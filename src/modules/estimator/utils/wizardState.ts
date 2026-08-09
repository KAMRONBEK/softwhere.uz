import {
  getService,
  getSubtype,
  featuresFor,
  integrationsFor,
  techFor,
  defaultInputFor,
  hasScreens,
} from '@/modules/estimator/data/catalog';
import type { DesignStatus, EstimatorInput, MobileApproach, Platform, ProjectType, Tier, Urgency } from '@/modules/estimator/types';

/**
 * Every wizard transition as a pure function of the current input.
 *
 * `Wizard.tsx` used to inline these, which is how the estimator ended up with
 * states the price could not explain: switching project subtype merged the new
 * subtype's "popular" features in but never dropped the previous one's, so
 * browsing the catalogue silently ratcheted the quote up and A → B → A did not
 * come back to A. Keeping the transitions here — pure, normalized and
 * round-trippable — is what makes that testable.
 *
 * The one rule every transition ends with is `normalizeInput`, which projects
 * an input onto the canonical valid state for its project type. The server's
 * `sanitizeEstimatorInput` finishes with the same call, so what the client
 * prices and what the API prices can never drift apart.
 */

const PLATFORM_IDS: Platform[] = ['ios', 'android'];

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Canonical form of an input: every id actually offered for the project type,
 * every number inside its subtype's bounds. Idempotent by construction —
 * `normalizeInput(normalizeInput(x))` deep-equals `normalizeInput(x)`.
 */
export function normalizeInput(input: EstimatorInput): EstimatorInput {
  const service = getService(input.projectType);
  const projectType = service.id;
  const subtype = service.subtypes.some(s => s.id === input.subtype) ? input.subtype : service.subtypes[0].id;
  const def = getSubtype(projectType, subtype);

  const validFeatures = new Set(featuresFor(projectType).map(f => f.id));
  const validIntegrations = new Set(integrationsFor(projectType).map(i => i.id));
  const validTech = new Set(techFor(projectType).map(t => t.id));

  const platforms = dedupe((input.platforms ?? []).filter((p): p is Platform => PLATFORM_IDS.includes(p))) as Platform[];
  const techStack = dedupe(input.techStack ?? []).filter(id => validTech.has(id));

  const screensRaw = Number.isFinite(input.screens) ? Math.round(input.screens) : def.defaultScreens;

  return {
    projectType,
    subtype,
    // Only mobile has platforms, and mobile always has at least one: an empty
    // list would be priced as "both" without ever being shown as both.
    platforms: projectType === 'mobile' ? (platforms.length ? platforms : ([...PLATFORM_IDS] as Platform[])) : [],
    approach: input.approach === 'native' ? 'native' : 'cross',
    tier: input.tier,
    // Screens below `includedScreens` cost exactly the same as `includedScreens`,
    // so allowing them only produced a slider whose bottom half moved the number
    // and nothing else. The floor is price-neutral and kills the dead zone.
    screens: hasScreens(projectType, subtype) ? clamp(screensRaw, Math.max(1, def.includedScreens), def.maxScreens) : 0,
    features: dedupe(input.features ?? []).filter(id => validFeatures.has(id)),
    integrations: dedupe(input.integrations ?? []).filter(id => validIntegrations.has(id)),
    techStack,
    // "Agency picks" is simply "no stack chosen" — deriving it removes the
    // contradictory state where neither the toggle nor any chip is active.
    autoTech: techStack.length === 0,
    design: input.design,
    languages: clamp(Number.isFinite(input.languages) ? Math.round(input.languages) : 2, 1, 3),
    urgency: input.urgency,
    description: input.description ?? '',
  };
}

/**
 * Features the user actively chose: everything except the current subtype's
 * pre-ticked recommendations. Those are re-seeded per subtype, so they must not
 * survive a subtype change — that accumulation was the price ratchet.
 */
function userChosenFeatures(input: EstimatorInput): string[] {
  const seeded = new Set(getSubtype(input.projectType, input.subtype).popular);
  return input.features.filter(id => !seeded.has(id));
}

/**
 * How many screens to carry into a different subtype. A count the user never
 * touched is just the old subtype's suggestion and gets re-seeded; a count they
 * dragged themselves is a fact about their project, so it follows them (clamped
 * to what the new subtype can actually hold).
 */
function carryScreens(input: EstimatorInput, next: { defaultScreens: number; includedScreens: number; maxScreens: number }): number {
  const current = getSubtype(input.projectType, input.subtype);
  const untouched = input.screens === current.defaultScreens;
  if (untouched || next.maxScreens === 0) return next.defaultScreens;
  return clamp(input.screens, Math.max(1, next.includedScreens), next.maxScreens);
}

/** Switch service (Mobile → Website …), carrying over everything still meaningful. */
export function selectProjectType(input: EstimatorInput, projectType: ProjectType): EstimatorInput {
  if (projectType === input.projectType) return input;
  const nextSubtype = getService(projectType).subtypes[0];
  return normalizeInput({
    // Deliberately keeps tier, design, languages, urgency, approach, platforms
    // and the description: those are preferences about the client's project,
    // not about the service. Only what cannot exist under the new service is
    // dropped (by normalizeInput).
    ...input,
    projectType,
    subtype: nextSubtype.id,
    screens: carryScreens(input, nextSubtype),
    features: [...userChosenFeatures(input), ...nextSubtype.popular],
  });
}

/** Switch subtype within a service: re-seed its recommendations, keep the user's own picks. */
export function selectSubtype(input: EstimatorInput, subtypeId: string): EstimatorInput {
  if (subtypeId === input.subtype) return input;
  const next = getSubtype(input.projectType, subtypeId);
  return normalizeInput({
    ...input,
    subtype: next.id,
    screens: carryScreens(input, next),
    features: [...userChosenFeatures(input), ...next.popular],
  });
}

/** Toggle iOS/Android. The last remaining platform cannot be turned off. */
export function togglePlatform(input: EstimatorInput, platform: Platform): EstimatorInput {
  const selected = input.platforms.includes(platform);
  if (selected && input.platforms.length === 1) return input;
  return normalizeInput({
    ...input,
    platforms: selected ? input.platforms.filter(p => p !== platform) : [...input.platforms, platform],
  });
}

export function toggleFeature(input: EstimatorInput, id: string): EstimatorInput {
  return normalizeInput({
    ...input,
    features: input.features.includes(id) ? input.features.filter(x => x !== id) : [...input.features, id],
  });
}

export function toggleIntegration(input: EstimatorInput, id: string): EstimatorInput {
  return normalizeInput({
    ...input,
    integrations: input.integrations.includes(id) ? input.integrations.filter(x => x !== id) : [...input.integrations, id],
  });
}

/** Picking any technology implies "not the agency's choice"; clearing them all implies it again. */
export function toggleTech(input: EstimatorInput, id: string): EstimatorInput {
  return normalizeInput({
    ...input,
    techStack: input.techStack.includes(id) ? input.techStack.filter(x => x !== id) : [...input.techStack, id],
  });
}

/** "Let SoftWhere choose" — a selection, not a toggle: it clears any manual picks. */
export function setAutoTech(input: EstimatorInput): EstimatorInput {
  return normalizeInput({ ...input, techStack: [] });
}

export function setApproach(input: EstimatorInput, approach: MobileApproach): EstimatorInput {
  return normalizeInput({ ...input, approach });
}

export function setTier(input: EstimatorInput, tier: Tier): EstimatorInput {
  return normalizeInput({ ...input, tier });
}

export function setScreens(input: EstimatorInput, screens: number): EstimatorInput {
  return normalizeInput({ ...input, screens });
}

export function setDesign(input: EstimatorInput, design: DesignStatus): EstimatorInput {
  return normalizeInput({ ...input, design });
}

export function setLanguages(input: EstimatorInput, languages: number): EstimatorInput {
  return normalizeInput({ ...input, languages });
}

export function setUrgency(input: EstimatorInput, urgency: Urgency): EstimatorInput {
  return normalizeInput({ ...input, urgency });
}

/** Free text is kept verbatim (the textarea caps its length); only trimmed server-side. */
export function setDescription(input: EstimatorInput, description: string): EstimatorInput {
  return { ...input, description };
}

/** A fresh wizard state (also what "Start over" returns to). */
export function initialInput(projectType: ProjectType = 'mobile'): EstimatorInput {
  return normalizeInput(defaultInputFor(projectType));
}
