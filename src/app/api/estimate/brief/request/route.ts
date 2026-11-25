import { NextRequest, NextResponse, after } from 'next/server';
import { ENV } from '@/core/constants';
import { logger } from '@/core/logger';
import { getClientIp, rateLimit } from '@/shared/utils/rateLimit';
import { createLeadOnce, markLeadNotified } from '@/modules/contact/model/leads.repository';
import { deliverRequest, parsePlanRequest } from '@/modules/estimator/ai-brief/planRequest';
import { IS_PLAN_LAUNCHED } from '@/modules/estimator/ai-brief/priceMode';

/**
 * POST /api/estimate/brief/request  { token?, idea?, name, contact, comment?, locale, website? }
 *
 * The visitor sends their AI plan and asks for a quote. The plan and the
 * engine's price come from the sealed token only; with a missing, expired or
 * forged token the lead is saved with the idea alone. 404 unless the site runs
 * outside 'range' mode (`priceMode.ts`).
 *
 *   200 { success: true, data: { plan: 'attached' | 'not_attached' } }
 *   400 invalid_input (+ field) · 413 too_large · 429 rate_limited · 503 not_stored
 */

const MAX_BODY_BYTES = 64 * 1024;
const RATE = { count: 5, windowMs: 60_000 };
const TG_TIMEOUT_MS = 8_000;
const LOG = 'PLAN_REQUEST';

function fail(status: number, code: string, extra?: Record<string, string>, headers?: Record<string, string>) {
  return NextResponse.json({ success: false, code, ...extra }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

async function notifyTelegram(text: string): Promise<boolean> {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) {
    logger.warn('Telegram credentials not configured; plan request not announced', undefined, LOG);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TG_TIMEOUT_MS),
    });
    if (!res.ok) logger.error('Telegram API error', `Status: ${res.status}`, LOG);
    return res.ok;
  } catch (error) {
    // The name only: a fetch error's message can carry the URL, and with it the bot token.
    logger.error('Telegram notification failed', error instanceof Error ? error.name : 'unknown error', LOG);
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!IS_PLAN_LAUNCHED) return fail(404, 'not_found');
  try {
    const { allowed, retryAfter } = rateLimit(`plan-request:${getClientIp(request)}`, RATE.count, RATE.windowMs);
    if (!allowed) return fail(429, 'rate_limited', undefined, { 'Retry-After': String(retryAfter) });

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return fail(413, 'too_large');
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail(400, 'invalid_input', { field: 'body' });
    }

    const now = Date.now();
    const parsed = parsePlanRequest(body, process.env.BRIEF_TOKEN_SECRET, now);
    if (!parsed.ok) return fail(400, 'invalid_input', { field: parsed.field });

    const isDelivered = await deliverRequest(parsed.value, {
      store: createLeadOnce,
      notify: notifyTelegram,
      markNotified: markLeadNotified,
      later: task => after(task),
      // Never the driver's error: drizzle attaches the bound params (name, contact) to it.
      onStoreError: () => logger.error('Failed to store plan request', undefined, LOG),
      adminUrl: `${ENV.BASE_URL}/en/admin/leads`,
      now,
    });
    if (!isDelivered) return fail(503, 'not_stored');
    return NextResponse.json(
      { success: true, data: { plan: parsed.value.plan ? 'attached' : 'not_attached' } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    logger.error('Plan request route failed', error instanceof Error ? error.name : 'unknown error', LOG);
    return fail(500, 'internal');
  }
}
