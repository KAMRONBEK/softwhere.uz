import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { escapeHtml } from '@/utils/security';
import { getClientIp, rateLimit } from '@/utils/rateLimit';

const MAX_FIELD_LENGTH = 2000;

export async function POST(request: NextRequest) {
  try {
    // Public, unauthenticated endpoint that notifies Telegram — throttle per IP
    // so it can't be used to flood the channel (and trip Telegram's own limits).
    const { allowed, retryAfter } = rateLimit(`contact:${getClientIp(request)}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const { name, phone, message, from } = await request.json();

    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 });
    }

    const botToken = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_CHAT_ID;

    if (!botToken || !chatId) {
      logger.error('Telegram credentials not configured', undefined, 'CONTACT');
      return NextResponse.json({ success: false, error: 'Service temporarily unavailable' }, { status: 503 });
    }

    // Escape every user-controlled field: the message is sent with
    // parse_mode=html, so raw `<`/`>`/`&` would otherwise let a submitter
    // inject markup/links into the admin's Telegram (phishing) or break the
    // message so Telegram 400s and silently drops it.
    const safeName = escapeHtml(String(name).slice(0, MAX_FIELD_LENGTH));
    const safePhone = escapeHtml(String(phone).slice(0, MAX_FIELD_LENGTH));
    const safeMessage = message ? escapeHtml(String(message).slice(0, MAX_FIELD_LENGTH)) : '';
    const safeFrom = from ? escapeHtml(String(from).slice(0, 50)) : '';

    const text =
      `<b>Message from softwhere.uz contact form ${safeFrom}:</b>\n` +
      `<b>\nName:</b> ${safeName}\n<b>Phone Number:</b> ${safePhone}${safeMessage ? `\n<b>Message:</b> ${safeMessage}` : ''}`;

    const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?parse_mode=html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!tgResponse.ok) {
      logger.error('Telegram API error', `Status: ${tgResponse.status}`, 'CONTACT');
      return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 502 });
    }

    logger.info('Contact message sent', undefined, 'CONTACT');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Contact route error', error, 'CONTACT');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
