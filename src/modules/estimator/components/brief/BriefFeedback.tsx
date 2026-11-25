'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { IS_PLAN_LAUNCHED } from '@/modules/estimator/ai-brief/priceMode';
import type { BriefRunState } from './briefState';
import css from './brief.module.css';

/** Past this many minutes (the daily attempt cap, not the burst limit) the wait is "later", not a count. */
const RATE_LIMIT_MINUTES_SHOWN = 60;

type BriefFeedbackProps = {
  state: BriefRunState;
  onRetry: () => void;
  /** The contact form with the idea: the way forward that needs no AI (outside 'range' mode). */
  onTalk: () => void;
};

/**
 * The callout above the composer when a brief did not come back: a request to
 * say more, a calm policy decline, or a failure with a way forward. The idea
 * stays in the field in every case.
 */
export default function BriefFeedback({ state, onRetry, onTalk }: BriefFeedbackProps) {
  const t = useTranslations('aiBrief.errors');
  const tRequest = useTranslations('aiBrief.request');
  const locale = useLocale();
  const isRequest = IS_PLAN_LAUNCHED;
  const estimatorLink = isRequest ? (
    <button type='button' className={css.secondaryButton} onClick={onTalk}>
      {tRequest('sendIdea')}
    </button>
  ) : (
    <Link href={`/${locale}/estimator`} className={css.textLink}>
      {t('estimator')}
    </Link>
  );

  if (state.status === 'rejected' && state.rejection) {
    return (
      <div className={`${css.callout} ${css.calloutInfo}`} role='alert'>
        <p>{t(state.rejection)}</p>
      </div>
    );
  }

  if (state.status === 'declined' && state.declined) {
    return (
      <div className={`${css.callout} ${css.calloutInfo}`} role='alert'>
        <p className={css.calloutTitle}>{t('declinedTitle')}</p>
        {state.declined.note && <p>{state.declined.note}</p>}
        <p>{t('declinedBody')}</p>
      </div>
    );
  }

  if (state.status !== 'error' || !state.failure) return null;
  const { failure } = state;

  // Today's free brief is used: the page shows its own calm card (`DailyLimit`), not an error.
  if (failure.code === 'daily_limit') return null;

  if (failure.code === 'rate_limited') {
    const minutes = Math.max(1, Math.ceil(failure.retryAfterSec / 60));
    return (
      <div className={`${css.callout} ${css.calloutWarn}`} role='alert'>
        <p>
          {minutes > RATE_LIMIT_MINUTES_SHOWN ? (isRequest ? tRequest('later') : t('rate_limited_later')) : t('rate_limited', { minutes })}
        </p>
        <div className={css.calloutActions}>{estimatorLink}</div>
      </div>
    );
  }

  if (failure.code === 'busy') {
    return (
      <div className={`${css.callout} ${css.calloutWarn}`} role='alert'>
        <p>{isRequest ? tRequest('busy') : t('busy')}</p>
        <div className={css.calloutActions}>{estimatorLink}</div>
      </div>
    );
  }

  const message = failure.code === 'network' ? t('network') : failure.code === 'too_long' ? null : t('failed');
  if (!message) return null;
  return (
    <div className={`${css.callout} ${css.calloutWarn}`} role='alert'>
      <p>{message}</p>
      <div className={css.calloutActions}>
        <button type='button' className={css.secondaryButton} onClick={onRetry}>
          {t('retry')}
        </button>
        {estimatorLink}
      </div>
    </div>
  );
}
