import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/core/auth';
import { configuredProviders, getProviderBalances } from '@/core/ai';
import { logger } from '@/core/logger';
import { briefCaps } from '@/modules/estimator/ai-brief/caps';
import { isBriefProvider } from '@/modules/estimator/ai-brief/chains';
import { getBriefSettings, getBriefStats, setBriefProvider } from '@/modules/estimator/model/briefRuns.repository';

/**
 * GET /api/admin/ai-brief — the AI demo admin page: provider switch, live
 * provider balances, today's spend against the caps, usage and spend stats.
 * PUT /api/admin/ai-brief { provider: 'kimi' | 'deepseek' } — switch who
 * writes the briefs (every instance picks it up within ~30 s).
 */

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const [settings, stats, balances] = await Promise.all([getBriefSettings(), getBriefStats(), getProviderBalances()]);
    return NextResponse.json(
      { success: true, data: { settings, stats, balances, configured: configuredProviders(), caps: briefCaps() } },
      { headers: NO_STORE }
    );
  } catch (error) {
    logger.error('Failed to load AI brief admin data', error, 'API');
    return NextResponse.json({ success: false, error: 'Failed to load AI demo stats' }, { status: 500, headers: NO_STORE });
  }
}

export async function PUT(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }
  const provider = (body as { provider?: unknown } | null)?.provider;
  if (!isBriefProvider(provider)) {
    return NextResponse.json({ success: false, error: 'provider must be "kimi" or "deepseek"' }, { status: 400, headers: NO_STORE });
  }

  try {
    const settings = await setBriefProvider(provider);
    logger.info(`AI brief provider set to ${provider}`, undefined, 'AI_BRIEF');
    return NextResponse.json({ success: true, data: { settings } }, { headers: NO_STORE });
  } catch (error) {
    logger.error('Failed to save the AI brief provider', error, 'API');
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500, headers: NO_STORE });
  }
}
