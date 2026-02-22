import { logger } from '@/core/logger';
import { NextResponse } from 'next/server';

const CACHE_MS = 24 * 60 * 60 * 1000; // 24 hours
const OPEN_ACCESS_URL = 'https://open.er-api.com/v6/latest/USD';

let cachedRates: { base: string; rates: Record<string, number>; timestamp: number } | null = null;

export async function GET() {
  try {
    if (cachedRates && Date.now() - cachedRates.timestamp < CACHE_MS) {
      return NextResponse.json({
        base: cachedRates.base,
        rates: cachedRates.rates,
      });
    }

    const apiKey = process.env.EXCHANGERATE_API_KEY;
    const url = apiKey ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD` : OPEN_ACCESS_URL;

    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) {
      logger.error(`Currency API failed: ${res.status}`, undefined, 'CURRENCY');
      return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 502 });
    }

    const data = (await res.json()) as Record<string, unknown>;

    if (data.result !== 'success' && !data.rates) {
      logger.error('Currency API returned invalid data', data, 'CURRENCY');
      return NextResponse.json({ error: 'Invalid response' }, { status: 502 });
    }

    const rates = (data.rates as Record<string, number>) ?? {};
    const base = (data.base_code as string) ?? 'USD';

    cachedRates = { base, rates, timestamp: Date.now() };

    return NextResponse.json({ base, rates });
  } catch (error) {
    logger.error('Currency API error', error, 'CURRENCY');

    return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 500 });
  }
}
