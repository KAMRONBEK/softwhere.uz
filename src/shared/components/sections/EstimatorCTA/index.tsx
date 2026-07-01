import Button from '@/shared/components/Button';
import SectionText from '@/shared/components/SectionTitle';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import css from './style.module.css';

async function EstimatorCTA() {
  const locale = await getLocale();
  const t = await getTranslations('estimatorCTA');

  return (
    <section className={css.section} id='estimator-cta'>
      <div className='container'>
        <div className={css.band} data-aos='fade-up'>
          <div className={css.content}>
            <SectionText>{t('title')}</SectionText>
            <SectionText className='mx-auto mb-8 lg:w-2/3' type='desc'>
              {t('description')}
            </SectionText>
            <Link href={`/${locale}/estimator`}>
              <Button className={css.ctaButton}>{t('cta')} →</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default EstimatorCTA;
