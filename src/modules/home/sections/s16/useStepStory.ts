'use client';

import { useCallback, useRef, useState, type RefObject } from 'react';
import { ScrollTrigger, useGSAP } from '../../global/gsap';
import { getLabLenis, scrollToY } from '../../global/scroll';

/** Where inside a step's slice of the scroll a jump lands (0 = its very start). */
const STEP_LANDING = 0.12;
const JUMP_BASE_S = 0.7;
const JUMP_PER_STEP_S = 0.12;

/**
 * Turns the scroll through `trackRef` (a tall track with a sticky stage)
 * into a step index: the stuck range is cut into `count` equal slices.
 * Progress rails ([data-fill='x'|'y'][data-index]) inside `scopeRef` are
 * written directly every frame (no re-render); React only hears about step
 * changes. `goTo` scrolls to a step (a Lenis glide).
 *
 * Still version (`isScroll` false, reduced motion): no scroll story at all;
 * the step is the one the visitor picked (the last, the finished site, until
 * they pick another) and `goTo` just picks it.
 */
export function useStepStory(
  trackRef: RefObject<HTMLDivElement | null>,
  scopeRef: RefObject<HTMLDivElement | null>,
  count: number,
  isScroll: boolean
): { step: number; goTo: (index: number) => void } {
  const [scrollStep, setScrollStep] = useState(0);
  const [pickedStep, setPickedStep] = useState(count - 1);
  const triggerRef = useRef<ScrollTrigger | null>(null);
  const stepRef = useRef(0);

  useGSAP(
    () => {
      const track = trackRef.current;
      const scope = scopeRef.current;
      if (!track || !scope || !isScroll) return;
      const fills = Array.from(scope.querySelectorAll<HTMLElement>('[data-fill]'));
      const apply = (progress: number) => {
        const at = progress * count;
        const index = Math.min(count - 1, Math.floor(at));
        fills.forEach(fill => {
          const amount = Math.min(1, Math.max(0, at - Number(fill.dataset.index)));
          fill.style.transform = fill.dataset.fill === 'x' ? `scaleX(${amount})` : `scaleY(${amount})`;
        });
        if (index !== stepRef.current) {
          stepRef.current = index;
          setScrollStep(index);
        }
      };
      const trigger = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: self => apply(self.progress),
        onRefresh: self => apply(self.progress),
      });
      triggerRef.current = trigger;
      apply(trigger.progress);
      return () => {
        if (triggerRef.current === trigger) triggerRef.current = null;
      };
    },
    { scope: scopeRef, dependencies: [count, isScroll], revertOnUpdate: true }
  );

  const goTo = useCallback(
    (index: number) => {
      if (!isScroll) {
        setPickedStep(index);
        return;
      }
      const trigger = triggerRef.current;
      if (!trigger) return;
      const y = trigger.start + ((index + STEP_LANDING) / count) * (trigger.end - trigger.start);
      const lenis = getLabLenis();
      if (lenis) lenis.scrollTo(y, { duration: JUMP_BASE_S + JUMP_PER_STEP_S * Math.abs(index - stepRef.current) });
      else scrollToY(y);
    },
    [count, isScroll]
  );

  return { step: isScroll ? scrollStep : pickedStep, goTo };
}
