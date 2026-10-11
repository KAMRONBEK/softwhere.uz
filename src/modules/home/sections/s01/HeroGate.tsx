'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { useDeviceTier, useHardware, useReducedMotion } from '../../device/useDeviceTier';
import type { LabSectionProps } from '../../types';
import HeroFallback from './HeroFallback';
import { onHeroBoot } from './heroBoot';

/** The live hero's chunk: three.js, R3F, SplitText and the particle scene. Imported only once booted. */
const S01Hero = lazy(() => import('../S01Hero'));

/**
 * The hero slot: the static HeroFallback (the page's LCP) until the first
 * boot signal (s01/heroBoot.ts), then the live particle hero over it. Reduced
 * motion, Save-Data and the low tier keep the static hero for good: its still
 * mark is the final state there, so the WebGL code is never downloaded.
 */
export default function HeroGate({ meta }: LabSectionProps) {
  const tier = useDeviceTier();
  const reducedMotion = useReducedMotion();
  const hardware = useHardware();
  const [isBooted, setIsBooted] = useState(false);
  // Hardware is null while hydrating; decide once it is known.
  const canGoLive = hardware !== null && !hardware.saveData && !reducedMotion && tier !== 'low';

  useEffect(() => {
    if (!canGoLive || isBooted) return;
    return onHeroBoot(() => setIsBooted(true));
  }, [canGoLive, isBooted]);

  if (!canGoLive || !isBooted) return <HeroFallback meta={meta} />;
  // The static hero stays on screen while the chunk loads; the live one mounts over it without a jump.
  return (
    <Suspense fallback={<HeroFallback meta={meta} />}>
      <S01Hero meta={meta} />
    </Suspense>
  );
}
