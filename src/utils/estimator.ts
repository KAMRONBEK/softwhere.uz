import { ESTIMATOR } from '@/constants/estimator';
import type { EstimateResult, EstimatorInput } from '@/types/estimator';

/**
 * Calculate an estimate based on user input.
 * Pure function → easy to unit-test.
 */
export function calculateEstimate(input: EstimatorInput): EstimateResult {
  const { projectType, complexity, features, pages, techStack = [] } = input;

  // 1. Base cost by project type
  const baseCost = ESTIMATOR.BASE_COST[projectType];

  // 2. Complexity multiplier
  const complexityMultiplier = ESTIMATOR.COMPLEXITY_MULTIPLIER[complexity];

  // 3. Additional features cost (guard against missing keys)
  const featuresCost = features.reduce((sum, feature) => {
    const price = ESTIMATOR.FEATURE_PRICES[feature as keyof typeof ESTIMATOR.FEATURE_PRICES] || 0;

    return sum + price;
  }, 0);

  // 4. Pages / screens cost
  const pagesCost = pages * ESTIMATOR.PAGE_PRICE;

  // 5. Tech-stack adjustment (guard against missing keys)
  const techAdjustmentFactor = techStack.reduce((acc, tech) => {
    const factor = ESTIMATOR.TECH_STACK_ADJUSTMENT[tech as keyof typeof ESTIMATOR.TECH_STACK_ADJUSTMENT] || 1;

    return acc * factor;
  }, 1);

  // 6. Development cost formula
  const developmentCostUnadjusted = (baseCost * complexityMultiplier + featuresCost + pagesCost) * techAdjustmentFactor;

  const developmentCost = Math.round(developmentCostUnadjusted);

  // 7. Deadline: ~1 dev week per $1.4k (configurable)
  const deadlineWeeks = Math.ceil(developmentCost / 1400);

  // 8. Support cost (first year)
  const supportCost = Math.round(developmentCost * ESTIMATOR.SUPPORT_RATE);

  return {
    developmentCost,
    deadlineWeeks,
    supportCost,
    breakdown: {
      baseCost,
      complexityMultiplier,
      featuresCost,
      pagesCost,
      techAdjustmentFactor,
    },
  };
}
