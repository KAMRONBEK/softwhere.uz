import { FEATURE_BY_ID, INTEGRATION_BY_ID, SERVICES, TECH_BY_ID, getService, getSubtype } from '@/modules/estimator/data/catalog';
import type { DesignStatus, EstimatorInput, MobileApproach, Platform, ProjectType, Tier, Urgency } from '@/modules/estimator/types';

export const MAX_DESCRIPTION_LENGTH = 600;

const PROJECT_TYPES = new Set<string>(SERVICES.map(s => s.id));
const TIERS = new Set<string>(['mvp', 'standard', 'enterprise']);
const DESIGNS = new Set<string>(['ready', 'template', 'custom']);
const URGENCIES = new Set<string>(['flexible', 'normal', 'rush']);
const PLATFORMS = new Set<string>(['ios', 'android']);

function idList(value: unknown, known: Map<string, unknown>, max = 60): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((v): v is string => typeof v === 'string' && known.has(v)))).slice(0, max);
}

/**
 * Server-side validation for estimator payloads. Whitelists every enum against
 * the catalog and silently drops unknown ids (a stale client after a catalog
 * change must degrade, not error). Returns null only when the payload is not
 * even shaped like an estimator input.
 */
export function sanitizeEstimatorInput(raw: unknown): EstimatorInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  if (typeof value.projectType !== 'string' || !PROJECT_TYPES.has(value.projectType)) return null;
  const projectType = value.projectType as ProjectType;

  const service = getService(projectType);
  const subtype =
    typeof value.subtype === 'string' && service.subtypes.some(s => s.id === value.subtype) ? value.subtype : service.subtypes[0].id;

  const def = getSubtype(projectType, subtype);
  const tier: Tier = typeof value.tier === 'string' && TIERS.has(value.tier) ? (value.tier as Tier) : 'mvp';
  const design: DesignStatus = typeof value.design === 'string' && DESIGNS.has(value.design) ? (value.design as DesignStatus) : 'custom';
  const urgency: Urgency = typeof value.urgency === 'string' && URGENCIES.has(value.urgency) ? (value.urgency as Urgency) : 'normal';
  const approach: MobileApproach = value.approach === 'native' ? 'native' : 'cross';

  const platforms = Array.isArray(value.platforms)
    ? (Array.from(new Set(value.platforms.filter((p): p is Platform => typeof p === 'string' && PLATFORMS.has(p)))) as Platform[])
    : [];

  const screensRaw = Number(value.screens);
  const screens =
    def.maxScreens === 0
      ? 0
      : Math.min(Math.max(Number.isFinite(screensRaw) ? Math.round(screensRaw) : def.defaultScreens, 1), def.maxScreens);

  const languagesRaw = Number(value.languages);
  const languages = Math.min(Math.max(Number.isFinite(languagesRaw) ? Math.round(languagesRaw) : 2, 1), 3);

  const description =
    typeof value.description === 'string'
      ? value.description

          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
          .trim()
          .slice(0, MAX_DESCRIPTION_LENGTH)
      : '';

  return {
    projectType,
    subtype,
    platforms: projectType === 'mobile' ? (platforms.length ? platforms : (['ios', 'android'] as Platform[])) : [],
    approach,
    tier,
    screens,
    features: idList(value.features, FEATURE_BY_ID),
    integrations: idList(value.integrations, INTEGRATION_BY_ID),
    techStack: idList(value.techStack, TECH_BY_ID),
    autoTech: value.autoTech !== false,
    design,
    languages,
    urgency,
    description,
  };
}
