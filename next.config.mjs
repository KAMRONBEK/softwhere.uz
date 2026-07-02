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
  },
};

export default withNextIntl(nextConfig);
