import { requireAdmin } from '@/core/auth';
import { logger } from '@/core/logger';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Bust the blog's ISR caches. Called by the GitHub Actions generator (Bearer
 * API_SECRET) right after auto-publishing, so new posts appear on the list,
 * feeds, and sitemap immediately instead of after the 1h revalidate window.
 * Also usable from the admin session.
 */
export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    revalidateTag('blog-posts', 'max');
    revalidatePath('/[locale]/blog/[slug]', 'page');
    revalidatePath('/[locale]/blog', 'page');
    // Route handlers need literal paths (no dynamic-segment purging).
    for (const locale of ['en', 'ru', 'uz']) revalidatePath(`/${locale}/feed.xml`);
    revalidatePath('/sitemap.xml');
    logger.info('Blog caches revalidated via API', undefined, 'API');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to revalidate blog caches', error, 'API');
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}
