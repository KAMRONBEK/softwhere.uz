'use client';

import { useEffect, useRef } from 'react';
import { useDeviceTier } from '../device/useDeviceTier';
import { useLabTheme } from '../theme/useLabTheme';
import { createCursorEngine, type CursorEngine } from './CursorLayer.engine';
import { BadgeGlyphs, DragGlyph } from './CursorLayer.icons';
import css from './CursorLayer.module.css';

/** The cursor layer's DOM and engine (CursorLayer.tsx loads this chunk on a fine pointer only). */
const PULSE_POOL = [0, 1, 2];
const CORNER_KEYS = [0, 1, 2, 3];

export default function Cursor() {
  const theme = useLabTheme();
  const tier = useDeviceTier();
  const layerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CursorEngine | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const engine = layer ? createCursorEngine(layer) : null;
    engineRef.current = engine;
    return () => {
      engine?.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => engineRef.current?.setTheme(theme), [theme]);
  useEffect(() => engineRef.current?.setTier(tier), [tier]);

  return (
    <div ref={layerRef} className={css.layer} aria-hidden='true' data-tone='ink' data-mode='idle' data-parked='false' data-down='false'>
      <canvas className={css.trail} data-part='trail' />
      {PULSE_POOL.map(key => (
        <span key={key} className={css.pulse} data-part='pulse' />
      ))}
      {CORNER_KEYS.map(key => (
        <span key={key} className={css.corner} data-part='corner' />
      ))}
      <span className={css.chip} data-part='chip' data-side='below' />
      <span className={css.caret} data-part='caret' />
      <span className={css.dot} data-part='dot' />
      <span className={css.badge} data-part='badge' data-icon=''>
        <span className={css.badgeFace}>
          <BadgeGlyphs />
          <span className={css.badgeText} data-part='badge-text' />
        </span>
        <DragGlyph />
      </span>
    </div>
  );
}
