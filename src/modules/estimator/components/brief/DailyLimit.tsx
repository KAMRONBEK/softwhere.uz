'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useId, useState } from 'react';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { nextFreeDay, timeFormatter } from './format';
import css from './brief.module.css';

type NextFreeLineProps = {
  nextFreeAt: number;
  locale: BriefLocale;
  /** `next`: on the pause card; `usedNote`: under a brief that used today's free one. */
  kind: 'next' | 'usedNote';
  className: string;
};

/**
 * When the next free brief opens — "today after 21:15" or "tomorrow after
 * 21:15" in the visitor's own calendar. Browser-only: `nextFreeAt` exists
 * only after the page has read its storage or the server's answer.
 */
export function NextFreeLine({ nextFreeAt, locale, kind, className }: NextFreeLineProps) {
  const t = useTranslations('aiBrief.limit');
  // Read once: the line is replaced the moment the time passes.
  const [now] = useState(() => Date.now());
  return <p className={className}>{t(kind, { day: nextFreeDay(nextFreeAt, now), time: timeFormatter(locale)(nextFreeAt) })}</p>;
}

type DailyLimitProps = {
  /** When the next free brief opens (epoch ms). */
  nextFreeAt: number;
  locale: BriefLocale;
  /** "Talk to us about your project": the contact form, prefilled with the idea in the field if there is one. */
  onTalk: () => void;
};

/**
 * Today's free brief is used and there is no saved brief to show: a calm,
 * on-brand pause instead of the composer — when the next one opens, and two
 * ways forward that need no AI.
 */
export default function DailyLimit({ nextFreeAt, locale, onTalk }: DailyLimitProps) {
  const t = useTranslations('aiBrief.limit');
  const headingId = useId();

  return (
    <section className={`${css.limit} ${css.reveal}`} aria-labelledby={headingId}>
      <span className={css.limitMark} aria-hidden>
        <svg viewBox='0 0 32 32'>
          <path d='M7 21a9 9 0 0 1 18 0' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
          <path d='M16 6.5v3M7.5 11l2 2M24.5 11l-2 2M4 25.5h24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
        </svg>
      </span>
      <div className={css.limitCopy}>
        <h2 id={headingId} className={css.limitTitle}>
          {t('title')}
        </h2>
        <p className={css.limitBody}>{t('body')}</p>
        <NextFreeLine nextFreeAt={nextFreeAt} locale={locale} kind='next' className={css.limitNext} />
      </div>
      <div className={css.limitActions}>
        <button type='button' className={css.primaryButton} onClick={onTalk}>
          {t('talk')}
        </button>
        <Link href={`/${locale}/estimator`} className={css.secondaryButton}>
          {t('estimator')}
        </Link>
      </div>
    </section>
  );
}
