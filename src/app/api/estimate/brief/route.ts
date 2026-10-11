import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/core/logger';
import { createDailyBudget, positiveNumberOr } from '@/shared/utils/dailyBudget';
import { getClientIp, rateLimit } from '@/shared/utils/rateLimit';
import { createBriefAllowance } from '@/modules/estimator/ai-brief/allowance';
import { BRIEF_LOCALES, MAX_IDEA_CHARS, type BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { runBrief, type BriefRun } from '@/modules/estimator/ai-brief/orchestrator';
import { totalRedactions } from '@/modules/estimator/ai-brief/scrub';
import { BRIEF_STREAM_CONTENT_TYPE, encodeBriefEvent, type BriefStreamEvent } from '@/modules/estimator/ai-brief/stream';

/**
 * POST /api/estimate/brief  { idea: string, locale: 'uz' | 'ru' | 'en' }
 *
 * Plain-words idea → AI project brief: scope, lo-fi wireframes, an estimate
 * computed by the estimator engine (never by the model) and a localized
 * narrative. Unauthenticated and paid per call, so: ONE free brief per visitor
 * (IP) a day, per-IP burst + daily attempt limits, a per-instance daily
 * call/spend cap, contact details scrubbed before the model sees the text,
 * and the idea itself is never logged.
 *
 * Responses (`success` envelope like every route here):
 *   200 { success: true, data: { status: 'ok', brief } }
 *   200 { success: true, data: { status: 'rejected', reason } }        not a project / abusive / too short
 *   200 { success: true, data: { status: 'declined_policy', topics, note } } outside the published work policy
 *   429 { success: false, code: 'daily_limit' } + Retry-After           today's free brief is used (the UI's "come back tomorrow")
 *   4xx/5xx { success: false, code, error }                            code drives the UI's error state
 *
 * With `Accept: application/x-ndjson` (the page sends it) every check above
 * still answers with the same 4xx/503 JSON, but an accepted brief streams as
 * NDJSON instead: progress milestones, then one `result` or `error` line —
 * see `ai-brief/stream.ts`. The brief takes ~45s, so the page shows real
 * progress (and the priced scope at ~20s) rather than a spinner.
 */

// Scope call, then plan ∥ risks ∥ two wireframe halves, each with a k3 → k2.6
// fallback, inside a 110s pipeline deadline. Mirrored in vercel.json (the
// global API cap there is 30s).
export const maxDuration = 120;

const MAX_BODY_BYTES = 16 * 1024;
/** Requests per IP, delivered or not: blunts rapid retries and parallel submits. */
const BURST_LIMIT = { count: 3, windowMs: 10 * 60_000 };
/**
 * ONE free brief per visitor a day (founder decision 2026-10-10, was five).
 * The visitor is the IP until accounts exist. Only a delivered brief uses it:
 * a rejected, declined or failed run gives it back (`ai-brief/allowance.ts`).
 */
const DAILY_LIMIT_PER_IP = { count: 1, windowMs: 24 * 60 * 60_000 };
/**
 * Attempts per IP a day, delivered or not: room to rephrase an idea that came
 * back "too vague" while rejected runs (a paid scope call each) stay bounded.
 */
const DAILY_ATTEMPTS_PER_IP = { count: 5, windowMs: 24 * 60 * 60_000 };
/**
 * Cost held back per brief by the spend cap while it runs: ≈ $0.09–0.13 at
 * list price on en/ru pages, ≈ $0.21–0.26 on uz pages (the Uzbek copy-edit in
 * parallel chunks, round-3 live runs), plus room for a fallback.
 */
const RESERVE_USD = 0.3;
/**
 * Production default for the per-instance daily spend cap (USD); `AI_BRIEF_DAILY_USD` overrides it.
 * $3 (founder decision 2026-10-10, was $1.50): ~12 Uzbek briefs at ~$0.24 or 25–35 en/ru briefs at
 * $0.08–0.10 (list prices), counting the reserve the last brief must still fit.
 */
const DEFAULT_DAILY_USD = 3;
/**
 * Call cap, a backstop for the spend estimate. Not raised with the $3 cap: every priced brief costs
 * $0.06–0.31, so $3 is spent after ~10–50 briefs; only 150 back-to-back rejections at the cheapest
 * saved cost ($0.019) would stop at ~$2.90 instead.
 */
const DEFAULT_DAILY_CALLS = 150;

// An empty, zero or junk value falls back to the default, so it never lifts the cap by accident.
const budget = createDailyBudget({
  maxCalls: positiveNumberOr(process.env.AI_BRIEF_DAILY_CALLS, DEFAULT_DAILY_CALLS),
  maxUsd: positiveNumberOr(process.env.AI_BRIEF_DAILY_USD, DEFAULT_DAILY_USD),
  reserveUsd: RESERVE_USD,
});
const allowance = createBriefAllowance(DAILY_LIMIT_PER_IP);

type ErrorCode =
  | 'daily_limit'
  | 'rate_limited'
  | 'too_large'
  | 'invalid_input'
  | 'too_long'
  | 'busy'
  | 'ai_unavailable'
  | 'invalid_output'
  | 'timeout'
  | 'internal';

function fail(status: number, code: ErrorCode, error: string, headers?: Record<string, string>) {
  return NextResponse.json({ success: false, code, error }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Today's free brief is used: the page shows its friendly "come back tomorrow" state, not an error. */
function dailyLimit(retryAfterSec: number) {
  return fail(429, 'daily_limit', 'One free brief a day per visitor. Please come back tomorrow.', {
    'Retry-After': String(Math.max(1, retryAfterSec)),
  });
}

/** A run that ended without a brief gives the visitor's free brief back. */
function settleAllowance(ip: string, run: BriefRun | null): void {
  if (run?.outcome.status !== 'ok') allowance.refund(ip);
}

function isLocale(value: unknown): value is BriefLocale {
  return typeof value === 'string' && (BRIEF_LOCALES as readonly string[]).includes(value);
}

/** Spend + one outcome log line per brief — metadata only, never the idea text (visitor-written, may hold personal data). */
function recordRun(run: BriefRun, locale: BriefLocale): void {
  budget.record(run.totalCostUsd);
  logger.info(
    `brief ${run.outcome.status}${run.outcome.status === 'error' ? `:${run.outcome.code}` : ''} locale=${locale} model=${run.model ?? '-'} ` +
      `ms=${run.totalMs} cost=$${run.totalCostUsd.toFixed(4)} redactions=${totalRedactions(run.redactions)} attempts=${run.attempts.length}`,
    undefined,
    'AI_BRIEF'
  );
}

/**
 * The same pipeline as an NDJSON stream. A visitor who closes the tab only
 * stops the writes: the run finishes and is still counted against the budget
 * (and, when it delivers a brief, against the visitor's free brief).
 */
function streamBrief(idea: string, locale: BriefLocale, ip: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let isOpen = true;
      const send = (event: BriefStreamEvent) => {
        if (!isOpen) return;
        try {
          controller.enqueue(encoder.encode(encodeBriefEvent(event)));
        } catch {
          isOpen = false; // the client went away
        }
      };

      send({ type: 'accepted' });
      try {
        const run = await runBrief({ idea, locale }, { onProgress: progress => send({ type: 'progress', progress }) });
        recordRun(run, locale);
        settleAllowance(ip, run);
        send(run.outcome.status === 'error' ? { type: 'error', code: run.outcome.code } : { type: 'result', data: run.outcome });
      } catch (error) {
        budget.record(0); // release the reserve held for this brief
        settleAllowance(ip, null);
        logger.error('AI brief stream failed', error instanceof Error ? error.message : 'unknown error', 'AI_BRIEF');
        send({ type: 'error', code: 'internal' });
      }
      if (isOpen) controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': `${BRIEF_STREAM_CONTENT_TYPE}; charset=utf-8`,
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    // A visitor who already has today's brief hears that first, before any attempt is counted.
    const usedFor = allowance.retryAfter(ip);
    if (usedFor > 0) return dailyLimit(usedFor);
    const burst = rateLimit(`brief:burst:${ip}`, BURST_LIMIT.count, BURST_LIMIT.windowMs);
    const attempts = burst.allowed ? rateLimit(`brief:day:${ip}`, DAILY_ATTEMPTS_PER_IP.count, DAILY_ATTEMPTS_PER_IP.windowMs) : burst;
    if (!burst.allowed || !attempts.allowed) {
      return fail(429, 'rate_limited', 'Too many requests. Please try again later.', {
        'Retry-After': String(attempts.retryAfter || burst.retryAfter),
      });
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'Request body too large');

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail(400, 'invalid_input', 'Invalid JSON body');
    }
    if (!body || typeof body !== 'object' || typeof body.idea !== 'string') {
      return fail(400, 'invalid_input', 'Field "idea" (string) is required');
    }
    if (body.idea.trim().length > MAX_IDEA_CHARS) {
      return fail(400, 'too_long', `Idea is longer than ${MAX_IDEA_CHARS} characters`);
    }
    const locale: BriefLocale = isLocale(body.locale) ? body.locale : 'en';

    // Held from here; every path below that ends without a brief gives it back.
    if (!allowance.take(ip)) return dailyLimit(allowance.retryAfter(ip)); // a parallel request got it first
    if (!budget.tryStart()) {
      allowance.refund(ip);
      logger.warn('AI brief daily budget exhausted on this instance', budget.snapshot(), 'AI_BRIEF');
      return fail(503, 'busy', 'The AI brief is resting for today. Please use the estimator or contact us.');
    }

    const idea = body.idea;
    if ((request.headers.get('accept') ?? '').includes(BRIEF_STREAM_CONTENT_TYPE)) return streamBrief(idea, locale, ip);

    let run: BriefRun;
    try {
      run = await runBrief({ idea, locale });
    } catch (error) {
      budget.record(0); // release the reserve held for this brief
      settleAllowance(ip, null);
      throw error;
    }
    recordRun(run, locale);
    settleAllowance(ip, run);
    if (run.outcome.status === 'error') {
      return fail(503, run.outcome.code, 'The AI brief is temporarily unavailable. Please try again or use the estimator.');
    }
    return NextResponse.json({ success: true, data: run.outcome }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('AI brief route failed', error instanceof Error ? error.message : 'unknown error', 'AI_BRIEF');
    return fail(500, 'internal', 'Internal server error');
  }
}
