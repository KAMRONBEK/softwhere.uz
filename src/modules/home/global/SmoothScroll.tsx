'use client';

import { useEffect, type RefObject } from 'react';
import { setLabLenis } from './scroll';
import { useKeepPlace } from './useKeepPlace';

const REFRESH_DEBOUNCE_MS = 200;
// GSAP's defaults, restored on unmount so the rest of the site is untouched.
const DEFAULT_LAG_THRESHOLD = 500;
const DEFAULT_LAG_ADJUSTED = 33;
/** Touch keeps the browser's own momentum scroll: no Lenis there at all. */
const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** Runs `task` once the first frame after mount has been painted. Returns a cancel function. */
function afterPaint(task: () => void): () => void {
  let timer = 0;
  const frame = requestAnimationFrame(() => {
    timer = window.setTimeout(task, 0);
  });
  return () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
  };
}

/**
 * Lenis smooth scroll driven by the GSAP ticker, so Lenis and every
 * ScrollTrigger advance in the same frame. Disabled with reduced motion and
 * on coarse pointers (native scroll). Lenis and ScrollTrigger are imported
 * after the first paint, so neither is part of the homepage's first load.
 */
function useLenisOnGsapTicker(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || window.matchMedia(COARSE_POINTER_QUERY).matches) return;
    let isDisposed = false;
    let dispose: (() => void) | null = null;
    const cancel = afterPaint(() => {
      void Promise.all([import('lenis'), import('./gsap')]).then(([{ default: Lenis }, { gsap, ScrollTrigger }]) => {
        if (isDisposed) return;
        const lenis = new Lenis({ autoRaf: false, lerp: 0.1, anchors: false });
        lenis.on('scroll', ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        setLabLenis(lenis);
        dispose = () => {
          setLabLenis(null);
          gsap.ticker.remove(tick);
          gsap.ticker.lagSmoothing(DEFAULT_LAG_THRESHOLD, DEFAULT_LAG_ADJUSTED);
          lenis.destroy();
        };
      });
    });

    return () => {
      isDisposed = true;
      cancel();
      dispose?.();
    };
  }, [enabled]);
}

/**
 * Sections mount lazily and change height as they do; ScrollTrigger only
 * re-measures on window resize, so watch the content and refresh (debounced).
 * The observer's first report is the initial size, not a change: skipping it
 * keeps ScrollTrigger out of the first load (sections bring it when they mount).
 */
function useRefreshOnResize(contentRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isFirst = true;
    const observer = new ResizeObserver(() => {
      if (isFirst) {
        isFirst = false;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        void import('./gsap').then(({ ScrollTrigger }) => ScrollTrigger.refresh());
      }, REFRESH_DEBOUNCE_MS);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [contentRef]);
}

interface SmoothScrollProps {
  enabled: boolean;
  contentRef: RefObject<HTMLElement | null>;
}

export default function SmoothScroll({ enabled, contentRef }: SmoothScrollProps) {
  useLenisOnGsapTicker(enabled);
  useRefreshOnResize(contentRef);
  useKeepPlace();
  return null;
}
