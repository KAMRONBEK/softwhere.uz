import type { ReactNode } from 'react';
import type { CursorIcon } from './CursorLayer.hit';
import css from './CursorLayer.module.css';

/**
 * Glyphs for the cursor's label badge (CursorLayer.tsx renders them once; the
 * engine un-hides the one matching the hovered `data-cursor` label). Drawn on
 * a 24px grid in currentColor, so they take --on-accent inside the disc and
 * --accent outside it. Hand outlines after Lucide (ISC).
 */

interface GlyphProps {
  icon: CursorIcon;
  children: ReactNode;
  className?: string;
}

function Glyph({ icon, children, className = css.glyph }: GlyphProps) {
  return (
    <span className={className} data-glyph={icon} hidden>
      {children}
    </span>
  );
}

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'>
      {children}
    </svg>
  );
}

/** Glyphs that sit inside the disc, above the label. */
export function BadgeGlyphs() {
  return (
    <>
      <Glyph icon='play'>
        <Svg>
          <path d='M8.5 5.8v12.4a.6.6 0 0 0 .9.5l10-6.2a.6.6 0 0 0 0-1L9.4 5.3a.6.6 0 0 0-.9.5z' fill='currentColor' />
        </Svg>
      </Glyph>
      <Glyph icon='open'>
        <Svg className={css.glyphOpen}>
          <path d='M7 17 17 7' />
          <path d='M8.5 7H17v8.5' />
        </Svg>
      </Glyph>
      <Glyph icon='grab'>
        <Svg className={css.handOpen}>
          <path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2' />
          <path d='M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2' />
          <path d='M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8' />
          <path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15' />
        </Svg>
        <Svg className={css.handShut}>
          <path d='M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4' />
          <path d='M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2' />
          <path d='M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5' />
          <path d='M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2' />
          <path d='M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0' />
        </Svg>
      </Glyph>
      <Glyph icon='tap'>
        <Svg>
          <circle cx='12' cy='12' r='6.5' strokeWidth='1.4' strokeOpacity='0.45' />
          <circle className={css.tapRing} cx='12' cy='12' r='9.5' />
          <circle cx='12' cy='12' r='3.2' fill='currentColor' stroke='none' />
        </Svg>
      </Glyph>
      <Glyph icon='show'>
        <Svg className={css.glyphEye}>
          <path d='M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z' />
          <circle cx='12' cy='12' r='3' fill='currentColor' />
        </Svg>
      </Glyph>
      <Glyph icon='recount'>
        <Svg className={css.glyphSpin}>
          <path d='M20.5 12a8.5 8.5 0 1 1-2.5-6' />
          <path d='M20 3.5V8h-4.5' />
        </Svg>
      </Glyph>
      <Glyph icon='pulse'>
        <Svg className={css.glyphBeat}>
          <path d='M2 12h4l2.5-6 4 13 3-9 1.5 2H22' />
        </Svg>
      </Glyph>
      <Glyph icon='type'>
        <Svg className={css.glyphBlink}>
          <path d='M12 5v14M9 4.5c1.5 0 3 .5 3 .5s1.5-.5 3-.5M9 19.5c1.5 0 3-.5 3-.5s1.5.5 3 .5' />
        </Svg>
      </Glyph>
    </>
  );
}

/** Drag: chevrons that ride outside the disc, between it and the brackets. */
export function DragGlyph() {
  return (
    <Glyph icon='drag' className={css.chevrons}>
      <Svg className={css.chevronLeft}>
        <path d='M15 5.5 8.5 12l6.5 6.5' />
      </Svg>
      <Svg className={css.chevronRight}>
        <path d='M9 5.5 15.5 12 9 18.5' />
      </Svg>
    </Glyph>
  );
}
