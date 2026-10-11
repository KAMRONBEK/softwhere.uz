'use client';

import { useEffect, useRef } from 'react';
import type { StepId, WidthMode } from './data';

/** The width each step shows on a wide stage (phones keep the phone layout, legible at their size). */
const WIDE_PREFERENCE: Record<StepId, WidthMode> = {
  wire: 'desktop',
  design: 'desktop',
  code: 'phone',
  checks: 'phone',
  content: 'phone',
  launch: 'desktop',
};

/**
 * The Code step's resize. Wide stages: desktop, tablet, phone. Narrow stages
 * skip the desktop layout (a 1280px page on a phone is microtext): the page
 * opens up to the tablet layout and folds back into the phone one.
 */
const WIDE_SEQUENCE: readonly WidthMode[] = ['desktop', 'tablet', 'phone'];
const NARROW_SEQUENCE: readonly WidthMode[] = ['tablet', 'phone'];
/** Pause on each width once its morph has finished (ms). */
const HOLD_MS = 1100;
/** One morph (useViewportMorph: 1.05s plus the block stagger), rounded up. */
const SETTLE_MS = 1400;
/** The first width change waits this long after the step opens (ms). */
const FIRST_MS = 450;

interface ModeDirectorOptions {
  stepId: StepId;
  /** The width on screen now (read when a step starts, never a trigger). */
  mode: WidthMode;
  isActive: boolean;
  isReduced: boolean;
  isWide: boolean;
  /** The visitor picked a width: the director never overrides them again. */
  isUserMode: boolean;
  setMode: (mode: WidthMode) => void;
}

/**
 * Picks the preview width for each step (also before the story starts, so
 * the frame opens on the width that suits it). The Code step plays the
 * responsive morph while the stage is on screen; reduced motion skips the
 * sequence and shows the tablet layout.
 */
export function useModeDirector({ stepId, mode, isActive, isReduced, isWide, isUserMode, setMode }: ModeDirectorOptions): void {
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (isUserMode) return;
    const timers: number[] = [];
    const go = (next: WidthMode, ms: number) => timers.push(window.setTimeout(() => setMode(next), ms));

    if (stepId !== 'code') go(isWide ? WIDE_PREFERENCE[stepId] : 'phone', 0);
    else if (isReduced) go('tablet', 0);
    else if (isActive) {
      const sequence = isWide ? WIDE_SEQUENCE : NARROW_SEQUENCE;
      // Already on the first width (desktop, coming from the design step): hold it a beat, then go on.
      const startsOnFirst = modeRef.current === sequence[0];
      let at = FIRST_MS;
      sequence.forEach((next, index) => {
        if (index === 0 && startsOnFirst) {
          at += HOLD_MS * 0.6;
          return;
        }
        go(next, at);
        at += SETTLE_MS + HOLD_MS;
      });
    }
    return () => timers.forEach(id => window.clearTimeout(id));
  }, [stepId, isActive, isReduced, isWide, isUserMode, setMode]);
}
