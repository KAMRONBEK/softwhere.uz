'use client';

import { INTEGRATION_GROUPS, integrationsFor } from '@/modules/estimator/data/catalog';
import type { EstimatorInput } from '@/modules/estimator/types';
import { marginalCost } from '@/modules/estimator/utils/estimator';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import TechIcon from '../TechIcon';
import { StepLabel, ToggleChip } from '../ui';

type Props = {
  input: EstimatorInput;
  /** Currency-aware formatter — chips must not quote USD next to a UZS total. */
  format: (amountUsd: number) => string;
  onToggleIntegration: (id: string) => void;
};

export default function IntegrationsStep({ input, format, onToggleIntegration }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const available = integrationsFor(input.projectType);

  // Same rule as the features step: quote what this chip actually moves the
  // estimate by (integrations are fixed effort, but urgency still scales them).
  const hints = useMemo(() => {
    const map = new Map<string, string>();
    for (const integration of integrationsFor(input.projectType)) {
      map.set(integration.id, `+${format(Math.round(marginalCost(input, 'integrations', integration.id) / 10) * 10)}`);
    }
    return map;
  }, [input, format]);

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
                    hint={hints.get(i.id)}
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
