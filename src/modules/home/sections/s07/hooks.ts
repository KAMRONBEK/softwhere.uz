'use client';

import { useEffect, type Dispatch, type RefObject } from 'react';
import { gsap, useGSAP } from '../../global/gsap';
import { revealOnFocus } from '../../global/revealOnFocus';
import { planNext, type ChatAction, type ChatState } from './machine';
import { ceilingBlocks } from './story';

/**
 * Runs the conversation's timed steps (typing, bot replies, autopilot taps)
 * one at a time, only while the phone is on screen. Any state change
 * reschedules, so a visitor's tap cancels the pending autopilot step. In the
 * scroll story (`ctx.untilBeat`), it plays the beat the scroll has reached on
 * time and waits at its end; the autopilot presses almost at once.
 */
export function useDirector(state: ChatState, dispatch: Dispatch<ChatAction>, isActive: boolean, ctx: DirectorOptions): void {
  const { isReduced, needsCode, untilBeat } = ctx;
  useEffect(() => {
    if (!isActive || state.phase === 'idle') return;
    const isScroll = untilBeat !== undefined;
    const step = planNext(state, { isReduced, needsCode, isQuick: isScroll });
    if (!step || (isScroll && ceilingBlocks(state, step.action, untilBeat, needsCode))) return;
    const id = window.setTimeout(() => dispatch(step.action), step.delay);
    return () => window.clearTimeout(id);
  }, [state, dispatch, isActive, isReduced, needsCode, untilBeat]);
}

export interface DirectorOptions {
  isReduced: boolean;
  needsCode: boolean;
  /** Scroll story: the beat the scroll has reached; timed steps never go past it. */
  untilBeat?: number;
}

export interface TiltRefs {
  root: RefObject<HTMLDivElement | null>;
  stage: RefObject<HTMLDivElement | null>;
  /** Scroll story: the tall track behind the pinned stage (the rock spans it, not the stuck stage). */
  track?: RefObject<HTMLDivElement | null>;
  scrollTilt: RefObject<HTMLDivElement | null>;
  pointerTilt: RefObject<HTMLDivElement | null>;
  entrance: RefObject<HTMLDivElement | null>;
  glare: RefObject<HTMLSpanElement | null>;
  floor: RefObject<HTMLDivElement | null>;
}

const POINTER_TILT = { x: 9, y: 13 };
const TOUCH_TILT = { x: 5, y: 7 };

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * The phone as an object in space: it rises in on first view, rocks with the
 * scroll (scrubbed), leans toward the pointer on desktop and toward the
 * finger on touch (press and release), and its glass glare and floor
 * shadow follow. Transforms only; reverted on unmount by useGSAP.
 */
export function usePhoneTilt(refs: TiltRefs, isEnabled: boolean, isTouch: boolean): void {
  useGSAP(
    () => {
      const stage = refs.stage.current;
      const scrollTilt = refs.scrollTilt.current;
      const pointerTilt = refs.pointerTilt.current;
      const entrance = refs.entrance.current;
      const glare = refs.glare.current;
      const floor = refs.floor.current;
      const root = refs.root.current;
      if (!isEnabled || !stage || !scrollTilt || !pointerTilt || !entrance || !glare || !floor || !root) return;

      // Opacity, not autoAlpha: the phone's buttons stay in the Tab order before it arrives.
      const arrival = gsap.from(entrance, {
        yPercent: 16,
        rotationX: 34,
        rotationZ: -4,
        opacity: 0,
        duration: 1.6,
        ease: 'expo.out',
        scrollTrigger: { trigger: stage, start: 'top 82%', once: true },
      });

      const scrub = { trigger: refs.track?.current ?? stage, start: 'top bottom', end: 'bottom top', scrub: 0.7 };
      const swing = isTouch ? { from: -8, to: 8 } : { from: -21, to: -7 };
      gsap.fromTo(
        scrollTilt,
        { rotationX: 15, rotationY: swing.from, rotationZ: isTouch ? -1.5 : 2.5 },
        { rotationX: -9, rotationY: swing.to, rotationZ: isTouch ? 1.5 : -0.5, ease: 'none', scrollTrigger: scrub }
      );
      gsap.fromTo(glare, { yPercent: -22 }, { yPercent: 22, ease: 'none', scrollTrigger: { ...scrub } });

      const ease = { duration: 0.9, ease: 'power3.out' };
      const toRotX = gsap.quickTo(pointerTilt, 'rotationX', ease);
      const toRotY = gsap.quickTo(pointerTilt, 'rotationY', ease);
      const toGlare = gsap.quickTo(glare, 'xPercent', ease);
      const toFloor = gsap.quickTo(floor, 'x', ease);

      const lean = (event: PointerEvent, amount: { x: number; y: number }) => {
        const rect = stage.getBoundingClientRect();
        const nx = clamp((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2));
        const ny = clamp((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
        toRotY(nx * amount.y);
        toRotX(-ny * amount.x);
        toGlare(nx * 18);
        toFloor(-nx * 26);
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

      root.addEventListener('pointermove', onMove, { passive: true });
      root.addEventListener('pointerleave', rest);
      stage.addEventListener('pointerdown', onDown, { passive: true });
      window.addEventListener('pointerup', onUp, { passive: true });
      window.addEventListener('pointercancel', onUp, { passive: true });
      const releaseFocus = revealOnFocus(root, arrival, [entrance]);
      return () => {
        releaseFocus();
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerleave', rest);
        stage.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
    },
    { dependencies: [isEnabled, isTouch], revertOnUpdate: true, scope: refs.root }
  );
}
