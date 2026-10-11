import { WORK_WALL_THUMBS } from '../../assets/work-wall';
import { WORK_WALL_TILES, type CropKey } from '../../assets/work-wall/tiles';
import { getShowcaseProjects, type LabProject } from '../../media/portfolio';

/**
 * Work Wall data, all derived from the real portfolio (media/portfolio.ts):
 * order, filters, counts and captions are computed, never typed in.
 */

/** Showcase order: strongest first, banking/lending/leasing/insurance last. */
export const WALL_PROJECTS: readonly LabProject[] = getShowcaseProjects();

const HOME_MARKET = 'Uzbekistan';

const AI = /\b(AI|LLM|RAG|GPT|OpenAI|machine learning|computer vision)\b/;
const BOTS = /telegram|\bbots?\b/i;
const WEB_STACK = /^(React( \d+)?|Next\.js.*|Vite|SvelteKit|Svelte|Angular|Vue)$/;
const MOBILE_STACK = /^(React Native.*|Swift|Kotlin|Flutter|Expo.*)$/;

function haystack(p: LabProject): string {
  return [p.type, p.tech.join(' '), p.description].join(' | ');
}

function isMobile(p: LabProject): boolean {
  if (p.platforms.some(platform => platform !== 'web')) return true;
  // No platform token (SDKs, consoles): fall back to the stack.
  return p.platforms.length === 0 && p.tech.some(t => MOBILE_STACK.test(t));
}

function isWeb(p: LabProject): boolean {
  if (p.platforms.includes('web')) return true;
  return p.platforms.length === 0 && !isMobile(p) && p.tech.some(t => WEB_STACK.test(t));
}

export type WallFilterId = 'all' | 'mobile' | 'web' | 'ai';

export interface WallFilter {
  id: WallFilterId;
  /** Indices into WALL_PROJECTS, in display order. */
  indices: readonly number[];
  /** Small counts read as weakness on a chip; they are shown only from this size up. */
  showsCount: boolean;
}

/** A chip shows its count only when it is a number worth reading. */
const MIN_SHOWN_COUNT = 10;

/** Labels live in messages (home.work-wall.filters.<id>). */
const FILTER_DEFS: ReadonlyArray<{ id: WallFilterId; test: (p: LabProject) => boolean }> = [
  { id: 'all', test: () => true },
  { id: 'mobile', test: isMobile },
  { id: 'web', test: isWeb },
  // AI and Telegram bots together: each alone is a handful of projects.
  { id: 'ai', test: p => AI.test(haystack(p)) || BOTS.test(haystack(p)) },
];

/**
 * Display order for a locale. English visitors are mostly abroad, so after
 * the lead project the wall interleaves two international products with one
 * from Uzbekistan; other locales keep the portfolio order. Sensitive-finance
 * work stays last either way.
 */
export function wallOrder(locale: string): readonly number[] {
  const all = WALL_PROJECTS.map((_, i) => i);
  if (locale !== 'en') return all;
  const safe = all.filter(i => !WALL_PROJECTS[i].isSensitiveFinance);
  const sensitive = all.filter(i => WALL_PROJECTS[i].isSensitiveFinance);
  const [lead, ...rest] = safe;
  const abroad = rest.filter(i => WALL_PROJECTS[i].location !== HOME_MARKET);
  const home = rest.filter(i => WALL_PROJECTS[i].location === HOME_MARKET);
  const mixed: number[] = [];
  while (abroad.length > 0 || home.length > 0) {
    mixed.push(...abroad.splice(0, 2), ...home.splice(0, 1));
  }
  return [lead, ...mixed, ...sensitive];
}

/** Filters with at least one project, each listing its projects in `order`. */
export function buildFilters(order: readonly number[]): readonly WallFilter[] {
  return FILTER_DEFS.map(def => {
    const indices = order.filter(i => def.test(WALL_PROJECTS[i]));
    return { id: def.id, indices, showsCount: indices.length >= MIN_SHOWN_COUNT };
  }).filter(filter => filter.indices.length > 0);
}

export function findFilter(filters: readonly WallFilter[], id: WallFilterId): WallFilter {
  return filters.find(f => f.id === id) ?? filters[0];
}

/** A tile's art direction: its still, its shape and where the device sits in each slide. */
export interface ResolvedTile {
  src: string;
  aspect: number;
  stillTime: number;
  loop: readonly [number, number];
  keys: readonly CropKey[];
}

const FULL_FRAME: readonly CropKey[] = [[0, 0, 0, 1, 1]];

/** The tile art for a project (the cropped device still); the full poster frame if none was generated. */
export function tileOf(p: LabProject): ResolvedTile {
  const tile = WORK_WALL_TILES[p.slug];
  if (!tile) return { src: p.poster, aspect: 16 / 9, stillTime: 0, loop: [0, 0], keys: FULL_FRAME };
  return { src: tile.src.src, aspect: tile.aspect, stillTime: tile.stillTime, loop: tile.loop, keys: tile.keys };
}

/** Full 16:9 still at the tile's still time: the lightbox cover until its video plays. */
export function stillOf(p: LabProject): string {
  return WORK_WALL_THUMBS[p.slug]?.src ?? p.poster;
}

export interface StoreLink {
  kind: 'appStore' | 'playMarket' | 'website';
  href: string;
}

/** Store and site links; the caller labels them (store names are brands, "Website" is translated). */
export function storeLinksOf(p: LabProject): StoreLink[] {
  const links: StoreLink[] = [];
  if (p.appStore) links.push({ kind: 'appStore', href: p.appStore });
  if (p.playMarket) links.push({ kind: 'playMarket', href: p.playMarket });
  if (p.website) links.push({ kind: 'website', href: p.website });
  return links;
}

export const STORE_NAMES: Readonly<Record<Exclude<StoreLink['kind'], 'website'>, string>> = {
  appStore: 'App Store',
  playMarket: 'Google Play',
};
