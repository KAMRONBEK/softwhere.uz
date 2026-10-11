'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { question, type Outcome } from './data';
import css from './chat.module.css';
import { useRagDemo } from './context';
import { AskIcon, CheckIcon, LockIcon } from './icons';
import { outcomeOf, turns } from './machine';

const OUTCOME_ICON: Record<Outcome, typeof CheckIcon> = {
  answered: CheckIcon,
  blocked: LockIcon,
  missing: AskIcon,
};

/**
 * What a team lead sees: every question asked in this demo, how it ended,
 * and the gap the "not found" question exposed. Honest about scope: it
 * counts this visitor's questions only, and says what the live version adds.
 */
export default function Insights() {
  const t = useTranslations('home.rag-build');
  const { state } = useRagDemo();
  const asked = turns(state).filter(turn => turn.status === 'done');
  const count = (outcome: Outcome) => asked.filter(turn => outcomeOf(turn) === outcome).length;
  const stats = [
    { id: 'asked', label: t('insights.stats.asked'), value: asked.length },
    { id: 'answered', label: t('insights.stats.answered'), value: count('answered') },
    { id: 'blocked', label: t('insights.stats.blocked'), value: count('blocked') },
    { id: 'missing', label: t('insights.stats.missing'), value: count('missing') },
  ];
  const hasGap = asked.some(turn => outcomeOf(turn) === 'missing');

  return (
    <div className={css.insights}>
      <p className={css.insightsHead}>
        <span className={css.insightsTitle}>{t('insights.title')}</span>
        <span className={css.insightsTag}>{t('insights.tag')}</span>
      </p>
      <dl className={css.stats}>
        {stats.map((stat, index) => (
          <div key={stat.id} className={css.stat} data-stat={stat.id} style={{ '--k': index } as CSSProperties}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
      {asked.length === 0 ? (
        <p className={css.insightsEmpty}>{t('insights.empty')}</p>
      ) : (
        <ol className={css.asked}>
          {asked.map((turn, index) => {
            const outcome = outcomeOf(turn);
            const Icon = OUTCOME_ICON[outcome];
            const def = question(turn.question);
            const reply = def.reply(turn.role);
            return (
              <li key={turn.key} className={css.askedRow} data-outcome={outcome} style={{ '--k': index } as CSSProperties}>
                <span className={css.askedIcon} aria-hidden='true'>
                  <Icon />
                </span>
                <span className={css.askedText}>{t(`questions.${turn.question}.text`)}</span>
                <span className={css.askedMeta}>
                  {t(`clusters.${def.topic}`)} · {t(`insights.outcome.${outcome}`, { count: reply.sources.length })}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {hasGap && (
        <div className={css.gapCard}>
          <p className={css.gapTitle}>{t('insights.gapTitle')}</p>
          <p className={css.gapText}>{t('insights.gap')}</p>
        </div>
      )}
      <p className={css.footnote}>{t('insights.footnote')}</p>
    </div>
  );
}
