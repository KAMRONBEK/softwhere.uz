'use client';

import { SERVICE_TYPES } from '@/data/estimator-options';
import type { Complexity, ProjectType } from '@/types/estimator';
import { useTranslations } from 'next-intl';

type ScopeStepProps = {
  projectType: ProjectType;
  selectedComplexity: Complexity;
  selectedSubtype?: string;
  onComplexityChange: (c: Complexity) => void;
  onSubtypeChange?: (s: string) => void;
};

const COMPLEXITIES: { id: Complexity; labelKey: string }[] = [
  { id: 'mvp', labelKey: 'complexity.mvp' },
  { id: 'standard', labelKey: 'complexity.standard' },
  { id: 'enterprise', labelKey: 'complexity.enterprise' },
];

export default function ScopeStep({
  projectType,
  selectedComplexity,
  selectedSubtype,
  onComplexityChange,
  onSubtypeChange,
}: ScopeStepProps) {
  const t = useTranslations('estimator');
  const service = SERVICE_TYPES.find(s => s.id === projectType);
  const subtypes = service?.subtypes?.filter(s => !['ios', 'android', 'both'].includes(s.id)) ?? [];

  return (
    <div className='space-y-6'>
      <div>
        <label className='block mb-2'>Complexity</label>
        <div className='flex flex-wrap gap-3'>
          {COMPLEXITIES.map(c => (
            <button
              key={c.id}
              type='button'
              className={`px-4 py-2 rounded-lg border dark:border-gray-700 transition-all ${
                selectedComplexity === c.id
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                  : 'hover:border-orange-300 bg-white dark:bg-gray-800'
              }`}
              onClick={() => onComplexityChange(c.id)}
            >
              {(t as (k: string) => string)(c.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {subtypes.length > 0 && onSubtypeChange && (
        <div>
          <label className='block mb-2'>Subtype</label>
          <div className='flex flex-wrap gap-3'>
            {subtypes.map(s => (
              <button
                key={s.id}
                type='button'
                className={`px-4 py-2 rounded-lg border dark:border-gray-700 transition-all ${
                  selectedSubtype === s.id
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                    : 'hover:border-orange-300 bg-white dark:bg-gray-800'
                }`}
                onClick={() => onSubtypeChange(s.id)}
              >
                {(t as (k: string) => string)(s.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
