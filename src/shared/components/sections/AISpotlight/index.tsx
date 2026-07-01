import { getTranslations } from 'next-intl/server';
import css from './style.module.css';

export default async function AISpotlight() {
  const t = await getTranslations('aiSpotlight');
  const chips = [t('chip1'), t('chip2'), t('chip3'), t('chip4')];

  return (
    <section className={css.section} id='ai'>
      <div className='container'>
        <div className={css.card} data-aos='fade-up'>
          <div className={css.glow} aria-hidden='true' />
          <div className={css.inner}>
            <div className={css.eyebrow}>{t('eyebrow')}</div>
            <h2 className={css.title}>{t('title')}</h2>
            <div className={css.chips}>
              {chips.map((chip, i) => (
                <span key={i} className={css.chip}>
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
