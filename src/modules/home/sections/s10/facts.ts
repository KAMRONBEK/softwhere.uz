import { getShowcaseProjects, type LabProject } from '../../media/portfolio';

/**
 * The section's facts, computed from the real portfolio data, never typed in
 * by hand. Each fact also arranges the 54 project dots of the unit chart
 * (one dot = one product), so every number can be counted on screen.
 */

/** Showcase order: sensitive-finance work last (founders' rule for grids). */
export const CHART_PROJECTS: readonly LabProject[] = getShowcaseProjects();

/** Industry label keys (home.numbers.industries.<key>). */
export type IndustryKey =
  | 'education'
  | 'finance'
  | 'mobility'
  | 'logistics'
  | 'healthcare'
  | 'social'
  | 'events'
  | 'commerce'
  | 'fashion'
  | 'government'
  | 'media'
  | 'business'
  | 'developer'
  | 'robotics';

/**
 * Portfolio `type` labels are fine-grained ("FinTech", "Halal FinTech",
 * "InsurTech", …). Industries group them so the count is not inflated by
 * near-duplicates. A type missing here counts as its own industry.
 */
const INDUSTRY_BY_TYPE: Readonly<Record<string, IndustryKey>> = {
  'AI & EdTech': 'education',
  EdTech: 'education',
  Education: 'education',
  'Halal FinTech': 'finance',
  FinTech: 'finance',
  Banking: 'finance',
  Insurance: 'finance',
  InsurTech: 'finance',
  'Car leasing': 'finance',
  'Fleet fuel cards': 'finance',
  Transport: 'mobility',
  'Ride-hailing': 'mobility',
  'EV & Mobility': 'mobility',
  Services: 'mobility',
  Logistics: 'logistics',
  Healthcare: 'healthcare',
  'Healthcare social network': 'healthcare',
  Messaging: 'social',
  'Social / Community': 'social',
  'Social / Travel': 'social',
  'Sport & Social': 'social',
  'Event planning': 'events',
  'Event Staffing': 'events',
  'Music marketplace': 'commerce',
  'Booking marketplace': 'commerce',
  Marketplace: 'commerce',
  'Job marketplace': 'commerce',
  'E-commerce': 'commerce',
  'Food delivery': 'commerce',
  'Fashion & Design': 'fashion',
  'E-documents': 'government',
  'Document signing': 'government',
  GovTech: 'government',
  'Civic tech': 'government',
  'Video streaming': 'media',
  Gaming: 'media',
  'Workforce management': 'business',
  'Retail analytics': 'business',
  'Brand monitoring': 'business',
  Construction: 'business',
  'Developer tools': 'developer',
  Robotics: 'robotics',
};

const HOME = 'Uzbekistan';
/** Locations that name a region, not a country: grouped as "international". */
const REGIONS = new Set(['International', 'Europe', 'Worldwide', 'Global']);
const INTERNATIONAL = 'International';

/** Place label keys (home.numbers.places.<key> and .placesInProse.<key>). */
export type PlaceKey = 'uz' | 'us' | 'ca' | 'gb' | 'nl' | 'au' | 'international';
const PLACE_KEYS: Readonly<Record<string, PlaceKey>> = {
  Uzbekistan: 'uz',
  USA: 'us',
  Canada: 'ca',
  'United Kingdom': 'gb',
  Netherlands: 'nl',
  Australia: 'au',
  [INTERNATIONAL]: 'international',
};

export type PlatformGroupKey = 'both' | 'ios' | 'android' | 'other';

/**
 * What a group is called, resolved to words at render time (messages):
 * a key into one of the section's label tables, or, for a place or type the
 * tables do not know yet (a later portfolio addition), the data's own word.
 */
export type GroupName =
  | { kind: 'all' }
  | { kind: 'platform'; key: PlatformGroupKey }
  | { kind: 'place'; key: PlaceKey | null; raw: string }
  | { kind: 'industry'; key: IndustryKey | null; raw: string };

export interface ChartGroup {
  id: string;
  /** Hover/legend name. */
  name: GroupName;
  /** Indices into CHART_PROJECTS. */
  members: readonly number[];
  /** Counted by the fact (dim groups are the rest of the portfolio, shown for scale). */
  isLit: boolean;
}

export type FactId = 'built' | 'platforms' | 'abroad' | 'industries';

/**
 * Which caption variant a fact shows (home.numbers.facts.<id>.<caption>),
 * chosen from the data so the words never claim more than it holds.
 */
export type CaptionKey = 'caption' | 'captionShared' | 'captionNoInternational';

export interface NumberFact {
  id: FactId;
  value: number;
  caption: CaptionKey;
  /** Under the chart, one entry per group, in chart order; false = the "hover/tap a dot" hint. */
  hasLegend: boolean;
  groups: readonly ChartGroup[];
  /** What the number counts: lit dots, or lit groups (industries). */
  unit: 'dot' | 'group';
}

const indices = (predicate: (project: LabProject) => boolean): number[] =>
  CHART_PROJECTS.flatMap((project, index) => (predicate(project) ? [index] : []));

function groupBy(key: (project: LabProject) => string): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  CHART_PROJECTS.forEach((project, index) => {
    const id = key(project);
    groups.set(id, [...(groups.get(id) ?? []), index]);
  });
  return groups;
}

/** Biggest group first; ties by id, so the order is the same in every language. */
function bySize(a: ChartGroup, b: ChartGroup): number {
  return b.members.length - a.members.length || a.id.localeCompare(b.id);
}

function litCount(groups: readonly ChartGroup[]): number {
  return groups.reduce((sum, group) => sum + (group.isLit ? group.members.length : 0), 0);
}

const placeName = (location: string): GroupName => ({ kind: 'place', key: PLACE_KEYS[location] ?? null, raw: location });

// ── 01 · shipped ────────────────────────────────────────────────────────────

const allGroups: ChartGroup[] = [{ id: 'all', name: { kind: 'all' }, members: indices(() => true), isLit: true }];

// ── 02 · iPhone and Android ─────────────────────────────────────────────────

const isIos = (project: LabProject) => project.platforms.includes('ios');
const isAndroid = (project: LabProject) => project.platforms.includes('android');
const platformGroup = (key: PlatformGroupKey, predicate: (p: LabProject) => boolean, isLit: boolean): ChartGroup => ({
  id: key,
  name: { kind: 'platform', key },
  members: indices(predicate),
  isLit,
});
const platformGroups: ChartGroup[] = [
  platformGroup('both', p => isIos(p) && isAndroid(p), true),
  platformGroup('ios', p => isIos(p) && !isAndroid(p), false),
  platformGroup('android', p => isAndroid(p) && !isIos(p), false),
  platformGroup('other', p => !isIos(p) && !isAndroid(p), false),
].filter(group => group.members.length > 0);
const bothPlatforms = CHART_PROJECTS.filter(p => isIos(p) && isAndroid(p));
/** True only if every one of them lists React Native: the caption claims one codebase per app. */
const isAllReactNative = bothPlatforms.every(p => p.tech.some(tech => /react native|expo/i.test(tech)));

// ── 03 · abroad ─────────────────────────────────────────────────────────────

const placeKey = (project: LabProject) => (REGIONS.has(project.location) ? INTERNATIONAL : project.location);
const abroadGroups: ChartGroup[] = [
  ...[...groupBy(placeKey)]
    .filter(([place]) => place !== HOME)
    .map(([place, members]) => ({ id: place, name: placeName(place), members, isLit: true }))
    .sort(bySize),
  { id: HOME, name: placeName(HOME), members: indices(project => project.location === HOME), isLit: false },
];
const abroadCountries = abroadGroups.flatMap(group => {
  const key = PLACE_KEYS[group.id];
  return group.isLit && key && key !== 'international' ? [key] : [];
});
const internationalCount = abroadGroups.find(group => group.id === INTERNATIONAL)?.members.length ?? 0;

/** Data behind the abroad caption: the countries (in chart order) and the multi-country projects. */
export const ABROAD_CAPTION: { readonly countries: readonly PlaceKey[]; readonly international: number } = {
  countries: abroadCountries,
  international: internationalCount,
};

// ── 04 · industries ─────────────────────────────────────────────────────────

const industryOf = (project: LabProject) => INDUSTRY_BY_TYPE[project.type] ?? project.type;
const industryGroups: ChartGroup[] = [...groupBy(industryOf)]
  .map(([industry, members]) => {
    const key = (Object.values(INDUSTRY_BY_TYPE) as string[]).includes(industry) ? (industry as IndustryKey) : null;
    return { id: industry, name: { kind: 'industry', key, raw: industry } satisfies GroupName, members, isLit: true };
  })
  .sort(bySize);

/** Biggest first, so the numeral counts down the portfolio (the whole portfolio always leads). */
export const NUMBER_FACTS: readonly NumberFact[] = (
  [
    { id: 'built', value: CHART_PROJECTS.length, caption: 'caption', hasLegend: false, groups: allGroups, unit: 'dot' },
    {
      id: 'platforms',
      value: litCount(platformGroups),
      caption: isAllReactNative ? 'captionShared' : 'caption',
      hasLegend: true,
      groups: platformGroups,
      unit: 'dot',
    },
    {
      id: 'abroad',
      value: litCount(abroadGroups),
      caption: internationalCount > 0 ? 'caption' : 'captionNoInternational',
      hasLegend: true,
      groups: abroadGroups,
      unit: 'dot',
    },
    {
      id: 'industries',
      value: industryGroups.length,
      caption: 'caption',
      hasLegend: true,
      groups: industryGroups,
      unit: 'group',
    },
  ] satisfies NumberFact[]
).sort((a, b) => b.value - a.value);
