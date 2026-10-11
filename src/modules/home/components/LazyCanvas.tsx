'use client';

import { Canvas, type CanvasProps } from '@react-three/fiber';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { DPR_CAPS, useLabDevice } from '../device/useDeviceTier';
import SectionErrorBoundary from './SectionErrorBoundary';
import { useInView, useLazyMount, type LazyMountOptions } from './useInView';

type ActiveFrameloop = 'always' | 'demand';

export interface LazyCanvasProps extends LazyMountOptions, Omit<CanvasProps, 'dpr' | 'frameloop' | 'className' | 'style'> {
  children: ReactNode;
  /**
   * Shown before the canvas mounts, after it unmounts (far offscreen), without
   * WebGL, and if the scene crashes. Make it a real still (poster/gradient),
   * not a spinner: on low-end phones it may be all the visitor sees.
   */
  fallback?: ReactNode;
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

/**
 * R3F <Canvas> that only exists near the viewport:
 * - mounts within ~1 viewport, unmounts past ~2.5 (R3F then disposes the
 *   scene graph, disposes the renderer and force-loses the WebGL context, so
 *   phones never hit their live-context limit);
 * - renders frames only while visible ('never' offscreen, so useFrame stops);
 * - DPR clamped to the device tier; reduced motion switches to 'demand'
 *   (one still frame, re-rendered only on invalidate()).
 */
export default function LazyCanvas({
  children,
  fallback = null,
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

  const [minDpr, tierMax] = DPR_CAPS[tier];
  const dprMax = Math.max(minDpr, Math.min(tierMax, maxDpr ?? tierMax));
  const frameloop = !isVisible ? 'never' : reducedMotion ? 'demand' : activeFrameloop;
  const glProps =
    typeof gl === 'function' ? gl : { antialias: tier === 'high', alpha: true, powerPreference: 'high-performance' as const, ...gl };

  return (
    <div ref={boxRef} className={className} style={{ position: 'relative', ...style }}>
      {isMounted && webgl ? (
        <SectionErrorBoundary label={label} fallback={<div style={FILL}>{fallback}</div>}>
          <Canvas {...canvasProps} gl={glProps} dpr={[minDpr, dprMax]} frameloop={frameloop} style={FILL}>
            {children}
          </Canvas>
        </SectionErrorBoundary>
      ) : (
        <div style={FILL}>{fallback}</div>
      )}
    </div>
  );
}
