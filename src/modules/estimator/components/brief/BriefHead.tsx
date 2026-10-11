'use client';

import { useTranslations } from 'next-intl';
import type { BriefPreview } from '@/modules/estimator/ai-brief/types';
import css from './brief.module.css';

type BriefHeadProps = {
  preview: BriefPreview | null;
  /** Receives focus when the brief is ready (tabIndex -1). */
  titleId: string;
};

function HeadSkeleton() {
  return (
    <div className={css.head} aria-hidden>
      <span className={`${css.skel} ${css.skelTitle}`} />
      <span className={`${css.skel} ${css.skelTitle} ${css.skelShort}`} />
      <span className={`${css.skel} ${css.skelLine}`} />
      <span className={`${css.skel} ${css.skelLine}`} />
      <span className={`${css.skel} ${css.skelLine} ${css.skelShort}`} />
    </div>
  );
}

/** What the product is: title and one-paragraph summary. */
export default function BriefHead({ preview, titleId }: BriefHeadProps) {
  if (!preview) return <HeadSkeleton />;
  return (
    <div className={`${css.head} ${css.reveal}`}>
      <h2 id={titleId} tabIndex={-1} className={css.title}>
        {preview.title}
      </h2>
      <p className={css.summary}>{preview.summary}</p>
    </div>
  );
}

/** Who it serves and what makes it harder (laid out under the head on desktop, after the price on phones). */
export function BriefContext({ preview }: { preview: BriefPreview | null }) {
  const t = useTranslations('aiBrief');
  const tx = t as unknown as (key: string) => string;
  if (!preview) return null;

  const { audience, complexityFlags, policy } = preview;
  if (audience.length === 0 && complexityFlags.length === 0 && policy.status !== 'ask') return null;
  return (
    <div className={`${css.context} ${css.reveal}`}>
      {audience.length > 0 && (
        <div className={css.headBlock}>
          <h3 className={css.miniHeading}>{t('result.audience')}</h3>
          <ul className={css.audience}>
            {audience.map(item => (
              <li key={item.segment}>
                <span className={css.audienceSegment}>{item.segment}</span>
                <span className={css.audienceNeed}>{item.need}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {complexityFlags.length > 0 && (
        <div className={css.headBlock}>
          <h3 className={css.miniHeading}>{t('result.complexity')}</h3>
          <ul className={css.flags}>
            {complexityFlags.map(flag => (
              <li key={flag} className={css.flag}>
                {tx(`flags.${flag}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {policy.status === 'ask' && policy.note && (
        <p className={css.policyNote}>
          <strong>{t('result.policyAsk')}.</strong> {policy.note}
        </p>
      )}
    </div>
  );
}
