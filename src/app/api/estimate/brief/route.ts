import { NextRequest, NextResponse } from 'next/server';
import { configuredProviders } from '@/core/ai';
import { logger } from '@/core/logger';
import { createDailyBudget } from '@/shared/utils/dailyBudget';
import { getClientIp, rateLimit } from '@/shared/utils/rateLimit';
import { createBriefAllowance } from '@/modules/estimator/ai-brief/allowance';
import { briefCaps, OVERFLOW_RESERVE_USD, RESERVE_USD } from '@/modules/estimator/ai-brief/caps';
import { providerChainSet, type BriefProvider } from '@/modules/estimator/ai-brief/chains';
import { pickBriefLane, type BriefLane } from '@/modules/estimator/ai-brief/lanes';
import { BRIEF_LOCALES, MAX_IDEA_CHARS, type BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { runBrief, type BriefRun } from '@/modules/estimator/ai-brief/orchestrator';
import { briefRunRecord, busyRecord, visitorHash } from '@/modules/estimator/ai-brief/runRecord';
import { totalRedactions } from '@/modules/estimator/ai-brief/scrub';
import { BRIEF_STREAM_CONTENT_TYPE, encodeBriefEvent, type BriefStreamEvent } from '@/modules/estimator/ai-brief/stream';
import { getBriefProvider, recordBriefRun } from '@/modules/estimator/model/briefRuns.repository';

/**
 * POST /api/estimate/brief  { idea: string, locale: 'uz' | 'ru' | 'en' }
 *
 * Plain-words idea → AI project brief: scope, lo-fi wireframes, an estimate
 * computed by the estimator engine (never by the model) and a localized
 * narrative. Unauthenticated and paid per call, so: ONE free brief per visitor
 * (IP) a day, per-IP burst + daily attempt limits, a per-instance daily
 * call/spend cap, contact details scrubbed before the model sees the text,
 * and the idea itself is never logged. Once the day's main (Kimi) cap is
 * spent, briefs are served fully on deepseek-flash under their own smaller
 * cap (the overflow) before the route says it is resting for today.
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

// Scope call, then plan ∥ risks ∥ two wireframe halves, each with a fallback to the
// other provider (Kimi K3 ⇄ deepseek-flash, per the admin's switch), inside a 110s pipeline deadline. Mirrored in vercel.json (the
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
const caps = briefCaps();
const budget = createDailyBudget({ maxCalls: caps.mainCalls, maxUsd: caps.mainUsd, reserveUsd: RESERVE_USD });
/** Once the main cap is spent, briefs run on deepseek-flash under their own cap (`ai-brief/caps.ts`). */
const overflowBudget = createDailyBudget({ maxCalls: caps.overflowCalls, maxUsd: caps.overflowUsd, reserveUsd: OVERFLOW_RESERVE_USD });
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

/** Who sent a brief and how it ran: the stats row's context (`ai-brief/runRecord.ts`). */
interface RunContext {
  locale: BriefLocale;
  provider: BriefProvider;
  lane: BriefLane;
  ip: string;
}

/**
 * Spend, one outcome log line and one admin stats row per brief — metadata
 * only, never the idea text (visitor-written, may hold personal data) or the IP.
 */
async function recordRun(run: BriefRun, ctx: RunContext): Promise<void> {
  const { locale, lane } = ctx;
  lane.budget.record(run.totalCostUsd);
  logger.info(
    `brief ${run.outcome.status}${run.outcome.status === 'error' ? `:${run.outcome.code}` : ''} locale=${locale} provider=${ctx.provider} lane=${lane.name} model=${run.model ?? '-'} ` +
      `ms=${run.totalMs} cost=$${run.totalCostUsd.toFixed(4)} redactions=${totalRedactions(run.redactions)} attempts=${run.attempts.length}`,
    undefined,
    'AI_BRIEF'
  );
  await recordBriefRun(briefRunRecord(run, { locale, provider: ctx.provider, lane: lane.name, visitor: visitorHash(ctx.ip) }));
}

/**
 * The same pipeline as an NDJSON stream. A visitor who closes the tab only
 * stops the writes: the run finishes and is still counted against the budget
 * (and, when it delivers a brief, against the visitor's free brief).
 */
function streamBrief(idea: string, ctx: RunContext): Response {
  const { ip, lane } = ctx;
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
        const run = await runBrief(
          { idea, locale: ctx.locale },
          { ...lane.options, onProgress: progress => send({ type: 'progress', progress }) }
        );
        const recorded = recordRun(run, ctx); // the stats row is written while the result goes out
        settleAllowance(ip, run);
        send(run.outcome.status === 'error' ? { type: 'error', code: run.outcome.code } : { type: 'result', data: run.outcome });
        await recorded;
      } catch (error) {
        lane.budget.record(0); // release the reserve held for this brief
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
    const provider = await getBriefProvider();
    const lane = pickBriefLane(budget, overflowBudget, configuredProviders().includes('deepseek'), providerChainSet(provider));
    if (!lane) {
      allowance.refund(ip);
      await recordBriefRun(busyRecord({ locale, provider, visitor: visitorHash(ip) }));
      logger.warn(
        'AI brief daily budgets exhausted on this instance',
        { main: budget.snapshot(), overflow: overflowBudget.snapshot() },
        'AI_BRIEF'
      );
      return fail(503, 'busy', 'The AI brief is resting for today. Please use the estimator or contact us.');
    }

    const idea = body.idea;
    const ctx: RunContext = { locale, provider, lane, ip };
    if ((request.headers.get('accept') ?? '').includes(BRIEF_STREAM_CONTENT_TYPE)) return streamBrief(idea, ctx);

    let run: BriefRun;
    try {
      run = await runBrief({ idea, locale }, lane.options);
    } catch (error) {
      lane.budget.record(0); // release the reserve held for this brief
      settleAllowance(ip, null);
      throw error;
    }
    await recordRun(run, ctx);
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
