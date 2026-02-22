'use client';

import { getTechForService } from '@/data/estimator-options';
import type { ProjectType } from '@/types/estimator';
import { useTranslations } from 'next-intl';

type TechStackStepProps = {
  projectType: ProjectType;
  subtype?: string;
  selectedTech: string[];
  onToggleTech: (tech: string) => void;
};

export default function TechStackStep({ projectType, subtype, selectedTech, onToggleTech }: TechStackStepProps) {
  const t = useTranslations('estimator');
  const groups = getTechForService(projectType, subtype);

  if (groups.length === 0) {
    return (
      <div className='text-gray-500'>
        <p>Tech stack selection is not applicable for this service type.</p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <p className='text-sm text-gray-500'>
        Select technologies that align with your requirements. Your choices may impact the final cost.
      </p>
      {groups.map(({ group, labelKey, options }) => (
        <div key={group}>
          <label className='block mb-2 font-medium'>{(t as (k: string) => string)(labelKey)}</label>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            {options.map(tech => (
              <div
                key={tech.id}
                className={`border dark:border-gray-700 rounded-lg p-3 flex items-center cursor-pointer transition-all hover:shadow-md ${
                  selectedTech.includes(tech.id) ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : 'bg-white dark:bg-gray-800'
                }`}
                onClick={() => onToggleTech(tech.id)}
              >
                <div className='flex-1'>
                  <div className='font-medium'>{(t as (k: string) => string)(tech.labelKey)}</div>
                </div>
                {tech.impactFactor != null && (
                  <div
                    className={`text-sm font-medium ${
                      tech.impactFactor > 1 ? 'text-red-500' : tech.impactFactor < 1 ? 'text-green-500' : 'text-gray-500'
                    }`}
                  >
                    {tech.impactFactor > 1
                      ? `+${Math.round((tech.impactFactor - 1) * 100)}%`
                      : tech.impactFactor < 1
                        ? `-${Math.round((1 - tech.impactFactor) * 100)}%`
                        : '±0%'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
