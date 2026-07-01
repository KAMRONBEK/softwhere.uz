'use client';

import Button from '@/shared/components/Button';
import CurrencySwitcher, { useCurrency, type CurrencyCode } from './CurrencySwitcher';
import type { EstimateResult } from '@/modules/estimator/types';
import { useLocale, useTranslations } from 'next-intl';

type ResultDisplayProps = {
  result: EstimateResult | null;
  source: 'ai' | 'formula' | null;
  loading: boolean;
  error: string;
  aiReasoning?: string;
  onReset: () => void;
};

export default function ResultDisplay({ result, source, loading, error, aiReasoning, onReset }: ResultDisplayProps) {
  const t = useTranslations('estimator');
  const locale = useLocale();
  const { currency, setCurrency, format } = useCurrency();

  const formatCost = (value: number | undefined): string => {
    if (value === undefined) return format(0);

    return format(value);
  };

  return (
    <div className='mt-10 border-t border-ember-border pt-6'>
      <div className='flex flex-wrap items-center justify-between gap-4 mb-4'>
        <h2 className='text-xl font-semibold font-display text-ember-text'>
          {source === 'ai' ? `🤖 ${t('aiEstimate')}` : source === 'formula' ? `🔢 ${t('formulaEstimate')}` : `⚡ ${t('livePreview')}`}
        </h2>
        <CurrencySwitcher currency={currency} onCurrencyChange={(c: CurrencyCode) => setCurrency(c)} />
      </div>

      {loading ? (
        <div className='flex flex-col items-center py-8'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ember-accent mb-4'></div>
          <p className='text-ember-muted'>{t('calculating')}</p>
        </div>
      ) : (
        <div>
          {error && (
            <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4'>
              <p className='text-yellow-700 text-sm'>{error}</p>
            </div>
          )}

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-4'>
            <div className='glass p-4 rounded-lg hover:shadow-sm transition-shadow'>
              <p className='text-sm text-ember-muted'>{t('devCost')}</p>
              <p className='text-2xl font-bold text-ember-accent font-display'>{formatCost(result?.developmentCost)}</p>
            </div>

            <div className='glass p-4 rounded-lg hover:shadow-sm transition-shadow'>
              <p className='text-sm text-ember-muted'>{t('timeframe')}</p>
              <p className='text-2xl font-bold text-ember-accent font-display'>
                {result?.deadlineWeeks ?? 0} {t('weeks')}
              </p>
            </div>

            <div className='glass p-4 rounded-lg hover:shadow-sm transition-shadow'>
              <p className='text-sm text-ember-muted'>{t('supportCost')}</p>
              <p className='text-2xl font-bold text-ember-accent font-display'>{formatCost(result?.supportCost)}</p>
            </div>
          </div>

          {source === 'ai' && aiReasoning && (
            <div className='glass mt-6 p-4 rounded-lg'>
              <h3 className='font-medium mb-2 font-display text-ember-text'>{t('aiAnalysis')}</h3>
              <p className='text-ember-text'>{aiReasoning}</p>
            </div>
          )}

          <div className='mt-6 flex flex-wrap gap-3'>
            <Button className='!bg-transparent !border !border-ember-border !text-ember-text !rounded-full' onClick={onReset}>
              {t('startOver')}
            </Button>
            <Button
              className='!bg-ember-accent !text-[#0a0705] font-bold !rounded-full hover:shadow-[0_0_28px_var(--glow)]'
              onClick={() => window.location.assign(`/${locale}/#contact`)}
            >
              {t('contactUs')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
