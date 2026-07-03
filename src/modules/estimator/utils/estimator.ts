import {
  AI_CLAMP,
  BLENDED_RATE,
  DESIGN_MULTIPLIER,
  EXTRA_LANGUAGE_FACTOR,
  MIN_WEEKS,
  MOBILE_FACTOR,
  RANGE_HIGH,
  RANGE_LOW,
  SUPPORT_MONTHLY_MIN,
  SUPPORT_RATE_YEARLY,
  TIER_MULTIPLIER,
  URGENCY_MULTIPLIER,
  URGENCY_WEEKS_FACTOR,
  VELOCITY,
} from '@/modules/estimator/constants';
import { FEATURE_BY_ID, INTEGRATION_BY_ID, effectiveFeatureHours, getSubtype, hasScreens } from '@/modules/estimator/data/catalog';
import type { BreakdownLine, EstimateResult, EstimatorInput, Range } from '@/modules/estimator/types';

/** Round money outward to friendly steps so ranges read honest, not fake-precise. */
function roundMoney(value: number, mode: 'down' | 'up'): number {
  const step = value >= 20000 ? 500 : value >= 5000 ? 250 : value >= 1000 ? 100 : 50;
  const fn = mode === 'down' ? Math.floor : Math.ceil;
  return fn(value / step) * step;
}

function velocityFor(hours: number): number {
  for (const band of VELOCITY) {
    if (hours <= band.maxHours) return band.hoursPerWeek;
  }
  return VELOCITY[VELOCITY.length - 1].hoursPerWeek;
}

/**
 * Pure formula estimate. Hours model:
 *   (base + extra screens + features) × tier × design × languages × mobile
 *   + integrations (fixed effort — a Payme hookup is the same job at any tier)
 *   , all × urgency; money = hours × blended rate, presented as a range with
 *   a per-subtype floor.
 */
export function calculateEstimate(input: EstimatorInput): EstimateResult {
  const def = getSubtype(input.projectType, input.subtype);
  const breakdown: BreakdownLine[] = [];

  // 1. Base + screens
  breakdown.push({ id: 'base', labelKey: `subtype.${def.id}`, hours: def.baseHours, kind: 'base' });
  let scopedHours = def.baseHours;

  if (hasScreens(input.projectType, input.subtype)) {
    const screens = Math.min(Math.max(input.screens, 1), def.maxScreens);
    const extra = Math.max(0, screens - def.includedScreens);
    if (extra > 0) {
      const screenHours = extra * def.screenHours;
      breakdown.push({ id: 'screens', labelKey: 'breakdown.extraScreens', hours: screenHours, kind: 'screens' });
      scopedHours += screenHours;
    }
  }

  // 2. Features (subtype-included populars that the user kept are counted;
  //    unknown ids are ignored so stale client payloads can't break the math)
  for (const id of input.features) {
    const feature = FEATURE_BY_ID.get(id);
    if (!feature || !feature.types.includes(input.projectType)) continue;
    const featureHours = effectiveFeatureHours(input.projectType, input.subtype, id);
    breakdown.push({ id, labelKey: `feature.${id}`, hours: featureHours, kind: 'feature' });
    scopedHours += featureHours;
  }

  // 3. Scope multipliers. Design only applies where a UI exists (bots/AI
  //    backends/service work carry no design phase).
  const tierMult = TIER_MULTIPLIER[input.tier] ?? 1;
  const designMult = hasScreens(input.projectType, input.subtype) ? (DESIGN_MULTIPLIER[input.design] ?? 1) : 1;
  const languages = Math.min(Math.max(input.languages || 1, 1), 3);
  const langMult = 1 + (languages - 1) * EXTRA_LANGUAGE_FACTOR;

  let mobileMult = 1;
  if (input.projectType === 'mobile') {
    const both = input.platforms.length !== 1;
    mobileMult =
      input.approach === 'native'
        ? both
          ? MOBILE_FACTOR.native_both
          : MOBILE_FACTOR.native_single
        : both
          ? MOBILE_FACTOR.cross_both
          : MOBILE_FACTOR.cross_single;
  }

  let hours = scopedHours * tierMult * designMult * langMult * mobileMult;

  // 4. Integrations — fixed effort, not scaled by tier/design
  for (const id of input.integrations) {
    const integration = INTEGRATION_BY_ID.get(id);
    if (!integration) continue;
    breakdown.push({ id, labelKey: `integration.${id}`, hours: integration.hours, kind: 'integration' });
    hours += integration.hours;
  }

  // 5. Urgency scales COST (rush = overtime/parallel staffing premium); the
  //    calendar is derived from pre-urgency effort below, with its own factor —
  //    paying for rush must never show a LONGER deadline.
  const effortHours = Math.round(hours);
  const urgencyMult = URGENCY_MULTIPLIER[input.urgency] ?? 1;
  hours = Math.round(hours * urgencyMult);

  const multiplier = tierMult * designMult * langMult * mobileMult * urgencyMult;

  // 6. Money range with subtype floor. When the floor engages it must not
  //    collapse the range to a fake-precise point — keep a real spread and
  //    re-anchor the displayed hours so "hours × rate" still reconciles.
  const mid = hours * BLENDED_RATE;
  const cost: Range = {
    min: Math.max(roundMoney(mid * RANGE_LOW, 'down'), def.minPrice),
    max: roundMoney(Math.max(mid * RANGE_HIGH, def.minPrice * 1.3), 'up'),
  };
  const hoursRange: Range = {
    min: Math.max(Math.round(hours * RANGE_LOW), Math.round(cost.min / BLENDED_RATE)),
    max: Math.max(Math.round(hours * RANGE_HIGH), Math.round(cost.max / BLENDED_RATE)),
  };

  // 7. Timeline from pre-urgency effort; rush compresses the calendar,
  //    flexible stretches it. Max is at least min+1: "2–3 weeks" is honest
  //    calendar variance; "2–2 weeks" is fake precision.
  const weeksFactor = URGENCY_WEEKS_FACTOR[input.urgency] ?? 1;
  const velocity = velocityFor(effortHours);
  const weeksMin = Math.max(MIN_WEEKS, Math.ceil((effortHours / velocity) * weeksFactor));
  const weeks: Range = { min: weeksMin, max: Math.max(weeksMin + 1, Math.ceil(((effortHours * 1.3) / velocity) * weeksFactor)) };

  // 8. Support retainer (optional)
  const supportMonthly = Math.max(SUPPORT_MONTHLY_MIN, Math.round((mid * SUPPORT_RATE_YEARLY) / 12 / 5) * 5);

  // 9. Team composition (derived, for credibility framing)
  const team = ['team.pm'];
  if (input.design !== 'ready') team.push('team.designer');
  team.push(hours > 400 ? 'team.devs' : 'team.dev');
  if (input.tier !== 'mvp') team.push('team.qa');

  return {
    hours: hoursRange,
    cost,
    weeks,
    supportMonthly,
    rate: BLENDED_RATE,
    team,
    breakdown,
    multiplier: Math.round(multiplier * 100) / 100,
  };
}

/** Clamp an AI-suggested range so it can never contradict the formula wildly. */
export function clampAiRange(ai: { costMin: number; costMax: number; weeksMin: number; weeksMax: number }, formula: EstimateResult) {
  const costFloor = formula.cost.min * AI_CLAMP.costMinFactor;
  const costCeil = formula.cost.max * AI_CLAMP.costMaxFactor;
  const weeksFloor = Math.max(MIN_WEEKS, Math.floor(formula.weeks.min * AI_CLAMP.weeksMinFactor));
  const weeksCeil = Math.ceil(formula.weeks.max * AI_CLAMP.weeksMaxFactor);

  let costMin = Math.min(Math.max(ai.costMin, costFloor), costCeil);
  let costMax = Math.min(Math.max(ai.costMax, costFloor), costCeil);
  if (costMax < costMin) [costMin, costMax] = [costMax, costMin];

  let weeksMin = Math.min(Math.max(ai.weeksMin, weeksFloor), weeksCeil);
  let weeksMax = Math.min(Math.max(ai.weeksMax, weeksFloor), weeksCeil);
  if (weeksMax < weeksMin) [weeksMin, weeksMax] = [weeksMax, weeksMin];

  // Friendly rounding must not round back through the enforced floor.
  let roundedMin = roundMoney(costMin, 'down');
  if (roundedMin < costFloor) roundedMin = Math.ceil(costFloor / 10) * 10;

  weeksMin = Math.round(weeksMin);
  weeksMax = Math.round(weeksMax);

  return {
    cost: { min: roundedMin, max: Math.max(roundMoney(costMax, 'up'), roundedMin) },
    // Same fake-precision guard the formula path has: never "4–4 weeks".
    weeks: { min: weeksMin, max: Math.max(weeksMax, weeksMin + 1) },
  };
}
