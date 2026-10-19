// API Configuration
export const API_CONFIG = {
  BLOG_GENERATION_ENDPOINT: '/api/blog/generate',
  ADMIN_POSTS_ENDPOINT: '/api/admin/posts',
  BLOG_POSTS_ENDPOINT: '/api/blog/posts',
} as const;

// Blog Configuration
export const BLOG_CONFIG = {
  POSTS_PER_PAGE: 10,
  EXCERPT_LENGTH: 150,
  SUPPORTED_LOCALES: ['en', 'ru', 'uz'] as const,
  DEFAULT_LOCALE: 'uz' as const,
  GENERATION_TIMEOUT: 30000, // 30 seconds
} as const;

// UI Configuration
export const UI_CONFIG = {
  HEADER_HEIGHT: 120,
  SCROLL_THRESHOLD: 60,
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 3000,
} as const;

// Blog Categories
export const BLOG_CATEGORIES = {
  MOBILE_APP: 'mobile-app-development',
  TELEGRAM: 'telegram-development',
  WEB_DEV: 'web-development',
  BUSINESS: 'business-strategy',
  RANDOM: 'random',
} as const;

// Status Types
export const POST_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  MIXED: 'mixed',
} as const;

// Contact Information
export const CONTACT_INFO = {
  PHONE: '+998332499111',
  EMAIL: 'kamuranbek98@gmail.com',
} as const;

// Social Links
export const SOCIAL_LINKS = {
  TELEGRAM: 'https://t.me/softwhereuz',
  INSTAGRAM: 'https://instagram.com/softwhere.uz',
} as const;

// Environment Variables (with fallbacks)
export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY || '',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
  API_SECRET: process.env.API_SECRET || '',
  UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
  BASE_URL: (process.env.NEXT_PUBLIC_BASE_URL || 'https://softwhere.uz').trim().replace(/\/+$/, ''),
} as const;

// Open Graph locales (language_TERRITORY, as og:locale expects). The site's
// URL locales are bare language codes, which OG consumers do not recognise.
export const OG_LOCALE = { uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' } as const;

export type OgLocaleKey = keyof typeof OG_LOCALE;

/** `openGraph.locale` plus the other two locales as `alternateLocale`. */
export function ogLocaleFields(locale: OgLocaleKey): { locale: string; alternateLocale: string[] } {
  const others = (Object.keys(OG_LOCALE) as OgLocaleKey[]).filter(key => key !== locale);
  return { locale: OG_LOCALE[locale], alternateLocale: others.map(key => OG_LOCALE[key]) };
}
