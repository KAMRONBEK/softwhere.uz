import { BUCKETS, DUST, HALO, type Ambient, type DustPalette, type Placement, type Pool } from './dustTypes';

/**
 * Canvas 2D drawing for the dust: batched fillRects, one fillStyle per colour
 * bucket, plain source-over everywhere (additive 'lighter' compositing is the
 * slow path in Safari's 2D canvas; on dark styles the accents already read as
 * light).
 */

const SPARK_MIN = 0.2;
const HALO_SIZE = 1.25;
const CULL = 4;

export interface Scene {
  pool: Pool;
  ambient: Ambient | null;
  palette: DustPalette;
  hasGlow: boolean;
  /** BUCKETS colours along the palette gradient. */
  colors: readonly string[];
  width: number;
  height: number;
  dpr: number;
  place: Placement;
  /** Particle size inside the numeral, CSS px. */
  dot: number;
  /** 0..1: how formed the numeral is (glow, halo alpha). */
  form: number;
  /** 0..1 fade-in of freshly scattered dust. */
  fade: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, c => c + c) : h;
  const n = Number.parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function gradientColors(palette: DustPalette): string[] {
  const a = hexToRgb(palette.gradient[0]);
  const b = hexToRgb(palette.gradient[1]);
  return Array.from({ length: BUCKETS }, (_, i) => {
    const t = i / (BUCKETS - 1);
    const c = a.map((v, k) => Math.round(v + (b[k] - v) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  });
}

function drawGlow(g: CanvasRenderingContext2D, scene: Scene): void {
  const { glow } = scene.palette;
  if (!glow || !scene.hasGlow || scene.form < 0.01) return;
  const { cx, cy, rx, ry } = scene.place;
  const r = Math.max(rx, ry) * 1.15;
  const [cr, cg, cb] = hexToRgb(glow);
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.16)`);
  grad.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, 0.05)`);
  grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
  g.globalAlpha = scene.form;
  g.fillStyle = grad;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function isOff(x: number, y: number, scene: Scene): boolean {
  return x < -CULL || y < -CULL || x > scene.width + CULL || y > scene.height + CULL;
}

function drawAmbient(g: CanvasRenderingContext2D, scene: Scene): void {
  const a = scene.ambient;
  if (!a) return;
  g.fillStyle = scene.palette.dust;
  g.globalAlpha = scene.palette.isDark ? 0.42 : 0.36;
  for (let i = 0; i < a.n; i++) {
    const s = a.size[i];
    g.fillRect(a.x[i], a.y[i], s, s);
  }
}

export function drawFrame(g: CanvasRenderingContext2D, scene: Scene): void {
  const { pool, palette, colors, dot, fade } = scene;
  g.setTransform(scene.dpr, 0, 0, scene.dpr, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, scene.width, scene.height);

  drawGlow(g, scene);
  drawAmbient(g, scene);

  const solidAlpha = (palette.isDark ? 0.92 : 0.94) * fade;
  const haloAlpha = (palette.isDark ? 0.3 : 0.26) * fade;
  const half = dot / 2;
  const haloHalf = HALO_SIZE / 2;
  let sparkCount = 0;
  let start = 0;
  for (let b = 0; b < BUCKETS; b++) {
    g.fillStyle = colors[b];
    const end = pool.bucketEnd[b];
    // Two passes per colour: the numeral, then the loose dust around it.
    g.globalAlpha = solidAlpha;
    for (let k = start; k < end; k++) {
      const j = pool.order[k];
      const status = pool.status[j];
      if (status === HALO || status === DUST) continue;
      const x = pool.x[j];
      const y = pool.y[j];
      if (isOff(x, y, scene)) continue;
      if (pool.energy[j] > SPARK_MIN) {
        pool.sparks[sparkCount++] = j;
        continue;
      }
      g.fillRect(x - half, y - half, dot, dot);
    }
    g.globalAlpha = haloAlpha;
    for (let k = start; k < end; k++) {
      const j = pool.order[k];
      const status = pool.status[j];
      if (status !== HALO && status !== DUST) continue;
      const x = pool.x[j];
      const y = pool.y[j];
      if (isOff(x, y, scene)) continue;
      g.fillRect(x - haloHalf, y - haloHalf, HALO_SIZE, HALO_SIZE);
    }
    start = end;
  }

  if (sparkCount > 0) {
    g.fillStyle = palette.spark;
    const s = dot * 1.2;
    for (let k = 0; k < sparkCount; k++) {
      const j = pool.sparks[k];
      // Always brighter than the particle's own colour: a spark, never a grey patch.
      g.globalAlpha = Math.min(1, 0.45 + pool.energy[j] * 0.55) * fade;
      g.fillRect(pool.x[j] - s / 2, pool.y[j] - s / 2, s, s);
    }
  }
  g.globalAlpha = 1;
}

export function clearFrame(g: CanvasRenderingContext2D, width: number, height: number): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, width, height);
}
