import { getTranslations } from 'next-intl/server';
import css from './style.module.css';

export default async function Process() {
  const t = await getTranslations('process');
  const steps = [
    { num: 1, title: t('step1Title'), desc: t('step1Desc') },
    { num: 2, title: t('step2Title'), desc: t('step2Desc') },
    { num: 3, title: t('step3Title'), desc: t('step3Desc') },
    { num: 4, title: t('step4Title'), desc: t('step4Desc') },
  ];

  return (
    <section className={css.section} id='process'>
      <div className='container'>
        <div className={css.eyebrow}>{t('eyebrow')}</div>
        <h2 className={css.title}>{t('title')}</h2>
        <div className={css.grid}>
          {steps.map(step => (
            <div key={step.num} className={css.card} data-aos='fade-up' data-aos-delay={(step.num - 1) * 100}>
              <div className={css.num}>{String(step.num).padStart(2, '0')}</div>
              <h3 className={css.stepTitle}>{step.title}</h3>
              <p className={css.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
