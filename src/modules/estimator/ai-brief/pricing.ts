import type { EstimateResult } from '@/modules/estimator/types';
import { roundMoney } from '@/modules/estimator/utils/estimator';
import { EN_RATE_HIGH, EN_RATE_LOW, type BriefLocale } from '@/modules/estimator/ai-brief/constants';
import type { BriefPrice } from '@/modules/estimator/ai-brief/types';

/**
 * Price shown on a brief, per the founder's rule:
 *  - uz / ru pages: the estimator engine's own range, unchanged (local market,
 *    blended $14/h with its subtype floors and friendly rounding).
 *  - en pages: low = engine low hours × $14, high = engine high hours × $40 —
 *    the same effort, quoted from the local rate up to an export-market rate.
 *    Rounded OUTWARD to the engine's friendly steps (never fake precision).
 *    The low end is floored at the engine's own $14/h quote, so rounding can
 *    never show an English visitor less than the uz/ru page quotes.
 *
 * Pure and deterministic: the model never touches a number on this path.
 */
export function priceForLocale(estimate: Pick<EstimateResult, 'cost' | 'hours'>, locale: BriefLocale): BriefPrice {
  if (locale !== 'en') {
    return { currency: 'USD', min: estimate.cost.min, max: estimate.cost.max, basis: 'local_engine' };
  }
  return {
    currency: 'USD',
    min: Math.max(roundMoney(estimate.hours.min * EN_RATE_LOW, 'down'), estimate.cost.min),
    max: roundMoney(estimate.hours.max * EN_RATE_HIGH, 'up'),
    basis: 'en_dual_rate',
  };
}

/** Sum of independent price ranges (e.g. main product + an extra deliverable). */
export function sumPrices(prices: BriefPrice[]): BriefPrice | null {
  if (prices.length === 0) return null;
  return prices.reduce((acc, p) => ({ ...acc, min: acc.min + p.min, max: acc.max + p.max }));
}
