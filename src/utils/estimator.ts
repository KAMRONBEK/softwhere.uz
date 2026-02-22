import { ESTIMATOR, HOURLY_RATE } from '@/constants/estimator';
import { getSubtypeIncludedFeatures, getImpliedTechFromSubtype } from '@/data/estimator-options';
import type { EstimateResult, EstimatorInput } from '@/types/estimator';

/**
 * Calculate an estimate based on user input.
 * Hour-based model: $35/hr for UZ/KZ/RU quality agencies.
 * Pure function → easy to unit-test.
 */
export function calculateEstimate(input: EstimatorInput): EstimateResult {
  const { projectType, complexity, features, pages, techStack = [], platforms, subtype } = input;

  // 1. Base hours by project type
  const baseHours = ESTIMATOR.BASE_HOURS[projectType] ?? ESTIMATOR.BASE_HOURS.other;

  // 2. Complexity multiplier
  const complexityMultiplier = ESTIMATOR.COMPLEXITY_MULTIPLIER[complexity];

  // 3. Feature hours (include subtype-included: RAG when rag subtype, miniapp when miniapp)
  const subtypeIncluded = getSubtypeIncludedFeatures(projectType, subtype);
  const allFeatureIds = Array.from(new Set([...subtypeIncluded, ...features]));
  const featuresHours = allFeatureIds.reduce((sum, feature) => sum + (ESTIMATOR.FEATURE_HOURS[feature] ?? 0), 0);

  // 4. Pages/screens hours (base includes ~13 screens; scale per PAGE_HOURS)
  const pagesHours = pages * ESTIMATOR.PAGE_HOURS;

  // 5. Tech-stack adjustment (include implied tech from subtype, e.g. electron for desktop.electron)
  const impliedTech = getImpliedTechFromSubtype(projectType, subtype);
  const effectiveTechStack = Array.from(new Set([...(impliedTech ? [impliedTech] : []), ...techStack]));
  const techAdjustmentFactor = effectiveTechStack.reduce((acc, tech) => acc * (ESTIMATOR.TECH_STACK_ADJUSTMENT[tech] ?? 1), 1);

  // 6. Total hours (base includes core structure; MVP mobile 13 screens ≈ 400h base)
  const totalHours = (baseHours * complexityMultiplier + featuresHours + pagesHours) * techAdjustmentFactor;

  const developmentCost = Math.round(totalHours * HOURLY_RATE);

  // 7. Deadline: parallel iOS+Android ≈ 80h/week; single platform ≈ 40h/week
  const isParallel = projectType === 'mobile' && platforms?.length === 2 && platforms.includes('ios') && platforms.includes('android');
  const hoursPerWeek = isParallel ? ESTIMATOR.HOURS_PER_WEEK_PARALLEL : ESTIMATOR.HOURS_PER_WEEK_SINGLE;
  const deadlineWeeks = Math.ceil(totalHours / hoursPerWeek);

  const supportCost = Math.round(developmentCost * ESTIMATOR.SUPPORT_RATE);

  return {
    developmentCost,
    deadlineWeeks,
    supportCost,
    breakdown: {
      baseCost: baseHours * HOURLY_RATE,
      complexityMultiplier,
      featuresCost: featuresHours * HOURLY_RATE,
      pagesCost: pagesHours * HOURLY_RATE,
      techAdjustmentFactor,
      totalHours,
      hourlyRate: HOURLY_RATE,
    },
  };
}
