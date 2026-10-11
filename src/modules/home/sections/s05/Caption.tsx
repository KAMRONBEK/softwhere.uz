'use client';

import { memo } from 'react';
import { STEP_COUNT } from './story';
import css from './caption.module.css';

interface CaptionProps {
  className?: string;
  /** First line shown before the engine takes over (SSR and the opening frame). */
  initial: string;
}

/**
 * Plain-English subtitle under the preview: what the code just did, with a
 * step counter and progress segments. The engine swaps the text (two lines
 * cross-fade) and fills the segments; it is a visual echo of the editor, so
 * screen readers get the code itself instead.
 */
function Caption({ className, initial }: CaptionProps) {
  return (
    <div className={`${css.caption} ${className ?? ''}`} data-caption='' aria-hidden='true'>
      <span className={css.step}>
        <b data-cap-step=''>00</b>/{String(STEP_COUNT).padStart(2, '0')}
      </span>
      <span className={css.text}>
        <span className={css.line} data-cap-line='0' data-on='1'>
          {initial}
        </span>
        <span className={css.line} data-cap-line='1' />
      </span>
      <span className={css.segs}>
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <span key={i} className={css.seg}>
            <i className={css.segFill} data-cap-seg={i} />
          </span>
        ))}
      </span>
    </div>
  );
}

export default memo(Caption);
