import { revalidatePath, revalidateTag } from 'next/cache';
import { logger } from '@/core/logger';
import { getGroupSiblings, listPublishedByCategory } from '@/modules/blog/model/posts.repository';

const BLOG_LOCALES = ['en', 'ru', 'uz'] as const;

type PostRef = { locale: string; slug: string; generationGroupId?: string | null; category?: string | null };

/** Route path of one post page, in the form `revalidatePath` expects. */
export function postPath(locale: string, slug: string): string {
  return `/${locale}/blog/${slug}`;
}

/**
 * Every post page a write to `post` can change:
 * - the post itself;
 * - its published locale siblings, whose hreflang alternates embed this slug;
 * - its published category-mates, all locales — each post page bakes up to
 *   three "related articles" cards (title, slug, cover) from its category into
 *   static HTML with no time window, so a title, slug or status change on one
 *   post can leave any page in the category pointing at a stale or 404ing URL.
 * A bounded set (a category is ~12 posts), instead of every post on the site.
 * Falls back to the post's own path if a lookup fails — a partial purge beats
 * none, and the write itself has already succeeded.
 */
export async function pathsForPost(post: PostRef): Promise<string[]> {
  const own = postPath(post.locale, post.slug);
  try {
    const [siblings, mates] = await Promise.all([
      post.generationGroupId ? getGroupSiblings(post.generationGroupId) : Promise.resolve([]),
      post.category ? listPublishedByCategory(post.category) : Promise.resolve([]),
    ]);
    return [...new Set([own, ...siblings.map(s => postPath(s.locale, s.slug)), ...mates.map(m => postPath(m.locale, m.slug))])];
  } catch (error) {
    logger.warn('Could not resolve sibling/category paths for revalidation; purging the post path only', error, 'BLOG');
    return [own];
  }
}

/**
 * Bust every blog cache a post write can leave stale, in one place.
 *
 * - `blog-posts` tag: the blog index query and the homepage latest-posts block.
 * - Post detail pages: per-request `cache()`, not tagged, so they go by path.
 *   Pass the paths you know (see `pathsForPost`); the untargeted fallback
 *   re-renders every post as crawlers return, which is a measurable Fluid CPU
 *   cost, so it is reserved for callers that cannot know the paths and for a
 *   deliberate final sweep (e.g. after a consolidation batch).
 * - `/[locale]/blog`, the three RSS feeds and `/sitemap.xml`: route handlers
 *   need literal paths, and `listForSitemap()` is untagged raw Drizzle, so the
 *   tag alone never reaches the sitemap — before this helper the admin routes
 *   skipped it and an unpublish stayed in the sitemap for up to 6h.
 *
 * Returns false (after logging) if Next throws — an invalid path, or a call
 * outside a request context. The purge itself is fire-and-forget on Next's
 * side, so `true` means "accepted", not "applied". Callers keep going either
 * way: a stale cache is recoverable, a failed write response is not.
 */
export function revalidateBlogCaches(postPaths: readonly string[] = [], context = 'BLOG'): boolean {
  try {
    revalidateTag('blog-posts', 'max');
    if (postPaths.length > 0) {
      for (const path of postPaths) revalidatePath(path);
    } else {
      revalidatePath('/[locale]/blog/[slug]', 'page');
    }
    revalidatePath('/[locale]/blog', 'page');
    for (const locale of BLOG_LOCALES) revalidatePath(`/${locale}/feed.xml`);
    revalidatePath('/sitemap.xml');
    return true;
  } catch (error) {
    logger.error('Failed to revalidate blog caches', error, context);
    return false;
  }
}
