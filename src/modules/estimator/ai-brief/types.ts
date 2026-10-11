import type { DesignStatus, MobileApproach, Platform, ProjectType, Range, Tier, Urgency } from '@/modules/estimator/types';
import type { BigIdeaReason } from '@/modules/estimator/ai-brief/bigIdea';
import type {
  BlockKind,
  BriefLocale,
  Clarity,
  ComplexityFlag,
  Device,
  PolicyStatus,
  PolicyTopic,
  Rejection,
  ScopePhase,
} from '@/modules/estimator/ai-brief/constants';

/* ------------------------------------------------------------------ */
/* What the model returns (after parsing/normalization)                */
/* ------------------------------------------------------------------ */

export interface WireframeBlock {
  kind: BlockKind;
  /** Short, product-specific caption in the visitor's language. */
  label: string;
  /** Up to 4 sample labels (tab names, list rows, form fields…). */
  items: string[];
}

export interface WireframeScreen {
  name: string;
  purpose: string;
  device: Device;
  phase: ScopePhase;
  blocks: WireframeBlock[];
}

export interface ScopeItem {
  id: string;
  phase: ScopePhase;
  note: string;
}

export interface ProductRef {
  projectType: ProjectType;
  subtype: string;
}

/**
 * Call 1 — what the idea IS: classification, policy and the catalog scope the
 * engine prices. Tier and screen count are deliberately absent: they are set
 * by rule in `mapping.ts`, not by the model.
 */
export interface BriefScope {
  isProjectIdea: boolean;
  rejection: Rejection;
  policy: { status: PolicyStatus; topics: PolicyTopic[]; note: string };
  title: string;
  summary: string;
  clarity: Clarity;
  audience: { segment: string; need: string }[];
  /** MVP user roles in the visitor's language, main user first ("Mijoz", "Kuryer", "Operator"). */
  roles: string[];
  product: ProductRef;
  platforms: Platform[];
  approach: MobileApproach;
  hasDesigns: boolean;
  uiLanguages: number;
  urgency: Urgency;
  features: ScopeItem[];
  integrations: ScopeItem[];
  extraDeliverables: (ProductRef & { reason: string })[];
  unpricedItems: string[];
  complexityFlags: ComplexityFlag[];
  stack: string[];
  assumptions: string[];
}

/**
 * Call 2 — the explanation, written against the FINAL priced scope. Every
 * phase deliverable and every "can wait" item names the scope ref it is about;
 * the parser drops whatever points outside what was priced for that phase.
 */
export interface BriefNarrative {
  buildFirst: { what: string; why: string };
  /** `inEstimate` = the item is priced in the full vision (false: it needs a discovery call). */
  canWait: { item: string; reason: string; inEstimate: boolean }[];
  phases: { id: 'mvp' | 'growth'; title: string; goal: string; deliverables: string[] }[];
  risks: { title: string; detail: string; mitigation: string }[];
  questions: string[];
}

/** Parser result: the normalized value plus everything it had to repair. */
export interface Parsed<T> {
  value: T;
  /** Repairs/drops applied while normalizing — audit material, not errors. */
  issues: string[];
  /** True when complete enough to show (else the next model gets a turn). */
  usable: boolean;
}

/* ------------------------------------------------------------------ */
/* What the API returns                                                */
/* ------------------------------------------------------------------ */

export type PriceBasis = 'local_engine' | 'en_dual_rate';

export interface BriefPrice {
  currency: 'USD';
  min: number;
  max: number;
  basis: PriceBasis;
}

export interface PriceDriver {
  id: string;
  /** i18n key within the `estimator` namespace (same keys as the wizard breakdown). */
  labelKey: string;
  /** Share of the raw (pre-multiplier) hours, 0–100. */
  share: number;
}

export interface BriefPhase {
  id: 'mvp' | 'growth';
  title: string;
  goal: string;
  deliverables: string[];
  /** From the estimator engine — never from the model. */
  weeks: Range;
}

export interface EngineConfig {
  projectType: ProjectType;
  subtype: string;
  platforms: Platform[];
  approach: MobileApproach;
  tier: Tier;
  design: DesignStatus;
  languages: number;
  urgency: Urgency;
  screens: number;
}

/**
 * The brief's estimate — the normal case: price ranges and weeks. Effort
 * hours never leave the server (founder rule 2026-10-10: visitors see a range
 * and weeks, never hours or hourly rates); the big-idea rule reads them from
 * `engineSize` in `mapping.ts` instead.
 */
export interface PricedEstimate {
  mode: 'priced';
  basis: PriceBasis;
  confidence: 'low' | 'medium' | 'high';
  /** The engine input the MVP was priced with (for "how we calculated"). */
  config: EngineConfig;
  mvp: {
    price: BriefPrice;
    weeks: Range;
    /** Team role i18n keys (`team.pm`, …) from the engine. */
    team: string[];
    drivers: PriceDriver[];
  };
  /** MVP + later scope + extra deliverables; null when there is no later scope. */
  fullVision: { price: BriefPrice; weeks: Range } | null;
  extras: { projectType: ProjectType; subtype: string; labelKey: string; reason: string; price: BriefPrice; weeks: Range }[];
  phases: BriefPhase[];
  /** Needs the catalog cannot price — excluded from every number above. */
  unpricedItems: string[];
  /** Deterministic changes the mapping made to the model's scope. */
  adjustments: string[];
}

/** A phase of a discovery-call brief: the plan without a duration. */
export type DiscoveryPhase = Omit<BriefPhase, 'weeks'>;

/**
 * A very large idea (`bigIdea.ts`): the plan without a single number — no
 * price, hours or weeks anywhere — and the reasons it needs a discovery call.
 * The engine still ran (the verdict needs its size); nothing of it is sent.
 */
export interface DiscoveryEstimate {
  mode: 'discovery';
  reasons: BigIdeaReason[];
  /** The engine input of the first module (product, platforms, languages — never a number of hours). */
  config: EngineConfig;
  /** Team role i18n keys the first module would need. */
  team: string[];
  extras: { projectType: ProjectType; subtype: string; labelKey: string; reason: string }[];
  phases: DiscoveryPhase[];
  unpricedItems: string[];
  adjustments: string[];
}

export type BriefEstimate = PricedEstimate | DiscoveryEstimate;

/** True for a normal, priced estimate (runs saved before 2026-10-10 have no `mode`: they are priced). */
export function isPricedEstimate(estimate: BriefEstimate): estimate is PricedEstimate {
  return estimate.mode !== 'discovery';
}

/** The estimate with each phase's text rewritten by `f` (a priced phase keeps its engine weeks). */
export function mapPhases(estimate: BriefEstimate, f: (phase: DiscoveryPhase) => DiscoveryPhase): BriefEstimate {
  if (!isPricedEstimate(estimate)) return { ...estimate, phases: estimate.phases.map(f) };
  return { ...estimate, phases: estimate.phases.map(p => ({ ...f(p), weeks: p.weeks })) };
}

/** The estimate with its visible text rewritten by `f`: unpriced items and extra-product reasons. */
export function mapEstimateText(estimate: BriefEstimate, f: (text: string) => string): BriefEstimate {
  const unpricedItems = estimate.unpricedItems.map(f);
  if (!isPricedEstimate(estimate)) return { ...estimate, unpricedItems, extras: estimate.extras.map(e => ({ ...e, reason: f(e.reason) })) };
  return { ...estimate, unpricedItems, extras: estimate.extras.map(e => ({ ...e, reason: f(e.reason) })) };
}

export interface AiBrief {
  version: 1;
  locale: BriefLocale;
  /** The model that scoped the brief (= `models.scope`). */
  model: string;
  /** Which model answered each call (a fallback can differ per call). */
  models: { scope: string; narrative: string; screens: string | null };
  title: string;
  summary: string;
  audience: { segment: string; need: string }[];
  roles: string[];
  features: (ScopeItem & { labelKey: string })[];
  integrations: (ScopeItem & { labelKey: string })[];
  stack: { id: string; label: string }[];
  complexityFlags: ComplexityFlag[];
  /** Lo-fi wireframes drawn against the priced scope; empty when that call failed (the brief still stands). */
  screens: WireframeScreen[];
  estimate: BriefEstimate;
  narrative: Omit<BriefNarrative, 'phases'> & { assumptions: string[] };
  policy: { status: PolicyStatus; topics: PolicyTopic[]; note: string };
}

/**
 * What the brief already knows once its scope is priced (~15–30s in): the
 * product, the scope and every engine number. Streamed ahead of the narrative
 * and the wireframes so the page can fill in while they are written.
 */
export type BriefPreview = Pick<
  AiBrief,
  'locale' | 'title' | 'summary' | 'audience' | 'roles' | 'features' | 'integrations' | 'stack' | 'complexityFlags' | 'estimate' | 'policy'
>;

/** Pipeline milestones reported while a brief is being built. */
export type BriefProgress =
  | { stage: 'scoped'; preview: BriefPreview }
  | { stage: 'screens'; screens: WireframeScreen[] }
  | { stage: 'narrative' };

export type BriefErrorCode = 'ai_unavailable' | 'invalid_output' | 'timeout';

export type BriefOutcome =
  | { status: 'ok'; brief: AiBrief }
  | { status: 'rejected'; reason: Exclude<Rejection, 'none'> | 'too_short' }
  | { status: 'declined_policy'; topics: PolicyTopic[]; note: string }
  | { status: 'error'; code: BriefErrorCode };

export interface BriefApiRequest {
  idea: string;
  locale: BriefLocale;
}
