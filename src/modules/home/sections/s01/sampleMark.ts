/**
 * Turns the active logo's <Mark /> SVG into particle targets.
 *
 * The mark is rasterised once into an offscreen canvas with two marker
 * colours (ink = blue, accent = red), so every sampled point knows which part
 * of the logo it belongs to. Points are drawn uniformly from the ink, with the
 * silhouette's edge pixels weighted up so the outline stays crisp even at
 * 8k particles.
 *
 * Output space: the 64×64 mark mapped to a unit square centred on the origin
 * (x right, y up), z a thin relief so the cloud has depth under parallax.
 */

export interface MarkSample {
  /** Particle count the sample was made for. */
  count: number;
  /** xyz per particle. */
  positions: Float32Array;
  /** (accent mix 0..1, ink strength 0..1) per particle. */
  tones: Float32Array;
  /** Centre of the accent part (station, badge, flick), where idle pulses start. */
  accentCenter: readonly [number, number];
  /** Share of the mark's square covered by ink, 0..1 (sets the dot spacing). */
  coverage: number;
  /** Horizontal extent of the ink, as a share of the square's width (0..1). */
  inkWidth: number;
}

const RASTER = 288;
const INK = '#0000ff';
const ACCENT = '#ff0000';
const ALPHA_MIN = 0.22;
const EDGE_WEIGHT = 2.6;
const EDGE_REACH = 3;
const RELIEF = 0.045;
const ACCENT_LIFT = 0.035;

/** Small deterministic PRNG, so a logo always samples into the same cloud. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** React serialises inline SVG without xmlns; an <img> needs it and explicit colours. */
function toStandaloneSvg(markup: string): string {
  let svg = markup
    .replace(/currentColor/g, INK)
    .replace(/var\(--accent\)/g, ACCENT)
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/\sstyle="[^"]*"/g, '');
  if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return svg.replace('<svg', `<svg width="${RASTER}" height="${RASTER}"`);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('mark raster failed'));
    image.src = src;
  });
}

interface InkMap {
  /** Cumulative sampling weight per ink pixel (for binary search). */
  cdf: Float32Array;
  index: Int32Array;
  accent: Float32Array;
  alpha: Float32Array;
  total: number;
}

function readInk(data: Uint8ClampedArray): InkMap {
  const size = RASTER;
  const alphaAt = (x: number, y: number) => (x < 0 || y < 0 || x >= size || y >= size ? 0 : data[(y * size + x) * 4 + 3] / 255);
  const index: number[] = [];
  const weights: number[] = [];
  const accent: number[] = [];
  const alpha: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const a = data[offset + 3] / 255;
      if (a < ALPHA_MIN) continue;
      const red = data[offset];
      const blue = data[offset + 2];
      const isEdge =
        alphaAt(x - EDGE_REACH, y) < ALPHA_MIN ||
        alphaAt(x + EDGE_REACH, y) < ALPHA_MIN ||
        alphaAt(x, y - EDGE_REACH) < ALPHA_MIN ||
        alphaAt(x, y + EDGE_REACH) < ALPHA_MIN;
      index.push(y * size + x);
      weights.push(isEdge ? EDGE_WEIGHT : 1);
      accent.push(red / Math.max(1, red + blue));
      alpha.push(a);
    }
  }
  const cdf = new Float32Array(weights.length);
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    total += weights[i];
    cdf[i] = total;
  }
  return { cdf, index: Int32Array.from(index), accent: Float32Array.from(accent), alpha: Float32Array.from(alpha), total };
}

function pick(cdf: Float32Array, value: number): number {
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cdf[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Rasterises `svgMarkup` and draws `count` particle targets from its ink. */
export async function sampleMark(svgMarkup: string, count: number, seed = 7): Promise<MarkSample> {
  const svg = toStandaloneSvg(svgMarkup);
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const canvas = document.createElement('canvas');
  canvas.width = RASTER;
  canvas.height = RASTER;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');
  ctx.drawImage(image, 0, 0, RASTER, RASTER);
  const ink = readInk(ctx.getImageData(0, 0, RASTER, RASTER).data);
  if (ink.cdf.length === 0) throw new Error('mark has no ink');

  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const tones = new Float32Array(count * 2);
  let accentX = 0;
  let accentY = 0;
  let accentWeight = 0;
  for (let i = 0; i < count; i++) {
    const k = pick(ink.cdf, random() * ink.total);
    const pixel = ink.index[k];
    const px = (pixel % RASTER) + random();
    const py = Math.floor(pixel / RASTER) + random();
    const accent = ink.accent[k];
    positions[i * 3] = px / RASTER - 0.5;
    positions[i * 3 + 1] = 0.5 - py / RASTER;
    positions[i * 3 + 2] = (random() - 0.5) * RELIEF + accent * ACCENT_LIFT;
    tones[i * 2] = accent;
    tones[i * 2 + 1] = ink.alpha[k];
    if (accent > 0.5) {
      accentX += positions[i * 3];
      accentY += positions[i * 3 + 1];
      accentWeight += 1;
    }
  }
  const accentCenter = accentWeight > 0 ? ([accentX / accentWeight, accentY / accentWeight] as const) : ([0, 0] as const);
  let inkLeft = RASTER;
  let inkRight = 0;
  ink.index.forEach(pixel => {
    inkLeft = Math.min(inkLeft, pixel % RASTER);
    inkRight = Math.max(inkRight, pixel % RASTER);
  });
  const inkWidth = (inkRight - inkLeft + 1) / RASTER;
  return { count, positions, tones, accentCenter, coverage: ink.cdf.length / (RASTER * RASTER), inkWidth };
}
