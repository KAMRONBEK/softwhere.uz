import { MetadataRoute } from 'next';
import { ENV } from '@/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/_next/'],
    },
    sitemap: `${ENV.BASE_URL}/sitemap.xml`,
  };
}
