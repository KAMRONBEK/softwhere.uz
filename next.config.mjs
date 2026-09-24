import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin('./src/core/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // 30 days
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  experimental: {
    // Inline the (~18KB gz total) global CSS into the HTML instead of three
    // render-blocking stylesheet requests. Each round trip costs ~300ms+ for
    // far-from-region visitors (biggest slow cohort: China -> hkg1 edge).
    inlineCss: true,
    // Blog posts prerender at build via generateStaticParams (each render hits
    // Neon); retry transient DB blips instead of failing the whole deploy.
    staticGenerationRetryCount: 3,
  },
  async redirects() {
    return [
      // Routing-layer redirect (zero function compute — cheaper than the
      // middleware 308 the locale-less feed would otherwise get).
      { source: '/feed.xml', destination: '/uz/feed.xml', permanent: true },
      // softwhere.app is a brand-protection alias for the global (English)
      // audience, not a second site: 308 every path to softwhere.uz so no
      // duplicate content is served. Locale-prefixed paths and root files keep
      // their path; everything else lands on /en instead of the /uz default.
      {
        source: '/:keep(uz|ru|en|robots\\.txt|sitemap\\.xml)/:rest*',
        has: [{ type: 'host', value: '(?:www\\.)?softwhere\\.app' }],
        destination: 'https://softwhere.uz/:keep/:rest*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: '(?:www\\.)?softwhere\\.app' }],
        destination: 'https://softwhere.uz/en/:path*',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
