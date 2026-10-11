/**
 * Data and scripted examples for 12 · ai-demo. Every word a visitor reads is
 * in src/messages/home/ai-demo/<locale>.json (useTranslations('home.ai-demo')).
 *
 * The scripted demo runs only when the app layer injects no real AI brief
 * (see LabSlots). Every number in it is TRUE: price and weeks are what the
 * estimator engine (src/modules/estimator/utils/estimator.ts →
 * calculateEstimate) returns for the scope in each example's `engine` note,
 * computed 2026-10-10 with the July 2026 pricing model. The English site
 * quotes like the real brief does (ai-brief/pricing.ts → priceForLocale 'en':
 * the engine's low effort at the local rate up to its high effort at the
 * export rate); the Uzbek and Russian sites show the engine's own range. If
 * the pricing constants change, re-run both and update the ranges.
 *
 * Payments follow the visitor's market: the English site shows Stripe (card
 * and Apple Pay, which Stripe accepts with no extra integration), the Uzbek
 * and Russian sites show Click and Payme. Each market has its own numbers,
 * and each locale's messages word its own market's payments.
 */

/**
 * Bubbling CustomEvent the injected real AI brief may dispatch from inside the
 * slot so the network reacts: detail 'idle' | 'thinking' | 'done'.
 */
export const AI_BRIEF_STATUS_EVENT = 'ai-brief:status';

/**
 * Bubbling CustomEvent with how far the real brief has got, from the server's
 * own milestones (AIBriefExperience → AI_BRIEF_STAGE_EVENT): the build rail
 * lights its steps from it.
 */
export const AI_BRIEF_STAGE_EVENT = 'ai-brief:stage';
export type BriefStage = 'idle' | 'reading' | 'scoped' | 'sketched' | 'done';

export type Market = 'intl' | 'uz';

export function marketForLocale(locale: string): Market {
  return locale === 'en' ? 'intl' : 'uz';
}

/** Wireframe block kinds: a lo-fi subset of the AI brief's BLOCK_KINDS, drawn in theme tokens. */
export type WireKind =
  | 'header'
  | 'bot-header'
  | 'search'
  | 'filters'
  | 'barbers'
  | 'week'
  | 'slots'
  | 'button'
  | 'nav-bar'
  | 'tabs'
  | 'card-grid'
  | 'chat'
  | 'keyboard'
  | 'cart'
  | 'pay'
  | 'form'
  | 'profile'
  | 'upload'
  | 'files'
  | 'note'
  | 'system';

export interface WireBlock {
  kind: WireKind;
  label?: string;
  items?: readonly string[];
  /** Secondary line per item (list rows). */
  meta?: readonly string[];
  /** Chat only: the first bubble is the phone owner's (right side). */
  startsOut?: boolean;
}

export interface DemoScreen {
  name: string;
  blocks: readonly WireBlock[];
}

export interface DemoExample {
  id: string;
  /** Short chip label. */
  chip: string;
  /** The idea as a visitor would type it. */
  idea: string;
  /** What the AI recognised. */
  kind: string;
  title: string;
  platforms: string;
  scope: readonly string[];
  screens: readonly [DemoScreen, DemoScreen, DemoScreen];
  weeks: { min: number; max: number };
  price: { min: number; max: number };
  /** Engine input the numbers came from (documentation, not rendered). */
  engine: string;
}

/** The scripted plan's four steps, in order (`steps.<id>`): the network's columns and the plan's parts. */
export const STEP_IDS = ['read', 'scope', 'sketch', 'price'] as const;

/** Design → Build → Launch (`phases.<id>`). */
export const PHASE_IDS = ['design', 'build', 'launch'] as const;

/**
 * The build rail between the heading and the real brief: what a plan is made
 * of, in the order the pipeline really makes it (the estimator prices the
 * scope the moment it is mapped; the screens are sketched after). The words,
 * features and screens are the composer's own placeholder idea (a yoga
 * studio): `rail.idea` marks the words that become features with <m>…</m>,
 * and the features after those are implied by the idea, not written in it.
 */
export const RAIL_STEP_IDS = ['idea', 'features', 'price', 'screens'] as const;
export const RAIL_FEATURE_IDS = ['booking', 'payments', 'waitlist', 'admin'] as const;
/** How many of the features are marked in the idea (the rest are implied). */
export const RAIL_MARKED_FEATURES = 3;

/** Weekday initials for the wireframe's week strip (`wire.week.<id>`). */
export const WEEKDAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Where each phase sits on the calendar, as shares of the shortest timeline (illustrative split). */
export const PHASES = [
  { start: 0, end: 0.24 },
  { start: 0.24, end: 0.82 },
  { start: 0.82, end: 1 },
] as const;

export function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}
