'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { placeScene, planeTransform } from './geometry';
import { shotSrc, type XRayScene } from './scenes';
import css from './XRay.module.css';

interface StillPlaneProps {
  scene: XRayScene;
  isWide: boolean;
  className?: string;
}

/**
 * The cut-out frame as a plain image, placed exactly where the WebGL plane
 * will draw it. Shown until the canvas has its first frame (and whenever the
 * canvas is unmounted), so the stage is never empty.
 */
export default function StillPlane({ scene, isWide, className }: StillPlaneProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox(prev => (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const win = placeScene(box.width, box.height, scene, isWide);
  const planeStyle: CSSProperties = {
    width: scene.size[0],
    height: scene.size[1],
    transform: planeTransform(win, scene.size),
    visibility: box.width === 0 ? 'hidden' : undefined,
  };

  return (
    <div ref={boxRef} className={className} aria-hidden='true'>
      <div className={css.plane} style={planeStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static cut-out still, placed by the plane transform */}
        <img className={css.planeImage} src={shotSrc(scene)} alt='' decoding='async' />
      </div>
    </div>
  );
}
