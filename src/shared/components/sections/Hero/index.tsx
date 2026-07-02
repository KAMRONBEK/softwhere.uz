// Server component on purpose: the H1 is the LCP element and must be in the
// prerendered HTML. The old react-type-animation rendered an EMPTY <h1> until
// the whole JS bundle hydrated — on slow links the headline painted seconds
// late. The typewriter personality is kept with a pure-CSS blinking caret.
import css from './style.module.css';

import Counter from '@/shared/components/Counter';
import { projects } from '@/shared/data/projects';
import { useTranslations } from 'next-intl';

function Hero() {
  const t = useTranslations('hero');

  return (
    <section className={css.section}>
      <div className={`container ${css.inner}`}>
        <div className={css.aura1} aria-hidden='true' />
        <div className={css.aura2} aria-hidden='true' />

        <div className={css.grid}>
          <div className={css.left}>
            <div className={css.eyebrow}>{t('eyebrow')}</div>
            <h1 className={css.title}>
              <span className={css.typed}>{t('title')}</span>
            </h1>
            <p className={css.description}>{t('description')}</p>
            <div className={css.actions}>
              <a href='#contact' className={css.ctaPrimary}>
                {t('btn')}
                <svg
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <path d='M5 12h14M12 5l7 7-7 7' />
                </svg>
              </a>
              <a href='#portfolio' className={css.ctaSecondary}>
                {t('ctaSecondary')}
              </a>
            </div>
          </div>

          <div className={css.stats}>
            <div className={css.statCard}>
              <div className={css.statValue}>
                <Counter to={projects.length} />
              </div>
              <div className={css.statLabel}>{t('statAppsLabel')}</div>
            </div>
            <div className={`${css.statCard} ${css.statCardAlt}`}>
              <div className={`${css.statValue} ${css.statValueAlt}`}>
                <Counter to={6} />
              </div>
              <div className={css.statLabel}>{t('statCountriesLabel')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
