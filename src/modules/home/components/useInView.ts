'use client';

import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

/** One viewport above and below (IntersectionObserver % = of the viewport). */
export const NEAR_MARGIN = '100% 0px';
/** Unmount distance: farther than this and lazy content is torn down. */
export const FAR_MARGIN = '250% 0px';

/**
 * True while the element intersects the viewport grown by `rootMargin`.
 * False during SSR and until the first observation.
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = '0px', threshold = 0): boolean {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), { rootMargin, threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold]);

  return isInView;
}

export interface LazyMountOptions {
  /** Mount when within this margin of the viewport. */
  mountMargin?: string;
  /** Unmount when outside this margin; null keeps it mounted once mounted. */
  unmountMargin?: string | null;
  /**
   * Stay on the fallback until the visitor has scrolled the page once (see
   * useHasScrolled): the sections under the hero are near on load, but a
   * visitor who never scrolls should not pay for their code.
   */
  waitForScroll?: boolean;
}

/* ── First scroll ─────────────────────────────────────────────────────────── */

let hasScrolled = false;
const scrollListeners = new Set<() => void>();

function markScrolled(): void {
  if (hasScrolled) return;
  hasScrolled = true;
  window.removeEventListener('scroll', markScrolled);
  scrollListeners.forEach(notify => notify());
}

function subscribeScrolled(onChange: () => void): () => void {
  scrollListeners.add(onChange);
  if (!hasScrolled) {
    // A page that opens scrolled (a #deep-link, a restored position) counts as scrolled.
    if (window.scrollY > 0) queueMicrotask(markScrolled);
    else window.addEventListener('scroll', markScrolled, { passive: true });
  }
  return () => scrollListeners.delete(onChange);
}

/**
 * True once the page has scrolled at all (wheel, touch, keys, an in-page
 * jump). False during SSR and hydration. Page-wide and one-way.
 */
export function useHasScrolled(): boolean {
  return useSyncExternalStore(
    subscribeScrolled,
    () => hasScrolled,
    () => false
  );
}

export interface LazyMountState {
  isMounted: boolean;
  /**
   * The element's height (px) at the moment it unmounted, so the placeholder
   * can hold exactly that space and nothing above the viewport shifts.
   */
  frozenHeight: number | null;
}

/** Mount/unmount with hysteresis: mounts at `mountMargin`, unmounts past `unmountMargin`. */
export function useLazyMount(ref: RefObject<HTMLElement | null>, options: LazyMountOptions = {}): LazyMountState {
  const { mountMargin = NEAR_MARGIN, unmountMargin = FAR_MARGIN, waitForScroll = false } = options;
  const [state, setState] = useState<LazyMountState>({ isMounted: false, frozenHeight: null });
  const hasScrolled = useHasScrolled();
  const isHeld = waitForScroll && !hasScrolled;

  useEffect(() => {
    const el = ref.current;
    if (!el || isHeld) return;
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setState(prev => (prev.isMounted ? prev : { isMounted: true, frozenHeight: null }));
      },
      { rootMargin: mountMargin }
    );
    near.observe(el);

    const far = unmountMargin
      ? new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) return;
            const height = el.getBoundingClientRect().height;
            setState(prev => (prev.isMounted ? { isMounted: false, frozenHeight: height } : prev));
          },
          { rootMargin: unmountMargin }
        )
      : null;
    far?.observe(el);

    // A frozen height is only true for the width it was measured at: after a
    // rotation or resize, fall back to the reserved (responsive) min-height.
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      setState(prev => (prev.frozenHeight === null ? prev : { ...prev, frozenHeight: null }));
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      near.disconnect();
      far?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [ref, mountMargin, unmountMargin, isHeld]);

  return state;
}
