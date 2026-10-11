/**
 * Splitting a word into one inline-block per letter drops the font's
 * kerning (each letter is shaped alone), which shows at display sizes: the
 * "W e" in a serif title. This measures every letter pair with a 2D canvas
 * (which kerns like the browser does) and gives the first letter of the pair
 * the difference as a negative margin, in em, so it holds at any fitted size.
 */

const MEASURE_PX = 100;
/** Words carry `data-k-word="<the word>"`; their children are the letters. */
export const WORD_ATTR = 'data-k-word';

const cache = new Map<string, number[]>();
let context: CanvasRenderingContext2D | null = null;

function getContext(): CanvasRenderingContext2D | null {
  if (!context) context = document.createElement('canvas').getContext('2d');
  return context;
}

function pairKerning(ctx: CanvasRenderingContext2D, font: string, word: string): number[] {
  const key = `${font}|${word}`;
  const cached = cache.get(key);
  if (cached) return cached;
  ctx.font = font;
  const letters = Array.from(word);
  const width = (text: string) => ctx.measureText(text).width;
  const kerns = letters.map((letter, index) => {
    const next = letters[index + 1];
    if (!next) return 0;
    return (width(letter + next) - width(letter) - width(next)) / MEASURE_PX;
  });
  cache.set(key, kerns);
  return kerns;
}

/** Applies pair kerning to every split word inside `lines` (main letters and their echoes alike). */
export function applyKerning(lines: readonly HTMLElement[]): void {
  const ctx = getContext();
  if (!ctx) return;
  lines.forEach(line => {
    const style = getComputedStyle(line);
    const font = `${style.fontStyle} ${style.fontWeight} ${MEASURE_PX}px ${style.fontFamily}`;
    const isUpper = style.textTransform === 'uppercase';
    line.querySelectorAll<HTMLElement>(`[${WORD_ATTR}]`).forEach(wordEl => {
      const raw = wordEl.getAttribute(WORD_ATTR) ?? '';
      const kerns = pairKerning(ctx, font, isUpper ? raw.toUpperCase() : raw);
      Array.from(wordEl.children).forEach((letter, index) => {
        const kern = kerns[index] ?? 0;
        (letter as HTMLElement).style.marginRight = Math.abs(kern) < 0.002 ? '' : `${kern.toFixed(4)}em`;
      });
    });
  });
}

/** Vertical metrics of a face, per 1px of font size. */
export interface TypeMetrics {
  /** Font ascent and descent (what line boxes are built from). */
  ascent: number;
  descent: number;
  /** Height of a capital H above the baseline. */
  cap: number;
}

const FALLBACK_METRICS: TypeMetrics = { ascent: 0.92, descent: 0.24, cap: 0.7 };
const metricsCache = new Map<string, TypeMetrics>();

/** Measures `el`'s face with a 2D canvas (same metrics the browser lays text out with). */
export function measureTypeMetrics(el: HTMLElement): TypeMetrics {
  const ctx = getContext();
  if (!ctx) return FALLBACK_METRICS;
  const style = getComputedStyle(el);
  const font = `${style.fontStyle} ${style.fontWeight} ${MEASURE_PX}px ${style.fontFamily}`;
  const cached = metricsCache.get(font);
  if (cached) return cached;
  ctx.font = font;
  const m = ctx.measureText('H');
  const metrics: TypeMetrics =
    m.fontBoundingBoxAscent > 0 && m.actualBoundingBoxAscent > 0
      ? {
          ascent: m.fontBoundingBoxAscent / MEASURE_PX,
          descent: m.fontBoundingBoxDescent / MEASURE_PX,
          cap: m.actualBoundingBoxAscent / MEASURE_PX,
        }
      : FALLBACK_METRICS;
  metricsCache.set(font, metrics);
  return metrics;
}
