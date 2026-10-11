'use client';

import { useEffect, type RefObject } from 'react';
import { addDrop, markInput as mark, type LensController } from './controller';

const TRAIL_STEP = 34;
/** A deliberate hold grabs the lens; shorter than this, a vertical swipe still scrolls the page. */
const HOLD_MS = 360;
const SLOP = 8;
const KEY_STEP = 0.06;

type TouchMode = 'idle' | 'pending' | 'drag' | 'scroll';

/** Controls inside the stage (buttons) keep their own clicks. */
const isOnControl = (target: EventTarget | null) => target instanceof Element && target.closest('button, a') !== null;

/**
 * Pointer, touch and keyboard input for the lens. Writes targets into the
 * controller; the renderer does the motion.
 * - Mouse/pen: the lens follows the cursor, the trail drops ripples, a press
 *   splashes and swells the lens.
 * - Touch: a tap moves the lens there; a horizontal drag or a deliberate
 *   hold grabs it (then vertical moves are captured too). A vertical swipe
 *   always scrolls the page — the stage keeps `touch-action: pan-y`.
 * - Keyboard: arrow keys move the lens when the stage has focus.
 */
export function useLensInput(stageRef: RefObject<HTMLElement | null>, controllerRef: RefObject<LensController | null>): void {
  useEffect(() => {
    const stage = stageRef.current;
    const c = controllerRef.current;
    if (!stage || !c) return;

    let rect = stage.getBoundingClientRect();
    const refreshRect = () => {
      rect = stage.getBoundingClientRect();
    };
    const local = (clientX: number, clientY: number): [number, number] => [
      Math.min(Math.max(clientX - rect.left, 0), rect.width),
      Math.min(Math.max(clientY - rect.top, 0), rect.height),
    ];
    const markInput = (isTouch: boolean) => mark(c, isTouch);
    const trail = (p: [number, number]) => {
      const dist = Math.hypot(p[0] - c.lastDropAt[0], p[1] - c.lastDropAt[1]);
      if (dist < TRAIL_STEP) return;
      addDrop(c, p[0], p[1], Math.min(6, Math.max(2, (dist / TRAIL_STEP) * 2.2)));
    };

    // ── Mouse / pen ─────────────────────────────────────────────────────────
    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      refreshRect();
      c.isHovering = true;
      c.lastDropAt = local(e.clientX, e.clientY);
      c.wake();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const p = local(e.clientX, e.clientY);
      c.isHovering = true;
      c.target = p;
      markInput(false);
      trail(p);
      c.requestFrame();
    };
    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      c.isHovering = false;
      c.isPressed = false;
      c.requestFrame();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0 || isOnControl(e.target)) return;
      refreshRect();
      const p = local(e.clientX, e.clientY);
      c.isPressed = true;
      c.target = p;
      markInput(false);
      addDrop(c, p[0], p[1], 13);
      c.requestFrame();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      c.isPressed = false;
      c.requestFrame();
    };

    // ── Touch ───────────────────────────────────────────────────────────────
    let mode: TouchMode = 'idle';
    let start: [number, number] = [0, 0];
    let holdTimer: number | undefined;
    const clearHold = () => {
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      holdTimer = undefined;
    };
    const grab = (p: [number, number]) => {
      mode = 'drag';
      c.isPressed = true;
      c.target = p;
      markInput(true);
      addDrop(c, p[0], p[1], 10);
      c.requestFrame();
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isOnControl(e.target)) {
        mode = 'idle';
        clearHold();
        return;
      }
      refreshRect();
      const t = e.touches[0];
      start = local(t.clientX, t.clientY);
      mode = 'pending';
      clearHold();
      holdTimer = window.setTimeout(() => {
        if (mode === 'pending') grab(start);
      }, HOLD_MS);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (mode === 'idle' || mode === 'scroll') return;
      const t = e.touches[0];
      if (!t) return;
      const p = local(t.clientX, t.clientY);
      if (mode === 'pending') {
        const dx = p[0] - start[0];
        const dy = p[1] - start[1];
        if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
          clearHold();
          grab(p);
        } else if (Math.abs(dy) > SLOP) {
          clearHold();
          mode = 'scroll';
          return;
        } else {
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      c.target = p;
      markInput(true);
      trail(p);
      c.requestFrame();
    };
    const onTouchEnd = () => {
      clearHold();
      if (mode === 'pending') {
        c.target = start;
        markInput(true);
        addDrop(c, start[0], start[1], 12);
      }
      mode = 'idle';
      c.isPressed = false;
      c.requestFrame();
    };

    // ── Keyboard ────────────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const step = Math.min(c.width, c.height) * KEY_STEP;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const move = moves[e.key];
      if (!move) return;
      e.preventDefault();
      const base = c.isPlaced ? c.target : c.pos;
      c.target = [Math.min(Math.max(base[0] + move[0], 0), c.width), Math.min(Math.max(base[1] + move[1], 0), c.height)];
      markInput(false);
      c.lastInputWasTouch = true; // keep the autopilot away for a while
      c.requestFrame();
    };

    const passive = { passive: true } as const;
    stage.addEventListener('pointerenter', onPointerEnter, passive);
    stage.addEventListener('pointermove', onPointerMove, passive);
    stage.addEventListener('pointerleave', onPointerLeave, passive);
    stage.addEventListener('pointerdown', onPointerDown, passive);
    window.addEventListener('pointerup', onPointerUp, passive);
    stage.addEventListener('touchstart', onTouchStart, passive);
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    stage.addEventListener('touchend', onTouchEnd, passive);
    stage.addEventListener('touchcancel', onTouchEnd, passive);
    stage.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', refreshRect, passive);
    window.addEventListener('resize', refreshRect, passive);
    return () => {
      clearHold();
      stage.removeEventListener('pointerenter', onPointerEnter);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
      stage.removeEventListener('touchcancel', onTouchEnd);
      stage.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', refreshRect);
      window.removeEventListener('resize', refreshRect);
    };
  }, [stageRef, controllerRef]);
}
