'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { PART_IDS, type PartId } from './data';
import { useRagDemo } from './context';
import { SCENES, SCENE_PART, activePart, partProgress, type SceneId } from './machine';
import css from './steps.module.css';

interface StepsProps {
  onJump: (part: PartId) => void;
  /** The scene the scroll picked (null without the scroll story: the demo's own part shows). */
  scene: SceneId | null;
  /** Still version: the step the visitor picked, while the demo shows it (null: the demo's own part). */
  picked?: PartId | null;
}

/**
 * The pipeline across the top of the stage: Read → Index → Answer → Guard →
 * Insights, each with a rail that fills as the demo gets there, and under it
 * a caption that says what is happening right now (one line per scroll
 * scene, so the guard part explains the lock and then the "I don't know").
 * The current step is the one the scroll picked; a tap or click on a step
 * glides the scroll there. Phones show the numbers in the rail and the
 * current step's name in the caption.
 */
export default function Steps({ onJump, scene, picked = null }: StepsProps) {
  const t = useTranslations('home.rag-build');
  const { state } = useRagDemo();
  const part = scene ? SCENE_PART[scene] : (picked ?? activePart(state));
  const shown = part ?? PART_IDS[0];
  const shownIndex = PART_IDS.indexOf(shown);

  return (
    <div className={css.steps} data-idle={part ? undefined : 'true'} data-scroll={scene ? 'true' : undefined}>
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
      <p className={css.caption} aria-live='polite'>
        {scene ? (
          // The scroll story: every scene's line in one cell, so the tallest sets the height and
          // the map below never moves when the scene changes (only the current one shows).
          SCENES.map(id => {
            const isCurrent = id === scene;
            const part = SCENE_PART[id];
            return (
              <span
                key={id}
                className={css.captionInner}
                data-current={isCurrent ? '' : undefined}
                aria-hidden={isCurrent ? undefined : true}
              >
                <b className={css.captionTerm}>
                  <span className={css.captionNum}>{String(PART_IDS.indexOf(part) + 1).padStart(2, '0')}</span>
                  {t(`steps.${part}.term`)}
                </b>
                {t(`scenes.${id}`)}
              </span>
            );
          })
        ) : (
          <span key={shown} className={css.captionInner}>
            <b className={css.captionTerm}>
              <span className={css.captionNum}>{String(shownIndex + 1).padStart(2, '0')}</span>
              {t(`steps.${shown}.term`)}
            </b>
            {t(`steps.${shown}.text`)}
          </span>
        )}
      </p>
    </div>
  );
}
