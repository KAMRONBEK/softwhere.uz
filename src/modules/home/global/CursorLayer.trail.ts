import type { LabTheme } from '../theme/useLabTheme';
import type { DeviceTier } from '../types';

/**
 * The cursor's trail (used by CursorLayer.engine.ts): a tapered, smoothed
 * ribbon on a full-viewport 2D canvas with a thin bright spine. Points come
 * from pointer events (coalesced where supported, stamped with the event's
 * own time so a burst delivered after a busy frame dies at once) and fade by
 * age or by length, whichever comes first; only the last frame's bounding box
 * is cleared.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface TrailConfig {
  lifeMs: number;
  /** Longest comet in CSS px, however fast the flick. */
  maxLength: number;
  capacity: number;
  dprCap: number;
  /** Head width in CSS px. */
  width: number;
  glow: boolean;
}

export const TRAIL_BY_TIER: Record<DeviceTier, TrailConfig | null> = {
  high: { lifeMs: 340, maxLength: 280, capacity: 72, dprCap: 1.5, width: 4.2, glow: true },
  mid: { lifeMs: 280, maxLength: 200, capacity: 40, dprCap: 1, width: 3.4, glow: false },
  low: null,
};

const GLOW_SCALE = 4.5;
const TRAIL_MIN_STEP = 1;
const TRAIL_TAPER = 0.85;
/** Spine width at the head in CSS px. */
const SPINE_WIDTH = 1;

type Stops = readonly [tail: string, mid: string, head: string];

export interface TrailPaint {
  composite: GlobalCompositeOperation;
  body: Stops;
  glow: Stops | null;
  /** Hairline core along the ribbon. */
  spine: Stops;
}

function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Dark styles: light — accent bleeding into accent-2, an additive halo and a
 * hot pale core. Light styles: ink — the accent at 70% with a 1px --fg core,
 * normal blending, so the comet reads on concrete and pearl alike.
 */
export function trailPaint(theme: LabTheme): TrailPaint {
  const { accent, accent2, fg } = theme.colors;
  if (theme.blending === 'additive') {
    return {
      composite: 'lighter',
      body: [rgba(accent2, 0), rgba(accent2, 0.5), rgba(accent, 0.9)],
      glow: [rgba(accent2, 0), rgba(accent2, 0.09), rgba(accent, 0.16)],
      spine: [rgba(fg, 0), rgba(fg, 0.22), rgba(fg, 0.6)],
    };
  }
  return {
    composite: 'source-over',
    body: [rgba(accent, 0), rgba(accent, 0.45), rgba(accent, 0.7)],
    glow: null,
    spine: [rgba(fg, 0), rgba(fg, 0.55), rgba(fg, 0.9)],
  };
}

export interface Trail {
  /** `time` on the performance.now() clock (an event's timeStamp). */
  push(x: number, y: number, time: number): void;
  /** Draws one frame; false once the trail has fully faded. */
  draw(now: number, paint: TrailPaint): boolean;
  clear(): void;
  resize(): void;
  readonly config: TrailConfig;
}

export function createTrail(canvas: HTMLCanvasElement, config: TrailConfig): Trail | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const cap = config.capacity;
  const xs = new Float32Array(cap);
  const ys = new Float32Array(cap);
  const ts = new Float64Array(cap);
  // Per-frame scratch: points oldest → newest, unit normals, half widths, both edges.
  const px = new Float32Array(cap);
  const py = new Float32Array(cap);
  const nx = new Float32Array(cap);
  const ny = new Float32Array(cap);
  const hw = new Float32Array(cap);
  const dd = new Float32Array(cap);
  const ex = new Float32Array(cap * 2);
  const ey = new Float32Array(cap * 2);
  let start = 0;
  let count = 0;
  let dirty: [number, number, number, number] | null = null;

  const clearDirty = () => {
    if (dirty) ctx.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1]);
    dirty = null;
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, config.dprCap);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = null;
  };

  const push = (x: number, y: number, time: number) => {
    if (count > 0) {
      const last = (start + count - 1) % cap;
      if (Math.hypot(x - xs[last], y - ys[last]) < TRAIL_MIN_STEP) return;
    }
    if (count === cap) {
      start = (start + 1) % cap;
      count -= 1;
    }
    const index = (start + count) % cap;
    xs[index] = x;
    ys[index] = y;
    ts[index] = time;
    count += 1;
  };

  /** Fills scratch arrays for the live points; returns how many. */
  const gather = (now: number): number => {
    while (count > 0 && now - ts[start] > config.lifeMs) {
      start = (start + 1) % cap;
      count -= 1;
    }
    // Distance back from the head: the comet fades by age or by length, whichever comes first.
    let first = 0;
    for (let i = count - 1, dist = 0; i >= 0; i--) {
      if (i < count - 1) {
        const a = (start + i) % cap;
        const b = (start + i + 1) % cap;
        dist += Math.hypot(xs[b] - xs[a], ys[b] - ys[a]);
      }
      dd[i] = dist;
      if (dist > config.maxLength) {
        first = i + 1;
        break;
      }
    }
    const n = count - first;
    for (let j = 0; j < n; j++) {
      const index = (start + first + j) % cap;
      px[j] = xs[index];
      py[j] = ys[index];
      const life = Math.min(1 - (now - ts[index]) / config.lifeMs, 1 - dd[first + j] / config.maxLength);
      hw[j] = (config.width / 2) * clamp(life, 0, 1) ** TRAIL_TAPER;
    }
    let lastX = 0;
    let lastY = 1;
    for (let i = 0; i < n; i++) {
      const dx = px[Math.min(i + 1, n - 1)] - px[Math.max(i - 1, 0)];
      const dy = py[Math.min(i + 1, n - 1)] - py[Math.max(i - 1, 0)];
      const length = Math.hypot(dx, dy);
      if (length > 1e-3) {
        lastX = -dy / length;
        lastY = dx / length;
      }
      nx[i] = lastX;
      ny[i] = lastY;
    }
    return n;
  };

  /** One closed, smoothed ribbon: left edge tail → head, round head cap, right edge back. */
  const trace = (n: number, scale: number) => {
    for (let i = 0; i < n; i++) {
      const w = hw[i] * scale;
      ex[i] = px[i] + nx[i] * w;
      ey[i] = py[i] + ny[i] * w;
      ex[cap + i] = px[i] - nx[i] * w;
      ey[cap + i] = py[i] - ny[i] * w;
    }
    ctx.beginPath();
    ctx.moveTo(ex[0], ey[0]);
    for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(ex[i], ey[i], (ex[i] + ex[i + 1]) / 2, (ey[i] + ey[i + 1]) / 2);
    ctx.lineTo(ex[n - 1], ey[n - 1]);
    const head = n - 1;
    const normalAngle = Math.atan2(ny[head], nx[head]);
    ctx.arc(px[head], py[head], hw[head] * scale, normalAngle, normalAngle - Math.PI, true);
    for (let i = n - 2; i > 0; i--) {
      ctx.quadraticCurveTo(ex[cap + i], ey[cap + i], (ex[cap + i] + ex[cap + i - 1]) / 2, (ey[cap + i] + ey[cap + i - 1]) / 2);
    }
    ctx.lineTo(ex[cap], ey[cap]);
    ctx.closePath();
  };

  const fill = (n: number, scale: number, stops: Stops) => {
    const gradient = ctx.createLinearGradient(px[0], py[0], px[n - 1], py[n - 1]);
    gradient.addColorStop(0, stops[0]);
    gradient.addColorStop(0.5, stops[1]);
    gradient.addColorStop(1, stops[2]);
    ctx.fillStyle = gradient;
    trace(n, scale);
    ctx.fill();
  };

  const markDirty = (n: number, reach: number) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      x0 = Math.min(x0, px[i]);
      y0 = Math.min(y0, py[i]);
      x1 = Math.max(x1, px[i]);
      y1 = Math.max(y1, py[i]);
    }
    dirty = [x0 - reach, y0 - reach, x1 + reach, y1 + reach];
  };

  const draw = (now: number, paint: TrailPaint) => {
    clearDirty();
    const n = gather(now);
    if (n < 2) return n > 0;
    ctx.globalCompositeOperation = paint.composite;
    const glow = config.glow ? paint.glow : null;
    if (glow) fill(n, GLOW_SCALE, glow);
    fill(n, 1, paint.body);
    fill(n, SPINE_WIDTH / config.width, paint.spine);
    markDirty(n, (config.width / 2) * (glow ? GLOW_SCALE : 1) + 2);
    return true;
  };

  const clear = () => {
    count = 0;
    clearDirty();
  };

  resize();
  return { push, draw, clear, resize, config };
}
