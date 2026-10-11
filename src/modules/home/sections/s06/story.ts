import { GrabSpin, GrabTargets } from './grab';

/**
 * The scroll story of 06 · Devices as plain numbers. One GSAP timeline
 * (duration STORY_LENGTH, scrubbed by the section's scroll) animates a Story
 * object; the WebGL scene and the CSS fallback both read it every frame, so
 * the two renderers can never drift apart.
 */

export interface Story {
  /** Entrance while the section scrolls into view: lid opens, screens power on. */
  boot: number;
  /** Camera: 0 = wide two-device shot, 1 = close on the phone. */
  dolly: number;
  /** Laptop presence: 1 = on stage, 0 = sunk out of frame. */
  laptop: number;
  /** Phone turns from its 3/4 pose to face the viewer. */
  face: number;
  /** App position 0..n-1; every step is one full turn of the phone (the app swaps while its back faces us). */
  app: number;
  /** Global screen position (app × 3 + screen); fractions are in-app transitions. */
  screen: number;
  /** A finger tap on the current screen, 0..1 (0 = none). */
  tap: number;
  /** 1 while the apps play (the phone may offer a spin by hand), else 0. */
  apps: number;
}

export const INITIAL_STORY: Story = { boot: 0, dolly: 0, laptop: 1, face: 0, app: 0, screen: 0, tap: 0, apps: 0 };

/** Timeline length in arbitrary units (1 unit = 1% of the sticky scroll). */
export const STORY_LENGTH = 100;

export const T = {
  introEnd: 8,
  dollyEnd: 22,
  /** App k plays from appsStart + k × appSpan. */
  appsStart: 22,
  appSpan: 19,
  /** Full turn of the phone between two apps, centred on the boundary. */
  spin: 5,
  /** In-app screen changes, relative to the app's start, and how long each takes. */
  screenAt: [5.5, 11.5] as readonly number[],
  screenChange: 2.4,
  /** The tap leads the screen change by this much. */
  tapLead: 1.6,
  tapLength: 2.2,
  outroStart: 79,
  outroEnd: 89,
} as const;

export function appStart(index: number): number {
  return T.appsStart + index * T.appSpan;
}

/**
 * Reduced motion: no scrubbing. The story jumps between these resting points
 * (intro, the first screen of each app, outro) and the DOM crossfades.
 */
export function stations(appCount: number): number[] {
  const apps = Array.from({ length: appCount }, (_, k) => appStart(k) + (k === 0 ? 2.5 : T.spin / 2 + 0.6));
  return [4, ...apps, 98];
}

export function nearestStation(points: readonly number[], progress: number): number {
  const time = progress * STORY_LENGTH;
  let best = points[0];
  for (const point of points) {
    if (Math.abs(point - time) < Math.abs(best - time)) best = point;
  }
  return best;
}

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
/** 0 → 1 as `value` goes from `edge0` to `edge1` (either order). */
export const smoothstep = (edge0: number, edge1: number, value: number): number => smooth((value - edge0) / (edge1 - edge0));

/** The phone rests facing the viewer between two turns, during the apps: the moment to offer a spin by hand. */
export function isPhoneFacing(story: Story): boolean {
  return story.apps > 0.5 && Math.abs(story.app - Math.round(story.app)) < 0.03;
}

/** The app on the display: it swaps half-way through a turn, while the back faces the camera. */
export function currentApp(story: Story, appCount: number): number {
  return Math.min(appCount - 1, Math.max(0, Math.round(story.app)));
}

export interface ScreenState {
  /** Screen leaving (index in the app). */
  from: number;
  /** Screen arriving. */
  to: number;
  /** Transition progress 0..1. */
  mix: number;
}

/** Which of the current app's screens are on the display, and how far the change between them is. */
export function screenState(story: Story, app: number, screensPerApp: number): ScreenState {
  const local = Math.min(screensPerApp - 1, Math.max(0, story.screen - app * screensPerApp));
  const from = Math.floor(local);
  const to = Math.min(screensPerApp - 1, from + 1);
  return { from, to, mix: to === from ? 0 : local - from };
}

/** Scroll speed (px/s) at which the device nod saturates. */
const VELOCITY_SCALE = 3000;

/**
 * Mutable state shared by the section, the WebGL scene and the CSS fallback.
 * Deliberately not React state: it changes every frame. Writes go through
 * methods; GSAP tweens `story` directly.
 */
export class DevicesRuntime {
  readonly story: Story = { ...INITIAL_STORY };
  /** Pointer / touch position over the stage, -1..1, and whether it is engaged. */
  readonly pointer = { x: 0, y: 0, isActive: false };
  /** The visitor turning the phone by hand. */
  readonly grab = new GrabSpin();
  /** The hit box over the phone and the "spin me" hint beside it. */
  readonly grabTargets = new GrabTargets();
  /** Scroll velocity, -1..1. */
  velocity = 0;
  /** Animation clock (s): advances only while frames render, so idle loops resume without a jump. */
  time = 0;
  /** performance.now() of the last scroll, pointer or grab input: the scene sleeps when it is old. */
  lastActive = 0;
  /**
   * Renderers subscribe here to hear about story changes the frameloop would
   * miss: 'demand' frames, the CSS fallback's styles.
   */
  readonly listeners = new Set<() => void>();
  /** Renderers that sleep subscribe here to draw again when the pointer moves. */
  readonly wakers = new Set<() => void>();

  reset(patch: Partial<Story> = {}): void {
    Object.assign(this.story, INITIAL_STORY, patch);
    this.grab.reset();
  }

  setPointer(x: number, y: number): void {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.isActive = true;
    this.wake();
  }

  releasePointer(): void {
    this.pointer.isActive = false;
    this.wake();
  }

  /** From ScrollTrigger's px/s. */
  setVelocity(pxPerSecond: number): void {
    this.velocity = Math.max(-1, Math.min(1, pxPerSecond / VELOCITY_SCALE));
  }

  /** Called every frame: the nod fades once scrolling stops. */
  decayVelocity(dt: number): void {
    this.velocity *= Math.exp(-5 * dt);
  }

  /** Advance the animation clock by one rendered frame. */
  advance(dt: number): void {
    this.time += dt;
  }

  /** Something moved that only the renderers care about (pointer, idle wake-up). */
  wake(): void {
    this.lastActive = performance.now();
    this.wakers.forEach(waker => waker());
  }

  /** Tell every renderer the story (or a texture, or the grab) changed. */
  notify(): void {
    this.lastActive = performance.now();
    this.listeners.forEach(listener => listener());
  }

  /** Whether nothing has happened for `ms` (the scene may stop drawing). */
  isIdle(ms: number): boolean {
    return performance.now() - this.lastActive > ms && !this.grab.isMoving;
  }
}

export function createRuntime(): DevicesRuntime {
  return new DevicesRuntime();
}
