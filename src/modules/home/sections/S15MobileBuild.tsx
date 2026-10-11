'use client';

import { useLocale, useTranslations } from 'next-intl';
import { startTransition, useCallback, useRef, type CSSProperties, type MouseEvent } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useLabDevice } from '../device/useDeviceTier';
import { scrollToSection, scrollToY } from '../global/scroll';
import { useProjectDescriber } from '../media/useProjectDescriber';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import { DemoProvider, type DemoApi } from './s15/context';
import {
  ESTIMATE,
  EXAMPLE_PROJECTS,
  LIVE_PROJECTS,
  STEP_UNIT_SVH,
  STEP_WEIGHTS,
  clockForLocale,
  currencyForLocale,
  marketForLocale,
  priceRange,
} from './s15/data';
import { useCopyEntrance, useDocumentVisible, useStepScroll } from './s15/hooks';
import { ArrowIcon } from './s15/icons';
import Plan from './s15/Plan';
import css from './s15/section.module.css';
import Stage from './s15/Stage';
import Steps from './s15/Steps';
import { useS15Copy } from './s15/useCopy';

/** Room above the phone after a jump in the still version (the header and the hint). */
const STAGE_JUMP_OFFSET = 72;
/** Share of the stage that must be on screen for the demo's timed beats to play. */
const ENGAGED_SHARE = 0.5;

const TRACK_LEN = `${STEP_WEIGHTS.reduce((sum, weight) => sum + weight, 0) * STEP_UNIT_SVH}svh`;

function onPriceIdea(event: MouseEvent<HTMLAnchorElement>) {
  // In ?only= mode there is no AI brief to jump to: leave the link inert.
  if (!document.getElementById('ai-demo')) return;
  event.preventDefault();
  scrollToSection('ai-demo');
}

/**
 * 08 · Mobile App — how we build one, told on a CSS-3D phone whose screen
 * evolves as you scroll: sticky notes that become a scoped feature list, the
 * home screen as gray wireframes with its flow drawn on, the same screen
 * painted in (and flipped to dark mode), a working build (add to cart,
 * order, a push notification, the courier on a map), a device-lab run, and
 * the store page. Each step says what we do, when, and what you get; taps
 * on the steps jump, taps in the app take over its demo.
 *
 * Desktop: the step as a chapter beside the phone, which the camera swings
 * around from step to step, and the whole first version as a 9-week plan
 * underneath, its playhead sweeping week 1 to week 9 with the scroll.
 * Phones: the phone fills the sticky screen with the current step as a
 * caption beneath it and a segmented bar to jump. Reduced motion: no
 * scroll story; the phone and every step side by side (stacked on phones),
 * tap a step to show it, each screen at its finished frame.
 *
 * The demo's state lives in DemoProvider (sliced contexts): this component
 * never re-renders on an app beat or a step change.
 */
export default function S15MobileBuild({ meta }: LabSectionProps) {
  const locale = useLocale();
  const t = useTranslations('home.mobile-build');
  const describer = useProjectDescriber();
  const currency = currencyForLocale(locale);
  const copy = useS15Copy(currency);
  const { scheme } = useLabTheme();
  const { tier, reducedMotion: isStatic, isTouch } = useLabDevice();

  const apiRef = useRef<DemoApi | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const jumpRef = useRef<((index: number) => void) | null>(null);
  const isOnScreen = useInView(stageRef);
  const isEngaged = useInView(stageRef, '0px', ENGAGED_SHARE);
  const isDocumentVisible = useDocumentVisible();

  // Scroll picks the step; React renders it as a transition, so a scroll
  // frame never waits for the phone to re-render.
  const onStep = useCallback((step: number) => {
    startTransition(() => apiRef.current?.dispatch({ type: 'STEP', step, isStatic: false }));
  }, []);
  useStepScroll(rootRef, trackRef, onStep, jumpRef, !isStatic);
  useCopyEntrance(rootRef, css.title, css.titleLine, isStatic);

  const onSelect = useCallback(
    (step: number) => {
      const api = apiRef.current;
      if (!api) return;
      if (!isStatic && jumpRef.current) {
        // Scroll owns the step: glide to it (the current one stays put).
        if (step !== api.getStep()) jumpRef.current(step);
        return;
      }
      api.dispatch({ type: 'STEP', step, isStatic });
      // Still version on phones: the phone sits above the list, so bring it back into view (instantly).
      const top = stageRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) scrollToY(window.scrollY + top - STAGE_JUMP_OFFSET);
    },
    [isStatic]
  );

  const market = marketForLocale(locale);
  const [minWeeks, maxWeeks] = ESTIMATE[market].weeks;
  const examples = EXAMPLE_PROJECTS.map(project => describer.describe(project));
  const exampleList =
    examples.length < 2 ? examples.join('') : t('listAnd', { rest: examples.slice(0, -1).join(', '), last: examples[examples.length - 1] });
  const proof = LIVE_PROJECTS.length > 0 && examples.length > 0 ? t('proof', { count: LIVE_PROJECTS.length, examples: exampleList }) : '';

  return (
    <DemoProvider
      apiRef={apiRef}
      currency={currency}
      clock={clockForLocale(locale)}
      copy={copy}
      isStatic={isStatic}
      isActive={isOnScreen && isEngaged && isDocumentVisible}
    >
      <div
        ref={rootRef}
        className={css.root}
        data-scheme={scheme}
        data-static={isStatic ? 'true' : undefined}
        data-paused={isOnScreen ? undefined : 'true'}
        style={{ ['--track-len' as string]: TRACK_LEN } as CSSProperties}
      >
        <header className={css.intro}>
          <SectionHeading meta={meta} className={css.title}>
            {t('heading')}
          </SectionHeading>
          <p className={css.lead} data-enter>
            {t('lead')}
          </p>
        </header>

        <div ref={trackRef} className={css.track}>
          <div className={css.sticky}>
            <div className={css.grid}>
              <div className={css.stageCell}>
                <div className={css.aura} aria-hidden='true' />
                <Stage
                  rootRef={rootRef}
                  stageRef={stageRef}
                  trackRef={trackRef}
                  isTiltEnabled={!isStatic && tier !== 'low'}
                  isTouch={isTouch}
                />
              </div>
              <div className={css.stepsCell}>
                <Steps onSelect={onSelect} />
              </div>
              {!isStatic && (
                <div className={css.planCell}>
                  <Plan onSelect={onSelect} />
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className={css.outro}>
          <div className={css.proof}>
            {proof && <p className={css.proofText}>{proof}</p>}
            <p className={css.next}>{t('next')}</p>
          </div>
          <div className={css.action}>
            <p className={css.price}>
              {t.rich('price', {
                payments: t(`payments.${market}`),
                range: priceRange(market, locale),
                weeks: t('weeks', { min: minWeeks, max: maxWeeks }),
                b: chunks => <strong className={css.priceFigure}>{chunks}</strong>,
              })}
            </p>
            <a className={css.cta} href='#ai-demo' onClick={onPriceIdea} data-magnetic=''>
              {t('cta')}
              <ArrowIcon className={css.ctaIcon} />
            </a>
            <p className={css.footnote}>{t('footnote')}</p>
          </div>
        </footer>
      </div>
    </DemoProvider>
  );
}
