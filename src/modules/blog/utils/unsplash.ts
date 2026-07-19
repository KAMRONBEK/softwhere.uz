import { ICoverImage } from '@/modules/blog/model/BlogPost';
import { safeGenerateContent } from '@/core/ai';
import { logger } from '@/core/logger';

const UNSPLASH_API = 'https://api.unsplash.com';
const FETCH_TIMEOUT_MS = 5000;
// One page of candidates, so a caller excluding photos it already uses has
// alternatives to fall back on without paying for another request.
const SEARCH_PAGE_SIZE = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_UNSPLASH_CALLS = 20;

class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxCalls: number;
  private readonly windowMs: number;

  constructor(maxCalls: number, windowMs: number) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
  }

  canProceed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return this.timestamps.length < this.maxCalls;
  }

  record(): void {
    this.timestamps.push(Date.now());
  }
}

const unsplashLimiter = new RateLimiter(MAX_UNSPLASH_CALLS, RATE_LIMIT_WINDOW_MS);

function sanitizeKeyword(keyword: string): string {
  return keyword
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/** Ask the AI provider chain for a visual keyword (null when unavailable). */
async function generateImageKeyword(title: string): Promise<string | null> {
  const prompt = `Return 2-3 English keywords for a stock photo that would visually represent this blog topic: "${title}". Focus on visual concepts a photographer would capture, not technical jargon. Only output the keywords, space-separated.`;
  const text = await safeGenerateContent(prompt, 'image-keyword');
  if (!text) return null;
  const keyword = sanitizeKeyword(text.trim());
  return keyword || null;
}

/** Deterministic fallback: derive image-friendly keywords from title */
function extractFallbackKeyword(title: string): string {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'vs',
    'versus',
    'what',
    'how',
    'why',
    'when',
    'where',
    'which',
    'that',
    'this',
    'it',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'can',
    'need',
    'complete',
    'guide',
    'ultimate',
    'best',
    'top',
    'new',
    'your',
    'our',
  ]);
  const words = title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));
  const keyword = words.slice(0, 3).join(' ') || title.slice(0, 50);
  return sanitizeKeyword(keyword) || 'technology';
}

interface UnsplashPhoto {
  urls: { regular: string; small: string };
  user: { name: string; links: { html: string } };
}

/**
 * Search Unsplash for one landscape photo matching `keyword`.
 *
 * `excludeUrls` lets a caller skip photos it already uses. Searching a page of
 * candidates rather than only the top hit matters for generic queries: the top
 * result for "startup office" is stable, so a caller that re-queried hoping for
 * a different photo got the same one every time.
 */
async function searchUnsplashImage(keyword: string, excludeUrls?: ReadonlySet<string>): Promise<Omit<ICoverImage, 'keyword'> | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    logger.warn('UNSPLASH_ACCESS_KEY not set — add it for cover images', undefined, 'UNSPLASH');
    return null;
  }

  if (!unsplashLimiter.canProceed()) {
    logger.warn('Unsplash rate limit reached, skipping image search', undefined, 'UNSPLASH');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const params = new URLSearchParams({
      query: keyword,
      per_page: String(SEARCH_PAGE_SIZE),
      orientation: 'landscape',
    });

    const response = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    unsplashLimiter.record();

    // Surface the account's real hourly budget (Demo = 50/hr, Production =
    // 1000/hr). Lets a bulk backfill confirm the ceiling and pace itself.
    const rlLimit = response.headers.get('x-ratelimit-limit');
    const rlRemaining = response.headers.get('x-ratelimit-remaining');
    if (rlLimit) {
      logger.info(`Unsplash budget: ${rlRemaining ?? '?'}/${rlLimit} remaining this hour`, undefined, 'UNSPLASH');
    }

    if (!response.ok) {
      logger.error(`Unsplash API returned ${response.status}`, undefined, 'UNSPLASH');
      return null;
    }

    const data = await response.json();
    const results: UnsplashPhoto[] = Array.isArray(data?.results) ? data.results : [];
    const isComplete = (p: UnsplashPhoto | undefined): p is UnsplashPhoto =>
      Boolean(p?.urls?.regular && p?.urls?.small && p?.user?.name && p?.user?.links?.html);
    // Ranked order is preserved, so with nothing excluded this still picks the
    // top hit — the same photo `per_page=1` used to return.
    const photo = results.find(p => isComplete(p) && !excludeUrls?.has(p.urls.regular));

    if (!photo) {
      const reason = results.some(isComplete) ? 'all results already in use' : 'no valid results';
      logger.warn(`Unsplash: ${reason} for "${keyword}"`, undefined, 'UNSPLASH');
      return null;
    }

    return {
      url: photo.urls.regular,
      thumbUrl: photo.urls.small,
      authorName: photo.user.name,
      authorUrl: photo.user.links.html,
    };
  } catch (error) {
    logger.error('Failed to search Unsplash', error, 'UNSPLASH');
    return null;
  }
}

/**
 * Generates a cover image for a blog post topic.
 * When a curated keywordHint is provided (from SEO topic imageHints), uses it directly.
 * Otherwise falls back to AI keyword generation from the title.
 */
export async function getCoverImageForTopic(
  title: string,
  keywordHint?: string,
  excludeUrls?: ReadonlySet<string>
): Promise<ICoverImage | null> {
  try {
    let keyword: string;

    if (keywordHint) {
      keyword = sanitizeKeyword(keywordHint);
      logger.info(`Using curated keyword: "${keyword}" for title: "${title}"`, undefined, 'UNSPLASH');
    } else {
      const aiKeyword = await generateImageKeyword(title);
      if (aiKeyword) {
        keyword = aiKeyword;
        logger.info(`AI keyword: "${keyword}" for title: "${title}"`, undefined, 'UNSPLASH');
      } else {
        keyword = extractFallbackKeyword(title);
        logger.info(`Fallback keyword: "${keyword}" for title: "${title}"`, undefined, 'UNSPLASH');
      }
    }

    if (!keyword) return null;

    const image = await searchUnsplashImage(keyword, excludeUrls);
    if (image) return { ...image, keyword };

    return null;
  } catch (error) {
    logger.error('Unexpected error in getCoverImageForTopic', error, 'UNSPLASH');
    return null;
  }
}

/**
 * Fetches multiple images for inline use in a blog post.
 * Uses provided imageHints as keywords, falls back to AI-generated keywords.
 * Pass the chosen cover URL as `excludeUrl` so the hero photo is never reused
 * as an in-body illustration (live posts repeated it right below the hero).
 */
export async function getImagesForPost(imageHints: string[], fallbackTitle: string, excludeUrl?: string): Promise<ICoverImage[]> {
  const images: ICoverImage[] = [];
  const usedUrls = new Set<string>(excludeUrl ? [excludeUrl] : []);
  const hints =
    imageHints.length > 0
      ? [...imageHints, `${extractFallbackKeyword(fallbackTitle)} technology`]
      : [extractFallbackKeyword(fallbackTitle), `${extractFallbackKeyword(fallbackTitle)} business`];

  for (const hint of hints.slice(0, 4)) {
    if (images.length >= 3) break;
    try {
      const keyword = sanitizeKeyword(hint);
      if (!keyword) continue;

      const image = await searchUnsplashImage(keyword, usedUrls);
      if (image) {
        images.push({ ...image, keyword });
        usedUrls.add(image.url);
      }
    } catch (error) {
      logger.error(`Failed to fetch inline image for "${hint}"`, error, 'UNSPLASH');
    }
  }

  return images;
}
