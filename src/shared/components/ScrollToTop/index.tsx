'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { trackEvent } from '@/shared/utils/analytics';
import css from './style.module.css';

const SHOW_AFTER_PX = 500;

function ScrollToTop() {
  const t = useTranslations('home.header');
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsShown(window.scrollY > SHOW_AFTER_PX);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = () => {
    trackEvent('scroll_to_top');
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, left: 0, behavior: isReduced ? 'instant' : 'smooth' });
  };

  return (
    <button type='button' onClick={handleClick} aria-label={t('toTop')} className={`${css.button} ${isShown ? css.shown : ''}`}>
      <svg width='18' height='18' viewBox='0 0 18 18' aria-hidden='true'>
        <path d='M9 15V3M4 8l5-5 5 5' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </button>
  );
}

export default ScrollToTop;
