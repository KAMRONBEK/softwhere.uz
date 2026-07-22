'use client';

import type { EstimateResult, EstimatorInput } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import CurrencySwitcher, { type CurrencyCode } from './CurrencySwitcher';

type Props = {
  estimate: EstimateResult;
  input: EstimatorInput;
  format: (amountUsd: number) => string;
  currency: CurrencyCode;
  available: CurrencyCode[];
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
 * Sticky right-column panel with the live formula range — updates on every
 * selection (the single biggest trust factor per calculator UX research).
 */
export default function LivePreview({ estimate, input, format, currency, available, setCurrency }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;

  return (
    <aside className='hidden xl:block rounded-3xl border border-ember-border bg-ember-surface p-6 xl:sticky xl:top-28'>
      <div className='uppercase tracking-[0.16em] text-[11px] font-bold text-ember-accent mb-4'>{t('liveEstimate')}</div>

      <div className='font-display text-[30px] font-extrabold text-ember-accent leading-tight mb-1'>
        {format(estimate.cost.min)} – {format(estimate.cost.max)}
      </div>
      <div className='text-ember-muted text-[13px] mb-6'>
        {t('weeksRange', { min: estimate.weeks.min, max: estimate.weeks.max })} · ≈{estimate.hours.min}–{estimate.hours.max}{' '}
        {t('hoursShort')}
      </div>

      <div className='flex flex-col gap-3 text-sm'>
        <Row label={t('summaryType')} value={tx(`subtype.${input.subtype}`)} />
        <Row label={t('summaryTier')} value={tx(`tier.${input.tier}`)} />
        {input.screens > 0 && <Row label={t('summaryScreens')} value={String(input.screens)} />}
        <Row label={t('summaryFeatures')} value={String(input.features.length)} />
        <Row label={t('summaryIntegrations')} value={String(input.integrations.length)} />
      </div>

      <div className='mt-6 pt-5 border-t border-ember-border'>
        <div className='text-sm text-ember-muted font-display mb-2'>{t('currencyLabel')}</div>
        <CurrencySwitcher currency={currency} available={available} onCurrencyChange={setCurrency} />
      </div>

      <p className='mt-4 text-xs text-ember-muted leading-relaxed'>{t('indicativeNote')}</p>
    </aside>
  );
}
