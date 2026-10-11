import landDots from '../../assets/globe/land-dots.json';
import { TAG_INDEX, type CountryTag } from './markets';

/**
 * Sphere math shared by the WebGL scene and the 2D still.
 *
 * Convention: unit sphere, y up, longitude 0 facing the camera (+z). The
 * globe turns by Euler XYZ (yaw about y first, then pitch about x), exactly
 * like three's `object.rotation.set(pitch, yaw, 0)`, so `rotate()` below and
 * the scene agree point for point.
 */

export const DEG = Math.PI / 180;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TWO_PI = Math.PI * 2;

export type Vec3 = [number, number, number];

export function latLonToVec(lat: number, lon: number, radius = 1): Vec3 {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  const c = Math.cos(phi);
  return [c * Math.sin(lambda) * radius, Math.sin(phi) * radius, c * Math.cos(lambda) * radius];
}

/** Yaw about y, then pitch about x (radians). */
export function rotate([x, y, z]: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Great-circle arc from a to b, lifted off the surface (higher for longer
 * flights). `segments + 1` points.
 */
export function arcPoints(a: Vec3, b: Vec3, segments: number): Vec3[] {
  const omega = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
  const sinOmega = Math.sin(omega) || 1;
  const lift = 0.035 + (omega / Math.PI) * 0.26;
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wa = Math.sin((1 - t) * omega) / sinOmega;
    const wb = Math.sin(t * omega) / sinOmega;
    const h = 1 + lift * Math.sin(Math.PI * t);
    points.push([(a[0] * wa + b[0] * wb) * h, (a[1] * wa + b[1] * wb) * h, (a[2] * wa + b[2] * wb) * h]);
  }
  return points;
}

const DAY_MS = 86_400_000;
const AXIAL_TILT = 23.44;

/**
 * Where the sun is overhead right now, as a unit vector in globe space: the
 * live day/night terminator. Declination from the day of the year, longitude
 * from UTC time (equation of time ignored: under 4° off, invisible here).
 */
export function sunDirection(date: Date): Vec3 {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - yearStart) / DAY_MS;
  const declination = -AXIAL_TILT * Math.cos(((2 * Math.PI) / 365.24) * (dayOfYear + 10));
  const utcHours = (date.getTime() % DAY_MS) / 3_600_000;
  return latLonToVec(declination, (12 - utcHours) * 15);
}

/** Shortest wrap of an angle onto a multiple of a full turn (for settling a spun globe). */
export function nearestTurn(angle: number): number {
  return Math.round(angle / TWO_PI) * TWO_PI;
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// ── Layout ─────────────────────────────────────────────────────────────

/** Camera for the WebGL scene (the still is orthographic and needs none). */
export const CAMERA_Z = 9;
export const CAMERA_FOV = 30;

export interface GlobeLayout {
  /** Globe center in CSS px within the stage. */
  cx: number;
  cy: number;
  /** Globe radius in CSS px. */
  r: number;
  isWide: boolean;
}

/** Wide screens put the globe right of the copy; phones centre it between heading and caption. */
export const WIDE_QUERY =
  '(min-width: 768px) and (min-aspect-ratio: 105/100), (min-width: 560px) and (max-height: 520px) and (min-aspect-ratio: 105/100)';

/** Phone layout bands (CSS px), mirrored in globe.module.css (--intro-h, --dock-h). */
const PHONE_INTRO_BOTTOM = 175;
const PHONE_DOCK_HEIGHT = 262;

export function globeLayout(width: number, height: number): GlobeLayout {
  // Short landscape screens too (a phone turned sideways): the phone bands do not fit their height.
  const isWide = width / height >= 1.05 && (width >= 768 || (width >= 560 && height <= 520));
  if (isWide) {
    const r = Math.min(height * 0.4, width * 0.27);
    return { cx: width * 0.665, cy: height * 0.52, r, isWide };
  }
  // Between the intro (heading + hint) and the dock (route + caption).
  const top = PHONE_INTRO_BOTTOM;
  const bottom = height - PHONE_DOCK_HEIGHT;
  const r = Math.max(80, Math.min(width * 0.47, (bottom - top) / 2 - 8));
  return { cx: width * 0.5, cy: (top + bottom) / 2, r, isWide };
}

// ── Land dots ──────────────────────────────────────────────────────────

export type DotSet = 'high' | 'mid' | 'low';

export interface LandDots {
  /** xyz per dot on the unit sphere. */
  positions: Float32Array;
  /** TAG_INDEX per dot (0 = land outside our markets). */
  tags: Float32Array;
  count: number;
  /** Angular spacing of the lattice (radians), for dot sizing. */
  spacing: number;
}

interface DotSetData {
  n: number;
  land: number;
  bits: string;
  tags: Record<string, string>;
}

const SETS = (landDots as { sets: Record<DotSet, DotSetData> }).sets;
const cache = new Map<DotSet, LandDots>();

function decodeBits(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeTags(data: DotSetData): Uint8Array {
  const byIndex = new Uint8Array(data.n);
  for (const [tag, encoded] of Object.entries(data.tags)) {
    const value = TAG_INDEX[tag as CountryTag];
    if (!value || !encoded) continue;
    let index = 0;
    for (const delta of encoded.split(',')) {
      index += parseInt(delta, 36);
      byIndex[index] = value;
    }
  }
  return byIndex;
}

/**
 * Land dots on a Fibonacci lattice (Natural Earth 110m, precomputed into
 * assets/globe/land-dots.json). Decoded once per set and cached.
 */
export function getLandDots(set: DotSet): LandDots {
  const cached = cache.get(set);
  if (cached) return cached;
  const data = SETS[set];
  const bits = decodeBits(data.bits);
  const tagByIndex = decodeTags(data);
  const positions = new Float32Array(data.land * 3);
  const tags = new Float32Array(data.land);
  let k = 0;
  for (let i = 0; i < data.n; i++) {
    if (!(bits[i >> 3] & (1 << (i & 7)))) continue;
    // Same lattice as the generator: latitude from y, longitude by the golden angle.
    const lat = Math.asin(1 - (2 * i + 1) / data.n) / DEG;
    let lon = ((i * GOLDEN_ANGLE) % TWO_PI) / DEG;
    if (lon >= 180) lon -= 360;
    const [x, y, z] = latLonToVec(lat, lon);
    positions[k * 3] = x;
    positions[k * 3 + 1] = y;
    positions[k * 3 + 2] = z;
    tags[k] = tagByIndex[i];
    k++;
  }
  const result: LandDots = { positions, tags, count: k, spacing: Math.sqrt((4 * Math.PI) / data.n) };
  cache.set(set, result);
  return result;
}
