'use client';

import { ESTIMATOR, HOURLY_RATE } from '@/constants/estimator';
import { getFeaturesForService } from '@/data/estimator-options';
import type { ProjectType } from '@/types/estimator';
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
      <label className='block mb-2'>{t('stepFeatures')}</label>
      <div className='grid grid-cols-2 gap-3'>
        {features.map(feature => (
          <div
            key={feature.id}
            className={`border dark:border-gray-700 rounded-lg p-3 flex items-start cursor-pointer transition-all hover:shadow-md ${
              selectedFeatures.includes(feature.id) ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : 'bg-white dark:bg-gray-800'
            }`}
            onClick={() => onToggleFeature(feature.id)}
          >
            <div className='flex-1'>
              <div className='font-medium'>{(t as (k: string) => string)(feature.labelKey)}</div>
              <div className='text-xs text-gray-500 dark:text-gray-400'>
                +${((ESTIMATOR.FEATURE_HOURS[feature.id] ?? 0) * HOURLY_RATE).toLocaleString()}
              </div>
            </div>
            {selectedFeatures.includes(feature.id) && (
              <div className='bg-orange-500 rounded-full p-1'>
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
          </div>
        ))}
      </div>
    </div>
  );
}
