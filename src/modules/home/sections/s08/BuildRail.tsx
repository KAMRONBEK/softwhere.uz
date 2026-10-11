'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { RAIL_FEATURE_IDS, RAIL_MARKED_FEATURES, RAIL_STEP_IDS, type BriefStage } from './data';
import css from './rail.module.css';

type StepId = (typeof RAIL_STEP_IDS)[number];
type StepState = 'rest' | 'pending' | 'active' | 'done';

const ALL_DONE: Record<StepId, StepState> = { idea: 'done', features: 'done', price: 'done', screens: 'done' };

/**
 * Each step at each of the brief's real milestones. The estimator prices the
 * scope the moment the features are mapped, so Price lands with Features; the
 * screens are sketched after.
 */
const STATES: Record<BriefStage, Record<StepId, StepState>> = {
  idle: { idea: 'rest', features: 'rest', price: 'rest', screens: 'rest' },
  reading: { idea: 'done', features: 'active', price: 'pending', screens: 'pending' },
  scoped: { idea: 'done', features: 'done', price: 'done', screens: 'active' },
  sketched: ALL_DONE,
  done: ALL_DONE,
};

/** Stagger index for the entrance choreography (rail.module.css reads --i). */
const order = (i: number): CSSProperties => ({ '--i': i }) as CSSProperties;

/** The visitor's words, with the ones that become features marked as a highlighter would. */
function IdeaArt() {
  const t = useTranslations('home.ai-demo');
  const tShared = useTranslations('home.shared');
  // The marks stagger in the order they appear in the sentence (it differs per language).
  let markIndex = 0;
  const mark = (chunks: ReactNode) => {
    const i = markIndex++;
    return (
      <mark key={i} className={css.mark} style={order(i)}>
        {chunks}
      </mark>
    );
  };
  return (
    <p className={css.quote}>
      {tShared('quoteOpen')}
      {t.rich('rail.idea', { m: mark })}
      {tShared('quoteClose')}
    </p>
  );
}

/** The marked words as catalog features; the last one is implied by the idea, not written in it. */
function FeaturesArt() {
  const t = useTranslations('home.ai-demo');
  return (
    <ul className={css.chips}>
      {RAIL_FEATURE_IDS.map((feature, i) => (
        <li key={feature} className={i < RAIL_MARKED_FEATURES ? css.chip : `${css.chip} ${css.chipImplied}`} style={order(i)}>
          {t(`rail.features.${feature}`)}
        </li>
      ))}
    </ul>
  );
}

/** A price range on a ruler and the weeks as three phases. No figures: those are the visitor's own. */
function PriceArt() {
  const t = useTranslations('home.ai-demo');
  return (
    <div className={css.priceArt}>
      <span className={css.artLabel}>{t('rail.range')}</span>
      <span className={css.ruler}>
        <span className={css.range} />
        <span className={`${css.cap} ${css.capMin}`} />
        <span className={`${css.cap} ${css.capMax}`} />
      </span>
      <span className={css.artLabel}>{t('rail.weeks')}</span>
      <span className={css.gantt}>
        {[0, 1, 2].map(i => (
          <span key={i} className={css.phase} style={order(i)} />
        ))}
      </span>
    </div>
  );
}

/** Two lo-fi screens: a list with a call to action, and a grid. */
function ScreensArt() {
  return (
    <div className={css.phones}>
      <span className={css.phone}>
        <span className={`${css.block} ${css.blockBar}`} style={order(0)} />
        {[1, 2, 3].map(i => (
          <span key={i} className={`${css.block} ${css.blockRow}`} style={order(i)} />
        ))}
        <span className={`${css.block} ${css.blockButton}`} style={order(4)} />
      </span>
      <span className={css.phone}>
        <span className={`${css.block} ${css.blockBar} ${css.blockQuiet}`} style={order(2)} />
        <span className={css.grid}>
          {[3, 4, 5, 6].map(i => (
            <span key={i} className={`${css.block} ${css.blockCell}`} style={order(i)} />
          ))}
        </span>
        <span className={`${css.block} ${css.blockButton}`} style={order(7)} />
      </span>
    </div>
  );
}

const ART: Record<StepId, ComponentType> = {
  idea: IdeaArt,
  features: FeaturesArt,
  price: PriceArt,
  screens: ScreensArt,
};

function StatusDot() {
  return (
    <span className={css.dot} aria-hidden='true'>
      <svg viewBox='0 0 12 12'>
        <path d='M3 6.2 5 8.2 9 4' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </span>
  );
}

type BuildRailProps = {
  /** How far the real brief has got (its milestones, not a timer). */
  stage: BriefStage;
  /** Reduced motion: no entrance, no working sweep. */
  isStill: boolean;
};

/**
 * 12 · ai-demo — what a plan is made of, between the heading and the real
 * brief: your words (the ones that matter highlighted), the features they
 * map to, the price range and weeks, and the key screens. It plays once as
 * it comes into view, then follows the brief's real milestones while a plan
 * is being made. Phones get a one-line rail, so the composer stays on the
 * section's first screen. CSS only: nothing runs while it rests.
 */
export default function BuildRail({ stage, isStill }: BuildRailProps) {
  const t = useTranslations('home.ai-demo');
  const listRef = useRef<HTMLOListElement>(null);
  const states = STATES[stage];

  // Arm the entrance (paused at its first frame) on mount and play it once the rail is in view.
  // A DOM attribute, not React state: React never owns it, so re-renders keep it.
  useEffect(() => {
    const list = listRef.current;
    if (!list || isStill) return;
    list.dataset.motion = 'armed';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        list.dataset.motion = 'play';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(list);
    return () => {
      observer.disconnect();
      delete list.dataset.motion;
    };
  }, [isStill]);

  return (
    <ol ref={listRef} className={css.rail} aria-label={t('rail.label')}>
      {RAIL_STEP_IDS.map((step, i) => {
        const Art = ART[step];
        return (
          <li key={step} className={css.step} data-state={states[step]} data-step={step}>
            <div className={css.head}>
              <span className={css.num} aria-hidden='true'>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={css.name}>{t(`rail.steps.${step}.name`)}</span>
              <span className={css.short}>{t(`rail.steps.${step}.short`)}</span>
              <StatusDot />
            </div>
            <div className={css.art} aria-hidden='true'>
              <Art />
            </div>
            <p className={css.caption}>{t(`rail.steps.${step}.caption`)}</p>
          </li>
        );
      })}
    </ol>
  );
}
