'use client';

import type { AiRefinement, EstimateResult, EstimatorInput } from '@/modules/estimator/types';
import { Arrow, buttonClass } from '@/shared/components/site';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import CurrencySwitcher, { type CurrencyCode } from './CurrencySwitcher';
import LeadForm from './LeadForm';
import css from './ResultPanel.module.css';
import { PriceRange, RangeScale } from './ui';

export type AiState = { status: 'loading' } | { status: 'ready'; ai: AiRefinement } | { status: 'unavailable' };

type Props = {
  input: EstimatorInput;
  estimate: EstimateResult;
  aiState: AiState;
  format: (amountUsd: number) => string;
  currency: CurrencyCode;
  available: CurrencyCode[];
  setCurrency: (c: CurrencyCode) => void;
  onBack: () => void;
  onReset: () => void;
};

const INCLUDED = ['design', 'development', 'qa', 'pm', 'deploy', 'warranty'] as const;
const EXCLUDED = ['hosting', 'stores', 'thirdparty', 'content'] as const;
const TERMS = ['prepay', 'milestones', 'warranty'] as const;

function ConfidenceBadge({ level }: { level: AiRefinement['confidence'] }) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  return <span className={css.small}>{tx(`aiConfidence.${level}`)}</span>;
}

export default function ResultPanel({ input, estimate, aiState, format, currency, available, setCurrency, onBack, onReset }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className={css.result}>
      <div>
        <p className={css.badge}>{t('resultBadge')}</p>
        <h2 className={css.heading}>{t('resultHeading')}</h2>
        <p className={css.sub}>{t('resultSub')}</p>
      </div>

      <div className={`${css.panel} ${css.raised}`}>
        <div className={css.priceLabel}>{t('estimateRange')}</div>
        <PriceRange testId='result-range' min={format(estimate.cost.min)} max={format(estimate.cost.max)} />
        <RangeScale min={estimate.cost.min} max={estimate.cost.max} />
        <div className={css.basis}>
          {/* The rate follows the selected currency: "$14/hour" under a UZS total
              is two currencies in one sentence. */}
          ≈ {estimate.hours.min}–{estimate.hours.max} {t('hoursShort')} · {t('rateBasis', { rate: format(estimate.rate) })}
        </div>
        {/* The desktop sidebar owns the switcher — and it only exists from `xl`,
            so this one has to cover everything below that, not below `lg`. */}
        <div className={css.currency}>
          <CurrencySwitcher currency={currency} available={available} onCurrencyChange={setCurrency} />
        </div>

        <div className={css.figures}>
          <div>
            <p className={css.muted}>{t('timeframe')}</p>
            <div data-testid='result-weeks' className={css.figure}>
              {t('weeksRange', { min: estimate.weeks.min, max: estimate.weeks.max })}
            </div>
          </div>
          <div>
            <p className={css.muted}>{t('supportCost')}</p>
            <div className={css.figure}>
              {format(estimate.supportMonthly)}
              {t('perMonth')}
            </div>
          </div>
        </div>
      </div>

      {/* Suggested team */}
      <div className={css.team}>
        <span className={css.muted}>{t('teamTitle')}:</span>
        {estimate.team.map(role => (
          <span key={role} className={css.role}>
            {tx(role)}
          </span>
        ))}
      </div>

      {/* AI refinement */}
      {aiState.status !== 'unavailable' && (
        <div data-testid='ai-block' className={css.panel}>
          <div className={css.aiHead}>
            <h3 className={css.title}>{t('aiTitle')}</h3>
            {aiState.status === 'ready' && <ConfidenceBadge level={aiState.ai.confidence} />}
          </div>

          {aiState.status === 'loading' ? (
            <div className={css.loading}>
              <div className={css.spinner} aria-hidden />
              <p className={css.muted}>{t('aiLoading')}</p>
            </div>
          ) : (
            <div className={css.aiBody}>
              <div data-testid='ai-range' className={css.aiRange}>
                {format(aiState.ai.cost.min)} – {format(aiState.ai.cost.max)}
                <span>· {t('weeksRange', { min: aiState.ai.weeks.min, max: aiState.ai.weeks.max })}</span>
              </div>
              <p>{aiState.ai.summary}</p>
              <div className={css.aiLists}>
                {aiState.ai.risks.length > 0 && (
                  <div>
                    <h4 className={css.muted}>{t('aiRisks')}</h4>
                    <ul className={css.list}>
                      {aiState.ai.risks.map((risk, i) => (
                        <li key={i}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiState.ai.suggestions.length > 0 && (
                  <div>
                    <h4 className={css.muted}>{t('aiSuggestions')}</h4>
                    <ul className={css.list}>
                      {aiState.ai.suggestions.map((suggestion, i) => (
                        <li key={i}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* How we calculated */}
      <div className={css.breakdown}>
        <button type='button' onClick={() => setShowBreakdown(v => !v)} aria-expanded={showBreakdown} className={css.toggle}>
          {t('breakdownTitle')}
          <svg viewBox='0 0 16 16' width='18' height='18' fill='none' stroke='currentColor' strokeWidth='1.6' aria-hidden='true'>
            <path d='m3 6 5 5 5-5' strokeLinecap='round' strokeLinejoin='round' />
          </svg>
        </button>
        {showBreakdown && (
          <div className={css.lines}>
            {estimate.breakdown.map(line => (
              <div key={line.id} className={css.line}>
                <span>{tx(line.labelKey)}</span>
                <span>
                  {line.hours} {t('hoursShort')}
                </span>
              </div>
            ))}
            <div className={css.line}>
              <span>{t('breakdownMultiplier')}</span>
              <span>×{estimate.multiplier}</span>
            </div>
            <div className={css.line}>
              <span>{t('breakdownRate')}</span>
              <span>
                {format(estimate.rate)}/{t('hoursShort')}
              </span>
            </div>
            <p className={css.small}>{t('breakdownNote')}</p>
          </div>
        )}
      </div>

      {/* Included / excluded / terms */}
      <div className={css.columns}>
        <div className={css.column}>
          <h3 className={css.title}>{t('includedTitle')}</h3>
          <ul className={css.list} data-mark='check'>
            {INCLUDED.map(key => (
              <li key={key}>{tx(`included.${key}`)}</li>
            ))}
          </ul>
        </div>
        <div className={css.column}>
          <h3 className={css.title}>{t('excludedTitle')}</h3>
          <ul className={css.list}>
            {EXCLUDED.map(key => (
              <li key={key}>{tx(`excluded.${key}`)}</li>
            ))}
          </ul>
        </div>
        <div className={css.column}>
          <h3 className={css.title}>{t('termsTitle')}</h3>
          <ul className={css.list}>
            {TERMS.map(key => (
              <li key={key}>{tx(`terms.${key}`)}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Lead capture — AFTER the fully-visible result, never gating it */}
      <LeadForm input={input} ai={aiState.status === 'ready' ? aiState.ai : null} />

      {/* Below xl there is no step rail, so without this the only way out of the
          result is "Start over" — which throws the whole configuration away. */}
      <div className={css.exit}>
        <button type='button' onClick={onBack} className={buttonClass('secondary', css.back)}>
          <Arrow /> {t('back')}
        </button>
        <button type='button' onClick={onReset} className={css.startOver}>
          {t('startOver')}
        </button>
      </div>
    </div>
  );
}
