'use client';

import { useEffect } from 'react';
import { getLabLenis } from './scroll';

/** The place is read once the scroll rests this long (a rotation mid-flick keeps the last rest). */
const RECORD_DEBOUNCE_MS = 120;
/** After a width change the place is held this long, while sections, pins and frozen heights re-measure. */
const HOLD_MS = 1200;
/** Drift (px) worth correcting. */
const DRIFT_PX = 2;
/** Visitor input that hands the scroll back to them. */
const INTERRUPT_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

interface Place {
  section: HTMLElement;
  /** How far through its scroll story (0 = stuck at the top, 1 = about to leave), for sections taller than the screen. */
  story: number | null;
  /** How far through its passage across the screen (0 = top at the screen's foot, 1 = bottom at its head). */
  passage: number;
}

function readPlace(): Place | null {
  const screen = window.innerHeight;
  const sections = document.querySelectorAll<HTMLElement>('main [data-section]');
  for (const section of sections) {
    const { top, height } = section.getBoundingClientRect();
    if (top > screen / 2 || top + height <= screen / 2) continue;
    return {
      section,
      story: height > screen ? -top / (height - screen) : null,
      passage: (screen - top) / (height + screen),
    };
  }
  return null;
}

/** The scroll offset that puts `place` back on the screen at the current size. */
function offsetFor({ section, story, passage }: Place): number {
  const screen = window.innerHeight;
  const { top, height } = section.getBoundingClientRect();
  const sectionY = top + window.scrollY;
  if (story !== null && height > screen) return sectionY + story * (height - screen);
  return sectionY + screen - passage * (height + screen);
}

function jumpTo(y: number): void {
  const lenis = getLabLenis();
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
}

/**
 * Keeps the visitor's place when the page's width changes (a phone turned
 * sideways and back, a desktop window resized). The browser's own scroll
 * anchoring keeps some element in view, but the scroll stories are sized in
 * svh, so their length changes several-fold with the screen: a visitor a
 * fifth into a story would land three quarters in, or in the next section.
 * Here the section in the middle of the screen keeps its progress through
 * its story (or its passage, for one no taller than the screen), held for a
 * moment while the page re-measures, until the visitor scrolls.
 */
export function useKeepPlace(): void {
  useEffect(() => {
    let place: Place | null = null;
    let recordTimer: ReturnType<typeof setTimeout> | undefined;
    let width = window.innerWidth;
    let holdUntil = 0;
    let frame = 0;

    const release = () => {
      holdUntil = 0;
      cancelAnimationFrame(frame);
      frame = 0;
      INTERRUPT_EVENTS.forEach(type => window.removeEventListener(type, release, true));
    };
    const hold = () => {
      frame = 0;
      if (!place || performance.now() > holdUntil || !place.section.isConnected) {
        release();
        return;
      }
      const target = offsetFor(place);
      if (Math.abs(window.scrollY - target) > DRIFT_PX) jumpTo(target);
      frame = requestAnimationFrame(hold);
    };
    const onScroll = () => {
      if (holdUntil) return;
      clearTimeout(recordTimer);
      recordTimer = setTimeout(() => {
        place = readPlace();
      }, RECORD_DEBOUNCE_MS);
    };
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      clearTimeout(recordTimer);
      if (!place) return;
      if (!holdUntil) INTERRUPT_EVENTS.forEach(type => window.addEventListener(type, release, { capture: true, passive: true }));
      holdUntil = performance.now() + HOLD_MS;
      if (!frame) hold();
    };

    place = readPlace();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      release();
      clearTimeout(recordTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);
}
