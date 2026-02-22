/** Hourly rate for quality agencies in UZ/KZ/RU */
export const HOURLY_RATE = 35;

/** Seniority hourly rates (USD) for reference */
export const SENIORITY_RATES = {
  senior: [18, 28],
  middle: [9, 18],
  junior: [4, 9],
} as const;

export const ESTIMATOR = {
  // Base hours per project type (core structure, navigation, setup)
  BASE_HOURS: {
    mobile: 200,
    web: 250,
    telegram: 150,
    ai: 250,
    desktop: 300,
    other: 200,
  } as Record<string, number>,

  // Hours per optional feature — keys from estimator-options
  FEATURE_HOURS: {
    camera: 35,
    gps: 22,
    notifications: 17,
    payments: 300, // Stripe, Braintree
    payments_regional: 250, // Payme, Click, Uzum, YooKassa, SberPay, etc.
    chat: 28,
    offline: 200,
    video: 300,
    biometric: 14,
    auth: 22,
    cms: 34,
    search: 17,
    analytics: 14,
    blog: 11,
    multilang: 20,
    api: 28,
    inline_keyboard: 11,
    webhooks: 14,
    miniapp: 57,
    llm: 57,
    rag: 71,
    embeddings: 42,
    finetuning: 114,
    api_integration: 34,
    autoupdate: 17,
    installer: 11,
    tray: 8,
    cloud_sync: 28,
    consulting: 14,
  } as Record<string, number>,

  // Hours per screen/page (13 screens ≈ 195h; base 200h = core structure)
  PAGE_HOURS: 15,

  // Multiplier applied based on project complexity
  COMPLEXITY_MULTIPLIER: {
    mvp: 1,
    standard: 1.5,
    enterprise: 2,
  },

  // Additional adjustment by tech-stack choice (percentage factor)
  TECH_STACK_ADJUSTMENT: {
    ios_native: 1.15,
    android_native: 1.15,
    swift_kotlin: 1.15,
    flutter: 0.95,
    react_native: 1,
    dotnet_maui: 1.05,
    nextjs: 1,
    remix: 1,
    nuxt: 1,
    react_vite: 0.98,
    vue: 0.98,
    angular: 1.1,
    nestjs: 1.1,
    express: 1,
    fastapi: 1,
    django: 1.05,
    go_gin: 1.05,
    dotnet: 1.1,
    rails: 1,
    laravel: 1,
    langchain: 1.05,
    openai_api: 1,
    electron: 1,
    tauri: 0.95,
    postgresql: 1,
    mongodb: 1,
    redis: 1.02,
    supabase: 0.95,
    firebase: 0.98,
  } as Record<string, number>,

  // Support rate applied to dev cost (percentage) — first year
  SUPPORT_RATE: 0.1,

  // Hours per dev week (for deadline calc); parallel iOS+Android ≈ 75h/week (16 weeks for 1200h)
  HOURS_PER_WEEK_SINGLE: 40,
  HOURS_PER_WEEK_PARALLEL: 75,
} as const;

export type FeatureKey = keyof typeof ESTIMATOR.FEATURE_HOURS;
export type TechnologyKey = keyof typeof ESTIMATOR.TECH_STACK_ADJUSTMENT;
