import { FLYING, LANDED, type Placement, type Pool } from './dustTypes';

/**
 * Couriers: one spark per counted unit. As the numeral's count reaches k, a
 * spark leaves a particle of the numeral and arcs to the k-th dot of the unit
 * chart, landing (with a small impact ring) at the moment the dot lights. It
 * makes "one dot per product" literal: the number pays out its own dots.
 *
 * Positions are a pure function of time (a quadratic Bézier per spark), so
 * there is no physics to step and nothing drifts on a slow device.
 */

/** A spark to send, in canvas CSS px and seconds from now. */
export interface CourierSpec {
  x: number;
  y: number;
  /** Seconds until the spark leaves the numeral. */
  delay: number;
  /** Flight time, s. */
  flight: number;
  /** Size of the dot it lands on, px: the impact ring scales with it. */
  size: number;
}

export interface Couriers {
  n: number;
  /** Absolute launch time and flight duration, s. */
  launch: Float32Array;
  flight: Float32Array;
  /** Start point, captured at launch (NaN until then). */
  sx: Float32Array;
  sy: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  /** Bézier control-point offset, a fraction of the flight distance (signed). */
  curl: Float32Array;
  size: Float32Array;
  /** Last moment anything of this batch is still drawn, s. */
  end: number;
}

const RING_S = 0.5;
/** Trail length, in eased progress. */
const TRAIL = 0.13;
const HEAD_R = 2.3;
const ORIGIN_TRIES = 12;

const easeInOutCubic = (s: number) => (s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createCouriers(specs: readonly CourierSpec[], now: number): Couriers {
  const n = specs.length;
  const f32 = () => new Float32Array(n);
  const c: Couriers = {
    n,
    launch: f32(),
    flight: f32(),
    sx: f32().fill(Number.NaN),
    sy: f32().fill(Number.NaN),
    tx: f32(),
    ty: f32(),
    curl: f32(),
    size: f32(),
    end: now,
  };
  specs.forEach((spec, i) => {
    c.launch[i] = now + spec.delay;
    c.flight[i] = spec.flight;
    c.tx[i] = spec.x;
    c.ty[i] = spec.y;
    c.curl[i] = (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.26);
    c.size[i] = spec.size;
    c.end = Math.max(c.end, c.launch[i] + spec.flight + RING_S);
  });
  return c;
}

/** True while any spark of the batch is waiting, flying or ringing. */
export function couriersBusy(c: Couriers, t: number): boolean {
  return t < c.end;
}

/** Captures the start point of every spark whose launch time has come: a live particle of the numeral, which flashes. */
export function launchCouriers(c: Couriers, t: number, pool: Pool, place: Placement): void {
  for (let i = 0; i < c.n; i++) {
    if (t < c.launch[i] || c.sx[i] === c.sx[i]) continue;
    let origin = -1;
    for (let k = 0; k < ORIGIN_TRIES; k++) {
      const j = Math.floor(Math.random() * pool.n);
      const status = pool.status[j];
      if (status === LANDED || status === FLYING) {
        origin = j;
        break;
      }
    }
    if (origin >= 0) {
      c.sx[i] = pool.x[origin];
      c.sy[i] = pool.y[origin];
      pool.energy[origin] = 1;
    } else {
      c.sx[i] = place.cx + (Math.random() - 0.5) * place.rx;
      c.sy[i] = place.cy + (Math.random() - 0.5) * place.ry;
    }
  }
}

function pointAt(c: Couriers, i: number, e: number, out: Float32Array): void {
  const sx = c.sx[i];
  const sy = c.sy[i];
  const tx = c.tx[i];
  const ty = c.ty[i];
  const mx = (sx + tx) / 2 - (ty - sy) * c.curl[i];
  const my = (sy + ty) / 2 + (tx - sx) * c.curl[i];
  const r = 1 - e;
  out[0] = r * r * sx + 2 * r * e * mx + e * e * tx;
  out[1] = r * r * sy + 2 * r * e * my + e * e * ty;
}

const scratch = new Float32Array(2);

/** Trails, heads and impact rings. Plain source-over: on dark styles the accent already reads as light. */
export function drawCouriers(g: CanvasRenderingContext2D, c: Couriers, t: number, color: string, isDark: boolean): void {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = 'round';
  for (let i = 0; i < c.n; i++) {
    if (t < c.launch[i] || c.sx[i] !== c.sx[i]) continue;
    const s = (t - c.launch[i]) / c.flight[i];
    if (s < 1) {
      const e = easeInOutCubic(s);
      const tail = easeInOutCubic(clamp01(s - TRAIL));
      // Trail: four samples along the curve, a soft wide stroke under a thin bright one.
      g.beginPath();
      for (let k = 0; k <= 3; k++) {
        pointAt(c, i, tail + ((e - tail) * k) / 3, scratch);
        if (k === 0) g.moveTo(scratch[0], scratch[1]);
        else g.lineTo(scratch[0], scratch[1]);
      }
      g.globalAlpha = isDark ? 0.16 : 0.12;
      g.lineWidth = 4;
      g.stroke();
      g.globalAlpha = isDark ? 0.75 : 0.65;
      g.lineWidth = 1.4;
      g.stroke();
      const hx = scratch[0];
      const hy = scratch[1];
      g.globalAlpha = isDark ? 0.26 : 0.16;
      g.beginPath();
      g.arc(hx, hy, HEAD_R * 3, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(hx, hy, HEAD_R, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    // Landed: a ring opens around the dot and fades.
    const q = (t - c.launch[i] - c.flight[i]) / RING_S;
    if (q >= 1) continue;
    const ease = 1 - (1 - q) ** 3;
    g.globalAlpha = (1 - q) * 0.6;
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(c.tx[i], c.ty[i], c.size[i] * (0.3 + 0.5 * ease), 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
}
