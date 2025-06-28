import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint configuration removed - all critical errors have been fixed

  // Handle redirects between www and non-www versions
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.softwhere.uz',
          },
        ],
        destination: 'https://softwhere.uz/:path*',
        permanent: true,
      },
    ];
  },

  // Handle rewrites for static files
  async rewrites() {
    return [
      {
        source: '/llms.txt',
        destination: '/llms.txt',
      },
      {
        source: '/llms-full.txt',
        destination: '/llms-full.txt',
      },
    ];
  },
};

export default withNextIntl(nextConfig);
