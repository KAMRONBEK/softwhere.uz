'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { SOCIAL_LINKS } from '@/core/constants';
import { trackEvent } from '@/shared/utils/analytics';
import css from './style.module.css';

/** As ScrollToTop: on narrow screens the first screen keeps its own buttons uncovered. */
const SHOW_AFTER_PX = 500;

/**
 * Floating "chat on Telegram" button (bottom left; below 1280px bottom
 * right, under ScrollToTop, once scrolled). Telegram is THE messaging channel in Uzbekistan, so a
 * one-tap chat link converts better than the contact form for most visitors.
 */
export default function TelegramChat() {
  const locale = useLocale();
  const t = useTranslations('contact');
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsShown(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <a
      href={SOCIAL_LINKS.TELEGRAM}
      target='_blank'
      rel='noopener noreferrer'
      aria-label={t('telegramCta')}
      title={t('telegramCta')}
      onClick={() => trackEvent('telegram_chat_click', { locale })}
      className={`${css.button} ${isShown ? css.shown : ''}`}
    >
      {/* Telegram paper plane (inline — no icon dependency) */}
      <svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
        <path d='M21.94 4.03a1.5 1.5 0 0 0-2.02-1.7L2.9 9.36c-1.28.5-1.2 2.35.12 2.73l4.3 1.25 1.6 5.13c.37 1.2 1.9 1.5 2.7.55l2.03-2.44 4.06 2.98c.9.66 2.18.17 2.4-.92l2.16-13.61-.33-.99v-.01ZM8.03 12.4l9.36-5.78c.42-.26.85.3.49.63l-7.16 6.55a1.5 1.5 0 0 0-.47.9l-.27 2.02c-.03.28-.42.31-.5.04l-1.06-3.45a.9.9 0 0 1 .38-1.03l-.77.12Z' />
      </svg>
    </a>
  );
}
