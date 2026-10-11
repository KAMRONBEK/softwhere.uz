import { positiveNumberOr } from '@/shared/utils/dailyBudget';

/**
 * The AI brief's per-instance daily caps (the route builds its budgets from
 * these; the admin page shows them next to the day's spend).
 */

/**
 * Cost held back per brief by the spend cap while it runs: ≈ $0.09–0.13 at
 * list price on en/ru pages, ≈ $0.21–0.26 on uz pages (the Uzbek copy-edit in
 * parallel chunks, round-3 live runs), plus room for a fallback.
 */
export const RESERVE_USD = 0.3;
/**
 * Production default for the per-instance daily spend cap (USD); `AI_BRIEF_DAILY_USD` overrides it.
 * $3 (founder decision 2026-10-10, was $1.50): ~12 Uzbek briefs at ~$0.24 or 25–35 en/ru briefs at
 * $0.08–0.10 (list prices), counting the reserve the last brief must still fit.
 */
export const DEFAULT_DAILY_USD = 3;
/**
 * Call cap, a backstop for the spend estimate. Not raised with the $3 cap: every priced brief costs
 * $0.06–0.31, so $3 is spent after ~10–50 briefs; only 150 back-to-back rejections at the cheapest
 * saved cost ($0.019) would stop at ~$2.90 instead.
 */
export const DEFAULT_DAILY_CALLS = 150;

/**
 * The overflow: once the main cap is spent, briefs run fully on deepseek-flash
 * (no Uzbek copy-edit, `chains.ts#overflowRunOptions`) under their own cap —
 * `AI_BRIEF_OVERFLOW_DAILY_USD`, $1 by default. A flash brief costs ~$0.01–0.03
 * (estimate incl. the 20% margin; peak hours double DeepSeek's price), so $1 is
 * ~30–100 more briefs; the reserve covers a peak-hour brief with a retry.
 * Without a DeepSeek key there is no overflow.
 */
export const OVERFLOW_RESERVE_USD = 0.05;
export const DEFAULT_OVERFLOW_DAILY_USD = 1;

export interface BriefCaps {
  mainUsd: number;
  mainCalls: number;
  overflowUsd: number;
  overflowCalls: number;
}

/** The caps in effect. An empty, zero or junk env value falls back to the default, so it never lifts a cap by accident. */
export function briefCaps(env: Record<string, string | undefined> = process.env): BriefCaps {
  return {
    mainUsd: positiveNumberOr(env.AI_BRIEF_DAILY_USD, DEFAULT_DAILY_USD),
    mainCalls: positiveNumberOr(env.AI_BRIEF_DAILY_CALLS, DEFAULT_DAILY_CALLS),
    overflowUsd: positiveNumberOr(env.AI_BRIEF_OVERFLOW_DAILY_USD, DEFAULT_OVERFLOW_DAILY_USD),
    overflowCalls: positiveNumberOr(env.AI_BRIEF_OVERFLOW_DAILY_CALLS, DEFAULT_DAILY_CALLS),
  };
}
