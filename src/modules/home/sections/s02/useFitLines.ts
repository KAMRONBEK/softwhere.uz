'use client';

import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { crossingRises, readCrossingLetters, readRing, readTilt, riseAt, type CrossingGeometry, type Linear } from './crossing';
import { FIT_EVENT, K } from './engine';
import { applyKerning, measureTypeMetrics } from './kerning';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Must match the `.narrowBreak` media query in manifesto.module.css. */
export const NARROW_QUERY = '(max-width: 719px)';
const MIN_FONT_PX = 28;
/** Rounding slack so the content never overflows the reserved height by a pixel. */
const BUDGET_SLACK_PX = 2;

interface LineRead {
  line: HTMLElement;
  width: number;
  height: number;
  size: number;
  share: number;
  isPayoff: boolean;
}

interface FitParts {
  root: HTMLElement;
  column: HTMLElement;
  tapes: HTMLElement | null;
  band: HTMLElement | null;
  lines: HTMLElement[];
}

/** Reads the crossing geometry of the payoff line (positions in em, so any size works). */
function readCrossing({ root, column, tapes, band }: FitParts, payoff: HTMLElement): CrossingGeometry {
  const { slope, secant } = readTilt(band?.parentElement ?? null);
  const metrics = measureTypeMetrics(payoff);
  const size = parseFloat(getComputedStyle(payoff).fontSize) || 1;
  const lineHeight = (parseFloat(getComputedStyle(payoff).lineHeight) || size) / size;
  return {
    letters: readCrossingLetters(payoff, K.char, slope),
    lineLeft: column.offsetLeft + payoff.offsetLeft,
    pivotX: tapes ? tapes.offsetLeft + tapes.offsetWidth / 2 : root.clientWidth / 2,
    slope,
    secant,
    // Half-leading model: the baseline sits (lineHeight − ascent + descent) / 2 above the box bottom.
    baseline: (lineHeight - metrics.ascent + metrics.descent) / 2,
    cap: metrics.cap,
  };
}

/**
 * Largest scale (≤ 1) at which lines + the tapes hanging below the payoff fit
 * `budget`. The hang shrinks as the crossing rises, and the crossing is the
 * lowest of the per-letter rises, so every letter gives its own bound.
 */
function solveScale(textHeight: number, payoffSize: number, rises: readonly Linear[], budget: number): number {
  if (budget <= 0 || textHeight <= 0) return 1;
  const bounds = (rises.length ? rises : [{ perPx: 0, fixed: 0 }]).map(rise => {
    const perScale = textHeight - rise.perPx * payoffSize;
    return perScale > 0 ? (budget + rise.fixed) / perScale : 1;
  });
  return Math.max(0.1, Math.min(1, ...bounds));
}

/**
 * Sizes the statement in two passes, both exact because text size is linear
 * in font size:
 *
 * 1. width: every `[data-fit]` line's widest row fills its share of the column
 *    (`data-share` on wide screens, the full width on narrow ones);
 * 2. height: if the composition (lines + the part of the tapes that hangs
 *    below the payoff) would be taller than the root's reserved min-height,
 *    all lines scale down together until it fits.
 *
 * The tapes cross the payoff as high as its letters allow (crossing.ts), so
 * the section is exactly as tall as heights.css reserves, in every style.
 * Writes `--fs` on each line and `--tapes-shift` on the root (the tapes'
 * centre relative to the foot of the statement), restores pair kerning first
 * (kerning.ts), and reruns on width/height changes, font loads and style
 * switches.
 */
function fitStatement(parts: FitParts, isNarrow: boolean): void {
  const { root, column, tapes, band, lines } = parts;
  const available = column.clientWidth;
  // Kerning changes the widths, so it goes first; then all reads, then all writes.
  applyKerning(lines);
  const reads: LineRead[] = lines.map(line => ({
    line,
    width: line.offsetWidth,
    height: line.offsetHeight,
    size: parseFloat(getComputedStyle(line).fontSize),
    share: isNarrow ? 1 : Number(line.dataset.share ?? '1'),
    isPayoff: line.hasAttribute('data-payoff'),
  }));
  const rootStyle = getComputedStyle(root);
  const reserved = parseFloat(rootStyle.minHeight) || 0;
  const padding = parseFloat(rootStyle.paddingTop) + parseFloat(rootStyle.paddingBottom);
  const gaps = (parseFloat(getComputedStyle(column).rowGap) || 0) * (lines.length - 1);
  const tapesHalf = (tapes?.offsetHeight ?? 0) / 2;
  const payoffIndex = reads.findIndex(read => read.isPayoff);
  const payoff = reads[payoffIndex];
  const geometry = payoff ? readCrossing(parts, payoff.line) : null;
  // From the band's centre line up to its visible edge: half the band, plus the ring of page colour around it.
  const bandEdge = ((band?.offsetHeight ?? 0) / 2 + readRing(band)) * (geometry?.secant ?? 1);

  const sizes = reads.map(({ width, size, share }) => (width && size ? Math.max(MIN_FONT_PX, (size * available * share) / width) : size));
  const textHeight = reads.reduce((sum, read, index) => sum + (read.size ? (read.height / read.size) * sizes[index] : 0), 0);
  const payoffSize = sizes[payoffIndex] ?? 0;
  const rises = geometry ? crossingRises(geometry) : [];
  // Below the statement: half the tapes box, centred half a band under the crossing.
  const budget = reserved - padding - gaps - tapesHalf - bandEdge - BUDGET_SLACK_PX;
  const scale = reserved > 0 ? solveScale(textHeight, payoffSize, rises, budget) : 1;

  reads.forEach(({ line, size }, index) => {
    if (!size) return;
    line.style.setProperty('--fs', `${Math.max(MIN_FONT_PX * 0.75, sizes[index] * scale).toFixed(2)}px`);
  });
  const rise = rises.length ? riseAt(rises, payoffSize * scale) : 0;
  root.style.setProperty('--tapes-shift', `${(bandEdge - rise).toFixed(2)}px`);
  root.dispatchEvent(new Event(FIT_EVENT));
}

export function useFitLines(rootRef: RefObject<HTMLElement | null>, styleKey: string): void {
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const column = root.querySelector<HTMLElement>('[data-fit-column]');
    const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-fit]'));
    if (!column || lines.length === 0) return;
    const parts: FitParts = {
      root,
      column,
      tapes: root.querySelector<HTMLElement>('[data-fit-tapes]'),
      band: root.querySelector<HTMLElement>('[data-fit-band]'),
      lines,
    };
    const narrow = window.matchMedia(NARROW_QUERY);
    let lastWidth = -1;
    let lastHeight = -1;
    let frame = 0;
    let isDisposed = false;

    const fit = () => {
      if (column.clientWidth <= 0) return;
      lastWidth = column.clientWidth;
      lastHeight = window.innerHeight;
      fitStatement(parts, narrow.matches);
    };
    const schedule = () => {
      if (isDisposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const onResize = () => {
      if (column.clientWidth !== lastWidth || window.innerHeight !== lastHeight) schedule();
    };

    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    observer?.observe(column);
    window.addEventListener('resize', onResize, { passive: true });
    narrow.addEventListener('change', schedule);
    document.fonts?.addEventListener('loadingdone', schedule);
    void document.fonts?.ready.then(schedule);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      narrow.removeEventListener('change', schedule);
      document.fonts?.removeEventListener('loadingdone', schedule);
    };
  }, [rootRef, styleKey]);
}
