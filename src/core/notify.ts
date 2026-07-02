import { logger } from './logger';

/**
 * Best-effort Telegram notification via the same bot the contact form uses
 * (TG_BOT_TOKEN + TG_CHAT_ID). Used by the generation pipeline to tell the
 * owner a draft is ready for review (or that a run failed). Never throws;
 * returns whether the message was delivered.
 */
export async function sendTelegramMessage(html: string): Promise<boolean> {
  const botToken = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!botToken || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) logger.warn(`Telegram notify failed: HTTP ${res.status}`, undefined, 'NOTIFY');
    return res.ok;
  } catch (error) {
    logger.warn('Telegram notify failed', error, 'NOTIFY');
    return false;
  }
}

/** Escape user/model-controlled text for Telegram parse_mode=HTML. */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
