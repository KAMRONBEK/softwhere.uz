'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, type RefObject } from 'react';
import { useIsTouch } from '../../device/useDeviceTier';
import css from './devices.module.css';
import type { DevicesRuntime } from './story';

/** A finger or mouse travels this many phone widths for one full turn. */
const TURN_WIDTHS = 2.1;

/**
 * Pointer handling for grab-to-spin on the hit box, and the physics loop that
 * runs only while the phone is held or still turning. Each frame notifies the
 * runtime, so the WebGL scene and the CSS fallback both follow.
 */
function useGrabSpin(runtime: DevicesRuntime, boxRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const grab = runtime.grab;
    let frame = 0;
    let last = 0;
    let pxPerTurn = 400;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const isMoving = grab.step(dt);
      runtime.notify();
      frame = isMoving ? requestAnimationFrame(tick) : 0;
    };
    const run = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // No text selection or native image drag while the mouse holds the phone.
      if (event.pointerType === 'mouse') event.preventDefault();
      pxPerTurn = box.getBoundingClientRect().width * TURN_WIDTHS;
      box.setPointerCapture?.(event.pointerId);
      grab.start(event.clientX, event.timeStamp);
      box.dataset.dragging = 'true';
      run();
    };
    const onMove = (event: PointerEvent) => {
      if (grab.isDragging) grab.move(event.clientX, event.timeStamp, pxPerTurn);
    };
    const finish = (event: PointerEvent, isCancelled: boolean) => {
      if (!grab.isDragging) return;
      // A vertical swipe hands the gesture to page scroll (pointercancel): spring back, no throw.
      grab.end(event.timeStamp, isCancelled);
      box.dataset.dragging = 'false';
      if (box.hasPointerCapture?.(event.pointerId)) box.releasePointerCapture(event.pointerId);
      run();
    };
    const onUp = (event: PointerEvent) => finish(event, false);
    const onCancel = (event: PointerEvent) => finish(event, true);

    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    box.addEventListener('pointercancel', onCancel);
    box.addEventListener('lostpointercapture', onCancel);
    return () => {
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onUp);
      box.removeEventListener('pointercancel', onCancel);
      box.removeEventListener('lostpointercapture', onCancel);
      cancelAnimationFrame(frame);
      grab.reset();
      runtime.notify();
    };
  }, [runtime, boxRef]);
}

/** A phone on an orbit: the hint's glyph (its body turns, transform only). */
function SpinGlyph() {
  return (
    <svg className={css.hintGlyph} viewBox='0 0 32 32' fill='none' aria-hidden='true'>
      <rect className={css.hintPhone} x='11.5' y='4.5' width='9' height='16' rx='2.4' />
      <path className={css.hintOrbit} d='M7 17.6c-3.6 1.4-3.9 3.4-.6 4.9 5.5 2.5 13.7 2.5 19.2 0 3.3-1.5 3-3.5-.6-4.9' />
      <path className={css.hintOrbit} d='M22.4 25.4l3.4-2.2-2.4-3' />
    </svg>
  );
}

interface GrabLayerProps {
  runtime: DevicesRuntime;
}

/**
 * The invisible hit box that rides on the phone (the renderers place it every
 * frame) and the small "drag to spin" hint beside it, shown while the phone
 * rests facing the viewer until the first grab.
 */
export default function GrabLayer({ runtime }: GrabLayerProps) {
  const isTouch = useIsTouch();
  const t = useTranslations('home.devices.grab');
  const boxRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = runtime.grabTargets;
    targets.attach(boxRef.current, hintRef.current);
    runtime.notify();
    return () => targets.attach(null, null);
  }, [runtime]);

  useGrabSpin(runtime, boxRef);

  const lines = isTouch ? [t('touch.first'), t('touch.second')] : [t('mouse.first'), t('mouse.second')];
  return (
    <>
      <div ref={boxRef} className={css.grab} data-cursor={isTouch ? undefined : t('cursor')} data-on='false' aria-hidden='true' />
      <div ref={hintRef} className={css.hint} data-shown='false' aria-hidden='true'>
        <SpinGlyph />
        <span className={css.hintText}>
          {lines[0]}
          <br />
          {lines[1]}
        </span>
      </div>
    </>
  );
}
