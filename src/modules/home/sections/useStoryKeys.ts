'use client';

import { useEffect, useRef, type RefObject } from 'react';

/** How long a key's glide counts as under way: a second press goes on from its target, not the step left behind. */
const GLIDE_MS = 900;
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
/** Space presses a focused control instead of scrolling: leave it to the control. */
const PRESSABLE = 'button, a[href], summary, [role="button"], [role="tab"], [role="checkbox"], [role="switch"]';

function keyDirection(event: KeyboardEvent): -1 | 1 | 0 {
  if (event.altKey || event.ctrlKey || event.metaKey) return 0;
  if (event.key === 'PageDown') return 1;
  if (event.key === 'PageUp') return -1;
  if (event.key === ' ' || event.key === 'Spacebar') return event.shiftKey ? -1 : 1;
  return 0;
}

function currentStep(step: number | (() => number)): number {
  return typeof step === 'function' ? step() : step;
}

interface StoryKeys {
  /** The tall track the stage sticks inside. */
  trackRef: RefObject<HTMLElement | null>;
  /** The step the scroll is in now, or a getter for it (read on a key press: no re-render per step needed). */
  step: number | (() => number);
  count: number;
  /** Glides the scroll to a step. */
  goTo: (index: number) => void;
  isEnabled: boolean;
}

/**
 * Page Down / Space (and Page Up / Shift+Space) move one step at a time
 * while the story is pinned: a page of scroll is longer than a step, so the
 * browser's own jump skipped steps. At either end the keys go back to
 * scrolling the page, out of the story. Arrow keys keep their small native
 * steps.
 */
export function useStoryKeys({ trackRef, step, count, goTo, isEnabled }: StoryKeys): void {
  const latestRef = useRef({ step, goTo });
  const pendingRef = useRef<{ index: number; at: number } | null>(null);

  useEffect(() => {
    latestRef.current = { step, goTo };
  }, [step, goTo]);

  useEffect(() => {
    if (!isEnabled) return;
    const onKey = (event: KeyboardEvent) => {
      const direction = keyDirection(event);
      const track = trackRef.current;
      if (!direction || event.defaultPrevented || !track) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(EDITABLE) || (event.key !== 'PageDown' && event.key !== 'PageUp' && target?.closest(PRESSABLE))) return;
      const rect = track.getBoundingClientRect();
      if (rect.top > 1 || rect.bottom < window.innerHeight - 1) return;
      const pending = pendingRef.current;
      const from = pending && performance.now() - pending.at < GLIDE_MS ? pending.index : currentStep(latestRef.current.step);
      const next = from + direction;
      if (next < 0 || next >= count) return;
      event.preventDefault();
      pendingRef.current = { index: next, at: performance.now() };
      latestRef.current.goTo(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trackRef, count, isEnabled]);
}
