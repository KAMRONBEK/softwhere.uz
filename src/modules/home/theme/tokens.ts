import { BRAND_ORANGE } from '../logos/brand';
import { STYLE_IDS } from '../types';
import { FALLBACK_FACES_CSS, LAB_FONTS, type LabFontKey } from './fonts';
import { LAB_STYLES, type LabStyle } from './styles';

/** On <html> while a style switch's reveal runs (set by theme/switchStyle.ts). */
export const SWITCH_ATTR = 'data-lab-switch';

/**
 * The lab wrapper carries `data-lab-root` and `data-style="A|B|C|D"`. The
 * attribute is set before first paint by theme/ThemeScript.tsx (the
 * visitor's remembered style) and kept by React afterwards.
 */
export const LAB_ROOT_ATTR = 'data-lab-root';

const SANS_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO_FALLBACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function fontVar(key: LabFontKey): string {
  return `var(${LAB_FONTS[key].cssVar})`;
}

/**
 * One rule per style. The display stack falls back to the body face first so
 * a Latin-only display family still renders Cyrillic in the style's own body
 * font instead of a system face.
 */
function styleRule(style: LabStyle): string {
  const { colors, fonts, type } = style;
  const declarations = [
    `color-scheme: ${style.scheme}`,
    `--bg: ${colors.bg}`,
    `--bg-2: ${colors.bg2}`,
    `--fg: ${colors.fg}`,
    `--muted: ${colors.muted}`,
    `--accent: ${colors.accent}`,
    `--accent-2: ${colors.accent2}`,
    `--on-accent: ${colors.onAccent}`,
    `--glow: ${colors.glow}`,
    `--font-display: ${fontVar(fonts.display)}, ${fontVar(fonts.body)}, ${SANS_FALLBACK}`,
    `--font-body: ${fontVar(fonts.body)}, ${SANS_FALLBACK}`,
    `--font-mono: ${fontVar(fonts.mono)}, ${MONO_FALLBACK}`,
    `--display-weight: ${type.displayWeight}`,
    `--display-tracking: ${type.displayTracking}`,
    `--display-scale: ${type.displayScale}`,
    `--radius: ${style.radius}`,
  ];
  const root = `[${LAB_ROOT_ATTR}][data-style='${style.id}']`;
  // Also on <html> while the lab is open, so overscroll areas and the body
  // background follow the style (see lab.css).
  return `${root},html:has(${root}){${declarations.join(';')}}`;
}

const ROOT = `[${LAB_ROOT_ATTR}]`;

/**
 * Style-wide defaults that every direction shares. Wrapped in :where() so
 * they carry zero specificity: any section class overrides them.
 * - Headings default to the style's display face, weight and tracking, so a
 *   section that only sets size still looks native in all four styles.
 * - Browser surfaces (selection, caret, form accents, scrollbar) take the
 *   palette instead of the browser's blue.
 * - The logo mark keeps SoftWhere's orange (--logo-ink) unless the panel's
 *   Logo color says "Style accent"; without --logo-ink it paints --accent.
 */
const BASE_RULES = [
  `:where(${ROOT}) :where(h1,h2){font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);text-wrap:balance}`,
  `:where(${ROOT}){caret-color:var(--accent);accent-color:var(--accent)}`,
  `:where(${ROOT}) ::selection{background:var(--accent);color:var(--on-accent)}`,
  `html:has(${ROOT}){scrollbar-color:color-mix(in srgb,var(--fg) 28%,transparent) var(--bg)}`,
  `:where(${ROOT}[data-logo-color='brand']){--logo-ink:${BRAND_ORANGE}}`,
  // A style switch (theme/switchStyle.ts) grows the new look as a circle from
  // the picked swatch: while it runs, <html> carries SWITCH_ATTR and the
  // default crossfade is off (the circle is a WAAPI clip-path on the new
  // snapshot, over a still old one). Without an origin, or under reduced
  // motion, the page crossfades instead: a touch slower than a UI fade
  // because every pixel changes, shorter under reduced motion (opacity only).
  `html:has(${ROOT})::view-transition-old(root),html:has(${ROOT})::view-transition-new(root){animation-duration:320ms;animation-timing-function:ease}`,
  `@media (prefers-reduced-motion: reduce){html:has(${ROOT})::view-transition-old(root),html:has(${ROOT})::view-transition-new(root){animation-duration:160ms}}`,
  `html[${SWITCH_ATTR}='reveal']::view-transition-old(root),html[${SWITCH_ATTR}='reveal']::view-transition-new(root){animation:none;mix-blend-mode:normal}`,
  FALLBACK_FACES_CSS,
];

/**
 * Token stylesheet for every style, generated from styles.ts so CSS and
 * useLabTheme() can never drift. Switching style only flips `data-style`.
 * Built from our own constants (no user input), so it is safe to inline.
 */
export const LAB_TOKENS_CSS = [...STYLE_IDS.map(id => styleRule(LAB_STYLES[id])), ...BASE_RULES].join('\n');
