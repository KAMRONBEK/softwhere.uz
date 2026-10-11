import { getSubtype, hasScreens, type SubtypeDef } from '@/modules/estimator/data/catalog';
import type { EstimateResult, EstimatorInput, Range, Tier } from '@/modules/estimator/types';
import { calculateEstimate } from '@/modules/estimator/utils/estimator';
import { sanitizeEstimatorInput } from '@/modules/estimator/utils/sanitize';
import { initialInput, normalizeInput, selectSubtype } from '@/modules/estimator/utils/wizardState';
import {
  DEFAULT_UI_LANGUAGES,
  GENERIC_SUBTYPES,
  SECOND_SIDE_FEATURES,
  SECOND_SIDE_SCREEN_SHARE,
  STANDARD_TIER_FLAGS,
  type BriefLocale,
  type Clarity,
  type ComplexityFlag,
} from '@/modules/estimator/ai-brief/constants';
import { scopeNotes } from '@/modules/estimator/ai-brief/digest';
import { notPricedLabel } from '@/modules/estimator/ai-brief/labels';
import { priceForLocale, sumPrices } from '@/modules/estimator/ai-brief/pricing';
import type { BigIdeaReason, EngineSize } from '@/modules/estimator/ai-brief/bigIdea';
import type {
  BriefNarrative,
  BriefPhase,
  BriefScope,
  DiscoveryEstimate,
  EngineConfig,
  PricedEstimate,
  PriceDriver,
} from '@/modules/estimator/ai-brief/types';

/**
 * Scope → estimator engine, deterministically.
 *
 * The model only ever picks catalog options (exactly what a visitor does in the
 * wizard); every hour, week and dollar is computed by `calculateEstimate`. The
 * inputs go through `sanitizeEstimatorInput` — the same trust boundary the
 * estimate API uses — so a brief can never price a state the wizard couldn't.
 * The two inputs that swung the same idea's price most between models — tier
 * and screen count — are set by rule here, never by the model.
 */

const MAX_DRIVERS = 4;

export interface ExtraInput {
  input: EstimatorInput;
  reason: string;
}

export interface MappedScope {
  /** What gets built first — the headline price. */
  mvp: EstimatorInput;
  /** MVP + every 'later' feature/integration on the same product. */
  full: EstimatorInput;
  /** Separate products (e.g. a website next to the app), planned for growth. */
  extras: ExtraInput[];
  hasLaterScope: boolean;
  /** Scope ids the engine could not price for this product type (listed as not priced). */
  notOffered: string[];
  /** Human-readable record of every deterministic change made to the model's scope. */
  adjustments: string[];
}

/** Interface languages when the model gave none (DEFAULT_UI_LANGUAGES: Uzbek + Russian on uz/ru pages, one on en; `reconcile.ts` rule 11 sets the rest). */
export function defaultLanguages(locale: BriefLocale): number {
  return DEFAULT_UI_LANGUAGES[locale];
}

/** Tier by rule: a first version is 'mvp'; regulated products get 'standard' QA depth. */
export function tierForScope(flags: readonly ComplexityFlag[]): Tier {
  return flags.some(f => STANDARD_TIER_FLAGS.includes(f)) ? 'standard' : 'mvp';
}

/**
 * Screens by rule: the subtype's default (what the wizard starts from), plus a
 * share for a second user-facing side (courier/driver app area, sellers, a
 * two-sided marketplace). 0 for products without screens.
 */
export function screensForScope(def: SubtypeDef, scope: Pick<BriefScope, 'features' | 'complexityFlags'>): number {
  if (def.maxScreens === 0) return 0;
  const secondSide =
    scope.complexityFlags.includes('two_sided_marketplace') ||
    scope.features.some(f => f.phase === 'mvp' && SECOND_SIDE_FEATURES.includes(f.id));
  const screens = def.defaultScreens + (secondSide ? Math.round(def.defaultScreens * SECOND_SIDE_SCREEN_SHARE) : 0);
  return Math.min(screens, def.maxScreens);
}

/** Confidence in the range: a vague idea or unpriced needs widen the real uncertainty. */
export function briefConfidence(clarity: Clarity, unpricedCount: number): PricedEstimate['confidence'] {
  if (clarity === 'vague' || unpricedCount >= 2) return 'low';
  if (clarity === 'detailed' && unpricedCount === 0) return 'high';
  return 'medium';
}

function idsFor(items: BriefScope['features'], phase?: 'mvp'): string[] {
  return items.filter(i => !phase || i.phase === phase).map(i => i.id);
}

function dropped(requested: string[], kept: string[]): string[] {
  const keep = new Set(kept);
  return requested.filter(id => !keep.has(id));
}

export function mapScopeToInputs(scope: BriefScope, locale: BriefLocale): MappedScope {
  const adjustments: string[] = [];
  const { projectType, subtype } = scope.product;
  const def = getSubtype(projectType, subtype);
  const tier = tierForScope(scope.complexityFlags);
  const languages = scope.uiLanguages || defaultLanguages(locale);
  const screens = screensForScope(def, scope);
  // Products without screens have no design phase (the engine already skips the
  // design multiplier there); 'ready' also keeps a designer off a bot's team.
  const design = !hasScreens(projectType, subtype) || scope.hasDesigns ? 'ready' : 'custom';

  const mvpFeatures = idsFor(scope.features, 'mvp');
  const mvpIntegrations = idsFor(scope.integrations, 'mvp');
  const allFeatures = idsFor(scope.features);
  const allIntegrations = idsFor(scope.integrations);

  const toInput = (features: string[], integrations: string[]): EstimatorInput | null =>
    sanitizeEstimatorInput({
      projectType,
      subtype,
      platforms: scope.platforms,
      approach: scope.approach,
      tier,
      screens,
      features,
      integrations,
      techStack: [],
      autoTech: true,
      design,
      languages,
      urgency: scope.urgency,
      description: '',
    });

  // sanitizeEstimatorInput only returns null for an unknown projectType, which
  // the schema enum rules out; fall back to the wizard default all the same.
  const mvp = toInput(mvpFeatures, mvpIntegrations) ?? initialInput(projectType);
  const full = toInput(allFeatures, allIntegrations) ?? mvp;

  const notOffered = [...dropped(allFeatures, full.features), ...dropped(allIntegrations, full.integrations)];
  for (const id of notOffered) adjustments.push(`${id} not offered for ${projectType} — not priced`);
  adjustments.push(`tier ${tier}, screens ${mvp.screens} (by rule)`);

  const extras: ExtraInput[] = scope.extraDeliverables.map(extra => ({
    reason: extra.reason,
    input: normalizeInput({
      ...selectSubtype(initialInput(extra.projectType), extra.subtype),
      tier,
      design: hasScreens(extra.projectType, extra.subtype) ? mvp.design : 'ready',
      languages: mvp.languages,
      urgency: mvp.urgency,
    }),
  }));

  const hasLaterScope =
    full.features.length > mvp.features.length || full.integrations.length > mvp.integrations.length || extras.length > 0;
  return { mvp, full, extras, hasLaterScope, notOffered, adjustments };
}

/** Message key naming a product in a brief: the subtype, or the service for a catch-all subtype ("Mobile app"). */
export function productLabelKey(projectType: string, subtype: string): string {
  return GENERIC_SUBTYPES.includes(subtype) ? `service.${projectType}` : `subtype.${subtype}`;
}

/** Biggest effort lines of the MVP, as shares of raw hours ("what drives the price"). */
export function priceDrivers(estimate: EstimateResult, projectType?: string): PriceDriver[] {
  const total = estimate.breakdown.reduce((sum, line) => sum + line.hours, 0);
  if (total <= 0) return [];
  const labelKey = (line: EstimateResult['breakdown'][number]) =>
    line.kind === 'base' && projectType ? productLabelKey(projectType, line.labelKey.replace(/^subtype\./, '')) : line.labelKey;
  return [...estimate.breakdown]
    .sort((a, b) => b.hours - a.hours)
    .slice(0, MAX_DRIVERS)
    .map(line => ({ id: line.id, labelKey: labelKey(line), share: Math.round((line.hours / total) * 100) }));
}

/**
 * Growth-phase calendar: what the later scope adds to the MVP's engine
 * timeline (full − mvp, the engine's weeks are monotonic in effort) plus each
 * extra deliverable built after it. Never "0 weeks", never "N–N weeks".
 */
export function growthWeeks(mvp: Range, full: Range, extras: Range[], hasMainLater: boolean): Range {
  const deltaMin = hasMainLater ? Math.max(1, full.min - mvp.min) : 0;
  const deltaMax = hasMainLater ? Math.max(deltaMin, full.max - mvp.max) : 0;
  const min = deltaMin + extras.reduce((sum, w) => sum + w.min, 0);
  const max = deltaMax + extras.reduce((sum, w) => sum + w.max, 0);
  return { min: Math.max(1, min), max: Math.max(Math.max(1, min) + 1, max) };
}

function engineConfig(input: EstimatorInput): EngineConfig {
  const { projectType, subtype, platforms, approach, tier, design, languages, urgency, screens } = input;
  return { projectType, subtype, platforms, approach, tier, design, languages, urgency, screens };
}

/**
 * Run the engine on the mapped scope and assemble the brief's estimate block.
 * Phase text comes from the narrative call (written after this scope was
 * priced); weeks always come from the engine.
 */
export function buildEstimate(
  scope: BriefScope,
  mapped: MappedScope,
  locale: BriefLocale,
  narrativePhases: BriefNarrative['phases'] = []
): PricedEstimate {
  const mvpEst = calculateEstimate(mapped.mvp);
  const fullEst = calculateEstimate(mapped.full);
  const extraEsts = mapped.extras.map(e => ({ ...e, estimate: calculateEstimate(e.input) }));

  const hasMainLater =
    mapped.full.features.length > mapped.mvp.features.length || mapped.full.integrations.length > mapped.mvp.integrations.length;
  const growth = mapped.hasLaterScope
    ? growthWeeks(
        mvpEst.weeks,
        fullEst.weeks,
        extraEsts.map(e => e.estimate.weeks),
        hasMainLater
      )
    : null;

  const narrativePhase = (id: 'mvp' | 'growth') => narrativePhases.find(p => p.id === id);
  const phases: BriefPhase[] = [
    { id: 'mvp', title: '', goal: '', deliverables: [], ...narrativePhase('mvp'), weeks: mvpEst.weeks },
    ...(growth ? [{ id: 'growth' as const, title: '', goal: '', deliverables: [], ...narrativePhase('growth'), weeks: growth }] : []),
  ];

  const mainFullPrice = priceForLocale(hasMainLater ? fullEst : mvpEst, locale);
  const extras = extraEsts.map(e => ({
    projectType: e.input.projectType,
    subtype: e.input.subtype,
    labelKey: `subtype.${e.input.subtype}`,
    reason: e.reason,
    price: priceForLocale(e.estimate, locale),
    weeks: e.estimate.weeks,
  }));

  return {
    mode: 'priced',
    basis: locale === 'en' ? 'en_dual_rate' : 'local_engine',
    confidence: briefConfidence(scope.clarity, scope.unpricedItems.length),
    config: engineConfig(mapped.mvp),
    mvp: {
      price: priceForLocale(mvpEst, locale),
      weeks: mvpEst.weeks,
      team: mvpEst.team,
      drivers: priceDrivers(mvpEst, mapped.mvp.projectType),
    },
    fullVision: growth
      ? {
          price: sumPrices([mainFullPrice, ...extras.map(e => e.price)]) ?? mainFullPrice,
          weeks: { min: mvpEst.weeks.min + growth.min, max: mvpEst.weeks.max + growth.max },
        }
      : null,
    extras,
    phases,
    unpricedItems: [...scope.unpricedItems, ...mapped.notOffered.map(id => notPricedLabel(id, scopeNotes(scope), locale))],
    adjustments: mapped.adjustments,
  };
}

/**
 * Effort hours of the mapped scope, for the big-idea rule only — server-side:
 * no hour count is ever part of a brief (`PricedEstimate`). The full vision is
 * the main product with its later scope plus every extra deliverable, and
 * exists exactly when the brief has a full-vision price (`hasLaterScope`).
 */
export function engineSize(mapped: MappedScope): EngineSize {
  const mvpHours = calculateEstimate(mapped.mvp).hours;
  if (!mapped.hasLaterScope) return { mvpHours, fullHours: null };
  const hasMainLater =
    mapped.full.features.length > mapped.mvp.features.length || mapped.full.integrations.length > mapped.mvp.integrations.length;
  const mainHours = hasMainLater ? calculateEstimate(mapped.full).hours : mvpHours;
  const fullHours = mapped.extras.reduce((sum, e) => {
    const { hours } = calculateEstimate(e.input);
    return { min: sum.min + hours.min, max: sum.max + hours.max };
  }, mainHours);
  return { mvpHours, fullHours };
}

/**
 * The estimate of a very large idea (`bigIdea.ts`): the plan, the first
 * module's configuration and team, and nothing that is a number — no price,
 * hours or weeks reach the page, and no phase promises a duration.
 */
export function toDiscoveryEstimate(estimate: PricedEstimate, reasons: BigIdeaReason[]): DiscoveryEstimate {
  return {
    mode: 'discovery',
    reasons,
    config: estimate.config,
    team: estimate.mvp.team,
    extras: estimate.extras.map(({ projectType, subtype, labelKey, reason }) => ({ projectType, subtype, labelKey, reason })),
    phases: estimate.phases.map(({ id, title, goal, deliverables }) => ({ id, title, goal, deliverables })),
    unpricedItems: estimate.unpricedItems,
    adjustments: estimate.adjustments,
  };
}
