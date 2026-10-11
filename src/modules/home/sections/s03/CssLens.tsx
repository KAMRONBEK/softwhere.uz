'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useInView } from '../../components/useInView';
import { baseRadiusFor, isIdle, type LensController } from './controller';
import { overlayMetrics, placeScene, planeTransform } from './geometry';
import type { XRayPalette } from './palette';
import { shotSrc, type XRayScene } from './scenes';
import { buildTour, createHudState, DWELL_SECONDS, hudBounds, updateHud, type HudElements } from './tour';
import css from './XRay.module.css';
import XRaySvg from './XRaySvg';

interface CssLensProps {
  scene: XRayScene;
  palette: XRayPalette;
  controllerRef: RefObject<LensController | null>;
  hudRef: RefObject<HudElements>;
  reducedMotion: boolean;
  isRevealAll: boolean;
  isWide: boolean;
}

/**
 * CSS-only x-ray for the low tier and browsers without WebGL. A circular
 * window moved with transforms (its contents counter-moved, so they stay put)
 * reveals the blueprint: paper, grid, a ghost of the screenshot and the SVG
 * overlay. No per-frame loop: it repositions on input, and glides between
 * tour stops with a CSS transition while idle (one lap, then it rests).
 */
export default function CssLens({ scene, palette, controllerRef, hudRef, reducedMotion, isRevealAll, isWide }: CssLensProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const hudState = useRef(createHudState());
  const [box, setBox] = useState({ width: 0, height: 0 });
  const isVisible = useInView(rootRef);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox(prev => (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const win = useMemo(() => placeScene(box.width, box.height, scene, isWide), [box, scene, isWide]);
  const sizes = useMemo(() => overlayMetrics(win.scale, 1, !isWide), [win.scale, isWide]);
  const radius = baseRadiusFor(box.width, box.height, isWide);
  const transform = planeTransform(win, scene.size);

  const apply = useCallback(
    (isGlide: boolean) => {
      const c = controllerRef.current;
      const lens = lensRef.current;
      const inner = innerRef.current;
      if (!c || !lens || !inner || box.width === 0) return;
      c.width = box.width;
      c.height = box.height;
      c.baseRadius = radius;
      c.pos = [...c.target];
      const x = c.pos[0] - radius;
      const y = c.pos[1] - radius;
      lens.dataset.glide = isGlide ? 'true' : 'false';
      lens.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      inner.style.transform = `translate3d(${(-x).toFixed(1)}px, ${(-y).toFixed(1)}px, 0)`;
      const hud = hudRef.current;
      if (hud) updateHud(hud, hudState.current, scene, win, c.pos, radius, !c.isRevealAll, 1, hudBounds(box.width, box.height, isWide));
    },
    [controllerRef, hudRef, box, radius, scene, win, isWide]
  );

  // Input → reposition on the next frame (no loop while idle).
  useEffect(() => {
    const c = controllerRef.current;
    if (!c) return;
    let frame = 0;
    const repaint = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply(false);
      });
    };
    c.requestFrame = repaint;
    return () => {
      cancelAnimationFrame(frame);
      // The WebGL scene may already have taken over (fallback → canvas swap).
      if (c.requestFrame === repaint) c.requestFrame = () => undefined;
    };
  }, [controllerRef, apply]);

  // Place the lens on the first stop, then tour one lap while idle and visible.
  useEffect(() => {
    const c = controllerRef.current;
    if (!c || box.width === 0) return;
    const stops = buildTour(scene, win, radius, sizes, null);
    hudState.current.key = '';
    if (!c.isPlaced) {
      c.target = [...stops[0]];
      c.isPlaced = true;
    }
    apply(false);
    if (reducedMotion || !isVisible) return;
    let index = 0;
    const timer = window.setInterval(() => {
      if (c.isRevealAll || !isIdle(c, performance.now())) return;
      index = (index + 1) % stops.length;
      c.target = [...stops[index]];
      apply(true);
      if (index === 0) window.clearInterval(timer);
    }, DWELL_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [controllerRef, scene, win, radius, sizes, reducedMotion, isVisible, apply, box.width]);

  useEffect(() => {
    const c = controllerRef.current;
    if (c) apply(false);
  }, [isRevealAll, controllerRef, apply]);

  const tx = -win.ox * scene.size[0] * win.scale;
  const ty = -win.oy * scene.size[1] * win.scale;
  const gridStyle = {
    '--grid': `${100 * win.scale}px`,
    '--grid-minor': `${20 * win.scale}px`,
    '--grid-x': `${tx}px`,
    '--grid-y': `${ty}px`,
  } as CSSProperties;
  const planeStyle: CSSProperties = { width: scene.size[0], height: scene.size[1], transform };

  return (
    <div ref={rootRef} className={css.cssLens} aria-hidden='true' data-dark={palette.isDark ? 'true' : 'false'}>
      <div className={css.plane} style={planeStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static cut-out still, placed by the plane transform */}
        <img className={css.planeImage} src={shotSrc(scene)} alt='' decoding='async' />
      </div>
      <div
        ref={lensRef}
        className={css.cssWindow}
        data-full={isRevealAll ? 'true' : 'false'}
        style={{ width: radius * 2, height: radius * 2 }}
      >
        <div ref={innerRef} className={css.cssInside} style={{ width: box.width, height: box.height, ...gridStyle }}>
          <div className={css.plane} style={planeStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ghost of the same still */}
            <img className={css.ghost} src={shotSrc(scene)} alt='' decoding='async' />
            <XRaySvg className={css.planeSvg} scene={scene} palette={palette} sizes={sizes} />
          </div>
        </div>
      </div>
    </div>
  );
}
