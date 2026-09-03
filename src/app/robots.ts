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
      // /_next/ is deliberately NOT disallowed: blocking it hides the CSS/JS
      // Google needs to render the page, and it puts "Page resources couldn't
      // be loaded" noise in URL Inspection. (experimental.inlineCss already
      // inlines most CSS, so nothing rendering-critical was blocked in
      // practice — this removes the footgun, not a live outage.)
      disallow: ['/admin/', '/*/admin/', '/api/'],
    },
    sitemap: `${ENV.BASE_URL}/sitemap.xml`,
  };
}
