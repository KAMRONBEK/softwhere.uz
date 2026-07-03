'use client';

import type { AiRefinement, EstimateResult, EstimatorInput } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import CurrencySwitcher, { type CurrencyCode } from './CurrencySwitcher';
import LeadForm from './LeadForm';

export type AiState = { status: 'loading' } | { status: 'ready'; ai: AiRefinement } | { status: 'unavailable' };

type Props = {
  input: EstimatorInput;
  estimate: EstimateResult;
  aiState: AiState;
  format: (amountUsd: number) => string;
  currency: CurrencyCode;
  available: CurrencyCode[];
  setCurrency: (c: CurrencyCode) => void;
  onReset: () => void;
};

const INCLUDED = ['design', 'development', 'qa', 'pm', 'deploy', 'warranty'] as const;
const EXCLUDED = ['hosting', 'stores', 'thirdparty', 'content'] as const;
const TERMS = ['prepay', 'milestones', 'warranty'] as const;

function ConfidenceBadge({ level }: { level: AiRefinement['confidence'] }) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  return (
    <span className='text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[rgba(255,91,30,0.14)] text-ember-accent'>
      {tx(`aiConfidence.${level}`)}
    </span>
  );
}

export default function ResultPanel({ input, estimate, aiState, format, currency, available, setCurrency, onReset }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className='space-y-5'>
      <div>
        <div className='inline-flex items-center gap-2 bg-[rgba(255,91,30,0.14)] text-ember-accent text-xs font-bold px-3.5 py-1.5 rounded-full mb-4'>
          ✳ {t('resultBadge')}
        </div>
        <h2 className='text-2xl font-bold font-display text-ember-text'>{t('resultHeading')}</h2>
        <p className='text-sm text-ember-muted mt-1'>{t('resultSub')}</p>
      </div>

      {/* Hero range */}
      <div className='rounded-2xl border border-ember-accent p-6 bg-[linear-gradient(150deg,rgba(255,91,30,0.12),var(--surface))]'>
        <div className='text-ember-muted text-sm font-semibold mb-1.5'>{t('estimateRange')}</div>
        <div className='font-display text-[34px] sm:text-[42px] font-extrabold text-ember-accent leading-none'>
          {format(estimate.cost.min)} – {format(estimate.cost.max)}
        </div>
        <div className='text-ember-muted text-sm mt-3'>
          ≈ {estimate.hours.min}–{estimate.hours.max} {t('hoursShort')} · {t('rateBasis', { rate: estimate.rate })}
        </div>
        {/* The desktop sidebar owns the switcher; on mobile this is the only one. */}
        <div className='lg:hidden mt-4 pt-4 border-t border-ember-border'>
          <CurrencySwitcher currency={currency} available={available} onCurrencyChange={setCurrency} />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3.5'>
        <div className='rounded-2xl border border-ember-border p-5 bg-ember-surface'>
          <div className='text-ember-muted text-sm font-semibold mb-1.5'>{t('timeframe')}</div>
          <div className='font-display text-2xl sm:text-3xl font-extrabold text-ember-text'>
            {t('weeksRange', { min: estimate.weeks.min, max: estimate.weeks.max })}
          </div>
        </div>
        <div className='rounded-2xl border border-ember-border p-5 bg-ember-surface'>
          <div className='text-ember-muted text-sm font-semibold mb-1.5'>{t('supportCost')}</div>
          <div className='font-display text-2xl sm:text-3xl font-extrabold text-ember-text'>
            {format(estimate.supportMonthly)}
            <span className='text-base text-ember-muted font-semibold'>{t('perMonth')}</span>
          </div>
        </div>
      </div>

      {/* Suggested team */}
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <span className='text-ember-muted font-semibold'>{t('teamTitle')}:</span>
        {estimate.team.map(role => (
          <span
            key={role}
            className='px-2.5 py-1 rounded-full bg-ember-surface border border-ember-border text-ember-text text-xs font-semibold'
          >
            {tx(role)}
          </span>
        ))}
      </div>

      {/* AI refinement */}
      {aiState.status !== 'unavailable' && (
        <div className='rounded-2xl border border-ember-border bg-ember-surface p-5'>
          <div className='flex items-center justify-between gap-3 mb-3'>
            <h3 className='font-display font-bold text-ember-text flex items-center gap-2'>🤖 {t('aiTitle')}</h3>
            {aiState.status === 'ready' && <ConfidenceBadge level={aiState.ai.confidence} />}
          </div>

          {aiState.status === 'loading' ? (
            <div className='flex items-center gap-3 py-2'>
              <div className='animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-ember-accent' />
              <p className='text-sm text-ember-muted'>{t('aiLoading')}</p>
            </div>
          ) : (
            <div className='space-y-3'>
              <div className='font-display text-xl font-extrabold text-ember-text'>
                {format(aiState.ai.cost.min)} – {format(aiState.ai.cost.max)}
                <span className='text-sm text-ember-muted font-semibold ml-2'>
                  · {t('weeksRange', { min: aiState.ai.weeks.min, max: aiState.ai.weeks.max })}
                </span>
              </div>
              <p className='text-sm text-ember-text leading-relaxed'>{aiState.ai.summary}</p>
              {aiState.ai.risks.length > 0 && (
                <div>
                  <div className='text-xs font-bold uppercase tracking-wide text-ember-muted mb-1'>{t('aiRisks')}</div>
                  <ul className='space-y-1'>
                    {aiState.ai.risks.map((risk, i) => (
                      <li key={i} className='text-sm text-ember-text leading-relaxed flex gap-2'>
                        <span aria-hidden>⚠️</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {aiState.ai.suggestions.length > 0 && (
                <div>
                  <div className='text-xs font-bold uppercase tracking-wide text-ember-muted mb-1'>{t('aiSuggestions')}</div>
                  <ul className='space-y-1'>
                    {aiState.ai.suggestions.map((suggestion, i) => (
                      <li key={i} className='text-sm text-ember-text leading-relaxed flex gap-2'>
                        <span aria-hidden>💡</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* How we calculated */}
      <div className='rounded-2xl border border-ember-border bg-ember-surface overflow-hidden'>
        <button
          type='button'
          onClick={() => setShowBreakdown(v => !v)}
          aria-expanded={showBreakdown}
          className='w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer'
        >
          <span className='font-display font-bold text-ember-text'>{t('breakdownTitle')}</span>
          <span className={`text-ember-muted transition-transform ${showBreakdown ? 'rotate-180' : ''}`} aria-hidden>
            ▾
          </span>
        </button>
        {showBreakdown && (
          <div className='px-5 pb-5 space-y-1.5 text-sm'>
            {estimate.breakdown.map(line => (
              <div key={line.id} className='flex items-center justify-between gap-3'>
                <span className='text-ember-muted'>{tx(line.labelKey)}</span>
                <span className='font-semibold text-ember-text whitespace-nowrap'>
                  {line.hours} {t('hoursShort')}
                </span>
              </div>
            ))}
            <div className='flex items-center justify-between gap-3 pt-2 mt-2 border-t border-ember-border'>
              <span className='text-ember-muted'>{t('breakdownMultiplier')}</span>
              <span className='font-semibold text-ember-text'>×{estimate.multiplier}</span>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-ember-muted'>{t('breakdownRate')}</span>
              <span className='font-semibold text-ember-text'>${estimate.rate}/h</span>
            </div>
            <p className='text-xs text-ember-muted pt-2 leading-relaxed'>{t('breakdownNote')}</p>
          </div>
        )}
      </div>

      {/* Included / excluded / terms */}
      <div className='grid sm:grid-cols-3 gap-3.5 text-sm'>
        <div className='rounded-2xl border border-ember-border bg-ember-surface p-4'>
          <div className='font-bold text-ember-text mb-2'>{t('includedTitle')}</div>
          <ul className='space-y-1.5'>
            {INCLUDED.map(key => (
              <li key={key} className='text-ember-muted flex gap-2 text-[13px] leading-snug'>
                <span className='text-ember-accent' aria-hidden>
                  ✓
                </span>
                {tx(`included.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className='rounded-2xl border border-ember-border bg-ember-surface p-4'>
          <div className='font-bold text-ember-text mb-2'>{t('excludedTitle')}</div>
          <ul className='space-y-1.5'>
            {EXCLUDED.map(key => (
              <li key={key} className='text-ember-muted flex gap-2 text-[13px] leading-snug'>
                <span aria-hidden>—</span>
                {tx(`excluded.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className='rounded-2xl border border-ember-border bg-ember-surface p-4'>
          <div className='font-bold text-ember-text mb-2'>{t('termsTitle')}</div>
          <ul className='space-y-1.5'>
            {TERMS.map(key => (
              <li key={key} className='text-ember-muted flex gap-2 text-[13px] leading-snug'>
                <span aria-hidden>·</span>
                {tx(`terms.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Lead capture — AFTER the fully-visible result, never gating it */}
      <LeadForm input={input} ai={aiState.status === 'ready' ? aiState.ai : null} />

      <div className='flex justify-center'>
        <button
          type='button'
          onClick={onReset}
          className='text-sm text-ember-muted hover:text-ember-text transition-colors underline underline-offset-4 cursor-pointer'
        >
          {t('startOver')}
        </button>
      </div>
    </div>
  );
}
