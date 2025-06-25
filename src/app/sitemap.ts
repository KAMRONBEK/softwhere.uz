import { MetadataRoute } from 'next';
import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://softwhere.uz';
  const locales = ['uz', 'ru', 'en'];

  // Static pages
  const staticPages = ['', '/blog'];

  const staticUrls = locales.flatMap(locale =>
    staticPages.map(page => ({
      url: `${baseUrl}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: page === '' ? 1 : 0.8,
    }))
  );

  // Dynamic blog posts
  try {
    await dbConnect();
    const posts = await BlogPost.find({ status: 'published' }).select('slug locale updatedAt').lean();

    const blogUrls = posts.map(post => ({
      url: `${baseUrl}/${post.locale}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

    return [...staticUrls, ...blogUrls];
  } catch (error) {
    console.error('Error generating sitemap:', error);

    return staticUrls;
  }
}
