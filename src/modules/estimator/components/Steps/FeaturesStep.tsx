'use client';

import { ESTIMATOR, HOURLY_RATE } from '@/modules/estimator/constants';
import { getFeaturesForService } from '@/modules/estimator/data/estimator-options';
import type { ProjectType } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';

type FeaturesStepProps = {
  projectType: ProjectType;
  subtype?: string;
  selectedFeatures: string[];
  onToggleFeature: (feature: string) => void;
};

export default function FeaturesStep({ projectType, subtype, selectedFeatures, onToggleFeature }: FeaturesStepProps) {
  const t = useTranslations('estimator');
  const features = getFeaturesForService(projectType, subtype);

  return (
    <div>
      <label className='block mb-2 font-display text-ember-text'>{t('stepFeatures')}</label>
      <div className='grid grid-cols-2 gap-3'>
        {features.map(feature => (
          <button
            key={feature.id}
            type='button'
            aria-pressed={selectedFeatures.includes(feature.id)}
            className={`border rounded-lg p-3 flex items-start cursor-pointer transition-all hover:shadow-md ${
              selectedFeatures.includes(feature.id)
                ? 'border-ember-accent bg-[rgba(255,91,30,0.12)]'
                : 'bg-ember-surface border-ember-border'
            }`}
            onClick={() => onToggleFeature(feature.id)}
          >
            <div className='flex-1 text-left'>
              <div className='font-medium text-ember-text'>{(t as (k: string) => string)(feature.labelKey)}</div>
              <div className='text-xs text-ember-muted'>
                +${((ESTIMATOR.FEATURE_HOURS[feature.id] ?? 0) * HOURLY_RATE).toLocaleString()}
              </div>
            </div>
            {selectedFeatures.includes(feature.id) && (
              <div className='bg-ember-accent rounded-full p-1'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-4 w-4 text-white'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
