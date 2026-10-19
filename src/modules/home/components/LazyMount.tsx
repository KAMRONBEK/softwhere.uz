'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from 'react';
import { useLazyMount, type LazyMountOptions } from './useInView';
import css from './LazyMount.module.css';

interface LazyMountProps extends LazyMountOptions {
  children: ReactNode;
  /** Rendered before mount and after unmount (keep it cheap: text, a poster). */
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Where focus goes once a section mounted from the keyboard: its first control (Tab) or its last (Shift+Tab). */
type FocusEdge = 'first' | 'last';

/** Give up waiting for the section's code (a dead chunk) and move on after this long. */
const FOCUS_TIMEOUT_MS = 8000;
/** After the code has rendered, how long to wait for controls that mount in effects (or, going back, for the last one). */
const SETTLE_MS = 400;
/** A static stand-in about to be swapped for the section's code (not one left by a crash, which stays). */
const STAND_IN = '[data-lab-standin]:not([data-lab-crashed] *)';

const TABBABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, iframe, [contenteditable=""], [contenteditable="true"], [tabindex]';

/**
 * Controls the browser's Tab would stop on, in document order: not the
 * sentinel, not a stand-in that is about to be swapped out, not inert or hidden.
 */
function tabbablesIn(root: ParentNode, sentinel: Element | null): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    el =>
      el !== sentinel &&
      el.tabIndex >= 0 &&
      !el.closest(`[inert], ${STAND_IN}`) &&
      (typeof el.checkVisibility !== 'function' || el.checkVisibility({ visibilityProperty: true }))
  );
}

/** A stand-in in a slot that has already mounted: that section's code is still on the way. */
const LOADING_STAND_IN = `[data-mounted="true"] ${STAND_IN}`;

/**
 * The next control after `box` (or the last one before it) in the whole page,
 * for a section with none of its own. `isWaiting` is true while a section in
 * between has mounted (it scrolled near) but its code has not rendered yet:
 * its controls are about to appear, so jumping past it would skip them.
 */
function neighbourOf(box: HTMLElement, edge: FocusEdge): { target: HTMLElement | null; isWaiting: boolean } {
  const all = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    el =>
      el.tabIndex >= 0 &&
      !box.contains(el) &&
      !el.closest(`[inert], ${LOADING_STAND_IN}`) &&
      (typeof el.checkVisibility !== 'function' || el.checkVisibility({ visibilityProperty: true }))
  );
  const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const target = edge === 'first' ? all.find(el => follows(box, el)) : all.filter(el => !follows(box, el)).pop();
  const isWaiting = [...document.querySelectorAll(LOADING_STAND_IN)].some(standIn =>
    edge === 'first'
      ? follows(box, standIn) && (!target || follows(standIn, target))
      : !box.contains(standIn) && !follows(box, standIn) && (!target || follows(target, standIn))
  );
  return { target: target ?? null, isWaiting };
}

/**
 * Renders `children` only while the box is within ~1 viewport (mountMargin)
 * and tears them down once it is farther than unmountMargin, so heavy
 * sections, videos and WebGL contexts exist only near the viewport. On
 * unmount the box keeps its last height, so the page never shifts.
 *
 * Keyboard: an unmounted section has no controls in the DOM, so Tab would
 * skip it. A visually hidden sentinel button at the top of the slot (and any
 * link in the stand-in) mounts the section when it gets keyboard focus, holds
 * focus while the code arrives, then hands it to the section's first control,
 * or its last when coming back with Shift+Tab, or to the next one on the page
 * when the section has none. Mouse focus on a stand-in link is left alone, so
 * its click still goes through. Nothing mounts until focus actually arrives.
 * The sentinel also stays while a section that scrolled near is still
 * loading its code, so a quick Tab cannot slip past it either.
 */
export default function LazyMount({
  children,
  fallback = null,
  className,
  style,
  mountMargin,
  unmountMargin,
  waitForScroll,
}: LazyMountProps) {
  const t = useTranslations('home.shared');
  const ref = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLButtonElement>(null);
  const { isMounted: isNear, frozenHeight } = useLazyMount(ref, { mountMargin, unmountMargin, waitForScroll });
  const [isForced, setIsForced] = useState(false);
  const [focusEdge, setFocusEdge] = useState<FocusEdge | null>(null);
  // Forced only until the viewport-based mount catches up (focus scrolls the
  // slot into view), so it still unmounts normally once left far behind.
  if (isForced && isNear) setIsForced(false);
  const isMounted = isNear || isForced;
  const boxStyle = frozenHeight === null || isMounted ? style : { ...style, minHeight: frozenHeight };
  // Mounted (it scrolled near) but its code is still on the way: the stand-in has no
  // controls yet either, so the sentinel stays until it is swapped out.
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const box = ref.current;
    if (!isMounted || !box) return;
    let isDone = false;
    const update = () => {
      if (isDone) return;
      const hasStandIn = Boolean(box.querySelector(STAND_IN));
      setIsLoading(hasStandIn);
      // Swapped out: the section's own DOM can churn a lot from here on, stop watching.
      if (!hasStandIn) observer.disconnect();
    };
    const observer = new MutationObserver(update);
    observer.observe(box, { childList: true, subtree: true });
    queueMicrotask(update);
    return () => {
      isDone = true;
      observer.disconnect();
      setIsLoading(false);
    };
  }, [isMounted]);

  const mountFromKeyboard = (edge: FocusEdge) => {
    if (focusEdge) return;
    setFocusEdge(edge);
    setIsForced(true);
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const sentinel = sentinelRef.current;
    if ((isMounted && !isLoading) || focusEdge || !sentinel) return;
    // Focus events bubble here from inside the box, so the target is any element in it.
    const target = event.target as Element;
    const isSentinel = target === sentinel;
    // A click on a stand-in link focuses it too: leave that alone so the click lands.
    if (!isSentinel && !target.matches(':focus-visible')) return;
    const from = event.relatedTarget;
    const isFromBelow =
      from instanceof Node &&
      !event.currentTarget.contains(from) &&
      Boolean(event.currentTarget.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_FOLLOWING);
    mountFromKeyboard(isFromBelow ? 'last' : 'first');
    // The stand-in link is about to be swapped out: hold focus on the sentinel meanwhile.
    if (!isSentinel) sentinel.focus({ preventScroll: true });
  };

  // Once the section's own code has rendered, hand focus over (see above).
  useEffect(() => {
    const box = ref.current;
    const sentinel = sentinelRef.current;
    if (!focusEdge || !isMounted || !box || !sentinel) return;
    let settleTimer = 0;
    const finish = (target: HTMLElement | null) => {
      cleanup();
      if (document.activeElement === sentinel) target?.focus();
      setFocusEdge(null);
    };
    const check = () => {
      // Focus left the sentinel (a click, another Tab): nothing to hand over.
      if (document.activeElement !== sentinel) return finish(null);
      // The chunk is still loading: the registry's stand-in is on screen.
      if (box.querySelector(STAND_IN)) return;
      const own = tabbablesIn(box, sentinel);
      // Tab: the first control is final as soon as it exists.
      if (focusEdge === 'first' && own.length > 0) return finish(own[0]);
      // Shift+Tab, or no control yet: give effects a moment to add the rest, once (a section that
      // animates its DOM would otherwise keep pushing a per-mutation timer back forever).
      if (settleTimer) return;
      settleTimer = window.setTimeout(settle, SETTLE_MS);
    };
    const settle = () => {
      const settled = tabbablesIn(box, sentinel);
      const own = focusEdge === 'first' ? settled[0] : settled[settled.length - 1];
      if (own) return finish(own);
      // No controls here: pass focus on, but not past a neighbour whose code is still arriving
      // (it scrolled near along with this one); check again shortly, until giveUp.
      const { target, isWaiting } = neighbourOf(box, focusEdge);
      if (isWaiting) settleTimer = window.setTimeout(settle, SETTLE_MS);
      else finish(target);
    };
    const observer = new MutationObserver(check);
    // Attributes too: a story may un-inert or un-hide its controls after its first frame.
    observer.observe(box, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['inert', 'hidden', 'disabled', 'tabindex'],
    });
    const giveUp = window.setTimeout(() => finish(neighbourOf(box, focusEdge).target), FOCUS_TIMEOUT_MS);
    function cleanup() {
      observer.disconnect();
      window.clearTimeout(settleTimer);
      window.clearTimeout(giveUp);
    }
    check();
    return cleanup;
  }, [focusEdge, isMounted]);

  return (
    <div ref={ref} className={className} style={boxStyle} data-mounted={isMounted ? 'true' : 'false'} onFocus={onFocus}>
      {!isMounted || isLoading || focusEdge ? (
        <button
          ref={sentinelRef}
          type='button'
          className={css.sentinel}
          // A screen reader's browse mode can activate it without focusing it: focus it first,
          // so the slot scrolls into view and the hand-off has focus to pass on.
          onClick={() => {
            sentinelRef.current?.focus();
            mountFromKeyboard('first');
          }}
          // Another Tab the same way while the code is still on the way would jump past the
          // section: swallow it, the hand-off is coming (FOCUS_TIMEOUT_MS bounds the wait).
          onKeyDown={event => {
            if (event.key === 'Tab' && focusEdge === (event.shiftKey ? 'last' : 'first')) event.preventDefault();
          }}
          // The name is an attribute, not a text node, so it stays out of the indexable page text;
          // the focus pill shows it through CSS (LazyMount.module.css, data-label).
          aria-label={t('loadSection')}
          data-label={t('loadSection')}
          data-lab-sentinel=''
        />
      ) : null}
      {isMounted ? children : fallback}
    </div>
  );
}
