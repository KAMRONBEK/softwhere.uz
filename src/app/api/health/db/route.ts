import { NextRequest, NextResponse } from 'next/server';
import { pingDb } from '@/modules/blog/model/posts.repository';
import { requireAdmin } from '@/core/auth';

/**
 * Deep health check — actually round-trips Postgres.
 *
 * Admin-only on purpose. Every call wakes the Neon compute, which then bills a
 * minimum 5 minutes of uptime; left public and unauthenticated, anything
 * polling this faster than that (a scanner, or an uptime monitor aimed here by
 * mistake) pins the compute at 100% and burns the whole free-tier CU-hour
 * budget. Point uptime monitoring at /api/health instead — it is public and
 * touches no database.
 */
export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const startTime = Date.now();

  try {
    await pingDb();

    return NextResponse.json({
      status: 'healthy',
      duration: `${Date.now() - startTime}ms`,
    });
  } catch {
    return NextResponse.json({ status: 'unhealthy' }, { status: 503 });
  }
}
