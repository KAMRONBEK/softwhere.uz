/**
 * Where the wide tape crosses "We ship." — solved per letter so the payoff
 * stays legible in every face while the band bites into it as far as it can.
 *
 * The band is tilted, so its top edge sits at a different height under every
 * letter. Each letter of the payoff's last row allows the band a different
 * bite above the baseline: stems (H, I, P, W, h, i…) can lose their feet,
 * rounds and bars (S, E, e, s…) only a sliver, and letters with a descender
 * (p, g, y…) keep their bowl whole and show a little of their tail, so
 * "ship" never reads "shin". The crossing is the highest one that respects
 * every letter.
 *
 * Everything is linear in the payoff's font size (letters are positioned in
 * em, kerning included), which lets useFitLines solve the height budget and
 * the crossing together, exactly, without a second layout pass.
 */

/**
 * Bite allowed above the baseline, as a share of the cap height. Negative for
 * descenders: the band stays that far below the baseline, so a little of the
 * tail shows and a "p" never passes for an "n" or an "o".
 */
const BITE = {
  stem: 0.17,
  round: 0.05,
  descender: -0.12,
} as const;

const STEM_FOOT = /[AFHIKMNPRTVWXYhiklmnrfvwx1]/;
const DESCENDER = /[gjpqy]/;
const FREE = /[^\p{L}\p{N}]/u;

/** One constraint: a letter edge (em from the line's left) and its allowed bite (cap shares). */
export interface CrossingLetter {
  /** Edge of the letter, in em of the payoff size, where the tilted band is highest. */
  edgeEm: number;
  bite: number;
}

export interface CrossingGeometry {
  letters: readonly CrossingLetter[];
  /** Root x of the payoff line's left edge. */
  lineLeft: number;
  /** Root x the band rotates about (the tapes box centre). */
  pivotX: number;
  /** tan of the band's tilt (negative: its right end is higher). */
  slope: number;
  /** 1 / cos of the tilt: the top edge sits a little further from the centre line. */
  secant: number;
  /** Baseline height above the line-box bottom, per px of font size. */
  baseline: number;
  /** Cap height per px of font size. */
  cap: number;
}

/** A linear function of the payoff's font size: `perPx * size + fixed` (px). */
export interface Linear {
  perPx: number;
  fixed: number;
}

function biteFor(ch: string): number | null {
  if (FREE.test(ch)) return null;
  if (DESCENDER.test(ch)) return BITE.descender;
  if (STEM_FOOT.test(ch)) return BITE.stem;
  return BITE.round;
}

/** Reads the letters of the payoff's last row, in em at its current size. */
export function readCrossingLetters(line: HTMLElement, charAttr: string, slope: number): CrossingLetter[] {
  const size = parseFloat(getComputedStyle(line).fontSize);
  if (!size) return [];
  const isUpper = getComputedStyle(line).textTransform === 'uppercase';
  const chars = Array.from(line.querySelectorAll<HTMLElement>(`[${charAttr}]`));
  const lastTop = chars.reduce((top, el) => Math.max(top, el.offsetTop), -Infinity);
  return chars.flatMap(el => {
    if (el.offsetTop < lastTop - 1) return [];
    const raw = el.getAttribute(charAttr) ?? '';
    const bite = biteFor(isUpper ? raw.toUpperCase() : raw);
    if (bite === null) return [];
    // Inset a little: side bearings and round overshoot never meet the band.
    const inset = el.offsetWidth * 0.12;
    const edge = slope < 0 ? el.offsetLeft + el.offsetWidth - inset : el.offsetLeft + inset;
    return [{ edgeEm: edge / size, bite }];
  });
}

/**
 * The band-top height above the payoff's line-box bottom (at the pivot), one
 * linear function per letter: the crossing is the lowest of them (the binding
 * letter), at any size.
 */
export function crossingRises(geo: CrossingGeometry): Linear[] {
  return geo.letters.map(({ edgeEm, bite }) => ({
    perPx: geo.baseline + bite * geo.cap + edgeEm * geo.slope,
    fixed: (geo.lineLeft - geo.pivotX) * geo.slope,
  }));
}

export function riseAt(rises: readonly Linear[], size: number): number {
  return rises.reduce((low, rise) => Math.min(low, rise.perPx * size + rise.fixed), Infinity);
}

/** Spread (px) of the first box-shadow on `el`: the band's ring of page colour. */
export function readRing(el: HTMLElement | null): number {
  const shadow = el ? getComputedStyle(el).boxShadow : 'none';
  const lengths = /(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(shadow);
  return lengths ? Math.max(0, Number(lengths[4]) || 0) : 0;
}

/** Reads the tilt of a rotated element from its computed transform matrix. */
export function readTilt(el: HTMLElement | null): { slope: number; secant: number } {
  const matrix = el ? getComputedStyle(el).transform : 'none';
  const values = /matrix\(([^)]+)\)/.exec(matrix)?.[1]?.split(',').map(Number);
  if (!values || values.length < 2 || !values[0]) return { slope: 0, secant: 1 };
  const [a, b] = values;
  return { slope: b / a, secant: Math.hypot(a, b) / Math.abs(a) };
}
