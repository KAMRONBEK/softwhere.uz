export type ProjectType = 'mobile' | 'web' | 'telegram' | 'ai' | 'desktop' | 'other';
export type Tier = 'mvp' | 'standard' | 'enterprise';
export type Platform = 'ios' | 'android';
/** Cross-platform (Flutter/RN, one codebase) vs native (Swift/Kotlin per platform). */
export type MobileApproach = 'cross' | 'native';
/** Design scope: client brings finished designs / template-based / custom UI design by us. */
export type DesignStatus = 'ready' | 'template' | 'custom';
export type Urgency = 'flexible' | 'normal' | 'rush';

export interface EstimatorInput {
  projectType: ProjectType;
  subtype: string;
  /** Mobile only. Empty means "both" is not yet chosen; engine treats as both. */
  platforms: Platform[];
  /** Mobile only. */
  approach: MobileApproach;
  tier: Tier;
  screens: number;
  features: string[];
  integrations: string[];
  techStack: string[];
  /** True = "let SoftWhere pick the stack" (tech picks are informational either way). */
  autoTech: boolean;
  design: DesignStatus;
  /** Number of UI languages (uz/ru/en...): 1–3. */
  languages: number;
  urgency: Urgency;
  /** Optional free-text project description — feeds the AI refinement. */
  description?: string;
}

/** USD range, already rounded for display. */
export interface Range {
  min: number;
  max: number;
}

export interface BreakdownLine {
  /** Stable id: 'base' | 'screens' | 'design' | feature/integration id. */
  id: string;
  /** i18n key within the `estimator` namespace, e.g. 'feature.payme'. */
  labelKey: string;
  hours: number;
  kind: 'base' | 'screens' | 'feature' | 'integration';
}

export interface EstimateResult {
  hours: Range;
  cost: Range;
  weeks: Range;
  /** Optional monthly support retainer, USD/month. */
  supportMonthly: number;
  /** Effective blended hourly rate used, USD. */
  rate: number;
  /** Team role i18n keys within `estimator`, e.g. 'team.pm'. */
  team: string[];
  breakdown: BreakdownLine[];
  /** Combined multiplier applied on top of raw hours (tier/design/urgency/...). */
  multiplier: number;
}

/** AI-refined estimate returned by /api/estimate (Kimi K2.6, clamped server-side). */
export interface AiRefinement {
  cost: Range;
  weeks: Range;
  /** Short localized narrative of how the AI sees the project. */
  summary: string;
  /** Localized risk bullets (may be empty). */
  risks: string[];
  /** Localized scope suggestions/upsells (may be empty). */
  suggestions: string[];
  confidence: 'low' | 'medium' | 'high';
  provider: string;
}

export interface EstimateApiResponse {
  formula: EstimateResult;
  ai: AiRefinement | null;
}

export interface EstimateLeadPayload {
  name: string;
  phone: string;
  comment?: string;
  /** Preferred contact channel. */
  contact: 'call' | 'telegram';
  input: EstimatorInput;
  locale: string;
}
