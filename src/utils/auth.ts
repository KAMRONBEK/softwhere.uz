import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

const VALID_LOCALES = ['en', 'ru', 'uz'] as const;
type ValidLocale = (typeof VALID_LOCALES)[number];

export function verifyApiSecret(request: NextRequest): NextResponse | null {
  const apiSecret = process.env.API_SECRET;

  if (!apiSecret) {
    logger.error('API_SECRET not configured', undefined, 'AUTH');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export function isValidLocale(locale: string): locale is ValidLocale {
  return VALID_LOCALES.includes(locale as ValidLocale);
}

export function validateLocale(locale: string | null, fallback: ValidLocale = 'en'): ValidLocale {
  if (locale && isValidLocale(locale)) return locale;
  return fallback;
}

export { VALID_LOCALES, type ValidLocale };
