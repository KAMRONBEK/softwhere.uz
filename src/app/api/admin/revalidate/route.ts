import { requireAdmin } from '@/core/auth';
import { logger } from '@/core/logger';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

// Only blog post paths may be targeted — this endpoint is not a generic
// cache-purge proxy.
const POST_PATH = /^\/(en|ru|uz)\/blog\/[^/]+$/;

/**
 * Bust the blog's ISR caches. Called by the GitHub Actions generator (Bearer
 * API_SECRET) right after auto-publishing, so new posts appear on the list,
 * feeds, and sitemap immediately instead of after the 1h revalidate window.
 * Also usable from the admin session.
 *
 * Body (optional): `{ paths: ["/uz/blog/<slug>", ...] }` — revalidates only
 * those post pages. Without it, every post page is purged (the pre-existing
 * behavior), which forces a full re-render of ~all posts as crawlers return —
 * a measurable Fluid CPU cost, so scripts should always send their paths.
 */
export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const paths: string[] = Array.isArray(body?.paths)
    ? body.paths.filter((p: unknown): p is string => typeof p === 'string' && POST_PATH.test(p)).slice(0, 100)
    : [];

  try {
    revalidateTag('blog-posts', 'max');
    if (paths.length > 0) {
      for (const path of paths) revalidatePath(path);
    } else {
      revalidatePath('/[locale]/blog/[slug]', 'page');
    }
    revalidatePath('/[locale]/blog', 'page');
    // Route handlers need literal paths (no dynamic-segment purging).
    for (const locale of ['en', 'ru', 'uz']) revalidatePath(`/${locale}/feed.xml`);
    revalidatePath('/sitemap.xml');
    logger.info(
      paths.length > 0
        ? `Blog caches revalidated via API (${paths.length} targeted post path(s))`
        : 'Blog caches revalidated via API (full purge)',
      undefined,
      'API'
    );
    return NextResponse.json({ success: true, targeted: paths.length });
  } catch (error) {
    logger.error('Failed to revalidate blog caches', error, 'API');
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}
