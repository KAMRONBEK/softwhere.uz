'use client';

import { useTranslations } from 'next-intl';
import { useId, useEffect, useState, type CSSProperties } from 'react';
import { BRIEF_STEPS, stepStates, type BriefRunState, type StepState } from './briefState';
import css from './brief.module.css';

const TICK_MS = 250;

function StepDot({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span className={`${css.stepDot} ${css.stepDotDone}`} aria-hidden>
        <svg viewBox='0 0 12 12'>
          <path
            d='M2.5 6.2l2.3 2.3 4.7-5'
            fill='none'
            stroke='currentColor'
            strokeWidth='1.8'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </span>
    );
  }
  return <span className={`${css.stepDot} ${state === 'active' ? css.stepDotActive : ''}`} aria-hidden />;
}

/**
 * Live pipeline steps. Each step completes only when the server reports the
 * matching milestone (screens and plan are written in parallel), so the
 * track never claims progress that has not happened.
 */
export default function ProgressTrack({ state }: { state: BriefRunState }) {
  const t = useTranslations('aiBrief.progress');
  const headingId = useId();
  const [now, setNow] = useState(() => Date.now());
  const isRunning = state.status === 'running';

  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [isRunning]);

  const steps = stepStates(state, isRunning ? now : Number.MAX_SAFE_INTEGER);
  const seconds = Math.max(
    0,
    Math.round(((isRunning ? now : (state.startedAt ?? 0) + (state.elapsedMs ?? 0)) - (state.startedAt ?? now)) / 1000)
  );
  const active = BRIEF_STEPS.filter(step => steps[step] === 'active').map(step => t(`steps.${step}`));
  const doneCount = BRIEF_STEPS.filter(step => steps[step] === 'done' || steps[step] === 'skipped').length;

  return (
    <section className={css.progress} aria-labelledby={headingId}>
      <div className={css.progressHead}>
        <h2 id={headingId} className={css.progressTitle}>
          <span className={css.liveDot} aria-hidden />
          {t('heading')}
        </h2>
        <span className={css.elapsed}>{t('elapsed', { seconds })}</span>
      </div>
      <ol className={css.steps} style={{ '--done': doneCount } as CSSProperties}>
        {BRIEF_STEPS.map(step => (
          <li key={step} className={`${css.step} ${css[`step_${steps[step]}`]}`}>
            <StepDot state={steps[step]} />
            <span className={css.stepLabel}>{t(`steps.${step}`)}</span>
          </li>
        ))}
      </ol>
      <p className={css.progressNote}>{t('typical')}</p>
      <p className={css.srOnly} aria-live='polite'>
        {active.join('. ')}
      </p>
    </section>
  );
}
