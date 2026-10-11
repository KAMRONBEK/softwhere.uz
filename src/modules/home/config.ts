import {
  LOGO_COLOR_IDS,
  LOGO_IDS,
  QUALITY_IDS,
  SECTION_IDS,
  STYLE_IDS,
  type LabState,
  type LogoColor,
  type LogoId,
  type Quality,
  type SectionId,
  type StyleId,
} from './types';

/** Query-param names. Shared links depend on them — do not rename. */
export const LAB_PARAMS = { style: 'style', logo: 'logo', logoColor: 'lc', quality: 'q', only: 'only' } as const;

export const DEFAULT_LAB_STATE: LabState = { style: 'A', logo: 2, logoColor: 'brand', quality: 'auto', only: null };

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pick<T extends string | number>(allowed: readonly T[], raw: string | undefined, fallback: T): T {
  if (raw === undefined) return fallback;
  const match = allowed.find(item => String(item).toLowerCase() === raw.trim().toLowerCase());
  return match ?? fallback;
}

/** `?only=` takes a section id ('devices') or its number ('06' / '6'). */
function parseOnly(raw: string | undefined): SectionId | null {
  const trimmed = raw?.trim();
  if (trimmed && /^\d{1,2}$/.test(trimmed)) return SECTION_IDS[Number(trimmed) - 1] ?? null;
  const id = pick<SectionId | ''>(['', ...SECTION_IDS], trimmed, '');
  return id === '' ? null : id;
}

/** Validates untrusted query params; anything unknown falls back to the default. */
export function parseLabParams(params: RawParams): LabState {
  const only = parseOnly(first(params[LAB_PARAMS.only]));
  return {
    style: pick<StyleId>(STYLE_IDS, first(params[LAB_PARAMS.style])?.toUpperCase(), DEFAULT_LAB_STATE.style),
    logo: pick<LogoId>(LOGO_IDS, first(params[LAB_PARAMS.logo]), DEFAULT_LAB_STATE.logo),
    logoColor: pick<LogoColor>(LOGO_COLOR_IDS, first(params[LAB_PARAMS.logoColor]), DEFAULT_LAB_STATE.logoColor),
    quality: pick<Quality>(QUALITY_IDS, first(params[LAB_PARAMS.quality]), DEFAULT_LAB_STATE.quality),
    only,
  };
}

/** Builds the query string for a state, omitting defaults so links stay short. */
export function toLabSearch(state: LabState): string {
  const search = new URLSearchParams();
  if (state.style !== DEFAULT_LAB_STATE.style) search.set(LAB_PARAMS.style, state.style);
  if (state.logo !== DEFAULT_LAB_STATE.logo) search.set(LAB_PARAMS.logo, String(state.logo));
  if (state.logoColor !== DEFAULT_LAB_STATE.logoColor) search.set(LAB_PARAMS.logoColor, state.logoColor);
  if (state.quality !== DEFAULT_LAB_STATE.quality) search.set(LAB_PARAMS.quality, state.quality);
  if (state.only) search.set(LAB_PARAMS.only, state.only);
  const query = search.toString();
  return query ? `?${query}` : '';
}
