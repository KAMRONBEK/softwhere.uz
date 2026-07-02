import { MetadataRoute } from 'next';
import { ENV } from '@/core/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // /api/og must stay fetchable: og:image and BlogPosting JSON-LD point at
      // it, and Google can't use images its crawler is robots-blocked from.
      allow: ['/', '/api/og'],
      // Admin URLs are locale-prefixed (/uz/admin/...), so target both shapes.
      disallow: ['/admin/', '/*/admin/', '/api/', '/_next/'],
    },
    sitemap: `${ENV.BASE_URL}/sitemap.xml`,
  };
}
