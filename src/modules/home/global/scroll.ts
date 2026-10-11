'use client';

import type Lenis from 'lenis';
import { useSyncExternalStore } from 'react';
import type { SectionId } from '../types';

// The page has exactly one smooth-scroll instance, owned by SmoothScroll.
// A tiny external store (instead of React state) lets any component read it
// without a context re-render cascade when it is created or destroyed.
let current: Lenis | null = null;
const listeners = new Set<() => void>();

export function setLabLenis(instance: Lenis | null): void {
  current = instance;
  listeners.forEach(notify => notify());
}

export function getLabLenis(): Lenis | null {
  return current;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** The Lenis instance, or null with reduced motion (native scroll) / before mount. */
export function useLenis(): Lenis | null {
  return useSyncExternalStore(subscribe, getLabLenis, () => null);
}

/** How long a jump keeps its target pinned while the sections around it mount. */
const SETTLE_MS = 1500;
/** Drift (px) of the target's top that counts as a layout change worth correcting. */
const DRIFT_PX = 1;
/** Visitor input that hands the scroll back to them. */
const INTERRUPT_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

let cancelSettle: (() => void) | null = null;

function jumpTo(y: number): void {
  const lenis = getLabLenis();
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo({ top: y, behavior: 'auto' });
}

/**
 * Scrolls the page to a y offset in px, through Lenis when it is running.
 * Takes over from a section jump that is still settling.
 */
export function scrollToY(y: number): void {
  cancelSettle?.();
  jumpTo(y);
}

/**
 * Keeps `el`'s top at the viewport top for a moment after a jump. Sections
 * mount lazily on arrival, and one that mounts above the target and is not
 * exactly its reserved height would otherwise push the target off the
 * screen. Watches the target, not the scroll offset (the browser's scroll
 * anchoring moves that too), and lets go as soon as the visitor scrolls, a
 * section scrolls the page itself (scrollToY), or Lenis runs an animated
 * scroll (e.g. the Finale's ride down to the form).
 */
function settleOn(el: HTMLElement): void {
  cancelSettle?.();
  const start = performance.now();
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    INTERRUPT_EVENTS.forEach(type => window.removeEventListener(type, stop, true));
    if (cancelSettle === stop) cancelSettle = null;
  };
  const check = () => {
    if (performance.now() - start > SETTLE_MS || getLabLenis()?.isScrolling === 'smooth') {
      stop();
      return;
    }
    const drift = el.getBoundingClientRect().top;
    if (Math.abs(drift) > DRIFT_PX) jumpTo(window.scrollY + drift);
    frame = requestAnimationFrame(check);
  };
  INTERRUPT_EVENTS.forEach(type => window.addEventListener(type, stop, { capture: true, passive: true }));
  cancelSettle = stop;
  frame = requestAnimationFrame(check);
}

/**
 * Jumps to a section instantly. Instant on purpose: an animated scroll would
 * pass (and lazily mount) every section in between. The target then stays
 * pinned while its neighbours mount (see settleOn).
 */
export function scrollToSection(id: SectionId): void {
  scrollToAnchor(id);
}

/**
 * scrollToSection for any element id on the page (a section, #contact,
 * #latest-posts). Returns false when no element has that id.
 */
export function scrollToAnchor(id: string): boolean {
  const el = id ? document.getElementById(id) : null;
  if (!el) return false;
  scrollToY(el.getBoundingClientRect().top + window.scrollY);
  settleOn(el);
  return true;
}
