'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useLazyMount, type LazyMountOptions } from './useInView';

interface LazyMountProps extends LazyMountOptions {
  children: ReactNode;
  /** Rendered before mount and after unmount (keep it cheap: text, a poster). */
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders `children` only while the box is within ~1 viewport (mountMargin)
 * and tears them down once it is farther than unmountMargin, so heavy
 * sections, videos and WebGL contexts exist only near the viewport. On
 * unmount the box keeps its last height, so the page never shifts.
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
  const ref = useRef<HTMLDivElement>(null);
  const { isMounted, frozenHeight } = useLazyMount(ref, { mountMargin, unmountMargin, waitForScroll });
  const boxStyle = frozenHeight === null || isMounted ? style : { ...style, minHeight: frozenHeight };

  return (
    <div ref={ref} className={className} style={boxStyle} data-mounted={isMounted ? 'true' : 'false'}>
      {isMounted ? children : fallback}
    </div>
  );
}
