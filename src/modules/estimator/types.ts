export type ProjectType = 'mobile' | 'web' | 'telegram' | 'ai' | 'desktop' | 'other';
export type Complexity = 'mvp' | 'standard' | 'enterprise';

export interface EstimatorInput {
  projectType: ProjectType;
  /** Subtype e.g. web: landing|corporate|ecommerce, mobile: ios|android|both */
  subtype?: string;
  platforms?: ('ios' | 'android')[];
  complexity: Complexity;
  features: string[];
  pages: number;
  techStack?: string[];
  languages?: string[];
  integrations?: string[];
}

export interface EstimateBreakdown {
  baseCost: number;
  complexityMultiplier: number;
  featuresCost: number;
  pagesCost: number;
  techAdjustmentFactor: number;
  totalHours?: number;
  hourlyRate?: number;
}

export interface EstimateResult {
  developmentCost: number; // total development cost USD
  deadlineWeeks: number; // estimated deadline in weeks
  supportCost: number; // first-year support cost USD
  breakdown: EstimateBreakdown;
}
