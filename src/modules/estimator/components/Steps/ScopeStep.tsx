'use client';

import { MOBILE_FACTOR } from '@/modules/estimator/constants';
import { getSubtype, hasScreens } from '@/modules/estimator/data/catalog';
import type { EstimatorInput, MobileApproach, Platform, Tier } from '@/modules/estimator/types';
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { TierIcon } from '../icons';
import TechIcon from '../TechIcon';
import { SelectCard, StepLabel } from '../ui';
import css from '../ui.module.css';

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
  const minScreens = Math.max(1, def.includedScreens);
  const fill = ((input.screens - minScreens) / Math.max(1, def.maxScreens - minScreens)) * 100;
  const bothPlatforms = input.platforms.length !== 1;

  // What switching to native costs *from here* — i.e. against cross-platform at
  // the same platform count, not against an abstract 1.0. On a single platform
  // the old "-1" form advertised +12% for a change that really adds ~19%.
  const nativeExtra = Math.round(
    ((bothPlatforms ? MOBILE_FACTOR.native_both / MOBILE_FACTOR.cross_both : MOBILE_FACTOR.native_single / MOBILE_FACTOR.cross_single) -
      1) *
      100
  );

  return (
    <div className={css.steps}>
      {isMobile && (
        <>
          <div>
            <StepLabel>{t('platformTitle')}</StepLabel>
            <div className={css.tiles}>
              {(['ios', 'android'] as Platform[]).map(p => (
                <SelectCard
                  key={p}
                  compact
                  selected={input.platforms.includes(p)}
                  onClick={() => onTogglePlatform(p)}
                  icon={<TechIcon icon={p === 'ios' ? 'SiApple' : 'SiAndroid'} label={p} size={24} />}
                  title={p === 'ios' ? 'iOS' : 'Android'}
                />
              ))}
            </div>
            <p className={css.note}>{t('platformHint')}</p>
          </div>

          <div>
            <StepLabel>{t('approachTitle')}</StepLabel>
            <div className={css.pair}>
              <SelectCard
                selected={input.approach === 'cross'}
                onClick={() => onApproachChange('cross')}
                title={t('approach.cross')}
                desc={t('approachDesc.cross')}
                badge={t('recommended')}
              />
              <SelectCard
                selected={input.approach === 'native'}
                onClick={() => onApproachChange('native')}
                title={t('approach.native')}
                desc={`${t('approachDesc.native')} (+${nativeExtra}%)`}
              />
            </div>
          </div>
        </>
      )}

      <div>
        <StepLabel hint={t('tierHint')}>{t('tierTitle')}</StepLabel>
        <div className={css.cards}>
          {TIERS.map(tier => (
            <SelectCard
              key={tier}
              selected={input.tier === tier}
              onClick={() => onTierChange(tier)}
              icon={<TierIcon tier={tier} />}
              title={tx(`tier.${tier}`)}
              desc={tx(`tierDesc.${tier}`)}
            />
          ))}
        </div>
      </div>

      {showScreens && (
        <div>
          <StepLabel hint={t('screensHint')}>{t('screensTitle')}</StepLabel>
          <div className={css.slider}>
            <input
              id='screens'
              type='range'
              // Everything up to `includedScreens` is already paid for by the
              // base — starting the slider there keeps every position meaningful.
              min={minScreens}
              max={def.maxScreens}
              value={input.screens}
              aria-label={t('screensTitle')}
              style={{ '--fill': `${fill}%` } as CSSProperties}
              onChange={e => onScreensChange(Number(e.target.value))}
            />
            <div aria-hidden>{input.screens}</div>
          </div>
          <p className={css.note}>{t('screensIncluded', { count: def.includedScreens })}</p>
        </div>
      )}
    </div>
  );
}
