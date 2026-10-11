/**
 * Hero geometry, shared by the WebGL scene, the input layer and the DOM
 * shockwave, and mirrored by the CSS still/fallback (S01Hero.module.css,
 * --mark, --mark-x, --mark-y): mark size
 * and centre offset (share of the frame). Then the scroll dissolve: the
 * direction the wind blows (mark space, unit), the side that goes first
 * (`sweep`, unit), how much scroll it takes (stage heights) and how much of
 * the page's scroll the mark follows while the stage is sticky.
 *
 * Landscape: the copy is beside the mark, so the wind strips it from the top
 * right and the accent node goes last, like a comet head. Portrait: the copy
 * rises from below, so the mark goes bottom first and is always gone from
 * wherever the headline is about to be.
 */
export const PORTRAIT_ASPECT = 1.1;
export interface Layout {
  size: (w: number, h: number) => number;
  x: number;
  y: number;
  wind: readonly [number, number];
  sweep: readonly [number, number];
  span: number;
  follow: number;
}
// x/size keep the mark's ink a stroke-width or more clear of the headline's longest line at 1280-1920.
const LANDSCAPE: Layout = {
  size: (w, h) => Math.min(h * 0.74, w * 0.41),
  x: 0.25,
  y: 0.02,
  wind: [0.53, 0.85],
  sweep: [0.53, 0.85],
  span: 0.5,
  follow: 0.45,
};
const PORTRAIT: Layout = {
  size: (w, h) => Math.min(w * 0.76, h * 0.34),
  x: 0,
  y: 0.21,
  wind: [0.3, 0.954],
  sweep: [0, -1],
  span: 0.42,
  follow: 0.3,
};

export const layoutFor = (width: number, height: number): Layout => (width / Math.max(1, height) < PORTRAIT_ASPECT ? PORTRAIT : LANDSCAPE);

/** The mark's on-screen size in px for a stage of this size (the DOM shockwave times itself with it). */
export function markPixels(width: number, height: number): number {
  return layoutFor(width, height).size(width, height);
}

/** Where the mark's centre sits on a stage of this size, in px from its top left (before any scroll lift). */
export function markCenterPixels(width: number, height: number): readonly [number, number] {
  const layout = layoutFor(width, height);
  return [width * (0.5 + layout.x), height * (0.5 - layout.y)];
}
