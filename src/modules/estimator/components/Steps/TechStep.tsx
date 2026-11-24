'use client';

import { TECH_GROUPS, techFor } from '@/modules/estimator/data/catalog';
import type { EstimatorInput } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import TechIcon from '../TechIcon';
import { SelectCard, StepLabel, ToggleChip } from '../ui';
import css from '../ui.module.css';

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
    <div className={css.steps}>
      <div>
        <StepLabel hint={t('techHint')}>{t('techTitle')}</StepLabel>
        <SelectCard
          selected={input.autoTech}
          onClick={onAutoTech}
          title={t('autoTech')}
          desc={t('autoTechDesc')}
          badge={t('recommended')}
        />
      </div>

      <div className={css.groups}>
        {TECH_GROUPS.map(group => {
          const items = available.filter(tech => tech.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className={css.groupLabel}>{tx(`techGroup.${group}`)}</div>
              <div className={css.chips}>
                {items.map(tech => (
                  <ToggleChip
                    key={tech.id}
                    selected={input.techStack.includes(tech.id)}
                    onClick={() => onToggleTech(tech.id)}
                    icon={<TechIcon icon={tech.icon} label={tech.label} />}
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
