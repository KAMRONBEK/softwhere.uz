'use client';

import { useEffect } from 'react';
import { scrollToAnchor } from './scroll';

/** '#a%20b' → 'a b'; a malformed escape is no target at all. */
function idFromHash(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return '';
  }
}

/** The id an in-page link points at ('#work-wall' → 'work-wall'), or null for any other link. */
function hashTarget(event: MouseEvent): { anchor: HTMLAnchorElement; id: string } | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
  if (!anchor || anchor.target) return null;
  const id = idFromHash(anchor.getAttribute('href') ?? '');
  return id ? { anchor, id } : null;
}

/**
 * Plain '#section' links on the homepage (the static fallbacks' CTAs and any
 * other anchor without its own handler) jump through scrollToAnchor instead
 * of the browser. A native hash jump pushes a history entry and skips the
 * pinning that keeps the target in place while lazy sections mount, so Back
 * from the next page could land on a half-mounted page. Listens on the
 * document after React's own handlers: a link whose handler already called
 * preventDefault is left to it.
 */
export function useHashLinks(): void {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = hashTarget(event);
      if (!link || !scrollToAnchor(link.id)) return;
      event.preventDefault();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}

/**
 * A deep link (/uz#crm-build) lands on its section and keeps it pinned while
 * the sections above mount at their real heights (scroll.ts settleOn); the
 * browser's own jump happens once, against reserved heights, and drifts.
 */
export function useHashLanding(): void {
  useEffect(() => {
    const id = idFromHash(window.location.hash);
    if (!id) return;
    const frame = requestAnimationFrame(() => scrollToAnchor(id));
    return () => cancelAnimationFrame(frame);
  }, []);
}
