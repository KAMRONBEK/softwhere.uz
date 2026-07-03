'use client';

import { TECH_GROUPS, techFor } from '@/modules/estimator/data/catalog';
import type { EstimatorInput } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import TechIcon from '../TechIcon';
import { SelectCard, StepLabel, ToggleChip } from '../ui';

type Props = {
  input: EstimatorInput;
  onAutoTech: () => void;
  onToggleTech: (id: string) => void;
};

export default function TechStep({ input, onAutoTech, onToggleTech }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const available = techFor(input.projectType);

  return (
    <div className='space-y-6'>
      <div>
        <StepLabel hint={t('techHint')}>{t('techTitle')}</StepLabel>
        <SelectCard
          selected={input.autoTech}
          onClick={onAutoTech}
          icon='🧭'
          title={t('autoTech')}
          desc={t('autoTechDesc')}
          badge={t('recommended')}
        />
      </div>

      <div className={`space-y-5 transition-opacity ${input.autoTech ? 'opacity-60' : ''}`}>
        {TECH_GROUPS.map(group => {
          const items = available.filter(tech => tech.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className='uppercase tracking-[0.14em] text-[11px] font-bold text-ember-muted mb-2'>{tx(`techGroup.${group}`)}</div>
              <div className='flex flex-wrap gap-2'>
                {items.map(tech => (
                  <ToggleChip
                    key={tech.id}
                    selected={input.techStack.includes(tech.id)}
                    onClick={() => onToggleTech(tech.id)}
                    icon={<TechIcon icon={tech.icon} flag={tech.flag} label={tech.label} />}
                    label={tech.label}
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
