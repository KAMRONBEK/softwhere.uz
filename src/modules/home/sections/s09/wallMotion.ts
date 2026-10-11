import { Flip } from 'gsap/Flip';
import { gsap } from '../../global/gsap';
import { RUBBER } from './engineConfig';
import { SCROLL_DRIFT_X, SCROLL_DRIFT_Y, wrapCentered, type WallLayout, type WallMetrics } from './layout';

gsap.registerPlugin(Flip);

/**
 * The Work Wall engine's pure helpers (spatial lookups on a layout) and its
 * one-shot GSAP choreography (intro, filter re-deal), kept apart from the
 * per-frame loop in engine.ts.
 */

export type WallDirection = 'left' | 'right' | 'up' | 'down';

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The index with the smallest distance, or null for an empty list. */
export function nearestIndex(indices: readonly number[], distanceOf: (index: number) => number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const i of indices) {
    const d = distanceOf(i);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/** Rubber band past the edge of an axis that does not wrap: outward moves are damped. */
export function rubberBand(delta: number, value: number, wraps: boolean, range: number): number {
  if (wraps) return delta;
  const isOutward = (value >= range && delta > 0) || (value <= -range && delta < 0);
  return isOutward ? delta * RUBBER : delta;
}

/**
 * The tile that should play when the wall rests without hover: the one
 * nearest the focus point, except that the playing tile is kept until it has
 * clearly drifted away (hysteresis, so a small nudge does not switch videos).
 */
export function focusPick(
  onScreen: readonly number[],
  active: number | null,
  metrics: Pick<WallMetrics, 'vw' | 'focusY' | 'mediaH'>,
  positionOf: (index: number) => readonly [number, number]
): number | null {
  const distanceOf = (i: number) => {
    const [x, y] = positionOf(i);
    return Math.hypot(x - metrics.vw / 2, (y - metrics.focusY) * 1.2);
  };
  const best = nearestIndex(onScreen, distanceOf);
  if (best === null || best === active) return active;
  if (active !== null && onScreen.includes(active) && distanceOf(active) < metrics.mediaH * 0.7) return active;
  return best;
}

/** Lean (rotateX, rotateY in degrees) of a card toward a pointer at (x, y). */
export function tiltToward(rect: DOMRect, x: number, y: number, maxDeg: number): Point {
  const nx = clamp((x - rect.left) / rect.width - 0.5, -0.5, 0.5);
  const ny = clamp((y - rect.top) / rect.height - 0.5, -0.5, 0.5);
  return { x: -ny * 2 * maxDeg, y: nx * 2 * maxDeg };
}

/** The spatial neighbour of a tile, for arrow-key navigation (wraps). `screenX` is each tile's current x. */
export function neighborIndex(
  layout: WallLayout,
  visible: readonly number[],
  screenX: (index: number) => number,
  index: number,
  direction: WallDirection
): number {
  const spec = layout.slots.get(index);
  if (!spec) return visible[0] ?? index;
  const byRow = new Map<number, number[]>();
  visible.forEach(i => {
    const s = layout.slots.get(i);
    if (!s) return;
    byRow.set(s.row, [...(byRow.get(s.row) ?? []), i]);
  });

  if (direction === 'left' || direction === 'right') {
    const row = [...(byRow.get(spec.row) ?? [index])].sort((a, b) => screenX(a) - screenX(b));
    const at = row.indexOf(index);
    const step = direction === 'right' ? 1 : -1;
    return row[(at + step + row.length) % row.length];
  }

  const rowCount = layout.rows.length;
  const step = direction === 'down' ? 1 : -1;
  const candidates = byRow.get((spec.row + step + rowCount) % rowCount) ?? [];
  if (candidates.length === 0) return index;
  const x = screenX(index);
  return candidates.reduce((best, i) => (Math.abs(screenX(i) - x) < Math.abs(screenX(best) - x) ? i : best));
}

/**
 * How far the pan must move so that, at rest on `pan` (drift included), the
 * tile nearest the focus point sits exactly on it. Positions are linear in
 * the pan, so the resting layout is predicted without rendering it.
 */
export function snapCorrection(layout: WallLayout, metrics: WallMetrics, visible: readonly number[], pan: Point): Point {
  const focusOffset = metrics.focusY - metrics.vh / 2;
  let best: { dx: number; dy: number; parallax: number; d: number } | null = null;
  for (const i of visible) {
    const spec = layout.slots.get(i);
    if (!spec) continue;
    const row = layout.rows[spec.row];
    let x = spec.x + pan.x * row.parallax;
    if (layout.wrapX) x = wrapCentered(x, row.width);
    let y = row.y + pan.y;
    if (layout.wrapY) y = wrapCentered(y, layout.height);
    const dy = y - focusOffset;
    const d = Math.hypot(x, dy * 1.2);
    if (!best || d < best.d) best = { dx: x, dy, parallax: row.parallax, d };
  }
  if (!best) return { x: 0, y: 0 };
  return {
    x: layout.wrapX || layout.rangeX > 0 ? best.dx / best.parallax : 0,
    y: layout.wrapY || layout.rangeY > 0 ? best.dy : 0,
  };
}

/**
 * Drift for `travel` px of scroll past the moment the stage pins, on the axes
 * the layout wraps. A wall too short to wrap vertically is walked through top
 * to bottom instead, over the `pinned` stretch (on touch that is the only way
 * to reach its lower tiles).
 */
export function scrollDrift(layout: WallLayout, travel: number, pinned: number): Point {
  let y = layout.wrapY ? -travel * SCROLL_DRIFT_Y : 0;
  if (!layout.wrapY && layout.rangeY > 0) y = layout.rangeY * (1 - 2 * clamp(travel / Math.max(1, pinned), 0, 1));
  return { x: layout.wrapX ? -travel * SCROLL_DRIFT_X : 0, y };
}

/** Intro: the wall swings up from a tilted plane. */
const INTRO_TILT = { rotationX: 42, rotationZ: -6, scale: 0.78, yPercent: 10 };

interface IntroOptions {
  plane: HTMLElement | null;
  /** Tile wrappers to rise in, each with its distance (px) from the focus point. */
  tiles: ReadonlyArray<{ el: HTMLElement; distance: number }>;
  hasEffects: boolean;
  seconds: number;
}

/** The plane's swing and the tiles rising in, nearest the focus point first. */
export function introTweens({ plane, tiles, hasEffects, seconds }: IntroOptions): gsap.core.Animation[] {
  const tweens: gsap.core.Animation[] = [];
  if (plane && hasEffects) {
    tweens.push(
      gsap.fromTo(
        plane,
        { ...INTRO_TILT, transformPerspective: 1400, transformOrigin: '50% 70%' },
        { rotationX: 0, rotationZ: 0, scale: 1, yPercent: 0, duration: seconds, ease: 'power4.out', clearProps: 'transform' }
      )
    );
  }
  tiles.forEach(({ el, distance }) => {
    tweens.push(
      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.78, y: 50 },
        { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: 'expo.out', delay: 0.05 + distance * 0.0006, clearProps: 'transform' }
      )
    );
  });
  return tweens;
}

interface RedealOptions {
  /** Flip state of the tiles that stay, captured before the re-layout. */
  state: Flip.FlipState;
  leaving: readonly HTMLElement[];
  entering: readonly HTMLElement[];
  /** A leaving tile has faded out: hide its slot. */
  onLeft: (el: HTMLElement) => void;
}

/** Filter change: leaving tiles drop away, staying ones Flip to their new slots, new ones land. */
export function redealTweens({ state, leaving, entering, onLeft }: RedealOptions): {
  flip: gsap.core.Timeline;
  tweens: gsap.core.Animation[];
} {
  const tweens: gsap.core.Animation[] = leaving.map(el =>
    gsap.to(el, {
      opacity: 0,
      scale: 0.86,
      duration: 0.32,
      ease: 'power2.in',
      overwrite: true,
      onComplete: () => {
        onLeft(el);
        gsap.set(el, { clearProps: 'opacity,transform' });
      },
    })
  );
  const flip = Flip.from(state, { duration: 0.95, ease: 'power3.inOut', scale: true, stagger: { amount: 0.12, from: 'center' } });
  entering.forEach(el => {
    tweens.push(
      gsap.fromTo(el, { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.7, delay: 0.32, ease: 'expo.out', overwrite: true })
    );
  });
  return { flip, tweens };
}
