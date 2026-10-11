'use client';

import { useEffect, type RefObject } from 'react';
import { globeLayout } from './geo';
import { requestFrame, type GlobeRuntime } from './story';

const MAX_YAW_SPEED = 9;
const MAX_PITCH_SPEED = 4;
const MAX_PITCH = 0.75;
/** A release this long after the last move is a stop, not a fling (ms). */
const FLING_WINDOW_MS = 90;
/** Horizontal travel (px) that counts as a real drag (hides the hint). */
const DRAG_THRESHOLD_PX = 6;

interface DragOptions {
  /** No inertia; every move asks for a single redraw. */
  isStatic: boolean;
  onDrag: () => void;
}

/** Mouse drags start on the planet itself (the `[data-globe-hit]` disc); touch swipes anywhere on the stage. */
function canStart(event: PointerEvent): boolean {
  if (event.pointerType !== 'mouse') return true;
  return event.button === 0 && event.target instanceof Element && event.target.closest('[data-globe-hit]') !== null;
}

/**
 * Drag to turn the globe: the surface follows the pointer 1:1 (dx / radius),
 * a release flings it and the scene's inertia takes over. Mouse also tilts;
 * touch turns sideways only, so vertical swipes still scroll the page
 * (the target is `touch-action: pan-y`).
 */
export function useGlobeDrag(runtime: GlobeRuntime, targetRef: RefObject<HTMLElement | null>, { isStatic, onDrag }: DragOptions): void {
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const drag = runtime.drag;
    let pointerId: number | null = null;
    let isMouse = false;
    let radius = 200;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let travel = 0;
    let velYaw = 0;
    let velPitch = 0;

    const end = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      const isFling = !isStatic && performance.now() - lastT < FLING_WINDOW_MS;
      drag.isActive = false;
      drag.releasedAt = performance.now();
      drag.velYaw = isFling ? Math.max(-MAX_YAW_SPEED, Math.min(MAX_YAW_SPEED, velYaw)) : 0;
      drag.velPitch = isFling ? Math.max(-MAX_PITCH_SPEED, Math.min(MAX_PITCH_SPEED, velPitch)) : 0;
      delete el.dataset.dragging;
    };

    const onDown = (event: PointerEvent) => {
      if (pointerId !== null || !canStart(event)) return;
      const rect = el.getBoundingClientRect();
      radius = Math.max(60, globeLayout(rect.width, rect.height).r);
      pointerId = event.pointerId;
      isMouse = event.pointerType === 'mouse';
      lastX = event.clientX;
      lastY = event.clientY;
      lastT = performance.now();
      travel = 0;
      velYaw = 0;
      velPitch = 0;
      drag.isActive = true;
      drag.velYaw = 0;
      drag.velPitch = 0;
      if (isMouse) {
        event.preventDefault();
        el.setPointerCapture(event.pointerId);
      }
      el.dataset.dragging = 'true';
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const now = performance.now();
      const dt = Math.max(8, now - lastT) / 1000;
      const dx = event.clientX - lastX;
      const dy = isMouse ? event.clientY - lastY : 0;
      lastX = event.clientX;
      lastY = event.clientY;
      lastT = now;
      const yaw = dx / radius;
      const pitch = dy / radius;
      drag.yaw += yaw;
      drag.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, drag.pitch + pitch));
      velYaw = velYaw * 0.5 + (yaw / dt) * 0.5;
      velPitch = velPitch * 0.5 + (pitch / dt) * 0.5;
      travel += Math.abs(dx);
      if (travel > DRAG_THRESHOLD_PX) onDrag();
      if (isStatic) requestFrame(runtime);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      drag.isActive = false;
    };
  }, [runtime, targetRef, isStatic, onDrag]);
}
