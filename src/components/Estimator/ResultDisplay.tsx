'use client';

import Button from '@/components/Button';
import CurrencySwitcher, { useCurrency, type CurrencyCode } from './CurrencySwitcher';
import type { EstimateResult } from '@/types/estimator';
import { useTranslations } from 'next-intl';

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
  const { currency, setCurrency, format } = useCurrency();

  const formatCost = (value: number | undefined): string => {
    if (value === undefined) return format(0);

    return format(value);
  };

  return (
    <div className='mt-10 border-t pt-6'>
      <div className='flex flex-wrap items-center justify-between gap-4 mb-4'>
        <h2 className='text-xl font-semibold'>
          {source === 'ai' ? `🤖 ${t('aiEstimate')}` : source === 'formula' ? `🔢 ${t('formulaEstimate')}` : `⚡ ${t('livePreview')}`}
        </h2>
        <CurrencySwitcher currency={currency} onCurrencyChange={(c: CurrencyCode) => setCurrency(c)} />
      </div>

      {loading ? (
        <div className='flex flex-col items-center py-8'>
          <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4'></div>
          <p>{t('calculating')}</p>
        </div>
      ) : (
        <div>
          {error && (
            <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4'>
              <p className='text-yellow-700 text-sm'>{error}</p>
            </div>
          )}

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-4'>
            <div className='p-4 border rounded-lg hover:shadow-sm transition-shadow'>
              <p className='text-sm text-gray-500'>{t('devCost')}</p>
              <p className='text-2xl font-bold'>{formatCost(result?.developmentCost)}</p>
            </div>

            <div className='p-4 border rounded-lg hover:shadow-sm transition-shadow'>
              <p className='text-sm text-gray-500'>{t('timeframe')}</p>
              <p className='text-2xl font-bold'>
                {result?.deadlineWeeks ?? 0} {t('weeks')}
              </p>
            </div>

            <div className='p-4 border rounded-lg hover:shadow-sm transition-shadow'>
              <p className='text-sm text-gray-500'>{t('supportCost')}</p>
              <p className='text-2xl font-bold'>{formatCost(result?.supportCost)}</p>
            </div>
          </div>

          {source === 'ai' && aiReasoning && (
            <div className='mt-6 p-4 bg-gray-50 rounded-lg border'>
              <h3 className='font-medium mb-2'>AI Analysis</h3>
              <p className='text-gray-700'>{aiReasoning}</p>
            </div>
          )}

          <div className='mt-6 flex flex-wrap gap-3'>
            <Button onClick={onReset}>{t('startOver')}</Button>
            <Button className='bg-green-600' onClick={() => window.location.assign('#contact')}>
              {t('contactUs')}
            </Button>
            {source === 'ai' && (
              <Button className='bg-gray-700'>
                <span className='flex items-center'>
                  <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4 mr-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                    />
                  </svg>
                  {t('exportPdf')}
                </span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
