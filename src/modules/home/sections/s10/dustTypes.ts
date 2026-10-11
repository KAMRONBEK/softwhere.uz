/** Colours of the dust, derived from the active lab style. */
export interface DustPalette {
  /** Dark styles: light on black (accents). Light styles: ink and pigment on paper. */
  isDark: boolean;
  /** Left → right colour ramp across the numeral (hex). */
  gradient: readonly [string, string];
  /** Disturbed particles and the glint sweep. */
  spark: string;
  /** Ambient dust motes. */
  dust: string;
  /** Hex colour of the soft glow behind the numeral (dark styles), or null. */
  glow: string | null;
  /** The sparks that carry each count to its chart dot (the dots' own colour). */
  courier: string;
}

/** Density and extras per device tier. */
export interface DustQuality {
  /** Distance between particles inside the numeral, CSS px. */
  spacing: number;
  /** Cap on numeral particles (the spacing grows to fit). */
  maxParticles: number;
  /** Free-floating dust motes across the stage. */
  ambient: number;
  hasBreathing: boolean;
  hasGlow: boolean;
  hasGlint: boolean;
}

export interface Pointer {
  /** Canvas coordinates, refreshed every frame from the client position. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  clientX: number;
  clientY: number;
  isActive: boolean;
  hasPrev: boolean;
}

/** Particle status. */
/** Free dust across the whole stage (before the first numeral forms). */
export const DUST = 0;
/** Not needed by the current numeral: hovers in a slow cloud around it. */
export const HALO = 1;
/** Released (ballistic until `fs`), then flying a curved path to its target. */
export const FLYING = 2;
/** Holding its place in the numeral on a spring. */
export const LANDED = 3;

export const BUCKETS = 6;
/** Halo orbit speed classes (one rotation per class per frame, no per-particle trig). */
export const ORBITS = 3;

/** Where the numeral sits on the canvas this frame (CSS px). */
export interface Placement {
  /** Left/top of the value's band, and the band height. */
  ox: number;
  oy: number;
  scale: number;
  /** Centre and half extents of the halo ellipse. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Every particle of the numeral (structure of arrays). */
export interface Pool {
  n: number;
  slots: number;
  /** First particle index of each slot, plus n at the end. */
  slotStart: Int32Array;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  slot: Uint8Array;
  /** Random permutation within the slot: the first `m` keys are the active ones. */
  key: Uint32Array;
  /** Colour position 0..1, left → right (fixed per particle). */
  u: Float32Array;
  jx: Float32Array;
  jy: Float32Array;
  /** Release delay and flight time for a full re-form, s. */
  delay: Float32Array;
  flight: Float32Array;
  curl: Float32Array;
  /** Flight: start time (ballistic before it), duration, start point (NaN = not captured yet). */
  fs: Float32Array;
  fd: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  /** Halo: unit direction (rotated each frame), radius factor and orbit class. */
  hux: Float32Array;
  huy: Float32Array;
  hr: Float32Array;
  orbit: Uint8Array;
  /** cos/sin of a random phase: breathing and drift without per-particle trig. */
  pc: Float32Array;
  ps: Float32Array;
  energy: Float32Array;
  status: Uint8Array;
  /** Particle indices sorted by colour bucket; bucketEnd[b] closes bucket b. */
  order: Uint32Array;
  bucketEnd: Int32Array;
  /** Scratch list of particles drawn as sparks this frame. */
  sparks: Uint32Array;
  /** Box-relative targets of the displayed value (band units, NaN = not needed). */
  targets: Float32Array;
  /** Width of the displayed value, band units. */
  width: number;
}

export interface Ambient {
  n: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  /** Drift heading (unit vector scaled per mote). */
  pc: Float32Array;
  ps: Float32Array;
  size: Float32Array;
}
