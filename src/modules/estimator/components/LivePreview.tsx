'use client';

import CurrencySwitcher, { type CurrencyCode } from './CurrencySwitcher';
import type { EstimateResult, EstimatorInput } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';

type Props = {
  estimate: EstimateResult;
  input: EstimatorInput;
  format: (amountUsd: number) => string;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-ember-muted'>{label}</span>
      <span className='font-semibold text-ember-text text-right'>{value}</span>
    </div>
  );
}

/**
 * Sticky right-column panel showing the live formula estimate (updates as the
 * user changes inputs) plus a compact summary and the currency switcher.
 */
export default function LivePreview({ estimate, input, format, currency, setCurrency }: Props) {
  const t = useTranslations('estimator');

  const dev = estimate.developmentCost;
  const low = Math.round((dev * 0.9) / 100) * 100;
  const high = Math.round((dev * 1.15) / 100) * 100;

  // Explicit label maps (next-intl rejects dynamic template-literal keys).
  const typeLabel: string = {
    mobile: t('service.mobile'),
    web: t('service.web'),
    telegram: t('service.telegram'),
    ai: t('service.ai'),
    desktop: t('service.desktop'),
    other: t('service.other'),
  }[input.projectType];

  const complexityLabel: string = {
    mvp: t('complexity.mvp'),
    standard: t('complexity.standard'),
    enterprise: t('complexity.enterprise'),
  }[input.complexity];

  return (
    <aside className='rounded-3xl border border-ember-border bg-ember-surface p-6 lg:sticky lg:top-28'>
      <div className='uppercase tracking-[0.16em] text-[11px] font-bold text-ember-accent mb-4'>{t('liveEstimate')}</div>

      <div className='font-display text-[38px] font-extrabold text-ember-accent leading-none mb-1'>{format(dev)}</div>
      <div className='text-ember-muted text-[13px] mb-6'>
        {format(low)} – {format(high)} · {estimate.deadlineWeeks} {t('weeks')}
      </div>

      <div className='flex flex-col gap-3 text-sm'>
        <Row label={t('summaryType')} value={typeLabel} />
        <Row label={t('summaryComplexity')} value={complexityLabel} />
        <Row label={t('summaryScreens')} value={String(input.pages)} />
        <Row label={t('summaryFeatures')} value={String(input.features.length)} />
      </div>

      <div className='mt-6 pt-5 border-t border-ember-border'>
        <CurrencySwitcher currency={currency} onCurrencyChange={setCurrency} />
      </div>

      <p className='mt-4 text-xs text-ember-muted leading-relaxed'>{t('indicativeNote')}</p>
    </aside>
  );
}
