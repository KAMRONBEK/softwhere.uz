'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * How fast the page is scrolling right now (px per ms), read on demand.
 * The stack uses it to skip its entrance drop when a visitor flies past:
 * the tower is simply there, finished.
 */

const IDLE_MS = 140;
const SMOOTHING = 0.5;

/** Returns a stable reader; call it when you need the speed (never during render). */
export function useScrollSpeed(): () => number {
  const sampleRef = useRef({ y: 0, t: 0, speed: 0 });

  useEffect(() => {
    const sample = sampleRef.current;
    sample.y = window.scrollY;
    sample.t = performance.now();
    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const elapsed = Math.max(1, now - sample.t);
      const instant = Math.abs(y - sample.y) / elapsed;
      sample.speed = now - sample.t > IDLE_MS ? instant : sample.speed + (instant - sample.speed) * SMOOTHING;
      sample.y = y;
      sample.t = now;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return useCallback(() => {
    const sample = sampleRef.current;
    return performance.now() - sample.t > IDLE_MS ? 0 : sample.speed;
  }, []);
}
