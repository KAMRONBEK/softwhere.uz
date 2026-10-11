import type { LabTheme } from '../theme/useLabTheme';
import { FIELD_SELECTOR, INTERACTIVE_SELECTOR } from './CursorLayer.hit';

/**
 * The precise point of the lab cursor is the hardware cursor itself: a small
 * themed dot (accent, with a hairline of page colour so it reads over accent
 * fills) handed to the browser as an SVG cursor image. The compositor draws
 * it, so it never lags a frame behind the mouse and keeps moving while the
 * main thread is busy mounting a 3D section. The layer's springs, brackets
 * and trail are decoration around it.
 *
 * The rules live in one <style> element the engine owns: present for the
 * layer's whole life (removed only while a pen or finger has taken over on a
 * hybrid laptop), rewritten only when the style changes. The image URL is a
 * literal in a single declaration — never a var() — so the browser decodes it
 * once rather than once per element.
 */

const SIZE = 20;
const CENTER = SIZE / 2;
const DOT = 4;
const RING = 1.5;

/** CSS `cursor` value: the style's dot (a square in Concrete, round elsewhere), arrow as the fallback. */
export function nativeDotCursor(theme: LabTheme): string {
  const { accent, bg } = theme.colors;
  const isSquare = Number.parseFloat(theme.radius) === 0;
  const outer = DOT + RING;
  const shape = isSquare
    ? `<rect x='${CENTER - outer}' y='${CENTER - outer}' width='${outer * 2}' height='${outer * 2}' fill='${bg}'/>` +
      `<rect x='${CENTER - DOT}' y='${CENTER - DOT}' width='${DOT * 2}' height='${DOT * 2}' fill='${accent}'/>`
    : `<circle cx='${CENTER}' cy='${CENTER}' r='${outer}' fill='${bg}'/><circle cx='${CENTER}' cy='${CENTER}' r='${DOT}' fill='${accent}'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${SIZE}' height='${SIZE}' viewBox='0 0 ${SIZE} ${SIZE}'>${shape}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${CENTER} ${CENTER}, auto`;
}

const ROOT = '[data-lab-root]';
/** Text fields, iframes and [data-cursor-hide] areas keep their own cursor. */
const EXEMPT = `:is(${FIELD_SELECTOR}, [data-cursor-hide]), :is([contenteditable]:not([contenteditable="false"]), [data-cursor-hide]) *`;
/** Where the layer draws the cursor itself: brackets on links and buttons, the label badge. */
const TARGETS = `:is(${INTERACTIVE_SELECTOR}, [data-cursor]:not([data-cursor=""]), [data-magnetic])`;

/**
 * 1. Everywhere in the lab the hardware cursor is the dot.
 * 2. On targets it steps aside, so it never covers a button's label; the
 *    brackets (or the badge) are the cursor there.
 * Rule 2 out-specifies rule 1; both need !important to beat the sections'
 * own `cursor: pointer | grab` declarations.
 */
export function nativeCursorCss(cursor: string): string {
  return [
    `${ROOT}, ${ROOT} *:not(${EXEMPT}) { cursor: ${cursor} !important; }`,
    `${ROOT} ${TARGETS}:not(${EXEMPT}), ${ROOT} ${TARGETS} *:not(${EXEMPT}) { cursor: none !important; }`,
  ].join('\n');
}
