import { LAB_PROJECTS } from '../../media/portfolio';

/**
 * Data for 08 · Mobile App; the words live in src/messages/home/mobile-build/*.json (read through useCopy).
 *
 * The weeks follow the same typical mobile MVP as 16 · Process (scope in
 * week 1, design in week 2, two-week sprints in weeks 3–8, release in week 9)
 * and the studio's own offer (a clickable prototype, weekly test builds, a
 * daily written update, code and accounts in the client's name, 12 months of
 * bug fixes). Price words, the same across 08, 16 and the AI brief: week 1
 * gives a price RANGE, week 2 the technical specification and the FIXED
 * price. The app on the phone is the visitor's own ("Your App"); no client is
 * named. The store count is derived from the portfolio data and the examples
 * are generic descriptions of live projects (media/descriptors), never names.
 */

export type StepId = 'scope' | 'wire' | 'design' | 'build' | 'test' | 'release';

/**
 * A step of the build. Its words (title, short, when, text, get) live in
 * `home.mobile-build.steps.<id>`; this keeps the order and the plan.
 */
export interface BuildStep {
  id: StepId;
  /** The step's bar on the 9-week plan: lane, start and end in weeks (0 = the start of week 1). */
  plan: { lane: 0 | 1 | 2; from: number; to: number };
}

export const STEPS: readonly BuildStep[] = [
  { id: 'scope', plan: { lane: 0, from: 0, to: 1 } },
  { id: 'wire', plan: { lane: 0, from: 1, to: 2 } },
  { id: 'design', plan: { lane: 1, from: 1, to: 7 } },
  { id: 'build', plan: { lane: 0, from: 2, to: 8 } },
  { id: 'test', plan: { lane: 2, from: 2, to: 9 } },
  { id: 'release', plan: { lane: 0, from: 8, to: 9 } },
];

/** Weeks on the plan (desktop timeline). */
export const PLAN_WEEKS = 9;

/**
 * Where the plan's playhead sits (in weeks) across each step's share of the
 * scroll: it sweeps week 1 to week 9 as the app grows on the phone. Testing
 * runs with every build, so its stretch is the final round before release.
 */
export const PLAYHEAD: ReadonlyArray<readonly [from: number, to: number]> = [
  [0, 1],
  [1, 2],
  [2, 2.6],
  [2.6, 8],
  [8, 8.6],
  [8.6, 9],
];

/**
 * Scroll length of each step, relative (the build step plays the longest
 * demo). The track is 100svh plus `STEP_UNIT_SVH` per unit; the registry
 * reserves the same length (see heights.css).
 */
export const STEP_WEIGHTS: readonly number[] = [1, 0.85, 1, 1.5, 1, 1.15];
export const STEP_UNIT_SVH = 45;

/** Live portfolio apps (the proof line's count). */
export const LIVE_PROJECTS = LAB_PROJECTS.filter(project => project.isLiveInStore);

/** Live portfolio apps to name by kind (founder's rule for story sections: what we built, never whose). */
const EXAMPLE_SLUGS: readonly string[] = ['tes-chat', 'driveme', 'vbrato', 'pulse', 'whoriddle'];

export const EXAMPLE_PROJECTS = EXAMPLE_SLUGS.flatMap(slug => LIVE_PROJECTS.filter(project => project.slug === slug));

/* ------------------------------------------------------------------------ */
/* Locale: the demo's money and clock, and the estimator's market.          */

export type Currency = 'usd' | 'uzs';
export type Market = 'intl' | 'uz';

export function currencyForLocale(locale: string): Currency {
  return locale === 'en' ? 'usd' : 'uzs';
}

export function marketForLocale(locale: string): Market {
  return locale === 'en' ? 'intl' : 'uz';
}

/** The phone's status-bar clock: 12-hour on the English site (as an iPhone in the US shows it). */
export function clockForLocale(locale: string): string {
  return locale === 'en' ? '6:30' : '18:30';
}

/**
 * What the estimator gives an app like the one on the phone. TRUE numbers:
 * src/modules/estimator/utils/estimator.ts → calculateEstimate, run
 * 2026-10-11 with the July 2026 pricing model for: mobile/delivery, iOS +
 * Android cross-platform, mvp, custom design, 2 languages, normal urgency,
 * 15 screens; features catalog, cart_checkout, orders, push, map_view,
 * courier_tracking, admin_panel; integrations stripe (intl) or click + payme
 * (uz). The same inputs for the booking example in 12 · AI demo reproduce
 * its $3,200–5,250. Re-run if the pricing constants change. Range and weeks
 * only: never rates or hours.
 */
export const ESTIMATE: Record<Market, { price: readonly [number, number]; weeks: readonly [number, number] }> = {
  intl: { price: [4700, 7500], weeks: [9, 10] },
  uz: { price: [4900, 7750], weeks: [9, 10] },
};

/**
 * The estimate's range in dollars, written the locale's way: "$4,700–$7,500"
 * in English, "4 900–7 750 $" in Russian and Uzbek (space-grouped, sign after).
 * Grouped by hand: browser ICU data for Uzbek is patchy, and the server must
 * render the same text.
 */
export function priceRange(market: Market, locale: string): string {
  const [min, max] = ESTIMATE[market].price;
  if (locale === 'en') {
    const usd = (value: number) => `$${value.toLocaleString('en-US')}`;
    return `${usd(min)}–${usd(max)}`;
  }
  return `${groupThousands(min)}–${groupThousands(max)}\u00a0$`;
}

/* ------------------------------------------------------------------------ */
/* The demo app: a food delivery app that belongs to the visitor.            */

function groupThousands(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

/** Minor units: cents for USD, whole so'm for UZS. Demo prices only. `soumUnit` comes from messages. */
export function formatPrice(amount: number, currency: Currency, soumUnit: string): string {
  if (currency === 'usd') return `$${(amount / 100).toFixed(2)}`;
  return `${groupThousands(amount)}\u00a0${soumUnit}`;
}

export type ArtKind = 'croissant' | 'pizza' | 'coffee' | 'salad';

/** A dish on the demo app's home screen; its name and shop line live in `dishes.<id>`. */
export interface Dish {
  id: ArtKind;
  art: ArtKind;
  price: Record<Currency, number>;
}

export const DISHES: readonly Dish[] = [
  { id: 'croissant', art: 'croissant', price: { usd: 290, uzs: 24000 } },
  { id: 'pizza', art: 'pizza', price: { usd: 950, uzs: 89000 } },
  { id: 'coffee', art: 'coffee', price: { usd: 380, uzs: 30000 } },
  { id: 'salad', art: 'salad', price: { usd: 640, uzs: 52000 } },
];

/** Category chips, in order (labels in `categories.<id>`). */
export const CATEGORY_IDS: readonly ArtKind[] = ['croissant', 'coffee', 'pizza', 'salad'];

export type NoteId = 'taps' | 'card' | 'track' | 'push' | 'points' | 'chat';

/** Sticky notes on the idea board (text in `notes.<id>`); `isLater` ones move to "Later" when scoped. */
export const NOTES: ReadonlyArray<{ id: NoteId; isLater: boolean }> = [
  { id: 'taps', isLater: false },
  { id: 'card', isLater: false },
  { id: 'track', isLater: false },
  { id: 'push', isLater: false },
  { id: 'points', isLater: true },
  { id: 'chat', isLater: true },
];

export const TRACK_STEP_IDS = ['accepted', 'cooking', 'onTheWay', 'delivered'] as const;
export const TAB_IDS = ['home', 'search', 'orders', 'profile'] as const;
export type TabId = (typeof TAB_IDS)[number];

export type TestDeviceId = 'ios-s' | 'ios-l' | 'and-l' | 'and-old' | 'tab' | 'slow';

/** The device lab (labels in `test.devices.<id>`). */
export const TEST_DEVICES: ReadonlyArray<{ id: TestDeviceId; shape: 'small' | 'tall' | 'phone' | 'tablet' }> = [
  { id: 'ios-s', shape: 'small' },
  { id: 'ios-l', shape: 'tall' },
  { id: 'and-l', shape: 'tall' },
  { id: 'and-old', shape: 'phone' },
  { id: 'tab', shape: 'tablet' },
  { id: 'slow', shape: 'phone' },
];

/** Versions shown in the demo (numbers, not words). */
export const BETA_VERSION = '1.0 (24)';
export const WEEKLY_BUILD_VERSION = '0.6 (31)';
export const STORE_NAMES = ['App Store', 'Google Play'] as const;
export const AGE_RATING = '4+';

/* Desktop satellites: small cards that float beside the phone. */
export const FLOW_SCREEN_IDS = ['home', 'dish', 'cart', 'track'] as const;
export const SWATCH_IDS = ['accent', 'second', 'ink', 'paper'] as const;
export const BUILD_PLATFORMS = ['iOS', 'Android'] as const;
export const BUILD_STACK = 'React Native · TypeScript';
export const BUILD_CODE = ['<AddButton', '  dish={croissant}', '  onPress={addToCart} />'] as const;
