'use client';

import { Canvas, useThree, type CanvasProps } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type TransitionEvent } from 'react';
import { DPR_CAPS, useLabDevice } from '../device/useDeviceTier';
import SectionErrorBoundary from './SectionErrorBoundary';
import { useInView, useLazyMount, type LazyMountOptions } from './useInView';
import css from './Skeleton.module.css';

type ActiveFrameloop = 'always' | 'demand';

export interface LazyCanvasProps extends LazyMountOptions, Omit<CanvasProps, 'dpr' | 'frameloop' | 'className' | 'style'> {
  children: ReactNode;
  /**
   * Shown before the canvas mounts, after it unmounts (far offscreen), without
   * WebGL, and if the scene crashes. Make it a real still (poster/gradient),
   * not a spinner: on low-end phones it may be all the visitor sees. Left
   * out, the box glows (the loading glow) until the canvas mounts.
   */
  fallback?: ReactNode;
  /**
   * Laid over the mounted canvas until its first frame that draws something
   * (scene chunks, textures and shaders can take a while on a slow phone),
   * then cross-faded out. Defaults to the loading glow; pass a stateless still
   * to hold instead, or null when the section shows its own still under the
   * canvas until its scene reports ready.
   */
  loading?: ReactNode;
  /** Applied to the sizing box; the canvas fills it. Give the box a height. */
  className?: string;
  style?: CSSProperties;
  /** Frameloop while visible. Use 'demand' for static scenes driven by invalidate(). */
  activeFrameloop?: ActiveFrameloop;
  /** Lower the DPR ceiling for heavy shaders; never exceeds the tier's cap. */
  maxDpr?: number;
  /** Label used in crash logs. */
  label?: string;
}

const FILL: CSSProperties = { position: 'absolute', inset: 0 };

/** The glowing placeholder of the canvas box (Skeleton.module.css). */
function CanvasGlow() {
  return <div className={css.canvas} aria-hidden='true' />;
}

/**
 * Calls `onReady` after the first render that issued a draw call: an empty
 * frame (the scene's own chunk still loading) does not count. Hooks the
 * scene's onAfterRender, which three calls at the end of every render of it,
 * so it also works in 'demand' mode and with scenes that render manually.
 */
function FirstFrameSignal({ onReady }: { onReady: () => void }): null {
  const getState = useThree(state => state.get);

  useEffect(() => {
    const { scene, gl } = getState();
    const previous = scene.onAfterRender;
    scene.onAfterRender = (...args) => {
      previous.apply(scene, args);
      if (gl.info.render.calls === 0) return;
      scene.onAfterRender = previous;
      onReady();
    };
    return () => {
      scene.onAfterRender = previous;
    };
  }, [getState, onReady]);

  return null;
}

/** The crash fallback also ends the loading state, so the glow never outlives a dead scene. */
function CrashStill({ children, onShow }: { children: ReactNode; onShow: () => void }) {
  useEffect(onShow, [onShow]);
  return <div style={FILL}>{children}</div>;
}

/**
 * R3F <Canvas> that only exists near the viewport:
 * - mounts within ~1 viewport, unmounts past ~2.5 (R3F then disposes the
 *   scene graph, disposes the renderer and force-loses the WebGL context, so
 *   phones never hit their live-context limit);
 * - renders frames only while visible ('never' offscreen, so useFrame stops);
 * - DPR clamped to the device tier; reduced motion switches to 'demand'
 *   (one still frame, re-rendered only on invalidate());
 * - until its first drawn frame, a cover (`loading`, by default a glow) sits
 *   over the box and then cross-fades out, so a slow scene never reads as a
 *   blank hole. The cover is absolutely positioned: no layout shift.
 */
export default function LazyCanvas({
  children,
  fallback,
  loading,
  className,
  style,
  mountMargin,
  unmountMargin,
  activeFrameloop = 'always',
  maxDpr,
  label = 'canvas',
  gl,
  ...canvasProps
}: LazyCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const { isMounted } = useLazyMount(boxRef, { mountMargin, unmountMargin });
  const isVisible = useInView(boxRef);
  const { tier, reducedMotion, webgl } = useLabDevice();
  const [isReady, setIsReady] = useState(false);
  const [isCoverGone, setIsCoverGone] = useState(false);
  const markReady = useCallback(() => setIsReady(true), []);
  // A remount (back from far offscreen) waits for its own first frame again.
  if (!isMounted && (isReady || isCoverGone)) {
    setIsReady(false);
    setIsCoverGone(false);
  }
  // Once faded out (or at once under reduced motion: no fade), the cover unmounts.
  const onCoverFaded = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.propertyName === 'opacity' && isReady) setIsCoverGone(true);
  };
  const hasCover = !isCoverGone && !(isReady && reducedMotion);

  const [minDpr, tierMax] = DPR_CAPS[tier];
  const dprMax = Math.max(minDpr, Math.min(tierMax, maxDpr ?? tierMax));
  const frameloop = !isVisible ? 'never' : reducedMotion ? 'demand' : activeFrameloop;
  const glProps =
    typeof gl === 'function' ? gl : { antialias: tier === 'high', alpha: true, powerPreference: 'high-performance' as const, ...gl };

  const hasCanvas = isMounted && webgl;
  const cover = loading === undefined ? <CanvasGlow /> : loading;
  // No WebGL: the fallback is the final state, so it never glows as if loading.
  const still = fallback === undefined && webgl ? <CanvasGlow /> : (fallback ?? null);

  return (
    <div ref={boxRef} className={className} style={{ position: 'relative', ...style }} aria-busy={hasCanvas && !isReady ? true : undefined}>
      {hasCanvas ? (
        <>
          <SectionErrorBoundary label={label} fallback={<CrashStill onShow={markReady}>{fallback ?? null}</CrashStill>}>
            <Canvas {...canvasProps} gl={glProps} dpr={[minDpr, dprMax]} frameloop={frameloop} style={FILL}>
              {children}
              <FirstFrameSignal onReady={markReady} />
            </Canvas>
          </SectionErrorBoundary>
          {cover === null || !hasCover ? null : (
            <div className={css.cover} data-ready={isReady} data-lab-canvas-cover='' onTransitionEnd={onCoverFaded}>
              {cover}
            </div>
          )}
        </>
      ) : (
        <div style={FILL}>{still}</div>
      )}
    </div>
  );
}
