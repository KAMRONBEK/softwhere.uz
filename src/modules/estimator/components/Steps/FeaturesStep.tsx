'use client';

import { BLENDED_RATE, TIER_MULTIPLIER } from '@/modules/estimator/constants';
import { FEATURE_CATEGORIES, effectiveFeatureHours, featuresFor, getSubtype } from '@/modules/estimator/data/catalog';
import type { EstimatorInput } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import { StepLabel, ToggleChip } from '../ui';

type Props = {
  input: EstimatorInput;
  onToggleFeature: (id: string) => void;
};

export default function FeaturesStep({ input, onToggleFeature }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const available = featuresFor(input.projectType);
  const popular = new Set(getSubtype(input.projectType, input.subtype).popular);
  const tierMult = TIER_MULTIPLIER[input.tier] ?? 1;

  const priceHint = (id: string): string => {
    const cost = effectiveFeatureHours(input.projectType, input.subtype, id) * BLENDED_RATE * tierMult;
    return `+$${(Math.round(cost / 10) * 10).toLocaleString('en-US')}`;
  };

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
                    hint={priceHint(f.id)}
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
