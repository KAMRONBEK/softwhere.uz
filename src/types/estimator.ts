import type { FeatureKey, TechnologyKey } from '@/constants/estimator';

export type ProjectType = 'mobile' | 'web' | 'telegram' | 'desktop' | 'other';
export type Complexity = 'mvp' | 'standard' | 'enterprise';

export interface EstimatorInput {
  projectType: ProjectType;
  // Applicable when projectType === 'mobile'
  platforms?: ('ios' | 'android')[];
  complexity: Complexity;
  features: FeatureKey[];
  pages: number; // Number of distinct screens / pages
  techStack?: TechnologyKey[]; // optional advanced selection
}

export interface EstimateBreakdown {
  baseCost: number;
  complexityMultiplier: number;
  featuresCost: number;
  pagesCost: number;
  techAdjustmentFactor: number;
}

export interface EstimateResult {
  developmentCost: number; // total development cost USD
  deadlineWeeks: number; // estimated deadline in weeks
  supportCost: number; // first-year support cost USD
  breakdown: EstimateBreakdown;
}
