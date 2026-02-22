import { MetadataRoute } from 'next';
import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://softwhere.uz';
  const locales = ['uz', 'ru', 'en'];

  const staticPages = ['', '/blog', '/estimator'];

  const staticUrls = locales.flatMap(locale =>
    staticPages.map(page => ({
      url: `${baseUrl}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: page === '' ? 1 : 0.8,
    }))
  );

  try {
    await dbConnect();
    const posts = await BlogPost.find({ status: 'published' }).select('slug locale updatedAt generationGroupId').lean();

    // Group posts by generationGroupId to build hreflang alternates
    const groupMap = new Map<string, Array<{ slug: string; locale: string }>>();
    for (const post of posts) {
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

    const blogUrls: MetadataRoute.Sitemap = posts.map(post => {
      const siblings = post.generationGroupId ? (groupMap.get(post.generationGroupId) ?? []) : [];

      const alternates: Record<string, string> = {};
      for (const s of siblings) {
        alternates[s.locale] = `${baseUrl}/${s.locale}/blog/${s.slug}`;
      }

      return {
        url: `${baseUrl}/${post.locale}/blog/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
        ...(Object.keys(alternates).length > 1 && {
          alternates: { languages: alternates },
        }),
      };
    });

    return [...staticUrls, ...blogUrls];
  } catch {
    return staticUrls;
  }
}
