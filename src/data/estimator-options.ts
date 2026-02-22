/**
 * Hierarchical estimator options: service types, subtypes, features by category, tech stack.
 * Used by wizard steps and AI prompt context.
 * Tech stacks are separated: mobile/backend, web frontend/backend. Other/Consulting has no tech stack.
 */

export type ProjectType = 'mobile' | 'web' | 'telegram' | 'ai' | 'desktop' | 'other';
export type Complexity = 'mvp' | 'standard' | 'enterprise';

export type TechStackGroup = 'mobile' | 'backend' | 'web_frontend' | 'web_backend' | 'ai' | 'desktop';

export interface ServiceSubtype {
  id: string;
  labelKey: string;
  /** Feature IDs included in this subtype (not shown as additive options) */
  includedFeatures?: string[];
  /** Tech ID implied by subtype (e.g. electron for desktop.electron) */
  impliedTech?: string;
}

export interface FeatureOption {
  id: string;
  labelKey: string;
  price: number;
  category: string;
}

export interface TechOption {
  id: string;
  labelKey: string;
  group: TechStackGroup;
  serviceTypes: ProjectType[];
  impactFactor?: number;
}

export const SERVICE_TYPES: { id: ProjectType; labelKey: string; subtypes?: ServiceSubtype[] }[] = [
  {
    id: 'mobile',
    labelKey: 'service.mobile',
    subtypes: [
      { id: 'ios', labelKey: 'platform.ios' },
      { id: 'android', labelKey: 'platform.android' },
      { id: 'both', labelKey: 'platform.both' },
    ],
  },
  {
    id: 'web',
    labelKey: 'service.web',
    subtypes: [
      { id: 'landing', labelKey: 'subtype.landing' },
      { id: 'corporate', labelKey: 'subtype.corporate' },
      { id: 'ecommerce', labelKey: 'subtype.ecommerce' },
      { id: 'saas', labelKey: 'subtype.saas' },
      { id: 'portal', labelKey: 'subtype.portal' },
    ],
  },
  {
    id: 'telegram',
    labelKey: 'service.telegram',
    subtypes: [
      { id: 'bot', labelKey: 'subtype.bot' },
      { id: 'miniapp', labelKey: 'subtype.miniapp', includedFeatures: ['miniapp'] },
      { id: 'bot_miniapp', labelKey: 'subtype.botMiniapp', includedFeatures: ['miniapp'] },
    ],
  },
  {
    id: 'ai',
    labelKey: 'service.ai',
    subtypes: [
      { id: 'chatbot', labelKey: 'subtype.chatbot', includedFeatures: ['llm'] },
      { id: 'rag', labelKey: 'subtype.rag', includedFeatures: ['rag'] },
      { id: 'custom_ml', labelKey: 'subtype.customMl' },
      { id: 'integration', labelKey: 'subtype.integration' },
      { id: 'full_product', labelKey: 'subtype.fullProduct' },
    ],
  },
  {
    id: 'desktop',
    labelKey: 'service.desktop',
    subtypes: [
      { id: 'electron', labelKey: 'subtype.electron', impliedTech: 'electron' },
      { id: 'tauri', labelKey: 'subtype.tauri', impliedTech: 'tauri' },
      { id: 'native', labelKey: 'subtype.native' },
    ],
  },
  {
    id: 'other',
    labelKey: 'service.other',
    subtypes: [
      { id: 'consulting', labelKey: 'subtype.consulting' },
      { id: 'custom', labelKey: 'subtype.custom' },
      { id: 'erp_crm', labelKey: 'subtype.erpCrm' },
    ],
  },
];

export const FEATURES_BY_SERVICE: Record<ProjectType, FeatureOption[]> = {
  mobile: [
    { id: 'camera', labelKey: 'feature.camera', price: 1225, category: 'core' },
    { id: 'gps', labelKey: 'feature.gps', price: 770, category: 'core' },
    { id: 'notifications', labelKey: 'feature.notifications', price: 595, category: 'core' },
    { id: 'payments', labelKey: 'feature.payments', price: 10500, category: 'core' },
    { id: 'payments_regional', labelKey: 'feature.paymentsRegional', price: 8750, category: 'core' },
    { id: 'chat', labelKey: 'feature.chat', price: 980, category: 'core' },
    { id: 'offline', labelKey: 'feature.offline', price: 7000, category: 'core' },
    { id: 'video', labelKey: 'feature.video', price: 10500, category: 'media' },
    { id: 'biometric', labelKey: 'feature.biometric', price: 490, category: 'auth' },
  ],
  web: [
    { id: 'auth', labelKey: 'feature.auth', price: 770, category: 'core' },
    { id: 'cms', labelKey: 'feature.cms', price: 1190, category: 'core' },
    { id: 'payments', labelKey: 'feature.payments', price: 10500, category: 'core' },
    { id: 'payments_regional', labelKey: 'feature.paymentsRegional', price: 8750, category: 'core' },
    { id: 'search', labelKey: 'feature.search', price: 600, category: 'core' },
    { id: 'analytics', labelKey: 'feature.analytics', price: 500, category: 'core' },
    { id: 'blog', labelKey: 'feature.blog', price: 400, category: 'content' },
    { id: 'multilang', labelKey: 'feature.multilang', price: 700, category: 'content' },
    { id: 'api', labelKey: 'feature.api', price: 1000, category: 'integrations' },
  ],
  telegram: [
    { id: 'inline_keyboard', labelKey: 'feature.inlineKeyboard', price: 385, category: 'core' },
    { id: 'webhooks', labelKey: 'feature.webhooks', price: 490, category: 'core' },
    { id: 'payments', labelKey: 'feature.payments', price: 10500, category: 'core' },
    { id: 'payments_regional', labelKey: 'feature.paymentsRegional', price: 8750, category: 'core' },
    { id: 'miniapp', labelKey: 'feature.miniapp', price: 2000, category: 'advanced' },
  ],
  ai: [
    { id: 'llm', labelKey: 'feature.llm', price: 2000, category: 'core' },
    { id: 'rag', labelKey: 'feature.rag', price: 2500, category: 'core' },
    { id: 'embeddings', labelKey: 'feature.embeddings', price: 1500, category: 'core' },
    { id: 'finetuning', labelKey: 'feature.finetuning', price: 4000, category: 'advanced' },
    { id: 'api_integration', labelKey: 'feature.apiIntegration', price: 1200, category: 'advanced' },
  ],
  desktop: [
    { id: 'autoupdate', labelKey: 'feature.autoupdate', price: 600, category: 'core' },
    { id: 'installer', labelKey: 'feature.installer', price: 400, category: 'core' },
    { id: 'tray', labelKey: 'feature.tray', price: 300, category: 'core' },
    { id: 'cloud_sync', labelKey: 'feature.cloudSync', price: 1000, category: 'integrations' },
  ],
  other: [
    { id: 'consulting', labelKey: 'feature.consulting', price: 500, category: 'core' },
    { id: 'api', labelKey: 'feature.api', price: 1000, category: 'integrations' },
  ],
};

export const TECH_STACK_OPTIONS: TechOption[] = [
  // Mobile stack (app framework)
  { id: 'swift_kotlin', labelKey: 'tech.swiftKotlin', group: 'mobile', serviceTypes: ['mobile'], impactFactor: 1.15 },
  { id: 'flutter', labelKey: 'tech.flutter', group: 'mobile', serviceTypes: ['mobile'], impactFactor: 0.95 },
  { id: 'react_native', labelKey: 'tech.reactNative', group: 'mobile', serviceTypes: ['mobile'], impactFactor: 1 },
  { id: 'dotnet_maui', labelKey: 'tech.dotnetMaui', group: 'mobile', serviceTypes: ['mobile'], impactFactor: 1.05 },
  // Web frontend
  { id: 'nextjs', labelKey: 'tech.nextjs', group: 'web_frontend', serviceTypes: ['web'], impactFactor: 1 },
  { id: 'remix', labelKey: 'tech.remix', group: 'web_frontend', serviceTypes: ['web'], impactFactor: 1 },
  { id: 'nuxt', labelKey: 'tech.nuxt', group: 'web_frontend', serviceTypes: ['web'], impactFactor: 1 },
  { id: 'react_vite', labelKey: 'tech.reactVite', group: 'web_frontend', serviceTypes: ['web'], impactFactor: 0.98 },
  { id: 'vue', labelKey: 'tech.vue', group: 'web_frontend', serviceTypes: ['web'], impactFactor: 0.98 },
  { id: 'angular', labelKey: 'tech.angular', group: 'web_frontend', serviceTypes: ['web'], impactFactor: 1.1 },
  // Backend (shared by mobile, web, telegram, desktop)
  { id: 'nestjs', labelKey: 'tech.nestjs', group: 'backend', serviceTypes: ['web', 'telegram', 'mobile'], impactFactor: 1.1 },
  { id: 'express', labelKey: 'tech.express', group: 'backend', serviceTypes: ['web', 'telegram', 'mobile'], impactFactor: 1 },
  { id: 'fastapi', labelKey: 'tech.fastapi', group: 'backend', serviceTypes: ['web', 'ai', 'mobile'], impactFactor: 1 },
  { id: 'django', labelKey: 'tech.django', group: 'backend', serviceTypes: ['web', 'ai', 'mobile'], impactFactor: 1.05 },
  { id: 'go_gin', labelKey: 'tech.goGin', group: 'backend', serviceTypes: ['web', 'mobile'], impactFactor: 1.05 },
  { id: 'dotnet', labelKey: 'tech.dotnet', group: 'backend', serviceTypes: ['web', 'desktop', 'mobile'], impactFactor: 1.1 },
  { id: 'rails', labelKey: 'tech.rails', group: 'backend', serviceTypes: ['web'], impactFactor: 1 },
  { id: 'laravel', labelKey: 'tech.laravel', group: 'backend', serviceTypes: ['web'], impactFactor: 1 },
  // Backend DB/BaaS
  {
    id: 'postgresql',
    labelKey: 'tech.postgresql',
    group: 'backend',
    serviceTypes: ['mobile', 'web', 'telegram', 'ai', 'desktop'],
    impactFactor: 1,
  },
  { id: 'mongodb', labelKey: 'tech.mongodb', group: 'backend', serviceTypes: ['mobile', 'web', 'telegram', 'ai'], impactFactor: 1 },
  { id: 'redis', labelKey: 'tech.redis', group: 'backend', serviceTypes: ['web', 'ai', 'mobile'], impactFactor: 1.02 },
  { id: 'supabase', labelKey: 'tech.supabase', group: 'backend', serviceTypes: ['web', 'mobile'], impactFactor: 0.95 },
  { id: 'firebase', labelKey: 'tech.firebase', group: 'backend', serviceTypes: ['mobile', 'web'], impactFactor: 0.98 },
  // AI stack
  { id: 'langchain', labelKey: 'tech.langchain', group: 'ai', serviceTypes: ['ai'], impactFactor: 1.05 },
  { id: 'openai_api', labelKey: 'tech.openaiApi', group: 'ai', serviceTypes: ['ai'], impactFactor: 1 },
  // Desktop (only when subtype not already implied)
  { id: 'electron', labelKey: 'tech.electron', group: 'desktop', serviceTypes: ['desktop'], impactFactor: 1 },
  { id: 'tauri', labelKey: 'tech.tauri', group: 'desktop', serviceTypes: ['desktop'], impactFactor: 0.95 },
];

export const LANGUAGES: { id: string; labelKey: string }[] = [
  { id: 'typescript', labelKey: 'lang.typescript' },
  { id: 'python', labelKey: 'lang.python' },
  { id: 'go', labelKey: 'lang.go' },
  { id: 'csharp', labelKey: 'lang.csharp' },
  { id: 'ruby', labelKey: 'lang.ruby' },
  { id: 'php', labelKey: 'lang.php' },
  { id: 'swift', labelKey: 'lang.swift' },
  { id: 'kotlin', labelKey: 'lang.kotlin' },
  { id: 'dart', labelKey: 'lang.dart' },
];

/** Feature IDs included by subtype (e.g. rag when RAG subtype, miniapp when miniapp) — used in formula */
export function getSubtypeIncludedFeatures(serviceType: ProjectType, subtype?: string): string[] {
  const service = SERVICE_TYPES.find(s => s.id === serviceType);
  const sub = service?.subtypes?.find(s => s.id === subtype);
  return sub?.includedFeatures ?? [];
}

/** Tech ID implied by subtype (e.g. electron for desktop.electron) — used in formula */
export function getImpliedTechFromSubtype(serviceType: ProjectType, subtype?: string): string | undefined {
  const service = SERVICE_TYPES.find(s => s.id === serviceType);
  const sub = service?.subtypes?.find(s => s.id === subtype);
  return sub?.impliedTech;
}

/** Features to show; excludes those already included by selected subtype (e.g. RAG when RAG subtype, miniapp when miniapp) */
export function getFeaturesForService(serviceType: ProjectType, subtype?: string): FeatureOption[] {
  const all = FEATURES_BY_SERVICE[serviceType] ?? FEATURES_BY_SERVICE.other;
  const service = SERVICE_TYPES.find(s => s.id === serviceType);
  const sub = service?.subtypes?.find(s => s.id === subtype);
  const included = sub?.includedFeatures ?? [];
  return all.filter(f => !included.includes(f.id));
}

/** Tech stack options grouped by mobile/backend, web_frontend/web_backend, etc. Other/Consulting has no tech stack. */
export function getTechForService(
  serviceType: ProjectType,
  subtype?: string
): { group: TechStackGroup; labelKey: string; options: TechOption[] }[] {
  if (serviceType === 'other') return [];

  const service = SERVICE_TYPES.find(s => s.id === serviceType);
  const sub = service?.subtypes?.find(s => s.id === subtype);
  const impliedTech = sub?.impliedTech;

  const all = TECH_STACK_OPTIONS.filter(t => {
    if (!t.serviceTypes.includes(serviceType)) return false;
    if (impliedTech && t.id === impliedTech) return false; // desktop: electron/tauri already selected as subtype
    return true;
  });

  const groupLabels: Record<TechStackGroup, string> = {
    mobile: 'techGroup.mobile',
    backend: 'techGroup.backend',
    web_frontend: 'techGroup.webFrontend',
    web_backend: 'techGroup.webBackend',
    ai: 'techGroup.ai',
    desktop: 'techGroup.desktop',
  };

  const groups: TechStackGroup[] =
    serviceType === 'mobile'
      ? ['mobile', 'backend']
      : serviceType === 'web'
        ? ['web_frontend', 'backend'] // backend shown as "Backend" for web
        : serviceType === 'ai'
          ? ['ai', 'backend']
          : serviceType === 'desktop'
            ? ['backend'] // desktop framework already chosen in subtype
            : serviceType === 'telegram'
              ? ['backend']
              : [];

  const groupLabelOverride: Partial<Record<TechStackGroup, string>> = serviceType === 'web' ? { backend: 'techGroup.webBackend' } : {};

  return groups
    .map(group => ({
      group,
      labelKey: groupLabelOverride[group] ?? groupLabels[group],
      options: all.filter(t => t.group === group),
    }))
    .filter(g => g.options.length > 0);
}
