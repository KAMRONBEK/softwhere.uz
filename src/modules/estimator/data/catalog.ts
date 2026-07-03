import type { EstimatorInput, ProjectType } from '@/modules/estimator/types';

/**
 * Estimator catalog v2 — calibrated for the Central Asia market (Tashkent
 * quality-agency band, researched July 2026):
 *   landing $300–700 · corporate site $800–1500 · e-commerce $1.2k–3k ·
 *   Telegram info bot $250–400 · order bot $400–700 · payments bot $700–1000 ·
 *   Mini App $900–3000 · mobile MVP (cross-platform) $3k–8k · custom CRM $5k–10k.
 *
 * All base/feature/integration numbers are HOURS; money comes from
 * constants.ts (blended rate). `featureFactor` models starter-kit reuse: an
 * agency doesn't build a web-shop cart from scratch every time, so feature
 * hours are discounted on subtypes with mature foundations. Ids double as
 * i18n keys under the `estimator` namespace: `subtype.<id>`, `feature.<id>`,
 * `integration.<id>` — tech entries carry hardcoded `label`s instead (proper
 * nouns need no translation).
 *
 * Calibration harness: `yarn tsx scripts/estimator-calibration.ts`.
 */

export interface SubtypeDef {
  id: string;
  /** Core build hours incl. `includedScreens` screens, setup, deploy. */
  baseHours: number;
  /** Screens covered by baseHours; extra screens cost `screenHours` each. */
  includedScreens: number;
  screenHours: number;
  defaultScreens: number;
  /** 0 ⇒ the screens slider is hidden (bots, AI backends, service work). */
  maxScreens: number;
  /** Hard floor for the displayed minimum price, USD. */
  minPrice: number;
  /** Starter-kit reuse discount applied to feature hours (1 = none). */
  featureFactor?: number;
  /** Feature ids pre-selected when this subtype is chosen ("popular for this"). */
  popular: string[];
  icon: string;
}

export interface ServiceDef {
  id: ProjectType;
  icon: string;
  subtypes: SubtypeDef[];
}

export type FeatureCategory = 'auth' | 'content' | 'commerce' | 'communication' | 'geo' | 'data' | 'ai' | 'platform';

export interface FeatureDef {
  id: string;
  category: FeatureCategory;
  hours: number;
  /** Per-type hour overrides (e.g. a "catalog" inside a Telegram bot is menus, not UI). */
  hoursFor?: Partial<Record<ProjectType, number>>;
  types: ProjectType[];
}

export type IntegrationGroup = 'payments_uz' | 'payments_intl' | 'messaging' | 'maps' | 'business' | 'gov';

export interface IntegrationDef {
  id: string;
  group: IntegrationGroup;
  hours: number;
  /** react-icons/si component name (see TechIcon); falls back to a letter chip. */
  icon?: string;
  /** Small flag/emoji rendered on the chip to signal the market. */
  flag?: string;
}

export type TechGroup = 'mobile' | 'frontend' | 'backend' | 'database' | 'cloud' | 'ai_stack' | 'cms';

export interface TechDef {
  id: string;
  /** Display name — proper nouns are identical across locales, so no i18n key. */
  label: string;
  group: TechGroup;
  icon?: string;
  /** Emoji fallback when there is no brand icon. */
  flag?: string;
  types: ProjectType[];
}

/* ------------------------------------------------------------------ */
/* Services & subtypes                                                 */
/* ------------------------------------------------------------------ */

export const SERVICES: ServiceDef[] = [
  {
    id: 'mobile',
    icon: '📱',
    subtypes: [
      // Bases assume cross-platform (Flutter/RN), both stores, basic backend+API.
      {
        id: 'ecommerce',
        baseHours: 175,
        includedScreens: 15,
        screenHours: 8,
        defaultScreens: 15,
        maxScreens: 60,
        minPrice: 3500,
        featureFactor: 0.85,
        popular: ['catalog', 'cart_checkout', 'orders', 'push', 'search', 'admin_panel'],
        icon: '🛍️',
      },
      {
        id: 'delivery',
        baseHours: 185,
        includedScreens: 15,
        screenHours: 8,
        defaultScreens: 15,
        maxScreens: 60,
        minPrice: 4000,
        featureFactor: 0.85,
        popular: ['catalog', 'cart_checkout', 'orders', 'push', 'map_view', 'courier_tracking', 'admin_panel'],
        icon: '🛵',
      },
      {
        id: 'booking',
        baseHours: 155,
        includedScreens: 12,
        screenHours: 8,
        defaultScreens: 12,
        maxScreens: 50,
        minPrice: 3200,
        featureFactor: 0.85,
        popular: ['auth_basic', 'orders', 'push', 'reviews', 'admin_panel'],
        icon: '📅',
      },
      {
        id: 'fintech',
        baseHours: 240,
        includedScreens: 15,
        screenHours: 9,
        defaultScreens: 15,
        maxScreens: 60,
        minPrice: 5000,
        featureFactor: 0.85,
        popular: ['auth_basic', 'otp_sms', 'push', 'dashboard', 'admin_panel'],
        icon: '💳',
      },
      {
        id: 'edtech',
        baseHours: 175,
        includedScreens: 14,
        screenHours: 8,
        defaultScreens: 14,
        maxScreens: 50,
        minPrice: 3500,
        featureFactor: 0.85,
        popular: ['auth_basic', 'push', 'file_upload', 'dashboard', 'admin_panel'],
        icon: '🎓',
      },
      {
        id: 'social',
        baseHours: 195,
        includedScreens: 15,
        screenHours: 8,
        defaultScreens: 15,
        maxScreens: 60,
        minPrice: 4000,
        featureFactor: 0.85,
        popular: ['auth_basic', 'profiles', 'chat', 'push', 'file_upload'],
        icon: '💬',
      },
      {
        id: 'business',
        baseHours: 150,
        includedScreens: 10,
        screenHours: 8,
        defaultScreens: 10,
        maxScreens: 40,
        minPrice: 2500,
        featureFactor: 0.85,
        popular: ['auth_basic', 'push', 'admin_panel'],
        icon: '🏢',
      },
      {
        id: 'custom_app',
        baseHours: 170,
        includedScreens: 12,
        screenHours: 8,
        defaultScreens: 12,
        maxScreens: 60,
        minPrice: 3000,
        featureFactor: 0.85,
        popular: ['auth_basic', 'push'],
        icon: '✨',
      },
    ],
  },
  {
    id: 'web',
    icon: '🖥️',
    subtypes: [
      {
        id: 'landing',
        baseHours: 23,
        includedScreens: 5,
        screenHours: 3,
        defaultScreens: 5,
        maxScreens: 12,
        minPrice: 300,
        popular: ['analytics_setup'],
        icon: '🚀',
      },
      {
        id: 'corporate',
        baseHours: 38,
        includedScreens: 8,
        screenHours: 4,
        defaultScreens: 8,
        maxScreens: 25,
        minPrice: 650,
        featureFactor: 0.7,
        popular: ['cms', 'analytics_setup'],
        icon: '🏛️',
      },
      {
        id: 'ecommerce',
        baseHours: 55,
        includedScreens: 15,
        screenHours: 4,
        defaultScreens: 15,
        maxScreens: 50,
        minPrice: 1300,
        featureFactor: 0.6,
        popular: ['catalog', 'cart_checkout', 'orders', 'search', 'admin_panel'],
        icon: '🛒',
      },
      {
        id: 'saas',
        baseHours: 130,
        includedScreens: 15,
        screenHours: 6,
        defaultScreens: 15,
        maxScreens: 60,
        minPrice: 2600,
        featureFactor: 0.8,
        popular: ['auth_basic', 'roles', 'dashboard', 'subscriptions', 'admin_panel'],
        icon: '☁️',
      },
      {
        id: 'portal',
        baseHours: 170,
        includedScreens: 20,
        screenHours: 6,
        defaultScreens: 20,
        maxScreens: 80,
        minPrice: 3000,
        featureFactor: 0.8,
        popular: ['auth_basic', 'roles', 'search', 'marketplace_vendors', 'admin_panel'],
        icon: '🌐',
      },
      {
        id: 'crm',
        baseHours: 220,
        includedScreens: 20,
        screenHours: 6,
        defaultScreens: 20,
        maxScreens: 80,
        minPrice: 4000,
        featureFactor: 0.8,
        popular: ['auth_basic', 'roles', 'dashboard', 'reports_export', 'import_export'],
        icon: '📊',
      },
    ],
  },
  {
    id: 'telegram',
    icon: '✈️',
    subtypes: [
      {
        id: 'info_bot',
        baseHours: 12,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 220,
        popular: ['bot_broadcast'],
        icon: 'ℹ️',
      },
      {
        id: 'order_bot',
        baseHours: 10,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 420,
        popular: ['catalog', 'orders', 'bot_admin', 'bot_broadcast'],
        icon: '🛒',
      },
      {
        id: 'support_bot',
        baseHours: 16,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 340,
        popular: ['bot_admin'],
        icon: '🎧',
      },
      {
        id: 'miniapp',
        baseHours: 60,
        includedScreens: 8,
        screenHours: 6,
        defaultScreens: 8,
        maxScreens: 30,
        minPrice: 950,
        popular: ['catalog', 'cart_checkout', 'orders', 'admin_panel'],
        icon: '📲',
      },
      {
        id: 'bot_miniapp',
        baseHours: 75,
        includedScreens: 10,
        screenHours: 6,
        defaultScreens: 10,
        maxScreens: 30,
        minPrice: 1300,
        popular: ['catalog', 'cart_checkout', 'orders', 'bot_admin', 'bot_broadcast', 'admin_panel'],
        icon: '🤖',
      },
    ],
  },
  {
    id: 'ai',
    icon: '🤖',
    subtypes: [
      // Bases already ARE the AI core — populars only add optional extras.
      {
        id: 'chatbot',
        baseHours: 75,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 900,
        popular: [],
        icon: '💬',
      },
      {
        id: 'rag',
        baseHours: 115,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 1500,
        popular: ['file_upload'],
        icon: '📚',
      },
      {
        id: 'automation',
        baseHours: 85,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 1100,
        popular: [],
        icon: '⚙️',
      },
      {
        id: 'vision_speech',
        baseHours: 140,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 1800,
        popular: [],
        icon: '👁️',
      },
      {
        id: 'ai_integration',
        baseHours: 50,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 650,
        popular: [],
        icon: '🔌',
      },
    ],
  },
  {
    id: 'desktop',
    icon: '💻',
    subtypes: [
      {
        id: 'business_app',
        baseHours: 160,
        includedScreens: 12,
        screenHours: 7,
        defaultScreens: 12,
        maxScreens: 50,
        minPrice: 2800,
        featureFactor: 0.85,
        popular: ['auth_basic', 'roles', 'reports_export', 'autoupdate'],
        icon: '🏢',
      },
      {
        id: 'pos_kiosk',
        baseHours: 170,
        includedScreens: 10,
        screenHours: 7,
        defaultScreens: 10,
        maxScreens: 40,
        minPrice: 3200,
        featureFactor: 0.85,
        popular: ['barcode', 'printer_fiscal', 'offline', 'import_export'],
        icon: '🧾',
      },
      {
        id: 'utility',
        baseHours: 110,
        includedScreens: 8,
        screenHours: 7,
        defaultScreens: 8,
        maxScreens: 30,
        minPrice: 1800,
        featureFactor: 0.85,
        popular: ['autoupdate'],
        icon: '🛠️',
      },
    ],
  },
  {
    id: 'other',
    icon: '🧩',
    subtypes: [
      {
        id: 'integration_sync',
        baseHours: 70,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 900,
        popular: [],
        icon: '🔄',
      },
      {
        id: 'audit',
        baseHours: 36,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 500,
        popular: [],
        icon: '🔍',
      },
      {
        id: 'custom_project',
        baseHours: 100,
        includedScreens: 0,
        screenHours: 0,
        defaultScreens: 0,
        maxScreens: 0,
        minPrice: 1300,
        popular: [],
        icon: '✨',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

const ALL: ProjectType[] = ['mobile', 'web', 'telegram', 'ai', 'desktop', 'other'];
const APPS: ProjectType[] = ['mobile', 'web', 'desktop'];

export const FEATURES: FeatureDef[] = [
  // Auth & users
  { id: 'auth_basic', category: 'auth', hours: 10, types: APPS },
  { id: 'otp_sms', category: 'auth', hours: 10, hoursFor: { telegram: 6 }, types: ['mobile', 'web', 'telegram'] },
  { id: 'social_login', category: 'auth', hours: 8, types: ['mobile', 'web'] },
  { id: 'roles', category: 'auth', hours: 18, types: APPS },
  { id: 'profiles', category: 'auth', hours: 8, types: ['mobile', 'web'] },

  // Content & admin
  { id: 'admin_panel', category: 'content', hours: 36, hoursFor: { telegram: 24 }, types: ['mobile', 'web', 'telegram', 'ai'] },
  { id: 'cms', category: 'content', hours: 20, types: ['web'] },
  { id: 'blog', category: 'content', hours: 10, types: ['web'] },
  { id: 'file_upload', category: 'content', hours: 8, hoursFor: { telegram: 6 }, types: ['mobile', 'web', 'telegram', 'ai', 'desktop'] },
  { id: 'search', category: 'content', hours: 14, hoursFor: { telegram: 6 }, types: ['mobile', 'web', 'telegram'] },
  { id: 'reviews', category: 'content', hours: 10, types: ['mobile', 'web'] },
  { id: 'analytics_setup', category: 'content', hours: 5, types: ['mobile', 'web'] },

  // Commerce
  { id: 'catalog', category: 'commerce', hours: 20, hoursFor: { telegram: 8 }, types: ['mobile', 'web', 'telegram'] },
  { id: 'cart_checkout', category: 'commerce', hours: 26, hoursFor: { telegram: 10 }, types: ['mobile', 'web', 'telegram'] },
  { id: 'orders', category: 'commerce', hours: 18, hoursFor: { telegram: 8 }, types: ['mobile', 'web', 'telegram'] },
  { id: 'promo', category: 'commerce', hours: 12, hoursFor: { telegram: 6 }, types: ['mobile', 'web', 'telegram'] },
  { id: 'loyalty', category: 'commerce', hours: 22, hoursFor: { telegram: 10 }, types: ['mobile', 'web', 'telegram'] },
  { id: 'subscriptions', category: 'commerce', hours: 20, types: ['mobile', 'web'] },
  { id: 'marketplace_vendors', category: 'commerce', hours: 40, types: ['mobile', 'web'] },

  // Communication
  { id: 'push', category: 'communication', hours: 12, types: ['mobile'] },
  { id: 'chat', category: 'communication', hours: 32, types: ['mobile', 'web'] },
  { id: 'video_call', category: 'communication', hours: 60, types: ['mobile', 'web'] },
  { id: 'bot_admin', category: 'communication', hours: 10, types: ['telegram'] },
  { id: 'bot_broadcast', category: 'communication', hours: 6, types: ['telegram'] },

  // Maps & logistics
  { id: 'map_view', category: 'geo', hours: 10, types: ['mobile', 'web'] },
  { id: 'address_picker', category: 'geo', hours: 10, hoursFor: { telegram: 6 }, types: ['mobile', 'web', 'telegram'] },
  { id: 'courier_tracking', category: 'geo', hours: 32, types: ['mobile', 'web'] },
  { id: 'delivery_zones', category: 'geo', hours: 14, hoursFor: { telegram: 8 }, types: ['mobile', 'web', 'telegram'] },

  // Analytics & data
  { id: 'dashboard', category: 'data', hours: 26, types: APPS },
  { id: 'reports_export', category: 'data', hours: 16, types: APPS },
  { id: 'import_export', category: 'data', hours: 12, types: APPS },
  { id: 'realtime', category: 'data', hours: 28, types: ['mobile', 'web'] },

  // AI features
  { id: 'ai_chatbot', category: 'ai', hours: 44, hoursFor: { telegram: 30, ai: 30 }, types: ALL },
  { id: 'rag_kb', category: 'ai', hours: 60, hoursFor: { telegram: 45 }, types: ['web', 'telegram', 'ai'] },
  { id: 'speech', category: 'ai', hours: 32, types: ['mobile', 'web', 'telegram', 'ai'] },
  { id: 'vision', category: 'ai', hours: 40, types: ['mobile', 'web', 'ai'] },
  { id: 'recommendations', category: 'ai', hours: 40, types: ['mobile', 'web', 'ai'] },
  { id: 'ai_content', category: 'ai', hours: 24, types: ['web', 'telegram', 'ai'] },

  // Platform & infrastructure
  { id: 'offline', category: 'platform', hours: 50, types: ['mobile', 'desktop'] },
  { id: 'multi_tenant', category: 'platform', hours: 40, types: ['web'] },
  { id: 'highload', category: 'platform', hours: 60, types: ['mobile', 'web'] },
  { id: 'api_public', category: 'platform', hours: 24, types: ['mobile', 'web'] },
  { id: 'autoupdate', category: 'platform', hours: 14, types: ['desktop'] },
  { id: 'barcode', category: 'platform', hours: 12, types: ['mobile', 'desktop'] },
  { id: 'printer_fiscal', category: 'platform', hours: 24, types: ['desktop'] },
];

export const FEATURE_CATEGORIES: FeatureCategory[] = ['auth', 'content', 'commerce', 'communication', 'geo', 'data', 'ai', 'platform'];

/* ------------------------------------------------------------------ */
/* Integrations (the regional catalog)                                 */
/* ------------------------------------------------------------------ */

export const INTEGRATIONS: IntegrationDef[] = [
  // Payments — Uzbekistan (Payme + Click + Uzum cover >90% of the market)
  { id: 'payme', group: 'payments_uz', hours: 16, flag: '🇺🇿' },
  { id: 'click', group: 'payments_uz', hours: 14, flag: '🇺🇿' },
  { id: 'uzum_bank', group: 'payments_uz', hours: 14, flag: '🇺🇿' },
  { id: 'paynet', group: 'payments_uz', hours: 14, flag: '🇺🇿' },
  { id: 'visa_acquiring', group: 'payments_uz', hours: 14, flag: '💳' },
  { id: 'nasiya', group: 'payments_uz', hours: 18, flag: '🇺🇿' },
  { id: 'soliq_ofd', group: 'payments_uz', hours: 20, flag: '🧾' },

  // Payments — international & neighbors
  { id: 'stripe', group: 'payments_intl', hours: 16, icon: 'SiStripe' },
  { id: 'paypal', group: 'payments_intl', hours: 12, icon: 'SiPaypal' },
  { id: 'kaspi', group: 'payments_intl', hours: 24, flag: '🇰🇿' },
  { id: 'yookassa', group: 'payments_intl', hours: 12, flag: '🇷🇺' },

  // Messaging & notifications
  { id: 'eskiz_sms', group: 'messaging', hours: 6, flag: '🇺🇿' },
  { id: 'playmobile_sms', group: 'messaging', hours: 8, flag: '🇺🇿' },
  { id: 'telegram_channel', group: 'messaging', hours: 10, icon: 'SiTelegram' },
  { id: 'email_service', group: 'messaging', hours: 6, flag: '✉️' },

  // Maps & geo
  { id: 'yandex_maps', group: 'maps', hours: 10, flag: '🗺️' },
  { id: 'gis2', group: 'maps', hours: 10, flag: '🗺️' },
  { id: 'google_maps', group: 'maps', hours: 10, icon: 'SiGooglemaps' },

  // Business systems
  { id: 'onec', group: 'business', hours: 40, flag: '📒' },
  { id: 'bitrix24', group: 'business', hours: 18, flag: '📇' },
  { id: 'amocrm', group: 'business', hours: 16, flag: '📇' },
  { id: 'moysklad', group: 'business', hours: 16, flag: '📦' },
  { id: 'billz', group: 'business', hours: 16, flag: '🇺🇿' },
  { id: 'smartup', group: 'business', hours: 20, flag: '🇺🇿' },
  { id: 'sheets', group: 'business', hours: 8, icon: 'SiGooglesheets' },
  { id: 'custom_api', group: 'business', hours: 16, flag: '🔌' },

  // Government & identity (Uzbekistan)
  { id: 'oneid', group: 'gov', hours: 18, flag: '🇺🇿' },
  { id: 'myid', group: 'gov', hours: 30, flag: '🇺🇿' },
  { id: 'eimzo', group: 'gov', hours: 24, flag: '🔏' },
  { id: 'didox', group: 'gov', hours: 24, flag: '🧾' },
];

export const INTEGRATION_GROUPS: IntegrationGroup[] = ['payments_uz', 'payments_intl', 'messaging', 'maps', 'business', 'gov'];

/* ------------------------------------------------------------------ */
/* Technologies (informational; approach multiplier handled in engine) */
/* ------------------------------------------------------------------ */

export const TECH: TechDef[] = [
  // Mobile
  { id: 'flutter', label: 'Flutter', group: 'mobile', icon: 'SiFlutter', types: ['mobile'] },
  { id: 'react_native', label: 'React Native', group: 'mobile', icon: 'SiReact', types: ['mobile'] },
  { id: 'expo', label: 'Expo', group: 'mobile', icon: 'SiExpo', types: ['mobile'] },
  { id: 'swift', label: 'Swift (iOS)', group: 'mobile', icon: 'SiSwift', types: ['mobile'] },
  { id: 'kotlin', label: 'Kotlin (Android)', group: 'mobile', icon: 'SiKotlin', types: ['mobile'] },

  // Frontend
  { id: 'nextjs', label: 'Next.js', group: 'frontend', icon: 'SiNextdotjs', types: ['web', 'telegram', 'ai'] },
  { id: 'react', label: 'React', group: 'frontend', icon: 'SiReact', types: ['web', 'telegram', 'ai', 'desktop'] },
  { id: 'vue', label: 'Vue', group: 'frontend', icon: 'SiVuedotjs', types: ['web', 'telegram'] },
  { id: 'nuxt', label: 'Nuxt', group: 'frontend', icon: 'SiNuxtdotjs', types: ['web'] },
  { id: 'angular', label: 'Angular', group: 'frontend', icon: 'SiAngular', types: ['web'] },
  { id: 'svelte', label: 'Svelte', group: 'frontend', icon: 'SiSvelte', types: ['web', 'telegram'] },
  { id: 'astro', label: 'Astro', group: 'frontend', icon: 'SiAstro', types: ['web'] },
  { id: 'tailwind', label: 'Tailwind CSS', group: 'frontend', icon: 'SiTailwindcss', types: ['web', 'telegram'] },

  // Backend
  { id: 'laravel', label: 'Laravel (PHP)', group: 'backend', icon: 'SiLaravel', types: ['mobile', 'web', 'telegram'] },
  { id: 'nodejs', label: 'Node.js', group: 'backend', icon: 'SiNodedotjs', types: ['mobile', 'web', 'telegram', 'ai', 'desktop'] },
  { id: 'nestjs', label: 'NestJS', group: 'backend', icon: 'SiNestjs', types: ['mobile', 'web', 'telegram'] },
  { id: 'django', label: 'Django', group: 'backend', icon: 'SiDjango', types: ['mobile', 'web', 'ai'] },
  { id: 'fastapi', label: 'FastAPI', group: 'backend', icon: 'SiFastapi', types: ['mobile', 'web', 'telegram', 'ai'] },
  { id: 'python', label: 'Python', group: 'backend', icon: 'SiPython', types: ['telegram', 'ai'] },
  { id: 'spring', label: 'Java Spring', group: 'backend', icon: 'SiSpring', types: ['web', 'mobile'] },
  { id: 'dotnet', label: '.NET / C#', group: 'backend', icon: 'SiDotnet', types: ['web', 'desktop', 'mobile'] },
  { id: 'go', label: 'Go', group: 'backend', icon: 'SiGo', types: ['web', 'mobile', 'telegram'] },
  { id: 'php', label: 'PHP', group: 'backend', icon: 'SiPhp', types: ['web', 'telegram'] },

  // Databases & storage
  { id: 'postgresql', label: 'PostgreSQL', group: 'database', icon: 'SiPostgresql', types: ALL },
  { id: 'mysql', label: 'MySQL', group: 'database', icon: 'SiMysql', types: ['mobile', 'web', 'telegram', 'desktop'] },
  { id: 'mongodb', label: 'MongoDB', group: 'database', icon: 'SiMongodb', types: ['mobile', 'web', 'telegram', 'ai'] },
  { id: 'redis', label: 'Redis', group: 'database', icon: 'SiRedis', types: ['mobile', 'web', 'telegram', 'ai'] },
  { id: 'clickhouse', label: 'ClickHouse', group: 'database', icon: 'SiClickhouse', types: ['web', 'ai'] },
  { id: 'elasticsearch', label: 'Elasticsearch', group: 'database', icon: 'SiElasticsearch', types: ['web', 'mobile'] },
  { id: 'firebase', label: 'Firebase', group: 'database', icon: 'SiFirebase', types: ['mobile', 'web'] },
  { id: 'supabase', label: 'Supabase', group: 'database', icon: 'SiSupabase', types: ['mobile', 'web'] },

  // Cloud & DevOps
  { id: 'aws', label: 'AWS', group: 'cloud', icon: 'SiAmazonwebservices', types: ALL },
  { id: 'gcp', label: 'Google Cloud', group: 'cloud', icon: 'SiGooglecloud', types: ALL },
  { id: 'azure', label: 'Azure', group: 'cloud', flag: '☁️', types: ALL },
  { id: 'vercel', label: 'Vercel', group: 'cloud', icon: 'SiVercel', types: ['web'] },
  { id: 'docker', label: 'Docker', group: 'cloud', icon: 'SiDocker', types: ALL },
  { id: 'kubernetes', label: 'Kubernetes', group: 'cloud', icon: 'SiKubernetes', types: ['web', 'mobile', 'ai'] },
  { id: 'local_vps', label: 'UZ hosting (TAS-IX)', group: 'cloud', flag: '🇺🇿', types: ALL },
  { id: 'hetzner', label: 'Hetzner', group: 'cloud', icon: 'SiHetzner', types: ALL },

  // AI stack
  { id: 'openai', label: 'OpenAI GPT', group: 'ai_stack', icon: 'SiOpenai', types: ['mobile', 'web', 'telegram', 'ai'] },
  { id: 'claude', label: 'Anthropic Claude', group: 'ai_stack', icon: 'SiClaude', types: ['mobile', 'web', 'telegram', 'ai'] },
  { id: 'gemini', label: 'Google Gemini', group: 'ai_stack', icon: 'SiGooglegemini', types: ['mobile', 'web', 'telegram', 'ai'] },
  { id: 'local_llm', label: 'Local LLM (Llama)', group: 'ai_stack', icon: 'SiOllama', types: ['ai'] },
  { id: 'langchain', label: 'LangChain', group: 'ai_stack', icon: 'SiLangchain', types: ['ai', 'telegram', 'web'] },
  { id: 'whisper', label: 'Whisper (STT)', group: 'ai_stack', icon: 'SiOpenai', types: ['ai', 'telegram'] },

  // CMS & platforms
  { id: 'wordpress', label: 'WordPress', group: 'cms', icon: 'SiWordpress', types: ['web'] },
  { id: 'strapi', label: 'Strapi', group: 'cms', icon: 'SiStrapi', types: ['web', 'mobile'] },
  { id: 'directus', label: 'Directus', group: 'cms', icon: 'SiDirectus', types: ['web', 'mobile'] },

  // Desktop frameworks
  { id: 'electron', label: 'Electron', group: 'frontend', icon: 'SiElectron', types: ['desktop'] },
  { id: 'tauri', label: 'Tauri', group: 'frontend', icon: 'SiTauri', types: ['desktop'] },
  { id: 'qt', label: 'Qt', group: 'frontend', icon: 'SiQt', types: ['desktop'] },
];

export const TECH_GROUPS: TechGroup[] = ['mobile', 'frontend', 'backend', 'database', 'cloud', 'ai_stack', 'cms'];

/* ------------------------------------------------------------------ */
/* Lookups & helpers                                                   */
/* ------------------------------------------------------------------ */

export function getService(type: ProjectType): ServiceDef {
  return SERVICES.find(s => s.id === type) ?? SERVICES[0];
}

export function getSubtype(type: ProjectType, subtypeId: string): SubtypeDef {
  const service = getService(type);
  return service.subtypes.find(s => s.id === subtypeId) ?? service.subtypes[0];
}

export function featuresFor(type: ProjectType): FeatureDef[] {
  return FEATURES.filter(f => f.types.includes(type));
}

export function integrationsFor(type: ProjectType): IntegrationDef[] {
  // Maps make no sense for desktop line-of-business tools; everything else is
  // offerable across all service types.
  if (type === 'desktop') return INTEGRATIONS.filter(i => i.group !== 'maps');
  return INTEGRATIONS;
}

export function techFor(type: ProjectType): TechDef[] {
  return TECH.filter(t => t.types.includes(type));
}

export const FEATURE_BY_ID = new Map(FEATURES.map(f => [f.id, f]));
export const INTEGRATION_BY_ID = new Map(INTEGRATIONS.map(i => [i.id, i]));
export const TECH_BY_ID = new Map(TECH.map(t => [t.id, t]));

/** Effective hours for a feature on a given project type & subtype (reuse discount applied). */
export function effectiveFeatureHours(type: ProjectType, subtypeId: string, featureId: string): number {
  const feature = FEATURE_BY_ID.get(featureId);
  if (!feature) return 0;
  const base = feature.hoursFor?.[type] ?? feature.hours;
  const factor = getSubtype(type, subtypeId).featureFactor ?? 1;
  return Math.round(base * factor);
}

/** Whether the screens slider applies (bots/AI/service work have no screens). */
export function hasScreens(type: ProjectType, subtypeId: string): boolean {
  return getSubtype(type, subtypeId).maxScreens > 0;
}

/** Fresh input with sensible defaults for a service type (first subtype). */
export function defaultInputFor(type: ProjectType): EstimatorInput {
  const subtype = getService(type).subtypes[0];
  return {
    projectType: type,
    subtype: subtype.id,
    platforms: type === 'mobile' ? ['ios', 'android'] : [],
    approach: 'cross',
    tier: 'mvp',
    screens: subtype.defaultScreens,
    features: [...subtype.popular],
    integrations: [],
    techStack: [],
    autoTech: true,
    design: 'custom',
    languages: 2,
    urgency: 'normal',
    description: '',
  };
}

/** Applied when the subtype changes: keep user picks, merge in new populars. */
export function applySubtype(input: EstimatorInput, subtypeId: string): EstimatorInput {
  const def = getSubtype(input.projectType, subtypeId);
  const validFeatureIds = new Set(featuresFor(input.projectType).map(f => f.id));
  const merged = Array.from(new Set([...input.features, ...def.popular])).filter(id => validFeatureIds.has(id));
  return { ...input, subtype: subtypeId, screens: def.defaultScreens, features: merged };
}
