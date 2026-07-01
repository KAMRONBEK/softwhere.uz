import SectionText from '@/shared/components/SectionTitle';
import css from './style.module.css';
import { getTranslations } from 'next-intl/server';

async function Service() {
  const t = await getTranslations('services');
  const services = [
    { num: 1, title: t('service1.title'), description: t('service1.description') },
    { num: 2, title: t('service2.title'), description: t('service2.description') },
    { num: 3, title: t('service3.title'), description: t('service3.description') },
    { num: 4, title: t('service4.title'), description: t('service4.description') },
    { num: 5, title: t('service5.title'), description: t('service5.description') },
    { num: 6, title: t('service6.title'), description: t('service6.description') },
  ];

  return (
    <section className={css.section} id='services'>
      <div className='container'>
        <div className={css.eyebrow}>{t('eyebrow')}</div>
        <SectionText>{t('title')}</SectionText>
        <SectionText className='mb-10 lg:w-1/2' type='desc'>
          {t('description')}
        </SectionText>
        <div className={css.rows}>
          {services.map((item, index) => (
            <div data-aos='fade-up' className={`${css.row} ${index === 2 ? css.rowHighlight : ''}`} key={item.title}>
              <span className={css.num}>{String(item.num).padStart(2, '0')}</span>
              <h3 className={css.rowTitle}>{item.title}</h3>
              <p className={css.rowDesc}>{item.description}</p>
              <span className={css.arrow} aria-hidden='true'>
                →
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Service;
