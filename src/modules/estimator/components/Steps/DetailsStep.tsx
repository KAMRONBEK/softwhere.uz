'use client';

import { hasScreens } from '@/modules/estimator/data/catalog';
import { MAX_DESCRIPTION_LENGTH } from '@/modules/estimator/utils/sanitize';
import type { DesignStatus, EstimatorInput, Urgency } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import { SegmentedPill, SelectCard, StepLabel } from '../ui';

type Props = {
  input: EstimatorInput;
  onDesignChange: (design: DesignStatus) => void;
  onLanguagesChange: (languages: number) => void;
  onUrgencyChange: (urgency: Urgency) => void;
  onDescriptionChange: (description: string) => void;
};

const DESIGNS: DesignStatus[] = ['ready', 'template', 'custom'];
const URGENCIES: Urgency[] = ['flexible', 'normal', 'rush'];

export default function DetailsStep({ input, onDesignChange, onLanguagesChange, onUrgencyChange, onDescriptionChange }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const showDesign = hasScreens(input.projectType, input.subtype);

  return (
    <div className='space-y-7'>
      {showDesign && (
        <div>
          <StepLabel>{t('designTitle')}</StepLabel>
          <div className='grid md:grid-cols-3 gap-3'>
            {DESIGNS.map(design => (
              <SelectCard
                key={design}
                selected={input.design === design}
                onClick={() => onDesignChange(design)}
                icon={design === 'ready' ? '📐' : design === 'template' ? '🧩' : '🎨'}
                title={tx(`design.${design}`)}
                desc={tx(`designDesc.${design}`)}
              />
            ))}
          </div>
        </div>
      )}

      <div className='grid md:grid-cols-2 gap-7'>
        <div>
          <StepLabel hint={t('languagesHint')}>{t('languagesTitle')}</StepLabel>
          <div className='flex gap-1.5'>
            {[1, 2, 3].map(n => (
              <SegmentedPill key={n} selected={input.languages === n} onClick={() => onLanguagesChange(n)}>
                {tx(`langCount.${n}`)}
              </SegmentedPill>
            ))}
          </div>
        </div>

        <div>
          <StepLabel>{t('urgencyTitle')}</StepLabel>
          <div className='flex gap-1.5'>
            {URGENCIES.map(urgency => (
              <SegmentedPill key={urgency} selected={input.urgency === urgency} onClick={() => onUrgencyChange(urgency)}>
                {tx(`urgency.${urgency}`)}
              </SegmentedPill>
            ))}
          </div>
        </div>
      </div>

      <div>
        <StepLabel hint={t('descriptionHint')}>{t('descriptionTitle')}</StepLabel>
        <textarea
          value={input.description ?? ''}
          onChange={e => onDescriptionChange(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
          placeholder={t('descriptionPlaceholder')}
          rows={4}
          className='w-full rounded-2xl border border-ember-border bg-ember-surface text-ember-text placeholder:text-ember-muted p-4 text-sm leading-relaxed outline-none focus:border-ember-accent transition-colors resize-y'
        />
        <div className='text-right text-[11px] text-ember-muted mt-1'>
          {(input.description ?? '').length}/{MAX_DESCRIPTION_LENGTH}
        </div>
      </div>
    </div>
  );
}
