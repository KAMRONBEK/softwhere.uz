'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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
