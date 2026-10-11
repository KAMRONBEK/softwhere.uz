'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { SectionId } from '../types';

/** Within this many px of the top the header always shows, on a clear ground. */
const TOP_PX = 8;
/** Scroll this far down (in one direction) before the header slides away… */
const HIDE_AFTER_PX = 28;
/** …and only once past the first screen's top band. */
const HIDE_MIN_Y_PX = 120;
/** A small move up brings it back: the visitor is looking for something. */
const SHOW_AFTER_PX = 14;
/** After a header jump the target's neighbours mount for ~1.5s (global/scroll.ts settleOn); stay out of the way. */
const JUMP_QUIET_MS = 1600;

export interface HeaderScrollState {
  isHidden: boolean;
  isAtTop: boolean;
  /** Slide the header away now (after a jump), whatever the scroll does for a moment. */
  hideNow: () => void;
  /** Keep the header on screen for a moment, whatever the scroll does (a style switch re-anchors the page). */
  holdShown: () => void;
}

/**
 * Hide on scroll down, show on scroll up, always shown at the top or while
 * `isPinned` (a menu or popover is open, focus is inside). Reads window
 * scroll, which Lenis drives too, once per frame.
 */
export function useHideOnScroll(isPinned: boolean): HeaderScrollState {
  const [isHidden, setIsHidden] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const quietUntil = useRef(0);
  const shownUntil = useRef(0);

  useEffect(() => {
    let lastY = Math.max(0, window.scrollY);
    let travel = 0;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      lastY = y;
      const atTop = y <= TOP_PX;
      setIsAtTop(atTop);
      if (atTop) {
        travel = 0;
        setIsHidden(false);
        return;
      }
      if (delta === 0) return;
      // Distance travelled in the current direction; a reversal starts over.
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (travel > HIDE_AFTER_PX && y > HIDE_MIN_Y_PX && performance.now() > shownUntil.current) setIsHidden(true);
      else if (travel < -SHOW_AFTER_PX && performance.now() > quietUntil.current) setIsHidden(false);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const hideNow = useCallback(() => {
    quietUntil.current = performance.now() + JUMP_QUIET_MS;
    shownUntil.current = 0;
    setIsHidden(true);
  }, []);

  const holdShown = useCallback(() => {
    shownUntil.current = performance.now() + JUMP_QUIET_MS;
    setIsHidden(false);
  }, []);

  return { isHidden: isHidden && !isPinned, isAtTop, hideNow, holdShown };
}

/** A 1%-tall band just above the middle of the screen: the section crossing it is "here". */
const HERE_BAND = '-45% 0px -54% 0px';

/** The id of the section in the middle of the screen (null before the first observation). */
export function useCurrentSection(rootRef: RefObject<HTMLElement | null>, resetKey: unknown): SectionId | null {
  const [current, setCurrent] = useState<SectionId | null>(null);
  useEffect(() => {
    const lab = rootRef.current?.closest('[data-lab-root]');
    if (!lab || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        const here = entries.find(entry => entry.isIntersecting);
        const id = here?.target.getAttribute('data-section');
        if (id) setCurrent(id as SectionId);
      },
      { rootMargin: HERE_BAND }
    );
    lab.querySelectorAll('main [data-section]').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [rootRef, resetKey]);
  return current;
}

function isKeyboardFocus(target: EventTarget | null): boolean {
  try {
    return target instanceof Element && target.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * True while keyboard focus is inside `ref`, so a Tab into the header keeps it
 * on screen. A mouse or tap leaves focus on the clicked link without pinning
 * the header (a jump still slides it away).
 */
export function useFocusWithin(ref: RefObject<HTMLElement | null>): boolean {
  const [isInside, setIsInside] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onIn = (event: FocusEvent) => setIsInside(isKeyboardFocus(event.target));
    const onOut = (event: FocusEvent) => {
      if (!el.contains(event.relatedTarget as Node | null)) setIsInside(false);
    };
    el.addEventListener('focusin', onIn);
    el.addEventListener('focusout', onOut);
    return () => {
      el.removeEventListener('focusin', onIn);
      el.removeEventListener('focusout', onOut);
    };
  }, [ref]);
  return isInside;
}

/**
 * While `isActive`, writes how far the visitor has read through each section
 * (0 before it, 1 past it; a sticky story counts its scroll travel) as
 * `--progress` on every `[data-progress-for="<section id>"]` element inside
 * `containerRef`, once per frame. Styles only, no React render per scroll.
 */
export function useSectionProgress(containerRef: RefObject<HTMLElement | null>, isActive: boolean): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!isActive || !container) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const screen = window.innerHeight;
      container.querySelectorAll<HTMLElement>('[data-progress-for]').forEach(bar => {
        const section = document.getElementById(bar.dataset.progressFor ?? '');
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const travel = Math.max(1, rect.height - screen);
        const progress = Math.min(1, Math.max(0, -rect.top / travel));
        bar.style.setProperty('--progress', progress.toFixed(3));
      });
    };
    const onChange = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('resize', onChange);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, [containerRef, isActive]);
}

export type DismissReason = 'escape' | 'outside';

/** Closes a popover/sheet on Escape or a pointer press outside `ref`. */
export function useDismiss(ref: RefObject<HTMLElement | null>, isOpen: boolean, onClose: (reason: DismissReason) => void): void {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose('escape');
    };
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose('outside');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [ref, isOpen, onClose]);
}
