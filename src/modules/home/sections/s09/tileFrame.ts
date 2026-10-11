import * as T from './engineConfig';

/**
 * Per-tile, per-frame helpers for the Work Wall engine: the tile transform
 * (flat at rest, bowed into a dome while the wall is lifted) and the caption
 * veils (where a caption would show through the header or bottom fade as
 * ghost text). Pure math, no DOM writes.
 */

/** Stage-space lines past which a caption is veiled. */
export interface VeilLines {
  /** Unfolded header scrim: captions left of `scrimRight` and above `scrimBottom`. */
  scrimRight: number;
  scrimBottom: number;
  /** Folded title band: captions whose top is above this line. */
  bandLine: number;
  /** Bottom fade and footer controls: captions whose bottom is below this line. */
  bottomLine: number;
}

interface VeilInput {
  stage: DOMRect;
  scrim: DOMRect | null;
  /** Bottom of the folded corner title, stage space (null without a fold). */
  foldedTitleBottom: number | null;
  footerTop: number;
}

export function measureVeil({ stage, scrim, foldedTitleBottom, footerTop }: VeilInput): VeilLines {
  const vh = stage.height;
  return {
    scrimRight: scrim ? scrim.right - stage.left - T.VEIL_SCRIM_INSET_X : -Infinity,
    scrimBottom: scrim ? scrim.bottom - stage.top - T.VEIL_SCRIM_INSET_Y : -Infinity,
    bandLine: foldedTitleBottom === null ? -Infinity : foldedTitleBottom + T.VEIL_BAND_BELOW_TITLE,
    bottomLine: vh - Math.max(vh * T.VEIL_BOTTOM_SHARE, vh - footerTop + 8),
  };
}

interface CaptionBox {
  left: number;
  top: number;
  bottom: number;
}

/** True when the caption sits where the page fades over the wall. `fold` is the header fold progress. */
export function isCaptionVeiled(lines: VeilLines, fold: number, caption: CaptionBox): boolean {
  if (caption.bottom > lines.bottomLine) return true;
  if (fold > T.VEIL_BAND_FROM && caption.top < lines.bandLine) return true;
  return fold < T.VEIL_SCRIM_UNTIL && caption.top < lines.scrimBottom && caption.left < lines.scrimRight;
}

/** A tile (center and half extents, stage px) entirely outside the stage plus `margin`. */
export function isOffscreen(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  stage: { vw: number; vh: number },
  margin: number
): boolean {
  return cx + halfW < -margin || cx - halfW > stage.vw + margin || cy + halfH < -margin || cy - halfH > stage.vh + margin;
}

interface TileFrame {
  /** Top-left of the unscaled tile box (its transform-origin is its center). */
  left: number;
  top: number;
  scale: number;
  skew: number;
  /** 0 (flat) → 1 (fully bowed). */
  bend: number;
  /** Tile center relative to the stage center, in half-stage units (≈ -1 … 1). */
  nx: number;
  ny: number;
}

/**
 * The slot transform. Flat (2D) unless the wall is bent: then each tile
 * turns away from the center and sinks back with its distance, under the
 * plane's CSS perspective, so the wall reads as a shallow dome.
 */
export function tileTransform({ left, top, scale, skew, bend, nx, ny }: TileFrame): string {
  const tail = `scale(${scale.toFixed(4)}) skewX(${skew.toFixed(2)}deg)`;
  if (bend < T.BEND_EPSILON) return `translate(${left.toFixed(1)}px,${top.toFixed(1)}px) ${tail}`;
  const z = -(nx * nx + ny * ny * 0.6) * bend * T.BEND_DEPTH;
  const rx = -ny * bend * T.BEND_X_DEG;
  const ry = nx * bend * T.BEND_Y_DEG;
  return `translate3d(${left.toFixed(1)}px,${top.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) ${tail}`;
}
