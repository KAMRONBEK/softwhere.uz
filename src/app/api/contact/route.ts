import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/core/logger';
import { escapeHtml } from '@/shared/utils/security';
import { getClientIp, rateLimit } from '@/shared/utils/rateLimit';
import { createLead, markLeadNotified } from '@/modules/contact/model/leads.repository';

const MAX_FIELD_LENGTH = 2000;

export async function POST(request: NextRequest) {
  try {
    // Public, unauthenticated endpoint — throttle per IP so it can't be used to
    // flood the DB / Telegram (and trip Telegram's own limits).
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

    const leadName = String(name).slice(0, MAX_FIELD_LENGTH);
    const leadPhone = String(phone).slice(0, MAX_FIELD_LENGTH);
    const leadMessage = message ? String(message).slice(0, MAX_FIELD_LENGTH) : null;
    const leadSource = from ? String(from).slice(0, 50) : null;

    // 1) Durably store the lead FIRST — this is the system of record, so a
    //    Telegram outage/misconfig can never lose a lead.
    let leadId: string;
    try {
      leadId = await createLead({ name: leadName, phone: leadPhone, message: leadMessage, source: leadSource });
    } catch (e) {
      logger.error('Failed to store lead', e, 'CONTACT');
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }

    // 2) Fire the instant Telegram notification (best-effort — the lead is
    //    already saved). Record the outcome so `failed` rows are a retry queue.
    const botToken = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_CHAT_ID;

    if (botToken && chatId) {
      try {
        // Escape every user-controlled field: sent with parse_mode=html, so raw
        // `<`/`>`/`&` would otherwise inject markup (phishing) or 400 the message.
        const safeName = escapeHtml(leadName);
        const safePhone = escapeHtml(leadPhone);
        const safeMessage = leadMessage ? escapeHtml(leadMessage) : '';
        const safeFrom = leadSource ? escapeHtml(leadSource) : '';

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
        }
        await markLeadNotified(leadId, tgResponse.ok);
      } catch (e) {
        logger.error('Telegram notification failed', e, 'CONTACT');
        await markLeadNotified(leadId, false).catch(() => {});
      }
    } else {
      logger.warn('Telegram credentials not configured; lead stored without notification', undefined, 'CONTACT');
    }

    // The lead is safely stored — always report success to the submitter.
    logger.info('Contact lead captured', undefined, 'CONTACT');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Contact route error', error, 'CONTACT');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
