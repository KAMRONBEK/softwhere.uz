'use client';

import { MOBILE_FACTOR } from '@/modules/estimator/constants';
import { getSubtype, hasScreens } from '@/modules/estimator/data/catalog';
import type { EstimatorInput, MobileApproach, Platform, Tier } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import { SelectCard, StepLabel } from '../ui';

type Props = {
  input: EstimatorInput;
  onTogglePlatform: (platform: Platform) => void;
  onApproachChange: (approach: MobileApproach) => void;
  onTierChange: (tier: Tier) => void;
  onScreensChange: (screens: number) => void;
};

const TIERS: Tier[] = ['mvp', 'standard', 'enterprise'];

export default function ScopeStep({ input, onTogglePlatform, onApproachChange, onTierChange, onScreensChange }: Props) {
  const t = useTranslations('estimator');
  const tx = t as unknown as (key: string) => string;
  const def = getSubtype(input.projectType, input.subtype);
  const showScreens = hasScreens(input.projectType, input.subtype);
  const isMobile = input.projectType === 'mobile';
  const bothPlatforms = input.platforms.length !== 1;

  const nativeExtra = Math.round(((bothPlatforms ? MOBILE_FACTOR.native_both : MOBILE_FACTOR.native_single) - 1) * 100);

  return (
    <div className='space-y-7'>
      {isMobile && (
        <>
          <div>
            <StepLabel>{t('platformTitle')}</StepLabel>
            <div className='grid grid-cols-2 gap-3 max-w-md'>
              {(['ios', 'android'] as Platform[]).map(p => (
                <SelectCard
                  key={p}
                  compact
                  selected={input.platforms.includes(p)}
                  onClick={() => onTogglePlatform(p)}
                  icon={p === 'ios' ? '🍎' : '🤖'}
                  title={p === 'ios' ? 'iOS' : 'Android'}
                />
              ))}
            </div>
            <p className='text-xs text-ember-muted mt-2'>{t('platformHint')}</p>
          </div>

          <div>
            <StepLabel>{t('approachTitle')}</StepLabel>
            <div className='grid md:grid-cols-2 gap-3'>
              <SelectCard
                selected={input.approach === 'cross'}
                onClick={() => onApproachChange('cross')}
                icon='🔀'
                title={t('approach.cross')}
                desc={t('approachDesc.cross')}
                badge={t('recommended')}
              />
              <SelectCard
                selected={input.approach === 'native'}
                onClick={() => onApproachChange('native')}
                icon='⚡'
                title={t('approach.native')}
                desc={`${t('approachDesc.native')} (+${nativeExtra}%)`}
              />
            </div>
          </div>
        </>
      )}

      <div>
        <StepLabel hint={t('tierHint')}>{t('tierTitle')}</StepLabel>
        <div className='grid md:grid-cols-3 gap-3'>
          {TIERS.map(tier => (
            <SelectCard
              key={tier}
              selected={input.tier === tier}
              onClick={() => onTierChange(tier)}
              icon={tier === 'mvp' ? '🌱' : tier === 'standard' ? '🚀' : '🏆'}
              title={tx(`tier.${tier}`)}
              desc={tx(`tierDesc.${tier}`)}
            />
          ))}
        </div>
      </div>

      {showScreens && (
        <div>
          <StepLabel hint={t('screensHint')}>{t('screensTitle')}</StepLabel>
          <div className='flex items-center gap-4'>
            <input
              id='screens'
              type='range'
              min={1}
              max={def.maxScreens}
              value={input.screens}
              aria-label={t('screensTitle')}
              className='w-full accent-[color:var(--accent)]'
              onChange={e => onScreensChange(Number(e.target.value))}
            />
            <div className='shrink-0 w-16 text-center rounded-xl border border-ember-border bg-ember-surface py-1.5 font-display font-bold text-ember-accent'>
              {input.screens}
            </div>
          </div>
          <p className='text-xs text-ember-muted mt-2'>{t('screensIncluded', { count: def.includedScreens })}</p>
        </div>
      )}
    </div>
  );
}
