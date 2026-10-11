'use client';

import { flushSync } from 'react-dom';
import { scrollToY } from '../global/scroll';
import type { StyleId } from '../types';
import { areStyleFontsReady, warmStyleFonts } from './fontWarm';
import { getStoredStyle, setStoredStyle } from './themeStore';
import { SWITCH_ATTR } from './tokens';
import { applyStyleToDocument } from './useLabTheme';

/** How long a pick may wait for its fonts before it is applied anyway (they then swap in). */
const FONT_WAIT_MS = 350;
/** Drift (px) of the anchored section that is worth correcting after a switch. */
const DRIFT_PX = 1;
/** A face that missed FONT_WAIT_MS can still land and re-flow the text this long after a switch. */
const LATE_FONT_MS = 2000;
/** The reveal: the new look grows as a circle from the picked swatch. */
const REVEAL_MS = 620;
/** Expo-out: covers most of the screen at once, then settles. */
const REVEAL_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** Visitor input that ends the late-font hold (they are moving the page themselves). */
const INTERRUPT_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

export interface PickOptions {
  /** Viewport point (px) the new look grows from: the picked swatch's centre. Defaults to the screen's centre. */
  origin?: { x: number; y: number };
  /** Runs in the same frame as the switch (the phone menu closes, so the page itself is revealed). */
  onApply?: () => void;
}

// ── Pending pick: the tapped option shows it at once, before fonts and render ──

let pending: StyleId | null = null;
const pendingListeners = new Set<() => void>();

function setPending(id: StyleId | null): void {
  if (pending === id) return;
  pending = id;
  pendingListeners.forEach(listener => listener());
}

/** useSyncExternalStore subscribe for the pending pick. */
export function subscribePendingStyle(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

/** The style a pick is waiting to apply (its fonts are loading), or null. */
export function getPendingStyle(): StyleId | null {
  return pending;
}

// ── Scroll anchor: the section at the top of the screen stays exactly there ──

interface Anchor {
  el: HTMLElement;
  top: number;
}

function findAnchor(): Anchor | null {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-lab-root] [data-section]'));
  const el = sections.find(section => section.getBoundingClientRect().bottom > 0);
  return el ? { el, top: el.getBoundingClientRect().top } : null;
}

function restoreAnchor({ el, top }: Anchor): void {
  const drift = el.getBoundingClientRect().top - top;
  if (Math.abs(drift) > DRIFT_PX) scrollToY(window.scrollY + drift);
}

let stopLateFontHold: (() => void) | null = null;

/**
 * Styles reserve different section heights (sections/heights.css) and set
 * text in other faces, so a switch can move everything below the first
 * section that changes. Fonts that miss FONT_WAIT_MS swap in later and move
 * it again: hold the anchor through those swaps for a moment, until the
 * visitor scrolls.
 */
function holdAnchorThroughLateFonts(anchor: Anchor): void {
  stopLateFontHold?.();
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;
  const onLoaded = () => restoreAnchor(anchor);
  const stop = () => {
    clearTimeout(timer);
    fonts.removeEventListener('loadingdone', onLoaded);
    INTERRUPT_EVENTS.forEach(type => window.removeEventListener(type, stop, true));
    if (stopLateFontHold === stop) stopLateFontHold = null;
  };
  const timer = setTimeout(stop, LATE_FONT_MS);
  fonts.addEventListener('loadingdone', onLoaded);
  INTERRUPT_EVENTS.forEach(type => window.addEventListener(type, stop, { capture: true, passive: true }));
  stopLateFontHold = stop;
}

// ── The switch ──

/** The newest pick; an older pick still waiting for its fonts gives way to it. */
let latestPick: StyleId | null = null;
/** Identifies the newest transition, so an interrupted one does not clear the newer one's attribute. */
let transitionToken = 0;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The page's new state: the root's attribute flips (every CSS-token surface
 * repaints without React), then the style store renders its few JS readers
 * (WebGL colours, the pickers) in the same frame.
 */
function apply(id: StyleId, onApply: (() => void) | undefined): void {
  const anchor = findAnchor();
  applyStyleToDocument(id);
  flushSync(() => {
    setStoredStyle(id);
    onApply?.();
  });
  setPending(null);
  if (!anchor) return;
  restoreAnchor(anchor);
  holdAnchorThroughLateFonts(anchor);
}

/** Grows the new look as a circle from `origin` over the old one (theme/tokens.ts turns the crossfade off). */
function reveal(origin: { x: number; y: number }): void {
  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: REVEAL_MS, easing: REVEAL_EASE, pseudoElement: '::view-transition-new(root)' }
  );
}

function transitionTo(id: StyleId, { origin, onApply }: PickOptions): void {
  const update = () => apply(id, onApply);
  if (typeof document.startViewTransition !== 'function' || document.visibilityState !== 'visible') {
    update();
    return;
  }
  // Reduced motion keeps the short crossfade (opacity only, nothing grows).
  const isReveal = !prefersReducedMotion();
  const html = document.documentElement;
  const token = ++transitionToken;
  if (isReveal) html.setAttribute(SWITCH_ATTR, 'reveal');
  const cleanUp = () => {
    if (token === transitionToken) html.removeAttribute(SWITCH_ATTR);
  };
  try {
    const transition = document.startViewTransition(update);
    transition.updateCallbackDone.catch(() => undefined);
    if (isReveal) {
      const point = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      transition.ready.then(() => reveal(point), cleanUp);
    }
    transition.finished.then(cleanUp, cleanUp);
  } catch {
    cleanUp();
    update();
  }
}

/**
 * Switches the page to a style and remembers it for this visitor. The tapped
 * option shows the pick at once (getPendingStyle), the style's fonts get a
 * short head start, then the new look grows out of the swatch as a circle
 * (a view transition; a plain swap where the browser has none, a short
 * crossfade under reduced motion).
 */
export async function pickStyle(id: StyleId, options: PickOptions = {}): Promise<void> {
  latestPick = id;
  if (id === getStoredStyle()) {
    setPending(null);
    // Still the visitor's choice: a look that came from a shared link becomes theirs.
    setStoredStyle(id);
    return;
  }
  setPending(id);
  if (!areStyleFontsReady(id)) await Promise.race([warmStyleFonts(id), wait(FONT_WAIT_MS)]);
  if (latestPick !== id) return;
  transitionTo(id, options);
}
