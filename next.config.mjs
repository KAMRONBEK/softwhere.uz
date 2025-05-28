import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint configuration removed - all critical errors have been fixed
};

export default withNextIntl(nextConfig);
