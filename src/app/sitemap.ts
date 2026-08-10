import { MetadataRoute } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { listForSitemap } from '@/modules/blog/model/posts.repository';
import { BLOG_CONFIG, ENV } from '@/core/constants';
import { logger } from '@/core/logger';
import { getSlugRoot } from '@/shared/utils/slug';

// ISR: regenerate at most once every 6h so newly published posts enter the
// sitemap without a redeploy. Without this the metadata route is prerendered
// once at build time and frozen — new posts stay absent until the next deploy.
//
// Deliberately still time-based (unlike the blog routes, which are now
// `revalidate = false`): this is a single low-traffic route, so the DB cost is
// a handful of wake-ups a day, and it keeps the self-healing property that
// stops the sitemap re-freezing if the /api/admin/revalidate call ever fails.
// Publishes still purge it immediately via revalidatePath('/sitemap.xml').
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = ENV.BASE_URL;
  const locales = ['uz', 'ru', 'en'] as const;

  const staticPages = [
    '',
    '/blog',
    '/estimator',
    '/services/web-development',
    '/services/mobile-apps',
    '/services/telegram-bots',
    '/privacy-policy',
  ];

  const staticUrls: MetadataRoute.Sitemap = [
    // No bare-root (`baseUrl`) entry: it 308-redirects to `/uz`, so listing it
    // would put a redirecting URL in the sitemap. The localized `/uz` `/ru` `/en`
    // roots below are the canonical, non-redirecting home URLs.
    ...locales.flatMap(locale =>
      staticPages.map(page => {
        const languages: Record<string, string> = {
          'x-default': `${baseUrl}/${BLOG_CONFIG.DEFAULT_LOCALE}${page}`,
          uz: `${baseUrl}/uz${page}`,
          ru: `${baseUrl}/ru${page}`,
          en: `${baseUrl}/en${page}`,
        };

        return {
          url: `${baseUrl}/${locale}${page}`,
          // No lastModified for static pages: stamping new Date() on every
          // sitemap render churned the field and trains Google to ignore it.
          changeFrequency: 'weekly' as const,
          priority: page === '' ? 1 : 0.8,
          alternates: { languages },
        };
      })
    ),
  ];

  try {
    const posts = await listForSitemap();

    // A zero-row read does NOT throw: it would fall through the success path
    // below and render the static-only sitemap anyway, logging nothing at all.
    // That is the same broken output as the catch, minus any trace of it. This
    // site always has published posts, so an empty result is a failure.
    if (posts.length === 0) {
      throw new Error('listForSitemap() returned zero published posts');
    }

    const canonicalByCluster = new Map<string, (typeof posts)[number]>();
    for (const post of posts) {
      const clusterKey = `${post.locale}:${getSlugRoot(post.slug)}`;
      const currentCanonical = canonicalByCluster.get(clusterKey);
      if (!currentCanonical || new Date(post.createdAt) < new Date(currentCanonical.createdAt)) {
        canonicalByCluster.set(clusterKey, post);
      }
    }
    const canonicalPosts = Array.from(canonicalByCluster.values());

    // Group posts by generationGroupId to build hreflang alternates
    const groupMap = new Map<string, Array<{ slug: string; locale: string }>>();
    for (const post of canonicalPosts) {
      if (post.generationGroupId) {
        if (!groupMap.has(post.generationGroupId)) {
          groupMap.set(post.generationGroupId, []);
        }
        groupMap.get(post.generationGroupId)!.push({
          slug: post.slug,
          locale: post.locale,
        });
      }
    }

    const blogUrls: MetadataRoute.Sitemap = canonicalPosts.map(post => {
      const siblings = post.generationGroupId ? (groupMap.get(post.generationGroupId) ?? []) : [];

      const alternates: Record<string, string> = {};
      for (const s of siblings) {
        alternates[s.locale] = `${baseUrl}/${s.locale}/blog/${encodeURIComponent(s.slug)}`;
      }
      if (Object.keys(alternates).length > 0) {
        alternates['x-default'] =
          alternates[BLOG_CONFIG.DEFAULT_LOCALE] || `${baseUrl}/${post.locale}/blog/${encodeURIComponent(post.slug)}`;
      }

      return {
        url: `${baseUrl}/${post.locale}/blog/${encodeURIComponent(post.slug)}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
        ...(Object.keys(alternates).length > 1 && {
          alternates: { languages: alternates },
        }),
      };
    });

    return [...staticUrls, ...blogUrls];
  } catch (error) {
    logger.error('Failed to generate dynamic sitemap URLs', error, 'SEO');

    // Returning `staticUrls` here used to be the failure mode itself. A metadata
    // route cannot set a status code, so a static-only list is a *successful*
    // render — Next persists it in the ISR cache for the full `revalidate`
    // window above, and every crawler that fetches in those 6h reads a valid,
    // error-free sitemap asserting the blog has no posts. That is exactly what
    // happened: Yandex recorded 21 URLs on 2026-07-30 and Google on 2026-08-04,
    // while the live sitemap had 174. Nothing purges it early either — the only
    // revalidatePath('/sitemap.xml') fires on publish.
    //
    // So at request time, throw. Next's response cache re-inserts the previous
    // (good) entry with a shortened 3–30s revalidate window and rethrows, so the
    // last correct sitemap keeps being served and regeneration is retried within
    // seconds of the DB coming back — instead of a wrong one sticking for 6h.
    // (`staticGenerationRetryCount` in next.config.mjs only ever applied to
    // renders that throw, so catching here had also disabled it.)
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      // Build time still degrades rather than breaking the deploy: the same
      // failure already makes generateStaticParams fall back to on-demand ISR
      // (see [locale]/blog/[slug]/page.tsx), and this sitemap is replaced by the
      // first successful revalidation.
      logger.warn('Static-only sitemap prerendered for this build — blog URLs unavailable (see the error above)', undefined, 'SEO');
      return staticUrls;
    }
    throw error;
  }
}
