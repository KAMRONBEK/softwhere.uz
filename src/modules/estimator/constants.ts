/**
 * Pricing model v2 — calibrated to the Central Asia market (July 2026 research).
 *
 * Market anchors (Tashkent quality-agency band):
 *   · Clutch UZ list rates $25–49/hr are export-facing; effective local rates
 *     for quality agencies are $10–20/hr (median dev salary ≈ $745/mo ⇒
 *     fully-loaded ≈ $5–6/hr; IT Park residents pay 0% profit/VAT/social tax,
 *     so $14/hr blended keeps a healthy margin while beating the old $35/hr
 *     model that overpriced local work 3–5×).
 *   · Fixed-price sanity targets: landing $300–700 · corporate $800–1,500 ·
 *     e-commerce $1.2–3k · Telegram order bot $400–700 · Mini App $0.9–3k ·
 *     mobile MVP $3–8k · custom CRM $5–10k.
 */

/** Effective blended hourly rate (design+dev+QA+PM averaged), USD. */
export const BLENDED_RATE = 14;

/** Tier scales scope depth: QA rigor, edge cases, polish, documentation. */
export const TIER_MULTIPLIER = {
  mvp: 1.0,
  standard: 1.4,
  enterprise: 2.0,
} as const;

/** Design scope multiplier (client-provided designs are cheaper, custom UI adds). */
export const DESIGN_MULTIPLIER = {
  ready: 0.92,
  template: 1.0,
  custom: 1.15,
} as const;

export const URGENCY_MULTIPLIER = {
  flexible: 0.97,
  normal: 1.0,
  rush: 1.25,
} as const;

/**
 * Urgency effect on the CALENDAR (cost uses URGENCY_MULTIPLIER above): rush
 * buys a compressed schedule via parallel effort; flexible stretches it.
 * Derived from pre-urgency hours so paying +25% never shows a LONGER deadline.
 */
export const URGENCY_WEEKS_FACTOR = {
  flexible: 1.15,
  normal: 1.0,
  rush: 0.8,
} as const;

/** Extra UI language beyond the first (uz/ru/en is the regional norm). */
export const EXTRA_LANGUAGE_FACTOR = 0.06;

/**
 * Mobile platform/approach factors. Base hours assume cross-platform (Flutter/
 * RN) shipping to BOTH stores — the regional default. Native = per-platform
 * codebases.
 */
export const MOBILE_FACTOR = {
  cross_single: 0.94,
  cross_both: 1.0,
  native_single: 1.12,
  native_both: 1.55,
} as const;

/** Spread applied to the point estimate to build the honest range. */
export const RANGE_LOW = 0.85;
export const RANGE_HIGH = 1.3;

/** First-year support ≈ 10% of dev cost, shown as an optional monthly retainer. */
export const SUPPORT_RATE_YEARLY = 0.1;
export const SUPPORT_MONTHLY_MIN = 40;

/**
 * Delivery velocity in effective hours/week by project size (small teams work
 * one stream; bigger budgets parallelize).
 */
export const VELOCITY = [
  { maxHours: 120, hoursPerWeek: 30 },
  { maxHours: 400, hoursPerWeek: 45 },
  { maxHours: 900, hoursPerWeek: 70 },
  { maxHours: Infinity, hoursPerWeek: 95 },
] as const;

export const MIN_WEEKS = 1;

/** Server-side clamps for the AI refinement vs the formula estimate. */
export const AI_CLAMP = {
  costMinFactor: 0.6, // AI min may not go below 60% of formula min
  costMaxFactor: 1.6, // AI max may not exceed 160% of formula max
  weeksMinFactor: 0.5,
  weeksMaxFactor: 2.0,
} as const;
