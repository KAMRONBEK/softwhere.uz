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
  TELEGRAM: 'https://t.me/softwhere_uz',
  INSTAGRAM: 'https://instagram.com/softwhere.uz',
} as const;

// Environment Variables (with fallbacks)
export const ENV = {
  MONGODB_URI: process.env.MONGODB_URI || '',
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  API_SECRET: process.env.API_SECRET || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const; 