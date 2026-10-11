/**
 * The finale's warp drive: one mutable state object shared by the GSAP ticker
 * (scroll → speed, DOM name stream, glow, clear zones) and the WebGL scene
 * (uniforms).
 *
 * Space model (shared by the shaders and the DOM projection below): the
 * camera sits on the axis of a cylinder of stars and looks down -z. A point
 * at polar (angle, radius) and depth d > 0 projects to
 *   ndc = (cos a · r / aspect, sin a · r) · f / d  +  center · smoothstep(0, STAR_DEPTH, d)
 * where f = 1 / tan(fov / 2) and `center` steers the vanishing point (far
 * things move with it, near things stay put — parallax for free).
 */

export const STAR_DEPTH = 80;
export const STAR_NEAR = 0.6;
export const TUNNEL_R_MIN = 1.15;
export const TUNNEL_R_MAX = 13;

export const GATE_COUNT = 6;
export const GATE_SPACING = 26;
export const GATE_RADIUS = 9.5;
/** Gates are far structure: they pass slower than the stars. */
const GATE_RATE = 0.22;

const FOV_CALM = 60;
const FOV_WARP = 86;
/** World units per second. */
const SPEED_CALM = 2.4;
const SPEED_WARP = 150;
/** Streak length = speed × shutter (a long exposure). */
export const SHUTTER = 0.17;

/** The name stream: its own, slower lane so the names stay readable. */
const LABEL_DEPTH = 46;
const LABEL_SPEED = 13;
const LABEL_REF_DEPTH = 7;
const LABEL_MAX_SCALE = 2.1;
/** Name font size in CSS px before scaling (finale.module.css `.name`). */
const LABEL_FONT_PX = 40;

/** Vanishing-point steering, in NDC. */
const STEER = 0.16;
const DRIFT = 0.035;

/** The submit flourish: a short jump to warp and back. */
const BOOST_SECONDS = 2.4;
/** The drop-out ring: one shockwave each time the drive falls out of warp. */
const RING_SECONDS = 1.35;
const RING_ARM = 0.8;
const RING_FIRE = 0.42;
/** Scroll flicks nudge the throttle; the nudge decays on its own. */
const KICK_DECAY = 2.6;

/**
 * The warp track's height in viewports. Must match `--track` in
 * finale.module.css: the contact panel starts right below it.
 */
export const TRACK_VIEWPORTS = 1.2;

/**
 * Scroll choreography, in viewports from the moment the section's top meets
 * the viewport top (negative while it scrolls in). The drive spools up while
 * the section enters, holds while the lead-in reads, and brakes as the panel
 * (which starts at TRACK_VIEWPORTS - 1) slides up; by CALM_FROM it has landed.
 */
const RAMP_UP: readonly [number, number] = [-0.72, 0.04];
const HOLD_END = 0.26;
const BRAKE_END = 0.92;
export const CALM_FROM = 1.1;

/** A rectangle the streaks keep clear of, in stage CSS px (centre + half size). */
export interface Zone {
  x: number;
  y: number;
  hx: number;
  hy: number;
  /** 0 = off, 1 = fully cleared. */
  k: number;
}

export interface WarpEngine {
  /** Viewports scrolled into the section (see the choreography above). */
  s: number;
  target: number;
  /** Smoothed warp level 0..1 (the ship has inertia). */
  level: number;
  /** Scroll-flick throttle 0..1 and its decaying target. */
  kick: number;
  kickTarget: number;
  /** Flourish phase 0..1, or -1 when idle, and its envelope 0..1. */
  boostT: number;
  boost: number;
  /** Effective warp 0..1 (level, flick or flourish). */
  warp: number;
  speed: number;
  travel: number;
  gateTravel: number;
  labelTravel: number;
  spin: number;
  fov: number;
  time: number;
  steerX: number;
  steerY: number;
  centerX: number;
  centerY: number;
  /** Drop-out ring phase 0..1, or -1 when idle. */
  ringT: number;
  isRingArmed: boolean;
  /** 0 during the flight, 1 once the panel has landed (streaks dim). */
  calm: number;
  /** Clear zones: the lead-in text, then the panel's heading and deck. */
  zoneA: Zone;
  zoneB: Zone;
  /** Soft edge of the clear zones, CSS px. */
  feather: number;
  /** Stage size in CSS px. */
  width: number;
  height: number;
  /** Asks the canvas for a frame while its loop is on demand (set by the scene). */
  requestFrame: (() => void) | null;
}

const emptyZone = (): Zone => ({ x: 0, y: 0, hx: 0, hy: 0, k: 0 });

export function createEngine(): WarpEngine {
  return {
    s: -1,
    target: 0,
    level: 0,
    kick: 0,
    kickTarget: 0,
    boostT: -1,
    boost: 0,
    warp: 0,
    speed: SPEED_CALM,
    travel: 0,
    gateTravel: 0,
    labelTravel: 0,
    spin: 0,
    fov: FOV_CALM,
    time: 0,
    steerX: 0,
    steerY: 0,
    centerX: 0,
    centerY: 0,
    ringT: -1,
    isRingArmed: false,
    calm: 0,
    zoneA: emptyZone(),
    zoneB: emptyZone(),
    feather: 80,
    width: 1,
    height: 1,
    requestFrame: null,
  };
}

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const smoothstep = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (current: number, target: number, lambda: number, dt: number) => current + (target - current) * (1 - Math.exp(-lambda * dt));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Target warp level for a scroll position (viewports into the section). */
export function levelAt(s: number): number {
  if (s <= RAMP_UP[0]) return 0;
  if (s < RAMP_UP[1]) return Math.pow((s - RAMP_UP[0]) / (RAMP_UP[1] - RAMP_UP[0]), 1.6);
  if (s <= HOLD_END) return 1;
  if (s < BRAKE_END) return 1 - easeInOutSine((s - HOLD_END) / (BRAKE_END - HOLD_END));
  return 0;
}

/** How present the lead-in is: it rises in with the section and scatters into the warp. */
export function introPresence(s: number): number {
  return smoothstep(-0.78, -0.36, s) * (1 - smoothstep(0.1, 0.36, s));
}

/** Flourish envelope: a fast punch to warp, then a long glide back. */
function boostEnvelope(t: number): number {
  if (t < 0) return 0;
  if (t < 0.16) return smoothstep(0, 0.16, t);
  return 1 - easeInOutSine((t - 0.16) / 0.84);
}

/** The canvas registers how to ask for a frame while its loop is on demand. */
export function setFrameRequest(engine: WarpEngine, request: (() => void) | null): void {
  engine.requestFrame = request;
}

export function startBoost(engine: WarpEngine): void {
  engine.boostT = 0;
}

/** A scroll flick (|velocity| in px/s) nudges the throttle. */
export function kickFrom(engine: WarpEngine, velocity: number): void {
  const kick = Math.min(0.32, Math.abs(velocity) / 7000);
  if (kick > engine.kickTarget) engine.kickTarget = kick;
}

/** Derived visuals for a warp value; also used to freeze a still frame. */
export function applyWarp(engine: WarpEngine, warp: number): void {
  engine.warp = warp;
  engine.speed = mix(SPEED_CALM, SPEED_WARP, Math.pow(warp, 1.7));
  engine.fov = mix(FOV_CALM, FOV_WARP, smoothstep(0, 1, warp));
}

/** Reduced motion: one composed long-exposure frame, no time, no steering. */
export const STILL_WARP = 0.34;

export function freezeStill(engine: WarpEngine): void {
  applyWarp(engine, STILL_WARP);
  engine.level = STILL_WARP;
  engine.travel = 37;
  engine.gateTravel = 9;
  engine.spin = 0.4;
  engine.centerX = 0;
  engine.centerY = 0;
  engine.ringT = -1;
}

/** Advances the drive by dt seconds. */
export function stepEngine(engine: WarpEngine, dt: number): void {
  const e = engine;
  e.time += dt;
  // Accelerate a little slower than braking: the jump feels heavy, the stop crisp.
  e.level = damp(e.level, e.target, e.level < e.target ? 2.4 : 3.2, dt);
  e.kickTarget = damp(e.kickTarget, 0, KICK_DECAY, dt);
  e.kick = damp(e.kick, e.kickTarget, 7, dt);
  if (e.boostT >= 0) {
    e.boostT += dt / BOOST_SECONDS;
    if (e.boostT >= 1) e.boostT = -1;
  }
  e.boost = boostEnvelope(e.boostT);
  applyWarp(e, Math.max(e.level + e.kick * (1 - e.level), e.boost));

  // Falling out of warp fires one ring; it re-arms only after the next full jump.
  if (e.warp > RING_ARM) e.isRingArmed = true;
  if (e.isRingArmed && e.warp < RING_FIRE) {
    e.isRingArmed = false;
    e.ringT = 0;
  }
  if (e.ringT >= 0) {
    e.ringT += dt / RING_SECONDS;
    if (e.ringT >= 1) e.ringT = -1;
  }

  e.travel += e.speed * dt;
  e.gateTravel += e.speed * GATE_RATE * dt;
  e.labelTravel += LABEL_SPEED * smoothstep(0.08, 0.6, e.warp) * dt;
  e.spin += dt * (0.015 + 0.32 * e.warp * e.warp);

  // Steer toward the pointer; with nobody steering, a slow drift keeps it alive.
  const driftX = Math.sin(e.time * 0.23) * DRIFT;
  const driftY = Math.cos(e.time * 0.17) * DRIFT * 0.6;
  e.centerX = damp(e.centerX, e.steerX * STEER + driftX, 2, dt);
  e.centerY = damp(e.centerY, e.steerY * STEER + driftY, 2, dt);
}

export function focalOf(fovDeg: number): number {
  return 1 / Math.tan((fovDeg * Math.PI) / 360);
}

/** Vanishing point in stage px (origin at the stage centre, y down). */
export function vanishingPoint(engine: WarpEngine): [x: number, y: number] {
  return [(engine.centerX * engine.width) / 2, (-engine.centerY * engine.height) / 2];
}

/**
 * How much of a point or box (stage CSS px, origin top-left) survives a clear
 * zone: 1 outside, fading to 1 - k inside (the same falloff as the shaders).
 */
export function zoneFade(zone: Zone, x: number, y: number, feather: number, halfW = 0, halfH = 0): number {
  if (zone.k <= 0) return 1;
  // A box (halfW × halfH around x, y) clears the zone when the zone grown by it does.
  const qx = Math.abs(x - zone.x) - zone.hx - halfW;
  const qy = Math.abs(y - zone.y) - zone.hy - halfH;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
  return 1 - zone.k * (1 - smoothstep(-0.25 * feather, feather, outside));
}

// ── The name stream ────────────────────────────────────────────────────────

/** Small deterministic PRNG so the layout is identical on every mount. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface LabelSlot {
  angle: number;
  radius: number;
  phase: number;
  lap: number;
  /** Half the label's width in ems (from its length), for clearing the text zones. */
  halfEms: number;
  isShown: boolean;
}

/** Average glyph advance of the display faces, in ems (generous: Science Gothic runs wide). */
const LABEL_EM_PER_CHAR = 0.6;

/**
 * Kinds of product we built ("Taxi app") flying past in the tunnel. Each slot is a DOM node that
 * is re-labelled with the next name every time it wraps around. Names keep
 * out of the clear zones, so they never cross the lead-in or the heading.
 */
export class NameStream {
  private readonly slots: LabelSlot[];

  constructor(
    private readonly nodes: readonly HTMLElement[],
    private readonly names: readonly string[]
  ) {
    const random = seeded(1414);
    const count = nodes.length;
    this.slots = nodes.map((_, index) => ({
      // Even spread around the ring with jitter, so names never stack.
      angle: ((index + random() * 0.6) / count) * Math.PI * 2 + 0.4,
      radius: mix(2.4, 4.6, random()),
      phase: (index * 0.618034) % 1,
      lap: -1,
      halfEms: 0,
      isShown: false,
    }));
  }

  update(e: WarpEngine): void {
    const f = focalOf(e.fov);
    const halfW = e.width / 2;
    const halfH = e.height / 2;
    // Names belong to the flight, not the landing: gone before the panel text arrives.
    const visibility = smoothstep(0.12, 0.5, e.warp) * (1 - smoothstep(0.04, 0.2, e.s));
    // Phones: names stay a size a phone can show (they still fly off the edges).
    const maxScale = Math.min(LABEL_MAX_SCALE, Math.max(1, e.width / 260));
    const count = this.slots.length;

    this.slots.forEach((slot, index) => {
      const node = this.nodes[index];
      if (visibility <= 0.001) {
        if (slot.isShown) {
          node.style.opacity = '0';
          slot.isShown = false;
        }
        return;
      }
      const run = slot.phase * LABEL_DEPTH + e.labelTravel;
      const lap = Math.floor(run / LABEL_DEPTH);
      const d = LABEL_DEPTH - (run - lap * LABEL_DEPTH);
      if (lap !== slot.lap) {
        const name = this.names[(((index + lap * count) % this.names.length) + this.names.length) % this.names.length];
        slot.lap = lap;
        slot.halfEms = (name.length * LABEL_EM_PER_CHAR) / 2;
        node.textContent = name;
      }
      const angle = slot.angle + e.spin;
      const k = smoothstep(0, STAR_DEPTH, d);
      const x = (Math.cos(angle) * slot.radius * f * halfH) / d + e.centerX * k * halfW;
      const y = (-Math.sin(angle) * slot.radius * f * halfH) / d - e.centerY * k * halfH;
      const scale = Math.min(maxScale, LABEL_REF_DEPTH / d);
      // Clear the zones by the name's whole box, not just its centre.
      const fontPx = LABEL_FONT_PX * scale;
      const clear =
        zoneFade(e.zoneA, halfW + x, halfH + y, e.feather, slot.halfEms * fontPx, fontPx * 0.6) *
        zoneFade(e.zoneB, halfW + x, halfH + y, e.feather, slot.halfEms * fontPx, fontPx * 0.6);
      const opacity = visibility * clear * smoothstep(LABEL_DEPTH, LABEL_DEPTH * 0.62, d) * smoothstep(1.6, 4.5, d);
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      node.style.opacity = opacity.toFixed(3);
      slot.isShown = true;
    });
  }
}
