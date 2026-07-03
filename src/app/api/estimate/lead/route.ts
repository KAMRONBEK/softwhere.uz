import { NextRequest, NextResponse, after } from 'next/server';
import { logger } from '@/core/logger';
import { escapeHtml } from '@/shared/utils/security';
import { getClientIp, rateLimit } from '@/shared/utils/rateLimit';
import { createLead, markLeadNotified } from '@/modules/contact/model/leads.repository';
import { sanitizeEstimatorInput } from '@/modules/estimator/utils/sanitize';
import { calculateEstimate, clampAiRange } from '@/modules/estimator/utils/estimator';
import { buildLeadSummaryLines } from '@/modules/estimator/utils/leadSummary';
import type { AiRefinement } from '@/modules/estimator/types';

const MAX_NAME = 200;
const MAX_PHONE = 50;
const MAX_COMMENT = 1000;
const MAX_BODY_BYTES = 32 * 1024;
const TG_TIMEOUT_MS = 8_000;

/**
 * Single-line sanitizer for fields that end up in the owner-facing Telegram
 * message and admin table: strips control chars (a NUL would even 500 the
 * Postgres INSERT) and Unicode bidi overrides, and collapses newlines so a
 * crafted name can't forge extra "Phone:"/"Estimate:" lines in the notification.
 */
function cleanLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Re-validate the client-echoed AI block; numbers get clamped vs the formula below. */
function parseAi(raw: unknown): {
  costMin: number;
  costMax: number;
  weeksMin: number;
  weeksMax: number;
  confidence: AiRefinement['confidence'];
  provider: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const cost = value.cost as Record<string, unknown> | undefined;
  const weeks = value.weeks as Record<string, unknown> | undefined;
  const numbers = [cost?.min, cost?.max, weeks?.min, weeks?.max].map(Number);
  if (!numbers.every(n => Number.isFinite(n) && n > 0 && n < 10_000_000)) return null;
  const provider = cleanLine(value.provider, 20);
  return {
    costMin: numbers[0],
    costMax: numbers[1],
    weeksMin: numbers[2],
    weeksMax: numbers[3],
    confidence: value.confidence === 'low' || value.confidence === 'high' ? value.confidence : 'medium',
    provider: /^[a-z0-9_-]+$/i.test(provider) ? provider : 'ai',
  };
}

export async function POST(request: NextRequest) {
  try {
    // Public endpoint that writes to the DB and pings Telegram — throttle per IP.
    const { allowed, retryAfter } = rateLimit(`estimate-lead:${getClientIp(request)}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'Request body too large' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const name = cleanLine(body.name, MAX_NAME);
    const phone = cleanLine(body.phone, MAX_PHONE);
    if (!name || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 });
    }

    const input = sanitizeEstimatorInput(body.input);
    if (!input) {
      return NextResponse.json({ success: false, error: 'Invalid estimator input' }, { status: 400 });
    }

    const comment = cleanLine(body.comment, MAX_COMMENT);
    const contact = body.contact === 'telegram' ? 'telegram' : 'call';
    const locale = typeof body.locale === 'string' && /^[a-z]{2}$/i.test(body.locale) ? body.locale.toLowerCase() : 'en';

    // Never trust client-side numbers for the record: recompute the formula,
    // and clamp the echoed AI block against it exactly like /api/estimate does
    // (an attacker could otherwise plant "AI says $1–$2" in the notification).
    const formula = calculateEstimate(input);
    const parsedAi = parseAi(body.ai);
    const ai: AiRefinement | null = parsedAi
      ? {
          ...clampAiRange(parsedAi, formula),
          summary: '',
          risks: [],
          suggestions: [],
          confidence: parsedAi.confidence,
          provider: parsedAi.provider,
        }
      : null;
    const summaryLines = buildLeadSummaryLines(input, formula, ai);

    // The client's own words are the one part we can never recompute — budget
    // them FIRST so a maximal config summary can't truncate them away.
    const messageParts = [
      comment ? `Client comment: ${comment}` : '',
      `Preferred contact: ${contact}`,
      `Locale: ${locale}`,
      ...summaryLines,
    ].filter(Boolean);

    // 1) Durably store the lead FIRST — Telegram is best-effort.
    let leadId: string;
    try {
      leadId = await createLead({
        name,
        phone,
        message: messageParts.join('\n').slice(0, 2000),
        source: 'estimator',
      });
    } catch (e) {
      // Don't pass the raw driver error to the logger: drizzle wraps failures
      // with the bound INSERT params (name/phone — PII) attached.
      logger.error('Failed to store estimator lead', e instanceof Error ? e.message : 'unknown error', 'ESTIMATE');
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }

    // 2) Telegram notification AFTER the response is sent (`after()`), so a
    //    slow/hung Telegram API can't stall the client into a false failure
    //    and a duplicate resubmission.
    const botToken = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_CHAT_ID;

    if (botToken && chatId) {
      after(async () => {
        try {
          const text = [
            '<b>🧮 Estimate request from softwhere.uz</b>',
            `<b>Name:</b> ${escapeHtml(name)}`,
            `<b>Phone:</b> ${escapeHtml(phone)}`,
            `<b>Contact via:</b> ${contact === 'telegram' ? 'Telegram' : 'Phone call'}`,
            comment ? `<b>Comment:</b> ${escapeHtml(comment)}` : '',
            '',
            ...summaryLines.map(line => escapeHtml(line)),
            `Locale: ${escapeHtml(locale)}`,
          ]
            .filter(Boolean)
            .join('\n');

          const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
            signal: AbortSignal.timeout(TG_TIMEOUT_MS),
          });

          if (!tgResponse.ok) {
            logger.error('Telegram API error', `Status: ${tgResponse.status}`, 'ESTIMATE');
          }
          await markLeadNotified(leadId, tgResponse.ok);
        } catch (e) {
          logger.error('Telegram notification failed', e instanceof Error ? e.message : 'unknown error', 'ESTIMATE');
          await markLeadNotified(leadId, false).catch(() => {});
        }
      });
    } else {
      logger.warn('Telegram credentials not configured; estimator lead stored without notification', undefined, 'ESTIMATE');
    }

    logger.info('Estimator lead captured', undefined, 'ESTIMATE');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Estimate lead route error', error, 'ESTIMATE');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
