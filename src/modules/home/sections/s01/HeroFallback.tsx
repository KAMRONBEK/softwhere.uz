'use client';

import { useTranslations } from 'next-intl';
import { SectionHeading } from '../../components/LabSection';
import { useLabLogo } from '../../logos';
import { useHomeFacts } from '../../context/HomeFactsContext';
import { useLabTheme } from '../../theme/useLabTheme';
import type { LabSectionProps } from '../../types';
import css from '../S01Hero.module.css';

/**
 * The hero before its code loads: the server HTML of the homepage's first
 * screen and its LCP. Same layout and classes as S01Hero (the headline,
 * subline and both CTAs where the live hero puts them, the mark as its
 * dot-matrix still), so the particle hero mounts over it without a jump.
 * Kept light on purpose: no GSAP, three or WebGL (sections/registry.ts
 * FALLBACKS). The CTAs are plain anchors, so they work before hydration too.
 */
export default function HeroFallback({ meta }: LabSectionProps) {
  const t = useTranslations('home.hero');
  const facts = useHomeFacts();
  const tShared = useTranslations('home.shared');
  const theme = useLabTheme();
  const { Mark } = useLabLogo();

  return (
    <div className={css.root} data-scheme={theme.scheme}>
      <div className={css.stage}>
        <div className={css.backdrop} aria-hidden='true' />
        <div className={css.still} aria-hidden='true'>
          <Mark className={css.stillMark} />
        </div>
      </div>

      <div className={css.content}>
        <div className={css.copy}>
          <div className={css.titleWrap}>
            <p className={css.title} data-hero-title=''>
              {t('heading')}
            </p>
          </div>
          <div className={css.subline}>
            <SectionHeading meta={meta} as='h1' className={css.lead}>
              {t('lead')}
            </SectionHeading>{' '}
            {t('summary', facts)}
          </div>
          <div className={css.actions}>
            <a href='#finale' className={`${css.cta} ${css.primary}`}>
              {tShared('callCta')}
            </a>
            <a href='#work-wall' className={`${css.cta} ${css.secondary}`}>
              {t('secondaryCta')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
