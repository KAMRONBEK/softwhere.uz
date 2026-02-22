'use client';
import { TypeAnimation } from 'react-type-animation';
import css from './style.module.css';

import SectionText from '@/components/SectionTitle';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import BackImage from '../../../../public/images/app-background.png';

function Hero() {
  const t = useTranslations('hero');
  const tHeader = useTranslations('header');

  return (
    <section className={css.section}>
      <div className='container 2xl:relative'>
        <Image className={css.backImage} src={BackImage} alt='' priority />
        <div className={css.content}>
          <SectionText className='lg:w-1/2'>
            <TypeAnimation sequence={[t('title'), 1000]} wrapper='p' speed={50} repeat={Infinity} />
          </SectionText>

          <SectionText type={'desc'} className={css.description}>
            {t('description')}
          </SectionText>

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
            <a href='#services' className={css.ctaSecondary}>
              {tHeader('services')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
