'use client';

import { SERVICES, getService } from '@/modules/estimator/data/catalog';
import type { EstimatorInput, ProjectType } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import { SelectCard, StepLabel } from '../ui';

type Props = {
  input: EstimatorInput;
  onTypeSelect: (type: ProjectType) => void;
  onSubtypeSelect: (subtype: string) => void;
};

export default function TypeStep({ input, onTypeSelect, onSubtypeSelect }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const service = getService(input.projectType);

  return (
    <div className='space-y-7'>
      <div>
        <StepLabel hint={t('typeHint')}>{t('typeTitle')}</StepLabel>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          {SERVICES.map(s => (
            <SelectCard
              key={s.id}
              selected={input.projectType === s.id}
              onClick={() => onTypeSelect(s.id)}
              icon={s.icon}
              title={tx(`service.${s.id}`)}
              desc={tx(`serviceDesc.${s.id}`)}
            />
          ))}
        </div>
      </div>

      <div>
        <StepLabel>{t('subtypeTitle')}</StepLabel>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          {service.subtypes.map(s => (
            <SelectCard
              key={s.id}
              compact
              selected={input.subtype === s.id}
              onClick={() => onSubtypeSelect(s.id)}
              icon={s.icon}
              title={tx(`subtype.${s.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
