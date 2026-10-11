import type { GlyphBank } from './glyphs';
import { BUCKETS, DUST, FLYING, HALO, LANDED, type Ambient, type DustQuality, type Placement, type Pointer, type Pool } from './dustTypes';

/**
 * The numeral's particle pool and its per-frame physics: pure functions over
 * typed arrays. One pool serves every value: each digit slot owns enough
 * particles for its inkiest digit, a value activates the first `m` keys of a
 * slot and leaves the rest hovering around it as a halo of dust.
 */

const JITTER = 0.22;
const RELEASE_SPREAD = 0.55;
const FLIGHT_MIN = 0.85;
const FLIGHT_SPREAD = 0.6;
const RELEASE_DAMP = 0.93;
const REJOIN_DELAY = 0.12;
const REJOIN_MIN = 0.55;
const REJOIN_SPREAD = 0.4;
const SPRING_K = 0.13;
const SPRING_DAMP = 0.76;
const HALO_K = 0.0045;
const HALO_DAMP = 0.955;
const HALO_SWAY = 0.35;
const HALO_IDLE_DAMP = 0.05;
const DRIFT_SPEED = 0.2;
const DRIFT_RISE = 0.05;
const DRIFT_RELAX = 0.02;
const ENERGY_DECAY = 0.9;
const WRAP = 24;
const BREATH = 0.45;
const GLINT_WIDTH = 0.05;
const GLINT_PEAK = 0.5;
const POINTER_PUSH = 3.2;
const DUST_PUSH = 0.7;
/** Energy a morph release gives: a brief sparkle as the numeral lets go. */
const MORPH_SPARK = 0.32;

export interface StepContext {
  t: number;
  /** Frame factor: 1 at 60 fps. */
  f: number;
  /** Liveliness 0..1: breathing, drift, orbit and glint fade out together when idle. */
  life: number;
  width: number;
  height: number;
  pointer: Pointer;
  quality: DustQuality;
  /** Pointer influence radius for the formed numeral, CSS px. */
  radius: number;
  place: Placement;
  /** cos, sin of this frame's rotation per halo orbit class. */
  rot: Float32Array;
  /** Glint position along the numeral (0..1, outside = none). */
  glint: number;
}

export interface StepResult {
  flying: number;
  /** Largest |vx| + |vy| this frame: ~0 means everything has settled. */
  motion: number;
}

const easeInOutCubic = (s: number) => (s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── Creation ────────────────────────────────────────────────────────────────

/** Particles per digit slot (values right-aligned): enough for the inkiest digit a final value puts there. */
export function slotCounts(bank: GlyphBank, values: readonly number[], stride: number): number[] {
  const slots = Math.max(1, ...values.map(value => String(value).length));
  const counts = new Array<number>(slots).fill(0);
  for (const value of values) {
    const text = String(value);
    for (let i = 0; i < text.length; i++) {
      const slot = slots - text.length + i;
      counts[slot] = Math.max(counts[slot], bank.digit(text[i], stride).count);
    }
  }
  return counts;
}

function shuffled(n: number): Uint32Array {
  const out = new Uint32Array(n);
  for (let i = 0; i < n; i++) out[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[k];
    out[k] = tmp;
  }
  return out;
}

export function createPool(perSlot: readonly number[], width: number, height: number): Pool {
  const slots = perSlot.length;
  const n = Math.max(
    1,
    perSlot.reduce((sum, count) => sum + count, 0)
  );
  const f32 = () => new Float32Array(n);
  const pool: Pool = {
    n,
    slots,
    slotStart: new Int32Array(slots + 1),
    x: f32(),
    y: f32(),
    vx: f32(),
    vy: f32(),
    slot: new Uint8Array(n),
    key: new Uint32Array(n),
    u: f32(),
    jx: f32(),
    jy: f32(),
    delay: f32(),
    flight: f32(),
    curl: f32(),
    fs: f32(),
    fd: f32(),
    sx: f32(),
    sy: f32(),
    hux: f32(),
    huy: f32(),
    hr: f32(),
    orbit: new Uint8Array(n),
    pc: f32(),
    ps: f32(),
    energy: f32(),
    status: new Uint8Array(n),
    order: new Uint32Array(n),
    bucketEnd: new Int32Array(BUCKETS),
    sparks: new Uint32Array(n),
    targets: new Float32Array(n * 2).fill(Number.NaN),
    width: 1,
  };

  const buckets = new Uint8Array(n);
  const counts = new Int32Array(BUCKETS);
  let j = 0;
  for (let slot = 0; slot < slots; slot++) {
    pool.slotStart[slot] = j;
    const count = perSlot[slot];
    const keys = shuffled(count);
    for (let k = 0; k < count; k++, j++) {
      pool.slot[j] = slot;
      pool.key[j] = keys[k];
      // Particles are created in rank order (left → right within the digit), so colour follows x.
      pool.u[j] = (slot + (k + Math.random()) / Math.max(1, count)) / slots;
      pool.jx[j] = (Math.random() - 0.5) * JITTER * 2;
      pool.jy[j] = (Math.random() - 0.5) * JITTER * 2;
      pool.delay[j] = Math.random() ** 1.4 * RELEASE_SPREAD;
      pool.flight[j] = FLIGHT_MIN + Math.random() * FLIGHT_SPREAD;
      pool.curl[j] = (Math.random() - 0.5) * 0.9;
      const angle = Math.random() * Math.PI * 2;
      pool.hux[j] = Math.cos(angle);
      pool.huy[j] = Math.sin(angle);
      pool.hr[j] = 0.9 + 0.55 * Math.random() ** 1.6;
      pool.orbit[j] = Math.floor(Math.random() * 3);
      const phase = Math.random() * Math.PI * 2;
      pool.pc[j] = Math.cos(phase);
      pool.ps[j] = Math.sin(phase);
      pool.x[j] = Math.random() * width;
      pool.y[j] = Math.random() * height;
      pool.vx[j] = (Math.random() - 0.5) * 0.4;
      pool.vy[j] = (Math.random() - 0.5) * 0.4;
      pool.status[j] = DUST;
      const b = Math.min(BUCKETS - 1, Math.floor(clamp01(pool.u[j] * 0.82 + Math.random() * 0.18) * BUCKETS));
      buckets[j] = b;
      counts[b]++;
    }
  }
  pool.slotStart[slots] = j;

  const cursor = new Int32Array(BUCKETS);
  let acc = 0;
  for (let b = 0; b < BUCKETS; b++) {
    cursor[b] = acc;
    acc += counts[b];
    pool.bucketEnd[b] = acc;
  }
  for (let i = 0; i < n; i++) pool.order[cursor[buckets[i]]++] = i;
  return pool;
}

export function createAmbient(n: number, width: number, height: number): Ambient {
  const a: Ambient = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    pc: new Float32Array(n),
    ps: new Float32Array(n),
    size: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) {
    a.x[i] = Math.random() * width;
    a.y[i] = Math.random() * height;
    a.vx[i] = (Math.random() - 0.5) * 0.3;
    a.vy[i] = (Math.random() - 0.5) * 0.3;
    const phase = Math.random() * Math.PI * 2;
    const speed = 0.4 + Math.random() * 0.6;
    a.pc[i] = Math.cos(phase) * speed;
    a.ps[i] = Math.sin(phase) * speed;
    a.size[i] = Math.random() < 0.7 ? 1 : 1.6;
  }
  return a;
}

// ── Targets ─────────────────────────────────────────────────────────────────

/**
 * Writes the targets of `value` (band units, x from the value's ink left edge)
 * and stores its width. In each slot the active particles, taken in rank
 * order, map onto the digit's ink in column order, so a particle keeps
 * roughly the same relative place from one number to the next.
 */
export function fillTargets(pool: Pool, bank: GlyphBank, value: number, stride: number): void {
  // Odometer-style zero padding ("07" on the way to "54"): every slot stays
  // busy while counting, so no digit drops out to the halo and back.
  const text = String(value).padStart(pool.slots, '0');
  const layout = bank.layout(text);
  const T = pool.targets;
  for (let slot = 0; slot < pool.slots; slot++) {
    const start = pool.slotStart[slot];
    const end = pool.slotStart[slot + 1];
    const i = slot - (pool.slots - text.length);
    if (i < 0) {
      T.fill(Number.NaN, start * 2, end * 2);
      continue;
    }
    const ink = bank.digit(text[i], stride);
    const c = ink.count;
    const m = Math.min(c, end - start);
    const pen = layout.penX[i] - layout.inkLeft;
    let a = 0;
    for (let j = start; j < end; j++) {
      if (pool.key[j] >= m) {
        T[j * 2] = Number.NaN;
        T[j * 2 + 1] = Number.NaN;
        continue;
      }
      const idx = Math.min(c - 1, Math.floor((a * c) / m));
      a++;
      T[j * 2] = pen + ink.points[idx * 2] + pool.jx[j] * stride;
      T[j * 2 + 1] = ink.points[idx * 2 + 1] + pool.jy[j] * stride;
    }
  }
  pool.width = layout.width;
}

/** After the targets changed: particles no longer needed drift off to the halo, newly needed ones fly in. */
export function applyTargets(pool: Pool, t: number): void {
  const T = pool.targets;
  for (let j = 0; j < pool.n; j++) {
    const isNeeded = T[j * 2] === T[j * 2];
    const status = pool.status[j];
    if (!isNeeded) {
      if (status !== HALO) pool.status[j] = HALO;
      continue;
    }
    if (status === HALO || status === DUST) {
      pool.status[j] = FLYING;
      pool.fs[j] = t + Math.random() * REJOIN_DELAY;
      pool.fd[j] = REJOIN_MIN + Math.random() * REJOIN_SPREAD;
      pool.sx[j] = Number.NaN;
    }
  }
}

export type ReleaseMode = 'gather' | 'morph' | 'burst';

/**
 * Lets every particle go before a (re-)form: 'gather' from free dust as it is,
 * 'morph' in a swirl around the numeral's centre, 'burst' outward from a point.
 * Each one then flies to its target after its own delay.
 */
export function release(pool: Pool, t: number, mode: ReleaseMode, ox: number, oy: number): void {
  const spin = Math.random() < 0.5 ? -1 : 1;
  const timing = mode === 'burst' ? 0.55 : 1;
  const lead = mode === 'burst' ? 0.2 : mode === 'morph' ? 0.06 : 0;
  for (let j = 0; j < pool.n; j++) {
    const status = pool.status[j];
    if (mode !== 'gather' && (status === LANDED || status === FLYING)) {
      const dx = pool.x[j] - ox;
      const dy = pool.y[j] - oy;
      const d = Math.hypot(dx, dy) || 1;
      if (mode === 'burst') {
        const impulse = (9 + Math.random() * 16) * (0.35 + 0.65 * Math.exp(-d / 110));
        pool.vx[j] += (dx / d) * impulse + (Math.random() - 0.5) * 4;
        pool.vy[j] += (dy / d) * impulse + (Math.random() - 0.5) * 4;
        pool.energy[j] = 1;
      } else {
        const out = 1.2 + Math.random() * 2.6;
        const swirl = (2 + Math.random() * 3.5) * spin;
        pool.vx[j] += (dx / d) * out - (dy / d) * swirl;
        pool.vy[j] += (dy / d) * out + (dx / d) * swirl;
        pool.energy[j] = Math.max(pool.energy[j], MORPH_SPARK);
      }
    }
    pool.status[j] = FLYING;
    pool.fs[j] = t + lead + pool.delay[j] * timing;
    pool.fd[j] = pool.flight[j] * (mode === 'burst' ? 0.8 : 1);
    pool.sx[j] = Number.NaN;
  }
}

/** Static frame: needed particles on their targets, the rest at their halo homes. */
export function settle(pool: Pool, place: Placement): void {
  const T = pool.targets;
  for (let j = 0; j < pool.n; j++) {
    pool.vx[j] = 0;
    pool.vy[j] = 0;
    pool.energy[j] = 0;
    if (T[j * 2] === T[j * 2]) {
      pool.status[j] = LANDED;
      pool.x[j] = place.ox + T[j * 2] * place.scale;
      pool.y[j] = place.oy + T[j * 2 + 1] * place.scale;
    } else {
      pool.status[j] = HALO;
      pool.x[j] = place.cx + pool.hux[j] * place.rx * pool.hr[j];
      pool.y[j] = place.cy + pool.huy[j] * place.ry * pool.hr[j];
    }
  }
}

/** Back to free dust across the stage (the numeral is offscreen). */
export function scatter(pool: Pool, width: number, height: number): void {
  for (let j = 0; j < pool.n; j++) {
    pool.status[j] = DUST;
    pool.x[j] = Math.random() * width;
    pool.y[j] = Math.random() * height;
    pool.vx[j] = (Math.random() - 0.5) * 0.4;
    pool.vy[j] = (Math.random() - 0.5) * 0.4;
    pool.energy[j] = 0;
  }
}

// ── Physics ─────────────────────────────────────────────────────────────────

/** Dust relaxes back to its own slow heading (cos/sin of its phase); no per-particle trig. */
function drift(vx: Float32Array, vy: Float32Array, i: number, pc: number, ps: number, f: number, life: number): void {
  const relax = DRIFT_RELAX * f;
  vx[i] += (pc * DRIFT_SPEED * life - vx[i]) * relax;
  vy[i] += ((ps * DRIFT_SPEED - DRIFT_RISE) * life - vy[i]) * relax;
}

function wrap(x: Float32Array, y: Float32Array, i: number, width: number, height: number): void {
  if (x[i] < -WRAP) x[i] += width + WRAP * 2;
  else if (x[i] > width + WRAP) x[i] -= width + WRAP * 2;
  if (y[i] < -WRAP) y[i] += height + WRAP * 2;
  else if (y[i] > height + WRAP) y[i] -= height + WRAP * 2;
}

/** Pushes particle i away from the pointer (plus a little of its motion); returns the falloff. */
function stir(
  x: Float32Array,
  y: Float32Array,
  vx: Float32Array,
  vy: Float32Array,
  i: number,
  p: Pointer,
  radius: number,
  strength: number,
  f: number
): number {
  const dx = x[i] - p.x;
  const dy = y[i] - p.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius || d2 < 0.0001) return 0;
  const d = Math.sqrt(d2);
  const fall = 1 - d / radius;
  const force = fall * fall * strength * f;
  vx[i] += (dx / d) * force + p.vx * fall * 0.06 * f;
  vy[i] += (dy / d) * force + p.vy * fall * 0.06 * f;
  return fall;
}

export function stepAmbient(a: Ambient, ctx: StepContext): number {
  const { t, f, pointer, width, height, life } = ctx;
  const radius = ctx.radius * 1.3;
  const swayX = Math.sin(t * 0.27) * 0.12 * f * life;
  const swayY = Math.cos(t * 0.21) * 0.06 * f * life;
  let motion = 0;
  for (let i = 0; i < a.n; i++) {
    drift(a.vx, a.vy, i, a.pc[i], a.ps[i], f, life);
    if (pointer.isActive) stir(a.x, a.y, a.vx, a.vy, i, pointer, radius, DUST_PUSH, f);
    a.x[i] += a.vx[i] * f + swayX;
    a.y[i] += a.vy[i] * f + swayY;
    wrap(a.x, a.y, i, width, height);
    const m = Math.abs(a.vx[i]) + Math.abs(a.vy[i]);
    if (m > motion) motion = m;
  }
  return motion + Math.abs(swayX) + Math.abs(swayY);
}

export function stepPool(pool: Pool, ctx: StepContext): StepResult {
  const { t, f, life, pointer, quality, radius, width, height, place, rot, glint } = ctx;
  const T = pool.targets;
  const { x, y, vx, vy } = pool;
  const k = SPRING_K * f;
  const damp = SPRING_DAMP ** f;
  // Idle: the halo rings down faster, so the loop can go to sleep sooner.
  const haloDamp = (HALO_DAMP - (1 - life) * HALO_IDLE_DAMP) ** f;
  const releaseDamp = RELEASE_DAMP ** f;
  const decay = ENERGY_DECAY ** f;
  // Breathing without per-particle trig: sin(a + ph) = sin a·cos ph + cos a·sin ph.
  const breath = quality.hasBreathing ? BREATH * life : 0;
  const sa = Math.sin(t * 1.7) * breath;
  const ca = Math.cos(t * 1.7) * breath;
  const sb = Math.sin(t * 1.3) * breath;
  const cb = Math.cos(t * 1.3) * breath;
  const sway = HALO_SWAY * place.scale * 0.02 * life;
  const stirRadius = radius * 1.3;
  const dustSwayX = Math.sin(t * 0.27) * 0.12 * f * life;
  const dustSwayY = Math.cos(t * 0.21) * 0.06 * f * life;
  let flying = 0;
  let motion = 0;

  for (let j = 0; j < pool.n; j++) {
    const status = pool.status[j];

    if (status === DUST) {
      drift(vx, vy, j, pool.pc[j], pool.ps[j], f, life);
      if (pointer.isActive) stir(x, y, vx, vy, j, pointer, stirRadius, DUST_PUSH, f);
      x[j] += vx[j] * f + dustSwayX;
      y[j] += vy[j] * f + dustSwayY;
      wrap(x, y, j, width, height);
    } else if (status === HALO) {
      const o = pool.orbit[j] * 2;
      const ux = pool.hux[j] * rot[o] - pool.huy[j] * rot[o + 1];
      const uy = pool.hux[j] * rot[o + 1] + pool.huy[j] * rot[o];
      pool.hux[j] = ux;
      pool.huy[j] = uy;
      const hx = place.cx + ux * place.rx * pool.hr[j] + pool.pc[j] * sway;
      const hy = place.cy + uy * place.ry * pool.hr[j] + pool.ps[j] * sway;
      vx[j] = (vx[j] + (hx - x[j]) * HALO_K * f) * haloDamp;
      vy[j] = (vy[j] + (hy - y[j]) * HALO_K * f) * haloDamp;
      if (pointer.isActive) stir(x, y, vx, vy, j, pointer, stirRadius, DUST_PUSH, f);
      x[j] += vx[j] * f;
      y[j] += vy[j] * f;
      pool.energy[j] *= decay;
    } else if (status === FLYING) {
      flying++;
      if (t < pool.fs[j]) {
        // Released: coast and slow down before the flight starts.
        vx[j] *= releaseDamp;
        vy[j] *= releaseDamp;
        x[j] += vx[j] * f;
        y[j] += vy[j] * f;
        pool.energy[j] *= decay;
        continue;
      }
      if (pool.sx[j] !== pool.sx[j]) {
        pool.sx[j] = x[j];
        pool.sy[j] = y[j];
      }
      const tx = place.ox + T[j * 2] * place.scale;
      const ty = place.oy + T[j * 2 + 1] * place.scale;
      const s = clamp01((t - pool.fs[j]) / pool.fd[j]);
      const e = easeInOutCubic(s);
      const sx = pool.sx[j];
      const sy = pool.sy[j];
      const curl = pool.curl[j];
      const mx = (sx + tx) / 2 - (ty - sy) * curl;
      const my = (sy + ty) / 2 + (tx - sx) * curl;
      const r = 1 - e;
      x[j] = r * r * sx + 2 * r * e * mx + e * e * tx;
      y[j] = r * r * sy + 2 * r * e * my + e * e * ty;
      pool.energy[j] *= decay;
      if (s >= 1) {
        pool.status[j] = LANDED;
        vx[j] = 0;
        vy[j] = 0;
      }
      continue;
    } else {
      const tx = place.ox + T[j * 2] * place.scale;
      const ty = place.oy + T[j * 2 + 1] * place.scale;
      const pc = pool.pc[j];
      const ps = pool.ps[j];
      const gx = tx + sa * pc + ca * ps;
      const gy = ty + cb * pc - sb * ps;
      let energy = pool.energy[j] * decay;
      const sheen = 1 - Math.abs(pool.u[j] - glint) / GLINT_WIDTH;
      if (sheen > 0 && energy < GLINT_PEAK * sheen * life) energy = GLINT_PEAK * sheen * life;
      if (pointer.isActive) {
        const fall = stir(x, y, vx, vy, j, pointer, radius, POINTER_PUSH, f);
        if (fall > 0) energy = Math.min(1, energy + fall * fall * 0.25 * f);
      }
      pool.energy[j] = energy;
      vx[j] = (vx[j] + (gx - x[j]) * k) * damp;
      vy[j] = (vy[j] + (gy - y[j]) * k) * damp;
      x[j] += vx[j] * f;
      y[j] += vy[j] * f;
    }
    const m = Math.abs(vx[j]) + Math.abs(vy[j]);
    if (m > motion) motion = m;
  }
  return { flying, motion };
}
