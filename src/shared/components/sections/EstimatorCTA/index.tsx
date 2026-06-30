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
        <SectionText>{t('title')}</SectionText>
        <SectionText className='mb-6 lg:w-1/2' type='desc'>
          {t('description')}
        </SectionText>
        <Link href={`/${locale}/estimator`}>
          <Button className={css.ctaButton}>{t('cta')}</Button>
        </Link>
      </div>
    </section>
  );
}

export default EstimatorCTA;
