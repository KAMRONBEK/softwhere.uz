import { ENV } from '@/core/constants';
import { logger } from '@/core/logger';

/**
 * IndexNow ping — tells Yandex/Bing about new or updated URLs within minutes
 * instead of waiting for a crawl. Yandex handles ~20% of Uzbekistan searches
 * (and co-founded the protocol); Google ignores IndexNow, which is fine.
 *
 * The key is public by design: the protocol verifies domain ownership by
 * fetching https://<host>/<key>.txt, which lives in /public.
 */
const INDEXNOW_KEY = '46b87b7e04b9d4a6adb8fc722995bde5';

export async function pingIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  try {
    const host = new URL(ENV.BASE_URL).host;
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${ENV.BASE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 100),
      }),
    });
    // 200/202 are success; anything else is only worth a log line.
    if (!res.ok && res.status !== 202) {
      logger.warn(`IndexNow ping returned HTTP ${res.status}`, undefined, 'SEO');
    } else {
      logger.info(`IndexNow pinged for ${urls.length} URL(s)`, undefined, 'SEO');
    }
  } catch (error) {
    logger.warn('IndexNow ping failed', error, 'SEO');
  }
}
