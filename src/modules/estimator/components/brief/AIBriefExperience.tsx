'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { isPricedEstimate } from '@/modules/estimator/ai-brief/types';
import { prefillContactMessage } from '@/shared/utils/contactPrefill';
import BriefFeedback from './BriefFeedback';
import BriefResult from './BriefResult';
import Composer from './Composer';
import DailyLimit from './DailyLimit';
import SampleSketch from './SampleSketch';
import { isBriefLocale, prefillIdea, priceRange, usdFormatter } from './format';
import type { BriefRunState } from './briefState';
import { useBriefRun } from './useBriefRun';
import css from './brief.module.css';

/** Bubbling event the lab's AI section listens for: 'idle' | 'thinking' | 'done'. */
export const AI_BRIEF_STATUS_EVENT = 'ai-brief:status';

/**
 * Bubbling event with how far the brief has really got, from the server's own
 * milestones: 'reading' (sent), 'scoped' (features and price are in),
 * 'sketched' (the screens are in), 'done', or 'idle'.
 */
export const AI_BRIEF_STAGE_EVENT = 'ai-brief:stage';
export type AIBriefStage = 'idle' | 'reading' | 'scoped' | 'sketched' | 'done';

function stageOf(state: BriefRunState): AIBriefStage {
  if (state.status === 'done') return 'done';
  if (state.status !== 'running') return 'idle';
  if (state.screens !== null) return 'sketched';
  return state.preview !== null ? 'scoped' : 'reading';
}

export type AIBriefExperienceProps = {
  /** 'full' = the /ai-estimate page; 'compact' = a homepage section (no page heading, plan collapsed). */
  variant?: 'full' | 'compact';
  /** id of the contact section to prefill; when it is not on the page the visitor goes to the homepage one. */
  contactSectionId?: string;
  /** Static prefix for the composer's ids (default `ai-brief-<variant>`: one brief per variant per page). */
  idPrefix?: string;
};

const SCROLL_MARGIN_PX = 96;

function scrollIntoViewSoftly(element: Element | null) {
  if (!element) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = element.getBoundingClientRect().top + window.scrollY - SCROLL_MARGIN_PX;
  window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
}

/**
 * AI project brief: a visitor describes an idea in plain words and gets the
 * key screens as lo-fi wireframes, what to build first, a timeline, risks,
 * call questions and a price range. Prices and weeks come from the estimator
 * engine on the server; the model only picks catalog options and writes text.
 * One free brief per visitor a day: once it is used, the page keeps showing
 * that brief (or, without one, a calm "come back tomorrow" card) and offers
 * the contact form and the step-by-step estimator instead of a new run.
 * The compact variant (a homepage section) shows a summary of a finished
 * brief — price, weeks, team, key screens — and links to the full plan on
 * /ai-estimate, which reads the same saved brief from this browser.
 */
export default function AIBriefExperience({
  variant = 'full',
  contactSectionId = 'contact',
  idPrefix = `ai-brief-${variant}`,
}: AIBriefExperienceProps) {
  const t = useTranslations('aiBrief');
  const rawLocale = useLocale();
  const locale = isBriefLocale(rawLocale) ? rawLocale : 'en';
  const router = useRouter();
  const { state, submit, reset } = useBriefRun(locale);
  const [draft, setDraft] = useState('');
  const [shouldFocusComposer, setShouldFocusComposer] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const isCompact = variant === 'compact';
  const isComposing = state.status !== 'running' && state.status !== 'done';
  const isLimited = state.nextFreeAt !== null;

  // The lab's AI section follows the brief: its status, and how far a run has really got.
  useEffect(() => {
    const detail = state.status === 'running' ? 'thinking' : state.status === 'done' ? 'done' : 'idle';
    rootRef.current?.dispatchEvent(new CustomEvent(AI_BRIEF_STATUS_EVENT, { detail, bubbles: true }));
  }, [state.status]);

  const stage = stageOf(state);
  useEffect(() => {
    rootRef.current?.dispatchEvent(new CustomEvent<AIBriefStage>(AI_BRIEF_STAGE_EVENT, { detail: stage, bubbles: true }));
  }, [stage]);

  const start = (idea: string) => {
    setShouldFocusComposer(false);
    void submit(idea);
    requestAnimationFrame(() => scrollIntoViewSoftly(resultRef.current));
  };

  const editIdea = () => {
    setDraft(state.idea);
    reset();
    setShouldFocusComposer(true);
    requestAnimationFrame(() => scrollIntoViewSoftly(rootRef.current));
  };

  const newIdea = () => {
    setDraft('');
    reset();
    setShouldFocusComposer(true);
    requestAnimationFrame(() => scrollIntoViewSoftly(rootRef.current));
  };

  /** The contact form's draft: the brief, or (no brief, today's used) the idea still in the field. */
  const contactMessage = (): string | null => {
    const { brief } = state;
    if (!brief) return draft.trim() ? t('limit.message', { idea: prefillIdea(draft) }) : null;
    const idea = prefillIdea(state.idea);
    const { estimate } = brief;
    return isPricedEstimate(estimate)
      ? t('cta.message', {
          title: brief.title,
          idea,
          price: priceRange(estimate.mvp.price, usdFormatter(locale)),
          weeks: t('estimate.weeks', { min: estimate.mvp.weeks.min, max: estimate.mvp.weeks.max }),
        })
      : t('cta.messageDiscovery', { title: brief.title, idea });
  };

  const talk = () => {
    const message = contactMessage();
    if (message) prefillContactMessage(message);
    const section = document.getElementById(contactSectionId);
    if (section) scrollIntoViewSoftly(section);
    else router.push(`/${locale}#${contactSectionId}`);
  };

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={start}
      isCompact={isCompact}
      shouldFocus={shouldFocusComposer}
      idPrefix={idPrefix}
      feedback={<BriefFeedback state={state} onRetry={() => start(state.idea)} />}
    />
  );

  // Today's free brief is used and no brief of it is on screen: the pause card takes the composer's place.
  const opening = state.nextFreeAt !== null ? <DailyLimit nextFreeAt={state.nextFreeAt} locale={locale} onTalk={talk} /> : composer;

  return (
    <div ref={rootRef} className={`${css.root} ${isCompact ? css.compact : css.full}`} data-ai-brief={variant}>
      {!isCompact && (
        <div className={isComposing ? css.intro : css.introCollapsed}>
          <div className={css.introCopy}>
            <h1 className={isComposing ? css.heading : css.srOnly}>{t('intro.heading')}</h1>
            {isComposing && !isLimited && <p className={css.lede}>{t('intro.lede')}</p>}
            {isComposing && opening}
          </div>
          {isComposing && <SampleSketch />}
        </div>
      )}
      {isCompact && isComposing && opening}

      {!isComposing && (
        <div ref={resultRef} className={css.resultWrap}>
          <div className={css.recap}>
            <div className={css.recapText}>
              <span className={css.recapLabel}>{t('composer.yourIdea')}</span>
              <p className={css.recapIdea}>{state.idea}</p>
            </div>
            {state.status === 'done' && !isLimited && (
              <button type='button' className={css.ghostButton} onClick={editIdea}>
                {t('composer.edit')}
              </button>
            )}
          </div>
          <BriefResult
            state={state}
            locale={locale}
            isCompact={isCompact}
            nextFreeAt={state.nextFreeAt}
            fullPlanHref={isCompact ? `/${locale}/ai-estimate` : null}
            onTalk={talk}
            onNewIdea={newIdea}
          />
        </div>
      )}
    </div>
  );
}
