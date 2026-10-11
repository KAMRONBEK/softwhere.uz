import { CanvasTexture, Color, NoColorSpace, SRGBColorSpace, Texture } from 'three';

/**
 * Textures for 06 · Devices: the real app screens (decoded off the main
 * thread, uploaded lazily), the phone's back (a debossed logo as a bump +
 * roughness map) and the laptop's browser bar.
 */

export function mixHex(a: string, b: string, t: number): string {
  return `#${new Color(a).lerp(new Color(b), t).getHexString()}`;
}

function rgba(hex: string, alpha: number): string {
  const c = new Color(hex);
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`;
}

const MAX_RETRIES = 3;
const RETRY_MS = 1500;

/**
 * App screens and the laptop's site as textures, loaded in the order asked
 * (the first app first) and decoded with img.decode() so the main thread
 * never stalls on a WebP. dispose() leaves the library reusable: React
 * StrictMode mounts, cleans up and mounts again with the same instance.
 */
export class ScreenLibrary {
  private readonly textures = new Map<string, Texture>();
  private readonly pending = new Set<string>();
  private readonly attempts = new Map<string, number>();
  private readonly retries = new Set<number>();
  private generation = 0;

  constructor(
    private readonly onReady: (texture: Texture) => void,
    private readonly anisotropy: number
  ) {}

  /** The texture for a source once it has decoded, else null (the display shows the app's fill). */
  get(src: string): Texture | null {
    return this.textures.get(src) ?? null;
  }

  load(sources: readonly string[]): void {
    sources.forEach(src => this.loadOne(src));
  }

  private loadOne(src: string): void {
    if (this.textures.has(src) || this.pending.has(src)) return;
    const generation = this.generation;
    this.pending.add(src);
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    image
      .decode()
      .then(() => {
        if (generation !== this.generation) return;
        const texture = new Texture(image);
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = this.anisotropy;
        texture.needsUpdate = true;
        this.textures.set(src, texture);
        this.pending.delete(src);
        this.onReady(texture);
      })
      .catch(() => {
        if (generation !== this.generation) return;
        this.pending.delete(src);
        // Flaky networks: try again a little later; the display keeps the app's fill meanwhile.
        const attempt = (this.attempts.get(src) ?? 0) + 1;
        this.attempts.set(src, attempt);
        if (attempt > MAX_RETRIES) return;
        const timer = window.setTimeout(() => {
          this.retries.delete(timer);
          if (generation === this.generation) this.loadOne(src);
        }, RETRY_MS * attempt);
        this.retries.add(timer);
      });
  }

  dispose(): void {
    this.generation += 1;
    this.retries.forEach(timer => window.clearTimeout(timer));
    this.retries.clear();
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
    this.pending.clear();
    this.attempts.clear();
  }
}

/** Back panel: R = height (the logo is debossed), G = roughness (frosted glass, polished logo). */
const BACK_SIZE = { width: 512, height: 1064 };
const FROSTED = 'rgb(255, 150, 0)';
/** Ink the logo is drawn with (low height, low roughness). */
const BACK_MARK_INK = '#002400';
/** Logo width as a share of the back, and its centre from the top. */
const MARK_WIDTH = 0.27;
const MARK_CENTER_Y = 0.47;

export interface BackSurface {
  texture: CanvasTexture;
  /** Repaint with the logo mark (an SVG already inked with BACK_MARK_INK), or plain. */
  paint: (mark: HTMLImageElement | null) => void;
}

export function createBackSurface(): BackSurface {
  const canvas = document.createElement('canvas');
  canvas.width = BACK_SIZE.width;
  canvas.height = BACK_SIZE.height;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  // Data, not colour: bump and roughness are read linearly.
  texture.colorSpace = NoColorSpace;
  const paint = (mark: HTMLImageElement | null) => {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = FROSTED;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (mark) {
      const size = canvas.width * MARK_WIDTH;
      // The back cap's UVs run in front-view x: mirror so the logo reads from behind.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(mark, (canvas.width - size) / 2, canvas.height * MARK_CENTER_Y - size / 2, size, size);
    }
    ctx.restore();
    texture.needsUpdate = true;
  };
  paint(null);
  return { texture, paint };
}

/** Turn the panel's inline-SVG logo mark into an image inked for the back panel. */
export function markImageFromSvg(svg: string, onLoad: (image: HTMLImageElement) => void): () => void {
  const inked = svg
    .replace(/currentColor/g, BACK_MARK_INK)
    .replace(/var\(--accent\)/g, BACK_MARK_INK)
    .replace(/<svg /, '<svg width="256" height="256" ');
  const image = new Image();
  let isCurrent = true;
  image.onload = () => isCurrent && onLoad(image);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(inked)}`;
  return () => {
    isCurrent = false;
  };
}

/** A neutral browser bar for the laptop: three dots, a URL field with a lock. */
export function createChromeTexture(url: string, pageFill: string, fontFamily: string, aspect: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = Math.round(2048 / aspect);
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  if (!ctx) return texture;
  const { width: w, height: h } = canvas;
  // A dark page gets a dark browser (the bar, field and ink flip with it).
  const isDarkPage = new Color(pageFill).getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
  const bar = isDarkPage ? mixHex(pageFill, '#ffffff', 0.07) : mixHex(pageFill, '#8a8a8a', 0.16);
  const ink = mixHex(pageFill, isDarkPage ? '#ffffff' : '#000000', 0.62);
  const field = mixHex(pageFill, '#ffffff', isDarkPage ? 0.1 : 0.7);
  const highlight = mixHex(bar, '#ffffff', isDarkPage ? 0.06 : 0.35);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, highlight);
  gradient.addColorStop(1, bar);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(ink, 0.12);
  ctx.fillRect(0, h - 2, w, 2);
  const dot = h * 0.13;
  [0, 1, 2].forEach(i => {
    ctx.beginPath();
    ctx.arc(h * 0.62 + i * dot * 3.1, h / 2, dot, 0, Math.PI * 2);
    ctx.fillStyle = rgba(ink, 0.24);
    ctx.fill();
  });
  const fieldW = w * 0.34;
  const fieldH = h * 0.6;
  const fieldX = (w - fieldW) / 2;
  ctx.beginPath();
  ctx.roundRect(fieldX, (h - fieldH) / 2, fieldW, fieldH, fieldH / 2);
  ctx.fillStyle = field;
  ctx.fill();
  ctx.font = `500 ${Math.round(h * 0.34)}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  const textWidth = ctx.measureText(url).width;
  ctx.fillText(url, w / 2 + h * 0.18, h / 2 + 1);
  // Padlock.
  // An empty address (the product stays unnamed) centres the padlock.
  const lockX = url ? w / 2 - textWidth / 2 - h * 0.18 : w / 2;
  const lockY = h / 2;
  const lock = h * 0.11;
  ctx.fillStyle = rgba(ink, 0.7);
  ctx.fillRect(lockX - lock, lockY - lock * 0.3, lock * 2, lock * 1.6);
  ctx.strokeStyle = rgba(ink, 0.7);
  ctx.lineWidth = lock * 0.45;
  ctx.beginPath();
  ctx.arc(lockX, lockY - lock * 0.3, lock * 0.7, Math.PI, 0);
  ctx.stroke();
  texture.needsUpdate = true;
  return texture;
}
