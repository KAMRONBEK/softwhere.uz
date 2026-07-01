'use client';

import Button from '@/shared/components/Button';
import type { EstimateResult } from '@/modules/estimator/types';
import { useLocale, useTranslations } from 'next-intl';

type ResultDisplayProps = {
  result: EstimateResult | null;
  source: 'ai' | 'formula' | null;
  loading: boolean;
  error: string;
  aiReasoning?: string;
  onReset: () => void;
  format: (amountUsd: number) => string;
};

/**
 * Final "Estimate" step body. Currency formatting is injected via `format`
 * (owned by the Wizard) so the live-preview panel and this view stay in sync.
 */
export default function ResultDisplay({ result, source, loading, error, aiReasoning, onReset, format }: ResultDisplayProps) {
  const t = useTranslations('estimator');
  const locale = useLocale();
  const formatCost = (value: number | undefined): string => format(value ?? 0);

  if (loading) {
    return (
      <div className='flex flex-col items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ember-accent mb-4' />
        <p className='text-ember-muted'>{t('calculating')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className='inline-flex items-center gap-2 bg-[rgba(255,91,30,0.14)] text-ember-accent text-xs font-bold px-3.5 py-1.5 rounded-full mb-4'>
        ✳ {source === 'ai' ? t('aiEstimate') : t('formulaEstimate')}
      </div>
      <h2 className='text-2xl font-bold font-display text-ember-text mb-6'>{t('resultHeading')}</h2>

      {error && (
        <div className='bg-[rgba(255,91,30,0.08)] border border-ember-border rounded-xl p-3.5 mb-4'>
          <p className='text-ember-muted text-sm'>{error}</p>
        </div>
      )}

      <div className='grid grid-cols-1 gap-3.5'>
        <div className='rounded-2xl border border-ember-accent p-6 bg-[linear-gradient(150deg,rgba(255,91,30,0.12),var(--surface))]'>
          <div className='text-ember-muted text-sm font-semibold mb-1.5'>{t('devCost')}</div>
          <div className='font-display text-[44px] font-extrabold text-ember-accent leading-none'>
            {formatCost(result?.developmentCost)}
          </div>
        </div>

        <div className='grid grid-cols-2 gap-3.5'>
          <div className='rounded-2xl border border-ember-border p-5 bg-ember-surface'>
            <div className='text-ember-muted text-sm font-semibold mb-1.5'>{t('timeframe')}</div>
            <div className='font-display text-3xl font-extrabold text-ember-text'>
              {result?.deadlineWeeks ?? 0} <span className='text-base text-ember-muted font-semibold'>{t('weeks')}</span>
            </div>
          </div>
          <div className='rounded-2xl border border-ember-border p-5 bg-ember-surface'>
            <div className='text-ember-muted text-sm font-semibold mb-1.5'>{t('supportCost')}</div>
            <div className='font-display text-3xl font-extrabold text-ember-text'>{formatCost(result?.supportCost)}</div>
          </div>
        </div>
      </div>

      {source === 'ai' && aiReasoning && (
        <div className='mt-5 rounded-2xl border border-ember-border bg-ember-surface p-5'>
          <h3 className='font-medium mb-2 font-display text-ember-text'>{t('aiAnalysis')}</h3>
          <p className='text-ember-text text-sm leading-relaxed'>{aiReasoning}</p>
        </div>
      )}

      <div className='mt-6 flex flex-wrap gap-3'>
        <Button
          className='flex-1 !bg-ember-accent !text-[#0a0705] font-bold !rounded-full hover:shadow-[0_0_28px_var(--glow)]'
          onClick={() => window.location.assign(`/${locale}/#contact`)}
        >
          {t('bookCall')}
        </Button>
        <Button className='!bg-transparent !border !border-ember-border !text-ember-text !rounded-full' onClick={onReset}>
          {t('startOver')}
        </Button>
      </div>
    </div>
  );
}
