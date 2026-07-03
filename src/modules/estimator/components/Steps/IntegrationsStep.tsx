'use client';

import { BLENDED_RATE } from '@/modules/estimator/constants';
import { INTEGRATION_GROUPS, integrationsFor } from '@/modules/estimator/data/catalog';
import type { EstimatorInput } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import TechIcon from '../TechIcon';
import { StepLabel, ToggleChip } from '../ui';

type Props = {
  input: EstimatorInput;
  onToggleIntegration: (id: string) => void;
};

export default function IntegrationsStep({ input, onToggleIntegration }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const available = integrationsFor(input.projectType);

  return (
    <div>
      <StepLabel hint={t('integrationsHint')}>{t('integrationsTitle')}</StepLabel>
      <div className='space-y-5'>
        {INTEGRATION_GROUPS.map(group => {
          const items = available.filter(i => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className='uppercase tracking-[0.14em] text-[11px] font-bold text-ember-muted mb-2'>{tx(`intGroup.${group}`)}</div>
              <div className='flex flex-wrap gap-2'>
                {items.map(i => (
                  <ToggleChip
                    key={i.id}
                    selected={input.integrations.includes(i.id)}
                    onClick={() => onToggleIntegration(i.id)}
                    icon={<TechIcon icon={i.icon} flag={i.flag} label={tx(`integration.${i.id}`)} />}
                    label={tx(`integration.${i.id}`)}
                    hint={`+$${(Math.round((i.hours * BLENDED_RATE) / 10) * 10).toLocaleString('en-US')}`}
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
