'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLabLenis } from './scroll';

/** gsap's own events around a gsap.matchMedia() rebuild (public at runtime, missing from its typings). */
interface MatchMediaEvents {
  addEventListener(type: 'matchMediaInit' | 'matchMedia', callback: () => void): void;
}

/**
 * Keeps the page where it was across a gsap.matchMedia() rebuild. When a
 * section's query flips (a phone turned sideways, a window resized across a
 * breakpoint) ScrollTrigger records the scroll, reverts every trigger, reruns
 * the section's handler and refreshes, then restores the record. But each
 * ScrollTrigger.create() in the rerun handler refreshes itself outside the
 * global refresh, which clears that record (ScrollTrigger 3.15), so the page
 * was left at the very top. Our listeners run after ScrollTrigger's (it
 * registered first): note the position, and put the page back after.
 */
function keepScrollAcrossMatchMedia(): void {
  const events = gsap as unknown as MatchMediaEvents;
  let y: number | null = null;
  events.addEventListener('matchMediaInit', () => {
    y = window.scrollY;
  });
  events.addEventListener('matchMedia', () => {
    const target = y;
    y = null;
    if (target === null || Math.abs(window.scrollY - target) < 1) return;
    const lenis = getLabLenis();
    if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
    else window.scrollTo(0, target);
    ScrollTrigger.update();
  });
}

/**
 * Single GSAP entry point for the lab. Import gsap / ScrollTrigger / useGSAP
 * from HERE (not from 'gsap' directly) so the core plugins are registered
 * before any section runs.
 *
 * SplitText, Flip, MorphSVG, DrawSVG etc. are free in the gsap package. To
 * keep them out of the shell bundle they are not registered here: import them
 * in the section that uses them and register at that module's top level,
 *   import { SplitText } from 'gsap/SplitText';
 *   gsap.registerPlugin(SplitText);
 * (registerPlugin is idempotent).
 */
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  // Mobile address-bar show/hide resizes the viewport constantly; refreshing
  // every trigger on it makes pinned/scrubbed sections jump on phones.
  ScrollTrigger.config({ ignoreMobileResize: true });
  keepScrollAcrossMatchMedia();
}

/**
 * Spread into every SplitText.create config. SplitText's default
 * `reduceWhiteSpace` rewrites every run of /\s+/ to a plain space, and \s
 * matches the no-break space the Russian copy glues each em dash with
 * ("Из таблицы\u00a0— в систему."), so a split heading could start a line
 * with the dash. Off, the no-break space stays inside its word.
 */
export const SPLIT_KEEP_NBSP = { reduceWhiteSpace: false } as const;

export { gsap, ScrollTrigger, useGSAP };
