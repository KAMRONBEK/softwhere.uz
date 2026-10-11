'use client';

import { useTranslations } from 'next-intl';
import { useId, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WireframeScreen } from '@/modules/estimator/ai-brief/types';
import Wireframe, { describeBlocks } from './wireframe/Wireframe';
import css from './brief.module.css';

type ScreensStripProps = {
  /** null while the wireframes are still being drawn. */
  screens: WireframeScreen[] | null;
  /** Draw the screens in when they first arrive (not for a restored brief). */
  isAnimated: boolean;
  isFinished: boolean;
};

const SCREEN_STAGGER_MS = 150;
const PLACEHOLDERS = ['phone', 'wide', 'phone'] as const;

function SketchingPlaceholders() {
  return (
    <ul className={css.strip} aria-hidden>
      {PLACEHOLDERS.map((kind, i) => (
        <li key={i} className={css.stripItem}>
          <span className={`${css.ghostFrame} ${kind === 'wide' ? css.ghostWide : css.ghostPhone}`}>
            <span className={`${css.skel} ${css.ghostBar}`} />
            <span className={`${css.skel} ${css.ghostBlock}`} />
            <span className={`${css.skel} ${css.ghostBar} ${css.skelShort}`} />
            <span className={`${css.skel} ${css.ghostBlockTall}`} />
          </span>
          <span className={`${css.skel} ${css.skelLabel}`} />
        </li>
      ))}
    </ul>
  );
}

/** Horizontal, swipeable strip of wireframes with prev/next on pointer devices. */
export default function ScreensStrip({ screens, isAnimated, isFinished }: ScreensStripProps) {
  const t = useTranslations('aiBrief.result');
  const headingId = useId();
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);
  const count = screens?.length ?? 0;

  const updateCurrent = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const items = Array.from(scroller.children) as HTMLElement[];
    const left = scroller.scrollLeft + scroller.clientWidth * 0.3;
    const index = items.findIndex(item => item.offsetLeft + item.offsetWidth > left);
    setCurrent(Math.max(0, index));
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.addEventListener('scroll', updateCurrent, { passive: true });
    return () => scroller.removeEventListener('scroll', updateCurrent);
  }, [updateCurrent, count]);

  const scrollTo = (index: number) => {
    const scroller = scrollerRef.current;
    const item = scroller?.children[index] as HTMLElement | undefined;
    if (!item) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    item.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
  };

  const showMissing = isFinished && count === 0;
  // A strip of browser windows only is shorter than one with phones in it.
  const hasTallFrames = screens?.some(screen => screen.device === 'phone' || screen.device === 'chat') ?? true;
  const stripStyle = hasTallFrames ? undefined : ({ '--frame-h': 'var(--wide-h)' } as CSSProperties);

  return (
    <section className={css.screens} aria-labelledby={headingId}>
      <div className={css.sectionHead}>
        <div>
          <h3 id={headingId} className={css.sectionTitle}>
            {t('screens')}
          </h3>
          <p className={css.sectionHint}>{showMissing ? t('screensMissing') : t('screensHint')}</p>
        </div>
        {count > 1 && (
          <div className={css.stripNav}>
            <span className={css.stripCount} aria-live='polite'>
              {t('screenCount', { current: current + 1, total: count })}
            </span>
            <button
              type='button'
              className={css.roundButton}
              onClick={() => scrollTo(current - 1)}
              disabled={current === 0}
              aria-label={t('prevScreen')}
            >
              <svg viewBox='0 0 16 16' aria-hidden>
                <path
                  d='M10 3.5L5.5 8l4.5 4.5'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.6'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </button>
            <button
              type='button'
              className={css.roundButton}
              onClick={() => scrollTo(current + 1)}
              disabled={current >= count - 1}
              aria-label={t('nextScreen')}
            >
              <svg viewBox='0 0 16 16' aria-hidden>
                <path
                  d='M6 3.5L10.5 8 6 12.5'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.6'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {screens === null && !isFinished && <SketchingPlaceholders />}
      {count > 0 && (
        <ul ref={scrollerRef} className={css.strip} style={stripStyle} tabIndex={0} aria-label={t('screens')}>
          {screens!.map((screen, i) => (
            <li key={`${screen.name}-${i}`} className={css.stripItem}>
              <figure className={css.screenFigure}>
                <div className={css.frameSlot}>
                  <Wireframe
                    screen={screen}
                    label={t('sketchOf', { name: screen.name, blocks: describeBlocks(screen) })}
                    isAnimated={isAnimated}
                    delayMs={i * SCREEN_STAGGER_MS}
                  />
                </div>
                <figcaption className={css.screenCaption}>
                  <span className={css.screenName}>
                    {screen.name}
                    {screen.phase === 'later' && <span className={css.laterBadge}>{t('phaseLater')}</span>}
                  </span>
                  <span className={css.screenPurpose}>{screen.purpose}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
