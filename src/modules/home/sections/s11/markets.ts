import { distinctByKind } from '../../media/descriptors';
import { LAB_PROJECTS, type LabProject } from '../../media/portfolio';

/**
 * Where the work went, derived from the portfolio data (media/portfolio.ts →
 * shared/data/projects.ts `location`). Nothing here is typed in by hand
 * except geography: pin coordinates are a representative point for each
 * place the data names (a country, or a city/state a description names:
 * Medrite and Persona are New York, Bysmillah is California).
 */

export type CountryTag = 'uz' | 'us' | 'ca' | 'gb' | 'nl' | 'au';
export type RegionId = 'home' | 'europe' | 'north-america' | 'oceania';

/** Index of each country in the dot shader's `uLit` array (0 = untagged land). */
export const TAG_INDEX: Readonly<Record<CountryTag, number>> = { uz: 1, us: 2, ca: 3, gb: 4, nl: 5, au: 6 };
export const TAG_COUNT = 7;

interface PlaceInfo {
  tag: CountryTag | null;
  region: RegionId;
  continent: string;
}

/** Portfolio `location` values. 'International' has no place on a map and is counted separately. */
const PLACES: Readonly<Record<string, PlaceInfo>> = {
  Uzbekistan: { tag: 'uz', region: 'home', continent: 'Asia' },
  USA: { tag: 'us', region: 'north-america', continent: 'North America' },
  Canada: { tag: 'ca', region: 'north-america', continent: 'North America' },
  'United Kingdom': { tag: 'gb', region: 'europe', continent: 'Europe' },
  Netherlands: { tag: 'nl', region: 'europe', continent: 'Europe' },
  Europe: { tag: null, region: 'europe', continent: 'Europe' },
  Australia: { tag: 'au', region: 'oceania', continent: 'Oceania' },
};

/** Pin ids; each names its label (home.globe.pins.<id>, and .pinsShort.<id> for hasShort). */
export type PinId = 'tashkent' | 'gb' | 'nl' | 'ny' | 'ca' | 'cal' | 'au';

export interface Pin {
  id: PinId;
  lat: number;
  lon: number;
  tag: CountryTag;
  region: RegionId;
  /** Which side of the pin its DOM label sits on (neighbours point away from each other). */
  side: 'left' | 'right';
  /**
   * May the label swap sides near the stage edge? Not for pins with a close
   * neighbour (UK/Netherlands, New York/Canada): they would collide, so
   * they fade at the edge instead.
   */
  canFlip: boolean;
  /** Has a shorter label for phone-width stages, where the long one cannot fit beside the limb. */
  hasShort?: boolean;
}

export const HOME_PIN: Pin = {
  id: 'tashkent',
  lat: 41.2995,
  lon: 69.2401,
  tag: 'uz',
  region: 'home',
  side: 'right',
  canFlip: true,
};

/** Arc destinations, in launch order. */
export const DESTINATIONS: readonly Pin[] = [
  { id: 'gb', hasShort: true, lat: 51.5072, lon: -0.1276, tag: 'gb', region: 'europe', side: 'left', canFlip: false },
  { id: 'nl', lat: 52.3676, lon: 4.9041, tag: 'nl', region: 'europe', side: 'right', canFlip: false },
  { id: 'ny', lat: 40.7128, lon: -74.006, tag: 'us', region: 'north-america', side: 'right', canFlip: false },
  { id: 'ca', lat: 43.6532, lon: -79.3832, tag: 'ca', region: 'north-america', side: 'left', canFlip: false },
  { id: 'cal', lat: 36.7783, lon: -119.4179, tag: 'us', region: 'north-america', side: 'left', canFlip: true },
  { id: 'au', lat: -33.8688, lon: 151.2093, tag: 'au', region: 'oceania', side: 'right', canFlip: true },
];

/** Every pin that gets a DOM label: home first, then the destinations. */
export const ALL_PINS: readonly Pin[] = [HOME_PIN, ...DESTINATIONS];

// ── Counting ───────────────────────────────────────────────────────────

const projects = LAB_PROJECTS;

function placeOf(project: LabProject): PlaceInfo | null {
  return PLACES[project.location] ?? null;
}

function countWhere(predicate: (project: LabProject) => boolean): number {
  return projects.filter(predicate).length;
}

const byLocation = (location: string) => (project: LabProject) => project.location === location;
const byRegion = (region: RegionId) => (project: LabProject) => placeOf(project)?.region === region;

/**
 * Examples for the captions, as kinds of product ("a messenger app"), never
 * names (founder, 2026-10-10: only the work wall names projects). Never
 * sensitive-finance work (founders' rule); portfolio order, each kind once.
 * The words are resolved per language at render time (useGlobeCopy).
 */
function exampleProjects(region: RegionId, count: number): LabProject[] {
  const eligible = projects.filter(p => byRegion(region)(p) && !p.isSensitiveFinance);
  return distinctByKind(eligible, count);
}

export interface Examples {
  projects: readonly LabProject[];
  /** How many more products the region holds beyond the examples. */
  rest: number;
}

function examplesOf(region: RegionId, show: number): Examples {
  const picked = exampleProjects(region, show);
  return { projects: picked, rest: countWhere(byRegion(region)) - picked.length };
}

/** The region's first and last portfolio categories (`project.type`, English data — localize with the describer), or null with fewer than two. */
function typeRange(region: RegionId): { first: string; last: string } | null {
  const types = [...new Set(projects.filter(byRegion(region)).map(p => p.type))];
  return types.length > 1 ? { first: types[0], last: types[types.length - 1] } : null;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance from Tashkent, rounded to 100 km. */
function kmFromHome(pin: Pin): number {
  const dLat = toRad(pin.lat - HOME_PIN.lat);
  const dLon = toRad(pin.lon - HOME_PIN.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(HOME_PIN.lat)) * Math.cos(toRad(pin.lat)) * Math.sin(dLon / 2) ** 2;
  const km = 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
  return Math.round(km / 100) * 100;
}

function farthestKm(region: RegionId): number {
  return Math.max(...DESTINATIONS.filter(pin => pin.region === region).map(kmFromHome));
}

const total = projects.length;
const uzCount = countWhere(byLocation('Uzbekistan'));
const usCount = countWhere(byLocation('USA'));
const caCount = countWhere(byLocation('Canada'));
const europeCount = countWhere(byRegion('europe'));
const oceaniaCount = countWhere(byRegion('oceania'));
const northAmericaCount = countWhere(byRegion('north-america'));
/** Everything not built for a client in Uzbekistan (mapped markets + 'International'). */
const abroadCount = countWhere(project => project.location !== 'Uzbekistan');
/** 'International': teams spread across several countries, no single place on the map. */
const worldwideCount = projects.filter(p => !placeOf(p)).length;
const countryCount = new Set(projects.map(p => (placeOf(p)?.tag ? p.location : null)).filter(Boolean)).size;

/** Continents the portfolio reaches (the heading's "four continents"; HOME_FACTS.continents). */
export const CONTINENT_COUNT = new Set(projects.map(p => placeOf(p)?.continent).filter(Boolean)).size;

// ── Story beats ────────────────────────────────────────────────────────

/**
 * A beat's data. Its words live in messages (home.globe.beats.<id>) and take
 * these values as ICU arguments; useGlobeCopy builds the lines.
 */
export interface Beat {
  id: RegionId | 'finale';
  /** Product count for the beat: the title's numeral (counts up) and the route stop's figure. */
  count: number;
  /** Product kinds named in the detail line (none for the finale). */
  examples: Examples | null;
  /** Farthest flight in the region (km), for the detail line. */
  km: number | null;
  /** Where the globe faces at this beat (degrees). Unwrapped so the turn is always westward. */
  focusLon: number;
  focusLat: number;
}

/**
 * Westward, once around: Tashkent → Europe → North America → across the
 * Pacific → Australia → back to Tashkent. Focus points sit between home and
 * the destination so the whole arc is in view.
 */
export const BEATS: readonly Beat[] = [
  { id: 'home', count: uzCount, examples: examplesOf('home', 3), km: null, focusLon: HOME_PIN.lon, focusLat: HOME_PIN.lat },
  { id: 'europe', count: europeCount, examples: examplesOf('europe', 2), km: farthestKm('europe'), focusLon: 32, focusLat: 47 },
  {
    id: 'north-america',
    count: northAmericaCount,
    examples: examplesOf('north-america', 3),
    km: farthestKm('north-america'),
    focusLon: -92,
    focusLat: 41,
  },
  {
    id: 'oceania',
    count: oceaniaCount,
    examples: examplesOf('oceania', 2),
    km: farthestKm('oceania'),
    focusLon: 128 - 360,
    focusLat: -12,
  },
  { id: 'finale', count: total, examples: null, km: null, focusLon: HOME_PIN.lon - 360, focusLat: HOME_PIN.lat },
];

/** Values the beats' messages interpolate (all counted from the portfolio). */
export const BEAT_VALUES = {
  us: usCount,
  ca: caCount,
  countries: countryCount,
  abroad: abroadCount,
  worldwide: worldwideCount,
  oceaniaRange: typeRange('oceania'),
} as const;

/** Great-circle distance (km, rounded to 100) from Tashkent to each destination, in DESTINATIONS order. */
export const DESTINATION_KM: readonly number[] = DESTINATIONS.map(kmFromHome);
