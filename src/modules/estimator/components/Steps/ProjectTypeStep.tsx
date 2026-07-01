'use client';

import { SERVICE_TYPES } from '@/modules/estimator/data/estimator-options';
import type { ProjectType } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';

type ProjectTypeStepProps = {
  selectedType: ProjectType;
  onSelect: (type: ProjectType) => void;
};

const ICONS: Record<ProjectType, string> = {
  mobile: '📱',
  web: '🖥️',
  telegram: '✈️',
  ai: '🤖',
  desktop: '💻',
  other: '🔧',
};

export default function ProjectTypeStep({ selectedType, onSelect }: ProjectTypeStepProps) {
  const t = useTranslations('estimator');

  return (
    <div>
      <label className='block mb-2 font-display text-ember-text'>{t('stepProjectType')}</label>
      <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
        {SERVICE_TYPES.map(service => (
          <button
            key={service.id}
            type='button'
            aria-pressed={selectedType === service.id}
            className={`border rounded-lg p-4 flex flex-col items-center cursor-pointer transition-all hover:shadow-md ${
              selectedType === service.id ? 'border-ember-accent bg-[rgba(255,91,30,0.12)]' : 'bg-ember-surface border-ember-border'
            }`}
            onClick={() => onSelect(service.id)}
          >
            <div className='text-3xl mb-2'>{ICONS[service.id] ?? '✨'}</div>
            <div className='font-medium text-ember-text'>{(t as (k: string) => string)(service.labelKey)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
