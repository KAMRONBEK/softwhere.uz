'use client';

import { memo, type CSSProperties } from 'react';
import { WireHome } from './HomeScreen';
import { useCopy } from './useCopy';
import css from './wire.module.css';

/** Flow pins (em, on the 21.9 × 46.9em screen): the search field, the first dish's add button, the cart. */
const PINS: ReadonlyArray<readonly [x: number, y: number]> = [
  [2.85, 9.05],
  [8.7, 36.25],
  [19.2, 5.2],
];

/**
 * Step 2 · Wireframes: the same home screen as gray boxes, with the
 * flow drawn over it (search → add → order) the way a clickable prototype
 * links its screens.
 */
function WireScreen() {
  const { wire } = useCopy();
  return (
    <>
      <WireHome />
      <div className={css.flow} aria-hidden='true'>
        <svg className={css.flowArt} viewBox='0 0 219 469' preserveAspectRatio='none' focusable='false'>
          <path className={css.flowBed} d='M28.5 90.5C18 200 58 292 87 362.5C150 330 214 200 192 52' />
          <path className={css.flowLine} d='M28.5 90.5C18 200 58 292 87 362.5C150 330 214 200 192 52' pathLength='100' />
        </svg>
        {PINS.map(([x, y], index) => (
          <span
            key={`${x}-${y}`}
            className={css.pin}
            style={{ ['--x' as string]: `${x}em`, ['--y' as string]: `${y}em`, ['--i' as string]: index } as CSSProperties}
          >
            {index + 1}
          </span>
        ))}
        <span className={css.label}>{wire.flow}</span>
      </div>
    </>
  );
}

export default memo(WireScreen);
