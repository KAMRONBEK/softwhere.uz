'use client';

import type { gsap } from './gsap';

/**
 * Finishes a scroll-triggered entrance at once when focus lands inside one of
 * its targets before the trigger has fired: a section reached by Shift+Tab
 * from below, or one that mounted after the page had already jumped past it.
 *
 * Pair it with an entrance that fades `opacity`, never `autoAlpha`: autoAlpha
 * parks the targets at `visibility: hidden`, which takes every control inside
 * them out of the Tab order, so the keyboard skips them without a trace.
 * Returns the cleanup for the gsap context's own.
 */
export function revealOnFocus(root: HTMLElement, entrance: gsap.core.Animation, targets: ArrayLike<Element>): () => void {
  const list = Array.from(targets);
  const holdsFocus = (node: Node | null) => node !== null && list.some(el => el.contains(node));
  const finish = () => {
    if (entrance.progress() === 1) return;
    // Retire the trigger as `once` would, keeping the tween, so it cannot start the entrance over.
    entrance.scrollTrigger?.kill(false, true);
    entrance.progress(1);
  };
  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Node && holdsFocus(event.target)) finish();
  };
  root.addEventListener('focusin', onFocusIn);
  // The entrance can be built after focus already landed: the section mounting as Tab reaches it,
  // or its hook re-running a frame later. A fresh tween would sit the focused control at opacity 0.
  if (holdsFocus(document.activeElement)) finish();
  return () => root.removeEventListener('focusin', onFocusIn);
}
