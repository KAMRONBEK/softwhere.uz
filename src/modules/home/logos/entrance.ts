'use client';

import type { RefObject } from 'react';
import { useReducedMotion } from '../device/useDeviceTier';
// GSAP core only, not '../global/gsap': that entry registers ScrollTrigger, and the
// header's logo is on every first paint while ScrollTrigger is only for sections.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * The logo entrance, the mark's one authored moment: the two chevrons glide
 * in along the S's middle diagonal ('<' from the upper left, '>' from the
 * lower right), so their cut faces stay in line and never shear. They rest a
 * beat a slash-width apart, reading < / >, then click shut into the S: the
 * whole mark answers the click with a 3% pulse and the halves hand over to
 * the one-path S. The wordmark rises in behind them, letter by letter.
 * Skipped entirely under reduced motion (the static logo is the end state).
 *
 * No overshoot anywhere: the halves meet once, so the middle stroke never
 * kinks.
 */

/** Where each chevron starts, in mark units along the diagonal (the mark is 64 tall). */
const APPROACH = 16;
/** Where they rest: each half this far off its place, a gap of about half a stroke between them. */
const AJAR = 1.9;
const ARRIVE_SECONDS = 0.46;
const FADE_IN_SECONDS = 0.2;
const HOLD_SECONDS = 0.12;
const CLOSE_SECONDS = 0.14;
const LOCK_AT = ARRIVE_SECONDS + HOLD_SECONDS + CLOSE_SECONDS;
const PULSE_SCALE = 1.03;
const PULSE_UP_SECONDS = 0.09;
const PULSE_SETTLE_SECONDS = 0.34;
/** The wordmark starts rising while the chevrons are still arriving. */
const LETTERS_AT = 0.28;
const LETTER_RISE = 10;
const LETTER_STAGGER = 0.032;

/** Strong ease-out for the glide in; the close accelerates into contact, like a latch. */
const ARRIVE_EASE = 'expo.out';
const CLOSE_EASE = 'power2.in';

/**
 * Plays the entrance once on mount when `isEnabled`; remount (change `key`) to replay.
 * `axis` is the mark's middle diagonal as a unit vector pointing down-right.
 */
export function useLogoEntrance(ref: RefObject<SVGSVGElement | null>, isEnabled: boolean, axis: readonly [number, number]): void {
  const reducedMotion = useReducedMotion();
  const [axisX, axisY] = axis;
  useGSAP(
    () => {
      const svg = ref.current;
      if (!svg || !isEnabled || reducedMotion) return;
      const parts = (name: string) => svg.querySelectorAll(`[data-logo-part="${name}"]`);
      const [mark, whole, lt, gt, letters] = ['mark', 'whole', 'lt', 'gt', 'letter'].map(parts);
      if (lt.length === 0 || gt.length === 0) return;
      const at = (distance: number) => ({ x: axisX * distance, y: axisY * distance });

      // Swap to the chevrons now, not on the timeline's first tick, so the finished S never flashes.
      gsap.set(whole, { visibility: 'hidden' });
      gsap.set([lt, gt], { visibility: 'visible' });
      const timeline = gsap.timeline();
      timeline
        .fromTo(lt, at(-APPROACH), { ...at(-AJAR), duration: ARRIVE_SECONDS, ease: ARRIVE_EASE }, 0)
        .fromTo(gt, at(APPROACH), { ...at(AJAR), duration: ARRIVE_SECONDS, ease: ARRIVE_EASE }, 0)
        .from([lt, gt], { opacity: 0, duration: FADE_IN_SECONDS, ease: 'power1.out' }, 0)
        .to([lt, gt], { x: 0, y: 0, duration: CLOSE_SECONDS, ease: CLOSE_EASE }, ARRIVE_SECONDS + HOLD_SECONDS)
        .set(whole, { visibility: 'visible' }, LOCK_AT)
        .set([lt, gt], { visibility: 'hidden' }, LOCK_AT)
        .to(mark, { scale: PULSE_SCALE, transformOrigin: '50% 50%', duration: PULSE_UP_SECONDS, ease: 'power2.out' }, LOCK_AT)
        .to(mark, { scale: 1, duration: PULSE_SETTLE_SECONDS, ease: 'power3.out' }, LOCK_AT + PULSE_UP_SECONDS);
      if (letters.length > 0) {
        timeline.from(letters, { y: LETTER_RISE, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: LETTER_STAGGER }, LETTERS_AT);
      }
    },
    { scope: ref, dependencies: [isEnabled, reducedMotion, axisX, axisY], revertOnUpdate: true }
  );
}
