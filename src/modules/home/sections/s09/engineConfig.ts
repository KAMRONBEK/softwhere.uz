import type { DeviceTier } from '../../types';

/** Work Wall engine tuning and contracts (engine.ts). Rates are 1/s for exponential easing. */

export const DRAG_RATE = 24;
export const RELEASE_RATE = 2.6;
export const KEY_RATE = 6.5;
export const INTRO_RATE = 1.7;
export const WHEEL_RATE = 9;
export const DRAG_THRESHOLD = 6;
export const MAX_THROW = 2400;
export const VELOCITY_WINDOW_MS = 100;
/** A pointer held still this long before release throws nothing. */
export const STALE_RELEASE_MS = 90;
export const ZOOM_PER_SPEED = 0.000028;
export const ZOOM_MAX_DROP = 0.11;
export const DRAG_LIFT = 0.035;
export const SKEW_PER_SPEED = 0.0021;
export const SKEW_MAX = 8;
export const CULL_MARGIN = 80;
export const INTRO_MS = 2000;
/** Share of the stage on screen before the intro plays (so it is seen, not missed). */
export const INTRO_RATIO = 0.4;
export const TILT_MAX_DEG = 7;
export const SETTLE_SPEED = 45;
export const SETTLE_MS = 320;
/** Layers are kept this long after the wall stops (a quick re-grab does not re-promote). */
export const LAYER_LINGER_MS = 300;
export const RUBBER = 0.35;
/** Clear space under the folded title before the focus band starts. */
export const FOLDED_TITLE_GAP = 28;
/** A per-frame move this large is a jump (section link, scroll restore), not motion: no lean or lift. */
export const JUMP_PX = 360;

/**
 * Bend: while the wall is lifted (dragged, flung or scrolled fast) it bows
 * into a shallow dome (edges turn away and sink back), then flattens as it
 * lands. Driven by the same lift as the zoom; 0 at rest, so a still wall is 2D.
 */
export const BEND_Y_DEG = 15;
export const BEND_X_DEG = 9;
export const BEND_DEPTH = 150;
/** Below this the bend is dropped and tiles get their plain 2D transform back. */
export const BEND_EPSILON = 0.004;

/**
 * Caption veils: a caption that slides under the header's scrim, the folded
 * title's band or the bottom fade would show through as ghost text, so it
 * fades out there (the tile's picture just recedes into the fog).
 * Fold progress past which the band is mostly in / the scrim mostly gone
 * (S09WorkWall's fold timeline: band 0 → 0.3, scrim 0.55 → 0.9).
 */
export const VEIL_BAND_FROM = 0.15;
export const VEIL_SCRIM_UNTIL = 0.72;
/** Px inside the scrim's feathered right and bottom edges where its cover drops to ~15%. */
export const VEIL_SCRIM_INSET_X = 40;
export const VEIL_SCRIM_INSET_Y = 20;
/** The folded title's band: its gap and fade below the title (wall.module.css .band) minus the faint tail. */
export const VEIL_BAND_BELOW_TITLE = 58;
/** Bottom fade (wall.module.css .edges): share of the stage height where it covers ~45%. */
export const VEIL_BOTTOM_SHARE = 0.1;

export interface WallEngineOptions {
  stage: HTMLElement;
  /** The tall section track: page scroll through it drifts the wall. */
  track: HTMLElement | null;
  /** Absolutely positioned tile slots, by project index (the engine owns their transform). */
  slots: ReadonlyArray<HTMLElement | null>;
  /** Inner wrappers, by project index: Flip and the enter/leave tweens animate these. */
  flippers: ReadonlyArray<HTMLElement | null>;
  header: HTMLElement | null;
  /** The title the header folds into on scroll: the focus band starts below its folded size. */
  foldTitle?: { el: HTMLElement; scale: number } | null;
  footer: HTMLElement | null;
  /** The legibility scrim behind the unfolded header (captions under it are veiled). */
  scrim?: HTMLElement | null;
  /** Header fold progress, 0 (full header) → 1 (corner title). */
  getFold?: () => number;
  indices: readonly number[];
  /** Tile aspect (media width / height), by project index. */
  aspects: readonly number[];
  reducedMotion: boolean;
  tier: DeviceTier;
  isTouch: boolean;
  onActiveChange: (index: number | null) => void;
  /** Called once, when the wall first comes into view (or right away under reduced motion). */
  onIntro?: () => void;
}

export interface DragState {
  id: number;
  type: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  samples: Array<{ t: number; x: number; y: number }>;
}
