export const ESTIMATOR = {
  // Base cost per project type (USD)
  BASE_COST: {
    mobile: 8000,
    web: 5000,
    telegram: 3000,
    desktop: 6000,
    other: 4000,
  },

  // Cost per optional feature (USD)
  FEATURE_PRICES: {
    camera: 1200,
    gps: 800,
    notifications: 600,
    payments: 900,
    chat: 1000,
    offline: 700,
  },

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
    flutter: 0.95,
    react_native: 1,
    nextjs: 1,
    nestjs: 1.1,
  },

  // Cost per screen / page (USD)
  PAGE_PRICE: 120,

  // Support rate applied to dev cost (percentage)
  SUPPORT_RATE: 0.15,
} as const;

export type FeatureKey = keyof typeof ESTIMATOR.FEATURE_PRICES;
export type TechnologyKey = keyof typeof ESTIMATOR.TECH_STACK_ADJUSTMENT;
