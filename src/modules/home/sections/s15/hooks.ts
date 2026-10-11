'use client';

import { SplitText } from 'gsap/SplitText';
import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type RefObject } from 'react';
import { ScrollTrigger, gsap, useGSAP, SPLIT_KEEP_NBSP } from '../../global/gsap';
import { getLabLenis, scrollToY } from '../../global/scroll';
import { PLAN_WEEKS, PLAYHEAD, STEP_WEIGHTS, STEPS } from './data';
import { planNext, type DemoAction, type DemoState } from './state';

if (typeof window !== 'undefined') gsap.registerPlugin(SplitText);

const TOTAL = STEP_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
const STARTS = STEP_WEIGHTS.map((_, index) => STEP_WEIGHTS.slice(0, index).reduce((sum, weight) => sum + weight, 0));
/** Where a jump lands inside a step (share of the step), past its threshold. */
const JUMP_INTO = 0.1;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** The step at scroll progress `p` (0..1 over the track). */
export function stepAt(p: number): number {
  const u = clamp01(p) * TOTAL;
  let index = 0;
  for (let i = 0; i < STARTS.length; i++) if (u >= STARTS[i]) index = i;
  return index;
}

/**
 * Plays each step's timed beats one at a time while the phone is on screen.
 * Any state change reschedules, so a tap cancels the pending beat.
 */
export function useDirector(state: DemoState, dispatch: Dispatch<DemoAction>, isActive: boolean, isStatic: boolean): void {
  useEffect(() => {
    if (!isActive) return;
    const next = planNext(state, isStatic);
    if (!next) return;
    const id = window.setTimeout(() => dispatch(next.action), next.delay);
    return () => window.clearTimeout(id);
  }, [state, dispatch, isActive, isStatic]);
}

/** The plan's playhead (in weeks, 0..PLAN_WEEKS) at track progress `p`. */
export function weekAt(p: number): number {
  const u = clamp01(p) * TOTAL;
  const index = stepAt(p);
  const local = clamp01((u - STARTS[index]) / STEP_WEIGHTS[index]);
  const [from, to] = PLAYHEAD[index];
  return from + (to - from) * local;
}

/**
 * Scroll → step. The track is the tall scroll space behind the sticky stage;
 * its progress picks the step (weighted by STEP_WEIGHTS) and drives, by
 * direct writes and without a re-render per frame: the phone's segments, the
 * desktop plan's playhead, its bar fills (everything left of the playhead is
 * done), the weekly test ticks and the current week on its ruler. `onStep` fires only when the step changes.
 * `jumpRef` scrolls to a step: an eased Lenis glide, or an instant jump
 * without Lenis.
 */
export function useStepScroll(
  rootRef: RefObject<HTMLDivElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  onStep: (index: number) => void,
  jumpRef: MutableRefObject<((index: number) => void) | null>,
  isEnabled: boolean
): void {
  const onStepRef = useRef(onStep);
  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);

  useGSAP(
    () => {
      const root = rootRef.current;
      const track = trackRef.current;
      if (!isEnabled || !root || !track) return;
      const segments = Array.from(root.querySelectorAll<HTMLElement>('[data-seg]'));
      const bars = Array.from(root.querySelectorAll<HTMLElement>('[data-bar]'));
      const ticks = Array.from(root.querySelectorAll<HTMLElement>('[data-tick]'));
      const playhead = root.querySelector<HTMLElement>('[data-playhead]');
      const weekLabels = Array.from(root.querySelectorAll<HTMLElement>('[data-week]'));
      let current = -1;
      let shownWeek = -1;

      const apply = (progress: number) => {
        const u = clamp01(progress) * TOTAL;
        segments.forEach((el, i) => {
          el.style.transform = `scaleX(${clamp01((u - STARTS[i]) / STEP_WEIGHTS[i])})`;
        });
        const week = weekAt(progress);
        bars.forEach((el, i) => {
          const { from, to } = STEPS[i].plan;
          el.style.transform = `scaleX(${clamp01((week - from) / (to - from))})`;
        });
        ticks.forEach(el => {
          const isOn = week >= Number(el.dataset.tick) - 0.02;
          if (isOn !== (el.dataset.on === 'true')) el.dataset.on = isOn ? 'true' : 'false';
        });
        if (playhead) playhead.style.transform = `translateX(${(week / PLAN_WEEKS) * 100}%)`;
        const weekNumber = Math.min(PLAN_WEEKS, Math.floor(week) + 1);
        if (weekNumber !== shownWeek) {
          shownWeek = weekNumber;
          weekLabels.forEach(el => {
            if (Number(el.dataset.week) === weekNumber) el.dataset.now = 'true';
            else delete el.dataset.now;
          });
        }
        const index = stepAt(progress);
        if (index !== current) {
          current = index;
          onStepRef.current(index);
        }
      };

      const trigger = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: self => apply(self.progress),
        onRefresh: self => apply(self.progress),
      });
      apply(trigger.progress);

      jumpRef.current = (index: number) => {
        const p = (STARTS[index] + STEP_WEIGHTS[index] * JUMP_INTO) / TOTAL;
        const y = trigger.start + p * (trigger.end - trigger.start);
        const lenis = getLabLenis();
        if (lenis) lenis.scrollTo(y, { duration: Math.min(1.6, 0.7 + Math.abs(index - current) * 0.16) });
        else scrollToY(y);
      };

      return () => {
        jumpRef.current = null;
        trigger.kill();
      };
    },
    { scope: rootRef, dependencies: [isEnabled], revertOnUpdate: true }
  );
}

/** False while the tab is in the background (timers and beats wait). */
export function useDocumentVisible(): boolean {
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    const update = () => setIsVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return isVisible;
}

export interface RigRefs {
  root: RefObject<HTMLDivElement | null>;
  stage: RefObject<HTMLDivElement | null>;
  track: RefObject<HTMLDivElement | null>;
  rig: RefObject<HTMLDivElement | null>;
  glare: RefObject<HTMLSpanElement | null>;
  floor: RefObject<HTMLDivElement | null>;
}

/** The phone's pose per step: degrees, scale, and a lift in phone units (em). */
interface Pose {
  rx: number;
  ry: number;
  rz: number;
  s: number;
  y: number;
}

const pose = (rx: number, ry: number, rz = 0, s = 1, y = 0): Pose => ({ rx, ry, rz, s, y });

/**
 * Desktop: the camera swings around the phone from step to step (from above
 * for the idea board, round to its right for the design, low and to the left
 * for the build), so each screen arrives from a new angle. The scroll sway
 * (below) adds about ±8° on top. Phones: gentle poses (the phone is the screen).
 */
const POSES_WIDE: readonly Pose[] = [
  pose(16, -9, -3, 1, 0.4),
  pose(4, -17, 1),
  pose(3, 15, -1),
  pose(7, -20, 1.2),
  pose(2, -3, 0, 0.95),
  pose(1, -8, 0, 1, -0.6),
];
const POSES_NARROW: readonly Pose[] = [
  pose(9, -4, -2),
  pose(3, -7, 0.6),
  pose(2, 7, -0.6),
  pose(4, -9, 0.8),
  pose(1, -1, 0, 0.97),
  pose(0, -4, 0, 1, -0.4),
];

const POINTER_TILT = { x: 8, y: 12 };
const TOUCH_TILT = { x: 4, y: 6 };
/** The entrance: the phone rises in, tipped back, once (yPercent 14 of 48em). */
const ENTRANCE = { ey: 6.7, ex: 30, ez: -4, eo: 0 };

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * The phone as an object in space, on ONE transformed element (the rig):
 * its pose per step (tweened when the step changes), a sway scrubbed across
 * the whole story, a lean toward the pointer (desktop) or a pressing finger
 * (touch), and the entrance, all composed into a single transform. The glass
 * glare and the floor shadow follow. Off (reduced motion, low tier): the CSS
 * pose per step in stage.module.css. Reverted on unmount by useGSAP.
 */
export function useRig(refs: RigRefs, step: number, isEnabled: boolean, isTouch: boolean): void {
  const toPoseRef = useRef<((index: number, isInstant: boolean) => void) | null>(null);
  const stepRef = useRef(step);

  useGSAP(
    () => {
      const stage = refs.stage.current;
      const track = refs.track.current;
      const rig = refs.rig.current;
      const glare = refs.glare.current;
      const floor = refs.floor.current;
      if (!isEnabled || !stage || !track || !rig || !glare || !floor) return;

      const wide = window.matchMedia('(min-width: 900px)');
      const v = { sx: 0, sy: 0, px: 0, py: 0, ey: 0, ex: 0, ez: 0, eo: 1, ...(wide.matches ? POSES_WIDE : POSES_NARROW)[stepRef.current] };
      let isFaded = false;
      const style = rig.style;
      const render = () => {
        style.setProperty(
          'transform',
          `translateY(${(v.y + v.ey).toFixed(3)}em) rotateX(${(v.rx + v.sx + v.px + v.ex).toFixed(3)}deg) ` +
            `rotateY(${(v.ry + v.sy + v.py).toFixed(3)}deg) rotateZ(${(v.rz + v.ez).toFixed(3)}deg) scale(${v.s.toFixed(4)})`
        );
        // Opacity below 1 flattens 3D: only while the entrance fades in.
        const isFading = v.eo < 0.999;
        if (isFading || isFaded) {
          style.setProperty('opacity', isFading ? v.eo.toFixed(3) : '');
          style.setProperty('visibility', v.eo <= 0.001 ? 'hidden' : '');
          isFaded = isFading;
        }
      };
      rig.setAttribute('data-driven', 'true');

      gsap.fromTo(
        v,
        { ...ENTRANCE },
        {
          ey: 0,
          ex: 0,
          ez: 0,
          eo: 1,
          duration: 1.5,
          ease: 'expo.out',
          onUpdate: render,
          scrollTrigger: { trigger: stage, start: 'top 85%', once: true },
        }
      );

      const scrub = { trigger: track, start: 'top bottom', end: 'bottom top', scrub: 0.8 };
      gsap.fromTo(
        v,
        { sx: 9, sy: isTouch ? -5 : -8 },
        { sx: -5, sy: isTouch ? 5 : 8, ease: 'none', onUpdate: render, scrollTrigger: { ...scrub, onRefresh: render } }
      );
      gsap.fromTo(glare, { yPercent: -24 }, { yPercent: 24, ease: 'none', scrollTrigger: { ...scrub } });

      toPoseRef.current = (index: number, isInstant: boolean) => {
        const target = (wide.matches ? POSES_WIDE : POSES_NARROW)[index];
        gsap.to(v, { ...target, duration: isInstant ? 0 : 1.2, ease: 'power3.inOut', overwrite: 'auto', onUpdate: render });
      };
      const onWide = () => toPoseRef.current?.(stepRef.current, true);
      wide.addEventListener('change', onWide);

      const ease = { duration: 0.9, ease: 'power3.out' };
      const toRotX = gsap.quickTo(v, 'px', { ...ease, onUpdate: render });
      const toRotY = gsap.quickTo(v, 'py', { ...ease, onUpdate: render });
      const toGlare = gsap.quickTo(glare, 'xPercent', ease);
      const toFloor = gsap.quickTo(floor, 'x', ease);

      const lean = (event: PointerEvent, amount: { x: number; y: number }) => {
        const rect = stage.getBoundingClientRect();
        const nx = clampUnit((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2));
        const ny = clampUnit((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
        toRotY(nx * amount.y);
        toRotX(-ny * amount.x);
        toGlare(nx * 18);
        toFloor(-nx * 24);
      };
      const rest = () => {
        toRotY(0);
        toRotX(0);
        toGlare(0);
        toFloor(0);
      };
      const onMove = (event: PointerEvent) => {
        if (event.pointerType === 'mouse') lean(event, POINTER_TILT);
      };
      const onDown = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') lean(event, TOUCH_TILT);
      };
      const onUp = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') rest();
      };

      render();
      stage.addEventListener('pointermove', onMove, { passive: true });
      stage.addEventListener('pointerleave', rest);
      stage.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('pointerup', onUp, { passive: true });
      window.addEventListener('pointercancel', onUp, { passive: true });
      return () => {
        toPoseRef.current = null;
        wide.removeEventListener('change', onWide);
        stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerleave', rest);
        stage.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        gsap.killTweensOf(v);
        rig.removeAttribute('data-driven');
        style.removeProperty('transform');
        style.removeProperty('opacity');
        style.removeProperty('visibility');
      };
    },
    { dependencies: [isEnabled, isTouch], revertOnUpdate: true, scope: refs.root }
  );

  // A new step: the camera swings to its pose.
  useEffect(() => {
    stepRef.current = step;
    toPoseRef.current?.(step, false);
  }, [step]);
}

/**
 * The heading's lines rise and tip up in 3D one after another, then the
 * lead follows. Once only; nothing moves under reduced motion.
 */
export function useCopyEntrance(
  rootRef: RefObject<HTMLDivElement | null>,
  titleClass: string,
  lineClass: string,
  isReduced: boolean
): void {
  useGSAP(
    () => {
      const root = rootRef.current;
      const title = root?.querySelector<HTMLElement>(`.${titleClass}`);
      if (isReduced || !root || !title) return;
      const trigger = { trigger: title, start: 'top 88%', once: true };
      const split = SplitText.create(title, {
        ...SPLIT_KEEP_NBSP,
        type: 'lines',
        linesClass: lineClass,
        autoSplit: true,
        onSplit: self =>
          gsap.from(self.lines, {
            yPercent: 70,
            rotationX: -70,
            autoAlpha: 0,
            transformPerspective: 700,
            transformOrigin: '50% 100% -0.3em',
            duration: 1.25,
            ease: 'expo.out',
            stagger: 0.11,
            scrollTrigger: trigger,
          }),
      });
      const rest = root.querySelectorAll<HTMLElement>('[data-enter]');
      gsap.from(rest, { y: 24, autoAlpha: 0, duration: 1, ease: 'power3.out', stagger: 0.08, delay: 0.25, scrollTrigger: trigger });
      return () => split.revert();
    },
    { scope: rootRef, dependencies: [isReduced], revertOnUpdate: true }
  );
}
