import { ICoverImage } from '@/models/BlogPost';
import { safeGenerateContent } from './ai';
import { logger } from './logger';

const UNSPLASH_API = 'https://api.unsplash.com';
const FETCH_TIMEOUT_MS = 5000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_UNSPLASH_CALLS = 10;

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

/** Ask Gemini for a visual keyword (returns null when quota-blocked or unavailable). */
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

async function searchUnsplashImage(keyword: string): Promise<Omit<ICoverImage, 'keyword'> | null> {
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
      per_page: '1',
      orientation: 'landscape',
    });

    const response = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    unsplashLimiter.record();

    if (!response.ok) {
      logger.error(`Unsplash API returned ${response.status}`, undefined, 'UNSPLASH');
      return null;
    }

    const data = await response.json();
    const photo: UnsplashPhoto | undefined = data?.results?.[0];

    if (!photo?.urls?.regular || !photo?.urls?.small || !photo?.user?.name || !photo?.user?.links?.html) {
      logger.warn('Unsplash returned no valid results', undefined, 'UNSPLASH');
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
 * Uses AI for keyword generation when available, falls back to deterministic extraction.
 */
export async function getCoverImageForTopic(title: string): Promise<ICoverImage | null> {
  try {
    let keyword = await generateImageKeyword(title);
    if (!keyword) {
      keyword = extractFallbackKeyword(title);
      logger.info(`Fallback keyword: "${keyword}" for title: "${title}"`, undefined, 'UNSPLASH');
    } else {
      logger.info(`AI keyword: "${keyword}" for title: "${title}"`, undefined, 'UNSPLASH');
    }

    const image = await searchUnsplashImage(keyword);
    if (image) return { ...image, keyword };

    return null;
  } catch (error) {
    logger.error('Unexpected error in getCoverImageForTopic', error, 'UNSPLASH');
    return null;
  }
}
