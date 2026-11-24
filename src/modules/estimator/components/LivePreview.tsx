'use client';

import type { EstimateResult, EstimatorInput } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import CurrencySwitcher, { type CurrencyCode } from './CurrencySwitcher';
import { PriceRange, RangeScale } from './ui';
import css from './Wizard.module.css';

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
    <div className={css.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
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
    <aside data-testid='live-preview' className={css.preview}>
      <p className={css.eyebrow}>{t('liveEstimate')}</p>

      <PriceRange testId='live-range' min={format(estimate.cost.min)} max={format(estimate.cost.max)} />
      <RangeScale min={estimate.cost.min} max={estimate.cost.max} />
      <p className={css.meta}>
        {t('weeksRange', { min: estimate.weeks.min, max: estimate.weeks.max })} · ≈{estimate.hours.min}–{estimate.hours.max}{' '}
        {t('hoursShort')}
      </p>

      <dl className={css.summary}>
        <Row label={t('summaryType')} value={tx(`subtype.${input.subtype}`)} />
        <Row label={t('summaryTier')} value={tx(`tier.${input.tier}`)} />
        {input.screens > 0 && <Row label={t('summaryScreens')} value={String(input.screens)} />}
        <Row label={t('summaryFeatures')} value={String(input.features.length)} />
        <Row label={t('summaryIntegrations')} value={String(input.integrations.length)} />
      </dl>

      <div className={css.currency}>
        <p>{t('currencyLabel')}</p>
        <CurrencySwitcher currency={currency} available={available} onCurrencyChange={setCurrency} />
      </div>

      <p className={css.indicative}>{t('indicativeNote')}</p>
    </aside>
  );
}
