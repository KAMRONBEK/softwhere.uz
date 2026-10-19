/**
 * The site's service landing pages: URL slug → `servicePages.*` message
 * namespace. Slugs are stable URL segments (/[locale]/services/<slug>); the
 * service pages, the /services hub, the homepage OfferCatalog and the
 * homepage footer all read this one list.
 */
export const SERVICE_NAMESPACES = {
  'web-development': 'webDevelopment',
  'mobile-apps': 'mobileApps',
  'telegram-bots': 'telegramBots',
} as const;

export type ServiceSlug = keyof typeof SERVICE_NAMESPACES;

export type ServiceNamespace = (typeof SERVICE_NAMESPACES)[ServiceSlug];

export const SERVICE_SLUGS = Object.keys(SERVICE_NAMESPACES) as ServiceSlug[];
