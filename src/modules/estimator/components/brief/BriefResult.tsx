'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { isPricedEstimate } from '@/modules/estimator/ai-brief/types';
import BriefHead, { BriefContext } from './BriefHead';
import { Method, PriceDrivers } from './BriefMethod';
import { BuildFirst, CanWait, Questions, Risks, ScopeSplit } from './BriefPlan';
import BriefTimeline from './BriefTimeline';
import { NextFreeLine } from './DailyLimit';
import type { BriefRunState } from './briefState';
import EstimateLedger from './EstimateLedger';
import ProgressTrack from './ProgressTrack';
import ScreensStrip from './ScreensStrip';
import css from './brief.module.css';

type BriefResultProps = {
  state: BriefRunState;
  locale: BriefLocale;
  isCompact: boolean;
  /** Today's free brief is used until then (null = open): no "plan another idea" — the step-by-step estimator instead, and when the next one opens. */
  nextFreeAt: number | null;
  /** Compact only: the page that shows this brief in full (it reads the same saved brief). */
  fullPlanHref: string | null;
  onTalk: () => void;
  onNewIdea: () => void;
};

function PlanSkeleton() {
  return (
    <div className={css.planSkeleton} aria-hidden>
      {[0, 1, 2].map(i => (
        <div key={i} className={css.planSection}>
          <span className={`${css.skel} ${css.skelLabel}`} />
          <span className={`${css.skel} ${css.skelLine}`} />
          <span className={`${css.skel} ${css.skelLine} ${css.skelShort}`} />
        </div>
      ))}
    </div>
  );
}

/** The written plan (full page): what to build first, scope, timeline, what can wait, risks, questions, and how it was priced. */
function PlanBody({ preview, brief }: { preview: BriefRunState['preview']; brief: BriefRunState['brief'] }) {
  const phases = (brief ?? preview)?.estimate.phases ?? [];
  return (
    <div className={preview ? css.resultBody : css.resultBodySingle}>
      <div className={css.resultMain}>
        <BuildFirst brief={brief} />
        {!preview && <PlanSkeleton />}
        {preview && (
          <>
            <ScopeSplit preview={preview} />
            <BriefTimeline phases={phases} hasText={brief !== null} />
            {brief && <CanWait brief={brief} />}
            {brief && <Risks brief={brief} />}
            {brief && <Questions brief={brief} />}
          </>
        )}
      </div>
      {preview && (
        <div className={css.resultAside}>
          <PriceDrivers preview={preview} />
          <Method preview={preview} brief={brief} />
        </div>
      )}
    </div>
  );
}

type NextStepsProps = {
  locale: BriefLocale;
  nextFreeAt: number | null;
  onNewIdea: () => void;
};

/** "Plan another idea", or — once today's free brief is used — the step-by-step estimator. */
function SecondaryAction({ locale, nextFreeAt, onNewIdea }: NextStepsProps) {
  const t = useTranslations('aiBrief');
  return nextFreeAt !== null ? (
    <Link href={`/${locale}/estimator`} className={css.secondaryButton}>
      {t('limit.estimator')}
    </Link>
  ) : (
    <button type='button' className={css.secondaryButton} onClick={onNewIdea}>
      {t('cta.newIdea')}
    </button>
  );
}

type FullPlanBandProps = NextStepsProps & { href: string; titleId: string };

/**
 * The compact brief's close: what the full plan adds, a link to it, and the
 * secondary way on. Talking to us sits on the price card above.
 */
function FullPlanBand({ href, titleId, locale, nextFreeAt, onNewIdea }: FullPlanBandProps) {
  const t = useTranslations('aiBrief');
  return (
    <section className={`${css.ctaBand} ${css.fullBand}`} aria-labelledby={`${titleId}-full`}>
      <div>
        <h3 id={`${titleId}-full`} className={css.ctaTitle}>
          {t('result.fullTitle')}
        </h3>
        <p className={css.ctaBody}>{t('result.fullBody')}</p>
      </div>
      <div className={css.ctaActions}>
        <Link href={href} className={css.primaryButton}>
          {t('result.openFull')}
          <svg viewBox='0 0 16 16' aria-hidden className={css.buttonArrow}>
            <path
              d='M3 8h9.5M8.5 4l4 4-4 4'
              fill='none'
              stroke='currentColor'
              strokeWidth='1.6'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </Link>
        <SecondaryAction locale={locale} nextFreeAt={nextFreeAt} onNewIdea={onNewIdea} />
      </div>
      {nextFreeAt !== null && <NextFreeLine nextFreeAt={nextFreeAt} locale={locale} kind='usedNote' className={css.ctaNote} />}
    </section>
  );
}

/**
 * The brief as it fills in: progress, then the product and its numbers
 * (~20s), then the wireframes and the written plan as each arrives. The same
 * layout serves the loading and the finished state, so nothing jumps.
 *
 * Compact (a homepage section) is a summary: the product, who it serves and
 * what makes it harder, its price range, weeks and team, and the key screens, then a link to the full plan — the
 * section keeps its length and the page's story goes on below it.
 */
export default function BriefResult({ state, locale, isCompact, nextFreeAt, fullPlanHref, onTalk, onNewIdea }: BriefResultProps) {
  const t = useTranslations('aiBrief');
  const titleId = useId();
  const announcedRef = useRef(false);
  const { preview, brief, screens } = state;
  const isRunning = state.status === 'running';
  const isDone = state.status === 'done';
  const isAnimated = !state.restored;
  // A very large idea: a plan without a price, and the call to action is a discovery call.
  const isDiscovery = preview !== null && !isPricedEstimate(preview.estimate);

  // Keyboard and screen-reader users land on the finished brief; sighted users keep their scroll position.
  useEffect(() => {
    if (!isDone || state.restored || announcedRef.current) return;
    announcedRef.current = true;
    document.getElementById(titleId)?.focus({ preventScroll: true });
  }, [isDone, state.restored, titleId]);

  const talkButton = (
    <button type='button' className={css.primaryButton} onClick={onTalk}>
      {isDiscovery ? t('cta.discoveryButton') : t('cta.button')}
    </button>
  );

  // Compact closes on the link to the full plan; the full page on the call to action.
  const closing =
    isCompact && fullPlanHref ? (
      <FullPlanBand href={fullPlanHref} titleId={titleId} locale={locale} nextFreeAt={nextFreeAt} onNewIdea={onNewIdea} />
    ) : (
      <section className={css.ctaBand} aria-labelledby={`${titleId}-cta`}>
        <div>
          <h3 id={`${titleId}-cta`} className={css.ctaTitle}>
            {isDiscovery ? t('cta.discoveryTitle') : t('cta.title')}
          </h3>
          <p className={css.ctaBody}>{isDiscovery ? t('cta.discoveryBody') : t('cta.body')}</p>
        </div>
        <div className={css.ctaActions}>
          {talkButton}
          <SecondaryAction locale={locale} nextFreeAt={nextFreeAt} onNewIdea={onNewIdea} />
        </div>
        {nextFreeAt !== null && <NextFreeLine nextFreeAt={nextFreeAt} locale={locale} kind='usedNote' className={css.ctaNote} />}
      </section>
    );

  return (
    <div className={css.result} aria-busy={isRunning}>
      {isRunning ? (
        <ProgressTrack state={state} />
      ) : (
        state.elapsedMs !== null && (
          <p className={css.doneLine}>{t('progress.done', { seconds: Math.max(1, Math.round(state.elapsedMs / 1000)) })}</p>
        )
      )}

      <div className={css.resultTop}>
        <BriefHead preview={preview} titleId={titleId} />
        <BriefContext preview={preview} />
        <EstimateLedger preview={preview} locale={locale} isAnimated={isAnimated} action={isDone ? talkButton : undefined} />
      </div>

      <ScreensStrip screens={screens} isAnimated={isAnimated} isFinished={isDone} />

      {!isCompact && <PlanBody preview={preview} brief={brief} />}
      {isDone && closing}
    </div>
  );
}
