/**
 * Rasterises the style's display digits on a small offscreen canvas and turns
 * their ink into particle targets.
 *
 * Every coordinate is in "band" units: 1 = the height of the digit band
 * (tallest ascent + deepest descent over 0-9), y = 0 at the band's top. Old-style
 * figures (Cormorant rises and descends per digit) keep their typographic
 * position. Each digit is sampled once per stride; a value is composed from its
 * digits at their pen positions, so any number (count-up frames included)
 * costs no extra rasterising.
 */

const SAMPLE_SIZE = 240;
const PAD = 16;
const INK_ALPHA = 128;
const DIGITS = '0123456789';

export function fontString(weight: number, family: string, size = SAMPLE_SIZE): string {
  return `${weight} ${size}px ${family}`;
}

/** Resolves once the face is usable on canvas (or after a failure: the stack's fallback is drawn). */
export async function loadFont(weight: number, family: string): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await document.fonts.load(fontString(weight, family), DIGITS);
  } catch {
    // The canvas falls back to the stack's next face; still legible.
  }
}

export interface DigitInk {
  /** Interleaved x,y in band units; x relative to the digit's pen origin. Column-major (left to right). */
  points: Float32Array;
  count: number;
}

export interface ValueLayout {
  /** Pen x of each character, band units. */
  penX: number[];
  /** Ink left edge and width of the whole value, band units. */
  inkLeft: number;
  width: number;
}

export interface GlyphBank {
  /** Ink of one digit sampled every `stride` band units (cached). */
  digit(digit: string, stride: number): DigitInk;
  layout(text: string): ValueLayout;
  dispose(): void;
}

export function createGlyphBank(weight: number, family: string): GlyphBank | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const font = fontString(weight, family);
  ctx.font = font;
  const all = ctx.measureText(DIGITS);
  const ascent = Math.ceil(all.actualBoundingBoxAscent);
  const descent = Math.max(0, Math.ceil(all.actualBoundingBoxDescent));
  const band = Math.max(1, ascent + descent);
  const metrics = new Map<string, { left: number; right: number; advance: number }>();
  let maxAdvance = 1;
  let maxOverhang = 0;
  for (const digit of DIGITS) {
    const m = ctx.measureText(digit);
    metrics.set(digit, { left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight, advance: m.width });
    maxAdvance = Math.max(maxAdvance, m.width, m.actualBoundingBoxRight);
    maxOverhang = Math.max(maxOverhang, m.actualBoundingBoxLeft);
  }
  const penPx = PAD + Math.ceil(maxOverhang);
  const baseline = PAD + ascent;
  const width = Math.ceil(penPx + maxAdvance * 1.15 + PAD);
  const height = band + PAD * 2;
  canvas.width = width;
  canvas.height = height;
  const inkCache = new Map<string, Uint8ClampedArray>();
  const pointCache = new Map<string, DigitInk>();
  const layoutCache = new Map<string, ValueLayout>();

  function raster(digit: string): Uint8ClampedArray {
    const cached = inkCache.get(digit);
    if (cached) return cached;
    if (!ctx) return new Uint8ClampedArray(0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(digit, penPx, baseline);
    const data = ctx.getImageData(0, 0, width, height).data;
    inkCache.set(digit, data);
    return data;
  }

  return {
    digit(digit, stride) {
      const key = `${digit}:${stride.toFixed(5)}`;
      const cached = pointCache.get(key);
      if (cached) return cached;
      const data = raster(digit);
      const step = Math.max(0.75, stride * band);
      const top = baseline - ascent;
      const out: number[] = [];
      // Float grid (the output is never rounded) keeps the stipple perfectly even.
      for (let x = step / 2; x < width; x += step) {
        const xi = Math.min(width - 1, Math.round(x));
        for (let y = step / 2; y < height; y += step) {
          const yi = Math.min(height - 1, Math.round(y));
          if (data[(yi * width + xi) * 4 + 3] >= INK_ALPHA) out.push((x - penPx) / band, (y - top) / band);
        }
      }
      const ink = { points: Float32Array.from(out), count: out.length / 2 };
      pointCache.set(key, ink);
      return ink;
    },
    layout(text) {
      const cached = layoutCache.get(text);
      if (cached) return cached;
      if (!ctx) return { penX: [], inkLeft: 0, width: 0 };
      ctx.font = font;
      const penX: number[] = [];
      let left = Infinity;
      let right = -Infinity;
      for (let i = 0; i < text.length; i++) {
        const pen = ctx.measureText(text.slice(0, i)).width;
        const m = metrics.get(text[i]) ?? { left: 0, right: maxAdvance, advance: maxAdvance };
        penX.push(pen / band);
        left = Math.min(left, pen - m.left);
        right = Math.max(right, pen + m.right);
      }
      const layout = { penX, inkLeft: left / band, width: Math.max(0.01, (right - left) / band) };
      layoutCache.set(text, layout);
      return layout;
    },
    dispose() {
      inkCache.clear();
      pointCache.clear();
      layoutCache.clear();
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}
