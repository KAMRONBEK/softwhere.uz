import { unstable_cache } from 'next/cache';
import { validateLocale } from '@/core/auth';
import { logWarn } from '@/core/logger';
import { listPublished, type PostSummary } from '../model/posts.repository';

// Shares the 'blog-posts' tag with the blog listing so admin writes bust both.
// No catch INSIDE the cached fn: a thrown error is never persisted (a failed
// background refresh keeps the previous good entry), while a returned []
// would be cached as a success for a day and hide the section.
// The window here also CLAMPS the homepage route's `revalidate` — keep it in
// sync with `revalidate = 86400` in app/[locale]/page.tsx. Freshness comes
// from the tag bust on publish, not this window.
const getCachedLatestPosts = unstable_cache(
  async (locale: string): Promise<PostSummary[]> => listPublished(validateLocale(locale, 'en'), 3),
  ['home-latest-posts'],
  { tags: ['blog-posts'], revalidate: 86400 }
);

/**
 * The three newest published posts in a locale, for the homepage's
 * latest-posts block. Never throws: with the DB unreachable and nothing
 * cached it returns [] and the homepage renders without the block.
 */
export async function getLatestPosts(locale: string): Promise<PostSummary[]> {
  try {
    return await getCachedLatestPosts(validateLocale(locale, 'en'));
  } catch (error) {
    logWarn('Latest posts unavailable', error instanceof Error ? error.message : 'unknown error');
    return [];
  }
}
