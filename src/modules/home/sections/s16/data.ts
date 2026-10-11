import { LAB_PROJECTS, getProjectBySlug } from '../../media/portfolio';

/**
 * Demo data for `web-build`; the words live in
 * src/messages/home/web-build/*.json (read through useS16Copy).
 *
 * The site in the browser is an example bakery ("Your Bakery"), not a client:
 * every number inside it (scores, vitals, visitors, orders) belongs to that
 * example and the browser says so. Studio facts are derived or sourced:
 * - the web-project count and the examples come from the portfolio data
 *   (platform "Web"), described without their names (founder, 2026-10-10);
 * - "3–4 weeks" is what the estimator gives a company site with an admin
 *   panel (web · corporate, 8 pages, CMS + analytics, standard tier;
 *   computed 2026-10-10). The step weeks add up to that;
 * - "What you get" uses the studio's standard terms (softwhere-proposal
 *   skill): code, repository, cloud accounts and domains in the client's
 *   name from day one, 12 months of bug fixes, a demo every week and a daily
 *   written update.
 */

export type StepId = 'wire' | 'design' | 'code' | 'checks' | 'content' | 'launch';
export type WidthMode = 'desktop' | 'tablet' | 'phone';

/** A step of the build; its words live in `steps.<id>` (term, when, text, get). */
export interface BuildStep {
  id: StepId;
}

export const STEPS: readonly BuildStep[] = [
  { id: 'wire' },
  { id: 'design' },
  { id: 'code' },
  { id: 'checks' },
  { id: 'content' },
  { id: 'launch' },
];

export const STEP_COUNT = STEPS.length;

/** The three layouts the example site is pre-rendered at, widest first. */
export const LAYOUTS: readonly WidthMode[] = ['desktop', 'tablet', 'phone'];
/** Virtual page widths (CSS px) each layout is laid out at. */
export const VIEWPORT_WIDTH: Record<WidthMode, number> = { desktop: 1280, tablet: 820, phone: 390 };

export const WEB_PROJECT_COUNT = LAB_PROJECTS.filter(project => project.platforms.includes('web')).length;

/** Web projects from the portfolio, described by kind without their names. A slug that leaves the data drops out. */
const WEB_EXAMPLE_SLUGS: readonly string[] = ['talim-ai', 'tes-tube', 'voltai', 'medrite'];

export const WEB_EXAMPLES = WEB_EXAMPLE_SLUGS.flatMap(slug => {
  const project = getProjectBySlug(slug);
  return project ? [project] : [];
});

export const DELIVER_IDS = ['site', 'admin', 'analytics', 'ownership', 'fixes'] as const;

/* ------------------------------------------------------------------------ */
/* The example site. Times follow the visitor's locale: 12-hour in English. */

export type Clock = '12h' | '24h';

export function clockForLocale(locale: string): Clock {
  return locale === 'en' ? '12h' : '24h';
}

/** An hour on the example site's clock ("8 AM" or "8:00"). */
export function formatHour(hour: number, clock: Clock): string {
  if (clock === '24h') return `${hour}:00`;
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
}

export type ArtId = 'loaf' | 'croissant' | 'bun';

/** The example site's hours: when the specials and each product come out, and opening hours. */
export const BAKERY_HOURS = { specialBefore: 8, specialAfter: 16, open: 7, close: 20 } as const;
export const PRODUCTS: ReadonlyArray<{ id: ArtId; outAt: number }> = [
  { id: 'loaf', outAt: 7 },
  { id: 'croissant', outAt: 8 },
  { id: 'bun', outAt: 16 },
];
export const NAV_IDS = ['menu', 'about', 'visit'] as const;

export type WireBlock = 'special' | 'logo' | 'nav' | 'order' | 'title' | 'text' | 'actions' | 'photo' | 'fresh' | 'footer';

export interface SiteCopy {
  brand: string;
  specialBefore: string;
  specialAfter: string;
  nav: readonly string[];
  navCta: string;
  navCtaShort: string;
  heroTitle: string;
  heroText: string;
  ctaPrimary: string;
  ctaSecondary: string;
  freshTitle: string;
  products: ReadonlyArray<{ id: ArtId; name: string; note: string }>;
  footer: string;
  hours: string;
  /** Wireframe labels, keyed by block. */
  wire: Record<WireBlock, string>;
}

/** The design panel's swatches, the checks panel's scores and vitals, the launch toasts: ids and values. */
export const SWATCH_IDS = ['brand', 'accent', 'ink', 'paper'] as const;
export const SCORES = [
  { id: 'perf', value: 98 },
  { id: 'a11y', value: 100 },
  { id: 'best', value: 100 },
  { id: 'seo', value: 100 },
] as const;
export const VITAL_IDS = ['lcp', 'inp', 'cls'] as const;
export const CHECK_ROW_IDS = ['local', 'meta', 'a11y'] as const;
export const ORDER_ITEM_IDS = ['croissants', 'loaf', 'buns', 'pistachio'] as const;
export const CODE_FILE = 'Menu.tsx';
export const HERO_PHOTO_FILE = 'sourdough.jpg';

/** Example traffic for the launch-day chart: visitors per hour, from opening time onwards. */
export const HOURLY_VISITORS = [6, 14, 22, 19, 25, 31, 28, 24, 30, 36, 33, 29] as const;
export const VISITORS_TODAY = HOURLY_VISITORS.reduce((sum, value) => sum + value, 0);
export const ORDERS_START = 9;
export const VISITORS_NOW_START = 12;
/** The live counter wanders inside this band. */
export const VISITORS_NOW_RANGE = [8, 19] as const;
/** Characters the visitor may type into the admin field. */
export const SPECIAL_MAX_LENGTH = 56;
