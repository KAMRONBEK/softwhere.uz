import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
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

    const text =
      `<b>Message from softwhere.uz contact form ${from || ''}:</b>\n` +
      `<b>\nName:</b> ${name}\n<b>Phone Number:</b> ${phone}` +
      (message ? `\n<b>Message:</b> ${message}` : '');

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
