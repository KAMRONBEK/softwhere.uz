'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { PART_IDS, type PartId } from './data';
import { useRagDemo } from './context';
import { activePart, partProgress } from './machine';
import css from './steps.module.css';

/**
 * The pipeline across the top of the stage: Read → Index → Answer → Guard →
 * Insights, each with a rail that fills as the demo gets there, and the
 * current step's one-line explanation under it. A tap or click jumps the
 * demo to that step. Phones show the numbers in the rail and the current
 * step's name in the caption.
 */
export default function Steps({ onJump }: { onJump: (part: PartId) => void }) {
  const t = useTranslations('home.rag-build');
  const { state } = useRagDemo();
  const part = activePart(state);
  const shown = part ?? PART_IDS[0];
  const shownIndex = PART_IDS.indexOf(shown);

  return (
    <div className={css.steps} data-idle={part ? undefined : 'true'}>
      <ol className={css.list} aria-label={t('stepsLabel')}>
        {PART_IDS.map((id, index) => (
          <li key={id} className={css.item}>
            <button
              type='button'
              className={css.step}
              aria-current={part === id ? 'step' : undefined}
              aria-label={t('stepAction', { term: t(`steps.${id}.term`), text: t(`steps.${id}.text`) })}
              onClick={() => onJump(id)}
              data-cursor={t('cursor.show')}
            >
              <span className={css.track} aria-hidden='true'>
                <span className={css.fill} style={{ '--p': partProgress(state, id) } as CSSProperties} />
              </span>
              <span className={css.num}>{String(index + 1).padStart(2, '0')}</span>
              <span className={css.term}>{t(`steps.${id}.term`)}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className={css.caption} aria-hidden='true'>
        <span key={shown} className={css.captionInner}>
          <b className={css.captionTerm}>
            <span className={css.captionNum}>{String(shownIndex + 1).padStart(2, '0')}</span>
            {t(`steps.${shown}.term`)}
          </b>
          {t(`steps.${shown}.text`)}
        </span>
      </p>
    </div>
  );
}
