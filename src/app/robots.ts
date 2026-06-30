import { MetadataRoute } from 'next';
import { ENV } from '@/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Admin URLs are locale-prefixed (/uz/admin/...), so target both shapes.
      disallow: ['/admin/', '/*/admin/', '/api/', '/_next/'],
    },
    sitemap: `${ENV.BASE_URL}/sitemap.xml`,
  };
}
