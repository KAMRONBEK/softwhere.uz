import { MAX_DROPS } from './shader';

/**
 * Mutable lens state shared by the DOM input handlers, the WebGL scene and
 * the CSS fallback. Lives in a ref: input writes targets, the renderer
 * integrates them per frame. Positions are stage CSS px (y down).
 */
export interface LensController {
  width: number;
  height: number;
  target: [number, number];
  pos: [number, number];
  vel: [number, number];
  /** Low-passed velocity, drives the liquid stretch. */
  flow: [number, number];
  /** Base lens radius for this stage size (CSS px). */
  baseRadius: number;
  radius: number;
  isPressed: boolean;
  isHovering: boolean;
  isRevealAll: boolean;
  /** 0 = whole stage x-rayed (scroll intro start), 1 = normal lens. */
  intro: number;
  /** performance.now() of the last user input; 0 = never. */
  lastInput: number;
  lastInputWasTouch: boolean;
  /** Has the lens been placed at least once (autopilot or user)? */
  isPlaced: boolean;
  /** Autopilot laps finished since the section last came into view; the show parks after one per project. */
  laps: number;
  epoch: number;
  /** MAX_DROPS × (x, y, startSeconds, amplitudePx). */
  drops: Float32Array;
  dropCursor: number;
  lastDropAt: [number, number];
  /** Wakes the renderer (invalidate() in demand mode, repaint for CSS). */
  requestFrame: () => void;
  /** Leaves the parked (render-on-demand) state; set by the section. */
  wake: () => void;
}

export function createController(): LensController {
  return {
    width: 1,
    height: 1,
    target: [0, 0],
    pos: [0, 0],
    vel: [0, 0],
    flow: [0, 0],
    baseRadius: 120,
    radius: 120,
    isPressed: false,
    isHovering: false,
    isRevealAll: false,
    intro: 1,
    lastInput: 0,
    lastInputWasTouch: false,
    isPlaced: false,
    laps: 0,
    epoch: typeof performance === 'undefined' ? 0 : performance.now(),
    drops: new Float32Array(MAX_DROPS * 4),
    dropCursor: 0,
    lastDropAt: [-9999, -9999],
    requestFrame: () => undefined,
    wake: () => undefined,
  };
}

export function seconds(c: LensController): number {
  return (performance.now() - c.epoch) / 1000;
}

export function addDrop(c: LensController, x: number, y: number, amplitude: number): void {
  const i = c.dropCursor * 4;
  c.drops[i] = x;
  c.drops[i + 1] = y;
  c.drops[i + 2] = seconds(c);
  c.drops[i + 3] = amplitude;
  c.dropCursor = (c.dropCursor + 1) % MAX_DROPS;
  c.lastDropAt = [x, y];
}

/** Seconds a ripple stays visible (shader.ts fades it out by then). */
export const DROP_LIFETIME = 2.8;

/** Is any ripple still moving? */
export function hasLiveDrops(c: LensController, now: number): boolean {
  for (let i = 0; i < MAX_DROPS; i++) {
    const o = i * 4;
    if (c.drops[o + 3] > 0 && now - c.drops[o + 2] < DROP_LIFETIME) return true;
  }
  return false;
}

/** Lens radius for a stage: a generous loupe; on phones a bigger share of the width. */
export function baseRadiusFor(width: number, height: number, isWide: boolean): number {
  if (!isWide) return Math.max(96, Math.min(150, width * 0.33, height * 0.3));
  return Math.max(140, Math.min(230, Math.min(width, height) * 0.21));
}

/** Records a user input now (pauses the autopilot and project auto-advance, wakes the renderer). */
export function markInput(c: LensController, isTouch: boolean): void {
  c.lastInput = performance.now();
  c.lastInputWasTouch = isTouch;
  c.isPlaced = true;
  c.wake();
}

/** Radius that covers the whole stage from any lens position. */
export function fullRadius(c: LensController): number {
  return Math.hypot(c.width, c.height) * 1.05;
}

/** The autopilot may steer when the user is not hovering, pressing or recently touching. */
export function isIdle(c: LensController, nowMs: number): boolean {
  if (c.isHovering || c.isPressed) return false;
  const wait = c.lastInputWasTouch ? 3200 : 900;
  return c.lastInput === 0 || nowMs - c.lastInput > wait;
}
