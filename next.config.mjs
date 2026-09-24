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
      // softwhere.app is a brand-protection alias for the global (English)
      // audience, not a second site: every path 308s to softwhere.uz so the
      // alias never serves content. Listed first so the host-less /feed.xml
      // rule can't bounce alias traffic through a relative redirect. No capture
      // is ever empty, so Locations carry no trailing slash (one hop, not two).
      toSoftwhereUz('/', '/en'),
      toSoftwhereUz('/:keep(uz|ru|en|api|icons|images)', '/:keep'),
      toSoftwhereUz('/:keep(uz|ru|en|api|icons|images)/:rest+', '/:keep/:rest+'),
      // Root files: robots.txt, sitemap.xml, feed.xml, favicons, verification files.
      toSoftwhereUz('/:file([^/]+\\.[a-z0-9]+)', '/:file'),
      toSoftwhereUz('/:path+', '/en/:path+'),
      // Routing-layer redirect (zero function compute — cheaper than the
      // middleware 308 the locale-less feed would otherwise get).
      { source: '/feed.xml', destination: '/uz/feed.xml', permanent: true },
    ];
  },
};

// Optional trailing dot: `softwhere.app.` (FQDN) is routed here too.
const SOFTWHERE_APP_HOST = [{ type: 'host', value: '(?:www\\.)?softwhere\\.app\\.?' }];

function toSoftwhereUz(source, path) {
  return { source, has: SOFTWHERE_APP_HOST, destination: `https://softwhere.uz${path}`, permanent: true };
}

export default withNextIntl(nextConfig);
