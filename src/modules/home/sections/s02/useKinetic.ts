'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { KineticEngine, type KineticTier } from './engine';

interface UseKineticOptions {
  /** False for reduced motion and the low tier: no engine at all. */
  isEnabled: boolean;
  tier: KineticTier;
  isTouch: boolean;
  /** The loop runs only while the section is on screen. */
  isInView: boolean;
  /** Changing it (style switch) decodes the lines again in the new face. */
  replayKey: string;
}

/** Owns the KineticEngine for the section: created on mount, destroyed (styles reset) on unmount. */
export function useKinetic(
  rootRef: RefObject<HTMLElement | null>,
  { isEnabled, tier, isTouch, isInView, replayKey }: UseKineticOptions
): void {
  const engineRef = useRef<KineticEngine | null>(null);
  const isInViewRef = useRef(isInView);
  const isTouchRef = useRef(isTouch);
  const replayKeyRef = useRef(replayKey);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !isEnabled) return;
    const engine = new KineticEngine(root, { tier });
    engineRef.current = engine;
    engine.setTouch(isTouchRef.current);
    engine.setActive(isInViewRef.current);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [rootRef, isEnabled, tier]);

  // Not an engine dependency: rebuilding would replay the decode.
  useEffect(() => {
    isTouchRef.current = isTouch;
    engineRef.current?.setTouch(isTouch);
  }, [isTouch]);

  useEffect(() => {
    isInViewRef.current = isInView;
    engineRef.current?.setActive(isInView);
  }, [isInView]);

  useEffect(() => {
    if (replayKeyRef.current === replayKey) return;
    replayKeyRef.current = replayKey;
    engineRef.current?.rearm();
  }, [replayKey]);
}
