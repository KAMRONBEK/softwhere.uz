'use client';
import SectionText from '@/components/SectionTitle';
import { useTranslations } from 'next-intl';
import css from './style.module.css';

function Discuss() {
  const t = useTranslations('discuss');

  return (
    <section className={css.section}>
      <div className='container flex flex-col items-center text-center py-4'>
        <SectionText className='!text-white'>{t('title')}</SectionText>
        <SectionText type='desc' className='!text-white/90 max-w-xl mt-2'>
          {t('description')}
        </SectionText>
        <a href='#contact' className={css.ctaButton}>
          {t('btn')}
          <svg
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <path d='M5 12h14M12 5l7 7-7 7' />
          </svg>
        </a>
      </div>
    </section>
  );
}

export default Discuss;
