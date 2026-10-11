import { gsap } from '../../global/gsap';
import type { Pt, RouteGeometry } from './geometry';

/**
 * The route, sampled once per layout from the rendered SVG paths, so every
 * per-frame question ("where is the pen at length L?") is a binary search
 * instead of a DOM call.
 */
export interface SampledRoute {
  len: Float32Array;
  x: Float32Array;
  y: Float32Array;
  /** Running max of x / y: the camera and the vertical focus never go backwards. */
  cmx: Float32Array;
  cmy: Float32Array;
  /** Monotonic blend of arc length and forward x, used to map scroll → pen. */
  key: Float32Array;
  total: number;
  pieceStart: readonly number[];
  pieceLen: readonly number[];
  /** Route length at each station (piece i + 1 starts at station i). */
  nodeLen: readonly number[];
  /** Route length at which each detail or flag switches on, by id. */
  triggerLen: ReadonlyMap<string, number>;
}

const SAMPLE_STEP = 3;
/** Minimum share of the remaining distance the pen may cover per second. */
const CATCH_UP_PER_SECOND = 3.5;

export function sampleRoute(paths: readonly SVGPathElement[], geometry: RouteGeometry): SampledRoute {
  const lens: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const pieceStart: number[] = [];
  const pieceLen: number[] = [];
  const pieceRange: Array<[number, number]> = [];
  let offset = 0;

  paths.forEach(path => {
    const total = path.getTotalLength();
    pieceStart.push(offset);
    pieceLen.push(total);
    const first = lens.length;
    const count = Math.max(2, Math.ceil(total / SAMPLE_STEP));
    for (let k = 0; k <= count; k++) {
      const at = (total * k) / count;
      const point = path.getPointAtLength(at);
      // Pieces join end to start: skip the duplicate joint sample.
      if (k === 0 && lens.length > 0) continue;
      lens.push(offset + at);
      xs.push(point.x);
      ys.push(point.y);
    }
    pieceRange.push([Math.max(0, first - 1), lens.length - 1]);
    offset += total;
  });

  const n = lens.length;
  const len = Float32Array.from(lens);
  const x = Float32Array.from(xs);
  const y = Float32Array.from(ys);
  const cmx = new Float32Array(n);
  const cmy = new Float32Array(n);
  const key = new Float32Array(n);
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    maxX = Math.max(maxX, x[i]);
    maxY = Math.max(maxY, y[i]);
    cmx[i] = maxX;
    cmy[i] = maxY;
  }
  const total = offset;
  const spanX = Math.max(1, cmx[n - 1] - cmx[0]);
  for (let i = 0; i < n; i++) key[i] = 0.5 * (len[i] / total) + 0.5 * ((cmx[i] - cmx[0]) / spanX);

  const nearest = (pt: Pt, piece: number): number => {
    const [from, to] = pieceRange[piece] ?? [0, n - 1];
    let best = from;
    let bestDist = Infinity;
    for (let i = from; i <= to; i++) {
      const d = (x[i] - pt.x) ** 2 + (y[i] - pt.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return len[best];
  };

  const nodeLen = geometry.nodes.map((_, i) => pieceStart[i + 1] ?? total);
  const triggerLen = new Map<string, number>();
  geometry.details.forEach(detail => triggerLen.set(detail.id, nearest(detail.trigger, detail.piece)));
  geometry.flags.forEach(flag => triggerLen.set(flag.id, nearest(flag.at, flag.piece)));

  return { len, x, y, cmx, cmy, key, total, pieceStart, pieceLen, nodeLen, triggerLen };
}

/** Index of the last sample with arr[i] <= value (arr non-decreasing). */
function floorIndex(arr: Float32Array, value: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  if (value <= arr[0]) return 0;
  if (value >= arr[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= value) lo = mid;
    else hi = mid;
  }
  return lo;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface RouteSample {
  x: number;
  y: number;
  cmx: number;
}

export function sampleAt(route: SampledRoute, length: number): RouteSample {
  const i = floorIndex(route.len, length);
  const j = Math.min(i + 1, route.len.length - 1);
  const span = route.len[j] - route.len[i];
  const t = span > 0 ? Math.min(1, Math.max(0, (length - route.len[i]) / span)) : 0;
  return { x: mix(route.x[i], route.x[j], t), y: mix(route.y[i], route.y[j], t), cmx: mix(route.cmx[i], route.cmx[j], t) };
}

/** Route length for a scroll key in [0, 1] (horizontal mapping). */
export function lengthAtKey(route: SampledRoute, value: number): number {
  const i = floorIndex(route.key, value);
  const j = Math.min(i + 1, route.key.length - 1);
  const span = route.key[j] - route.key[i];
  const t = span > 0 ? Math.min(1, Math.max(0, (value - route.key[i]) / span)) : 0;
  return mix(route.len[i], route.len[j], t);
}

/** Scroll key of a route length (inverse of lengthAtKey). */
export function keyAtLength(route: SampledRoute, length: number): number {
  const i = floorIndex(route.len, length);
  return route.key[i];
}

/** Furthest route length whose running max y is still above `focusY` (vertical mapping). */
export function lengthAtFocus(route: SampledRoute, focusY: number): number {
  if (focusY <= route.cmy[0]) return 0;
  const i = floorIndex(route.cmy, focusY);
  return route.len[i];
}

/**
 * The pen: eases the drawn length toward a target with a speed limit, so a
 * jump in the target (a horizontal run on phones, a fast flick) is drawn as a
 * quick stroke instead of popping in. Ticks only while it is moving, and
 * reports when it starts and stops (the tip only breathes at rest).
 */
export class PenChaser {
  private current = 0;
  private target = 0;
  private isRunning = false;
  private hasReportedMove = false;

  constructor(
    private readonly onFrame: (length: number) => void,
    private readonly rate: number,
    private readonly maxSpeed: number,
    private readonly onRest?: (isAtRest: boolean) => void
  ) {}

  get length(): number {
    return this.current;
  }

  setTarget(value: number, isImmediate = false): void {
    this.target = value;
    if (isImmediate) {
      this.current = value;
      this.onFrame(value);
      this.onRest?.(!this.isRunning);
      return;
    }
    if (!this.isRunning && Math.abs(this.target - this.current) > 0.25) {
      // Called from scroll callbacks: no DOM writes here, the first tick reports the move.
      this.isRunning = true;
      this.hasReportedMove = false;
      gsap.ticker.add(this.tick);
    }
  }

  /** Re-renders the current state (after a layout change). */
  redraw(): void {
    this.onFrame(this.current);
  }

  destroy(): void {
    if (this.isRunning) gsap.ticker.remove(this.tick);
    this.isRunning = false;
  }

  private readonly tick = (_time: number, deltaMs: number): void => {
    if (!this.hasReportedMove) {
      this.hasReportedMove = true;
      this.onRest?.(false);
    }
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const gap = this.target - this.current;
    if (Math.abs(gap) <= 0.25) {
      this.current = this.target;
      this.onFrame(this.current);
      gsap.ticker.remove(this.tick);
      this.isRunning = false;
      this.onRest?.(true);
      return;
    }
    const eased = gap * (1 - Math.exp(-dt * this.rate));
    // The cap grows with the distance: short runs read as quick strokes, a
    // long jump (a fling, a stage button) still lands in well under a second.
    const limit = Math.max(this.maxSpeed, Math.abs(gap) * CATCH_UP_PER_SECOND) * dt;
    this.current += Math.max(-limit, Math.min(limit, eased));
    this.onFrame(this.current);
  };
}
