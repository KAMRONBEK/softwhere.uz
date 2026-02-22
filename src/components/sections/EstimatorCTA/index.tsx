'use client';

import Button from '@/components/Button';
import SectionText from '@/components/SectionTitle';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import css from './style.module.css';

function EstimatorCTA() {
  const params = useParams();
  const locale = (params?.locale as string) || 'uz';
  const t = useTranslations('estimatorCTA');

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
