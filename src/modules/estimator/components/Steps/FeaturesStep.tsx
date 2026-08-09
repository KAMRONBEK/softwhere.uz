'use client';

import { FEATURE_CATEGORIES, featuresFor, getSubtype } from '@/modules/estimator/data/catalog';
import type { EstimatorInput } from '@/modules/estimator/types';
import { marginalCost } from '@/modules/estimator/utils/estimator';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { StepLabel, ToggleChip } from '../ui';

type Props = {
  input: EstimatorInput;
  /** Currency-aware formatter — chips must not quote USD next to a UZS total. */
  format: (amountUsd: number) => string;
  onToggleFeature: (id: string) => void;
};

export default function FeaturesStep({ input, format, onToggleFeature }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const available = featuresFor(input.projectType);
  const popular = new Set(getSubtype(input.projectType, input.subtype).popular);

  // What each chip really costs in the *current* configuration — the tier,
  // design, language and platform multipliers all land on feature hours, so a
  // hint that ignored them was wrong by 25–60% and moved the range by an amount
  // the user could not predict.
  const hints = useMemo(() => {
    const map = new Map<string, string>();
    for (const feature of featuresFor(input.projectType)) {
      map.set(feature.id, `+${format(Math.round(marginalCost(input, 'features', feature.id) / 10) * 10)}`);
    }
    return map;
  }, [input, format]);

  return (
    <div>
      <StepLabel hint={t('featuresHint')}>{t('featuresTitle')}</StepLabel>
      <div className='space-y-5'>
        {FEATURE_CATEGORIES.map(category => {
          const items = available.filter(f => f.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category}>
              <div className='uppercase tracking-[0.14em] text-[11px] font-bold text-ember-muted mb-2'>{tx(`category.${category}`)}</div>
              <div className='flex flex-wrap gap-2'>
                {items.map(f => (
                  <ToggleChip
                    key={f.id}
                    selected={input.features.includes(f.id)}
                    onClick={() => onToggleFeature(f.id)}
                    label={
                      <>
                        {tx(`feature.${f.id}`)}
                        {popular.has(f.id) && (
                          <span className='ml-1.5 text-[10px] font-bold uppercase tracking-wide text-ember-accent2'>
                            ★ {t('popularBadge')}
                          </span>
                        )}
                      </>
                    }
                    hint={hints.get(f.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
