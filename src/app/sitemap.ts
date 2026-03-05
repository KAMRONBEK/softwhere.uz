import { MetadataRoute } from 'next';
import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';
import { BLOG_CONFIG, ENV } from '@/constants';
import { logger } from '@/utils/logger';
import { getSlugRoot } from '@/utils/slug';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = ENV.BASE_URL;
  const locales = ['uz', 'ru', 'en'] as const;

  const staticPages = ['', '/blog', '/estimator'];

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
      alternates: {
        languages: {
          'x-default': `${baseUrl}/${BLOG_CONFIG.DEFAULT_LOCALE}`,
          uz: `${baseUrl}/uz`,
          ru: `${baseUrl}/ru`,
          en: `${baseUrl}/en`,
        },
      },
    },
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
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: page === '' ? 1 : 0.8,
          alternates: { languages },
        };
      })
    ),
  ];

  try {
    await dbConnect();
    const posts = await BlogPost.find({ status: 'published' })
      .select('slug locale updatedAt createdAt generationGroupId')
      .sort({ createdAt: 1 })
      .lean();

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
    logger.error('Failed to generate dynamic sitemap URLs, serving static-only sitemap', error, 'SEO');
    return staticUrls;
  }
}
