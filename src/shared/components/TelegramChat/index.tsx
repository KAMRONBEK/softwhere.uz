'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { SOCIAL_LINKS } from '@/core/constants';
import { trackEvent } from '@/shared/utils/analytics';

/**
 * Floating "chat on Telegram" button (bottom-left; ScrollToTop owns the
 * bottom-right corner). Telegram is THE messaging channel in Uzbekistan, so a
 * one-tap chat link converts better than the contact form for most visitors.
 * Hidden on admin routes.
 */
export default function TelegramChat() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('contact');

  if (pathname?.includes('/admin')) return null;

  return (
    <a
      href={SOCIAL_LINKS.TELEGRAM}
      target='_blank'
      rel='noopener noreferrer'
      aria-label={t('telegramCta')}
      title={t('telegramCta')}
      onClick={() => trackEvent('telegram_chat_click', { locale })}
      className='fixed bottom-5 left-5 z-40 flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
      style={{ backgroundColor: '#229ED9', width: 52, height: 52 }}
    >
      {/* Telegram paper plane (inline — no icon dependency) */}
      <svg width='26' height='26' viewBox='0 0 24 24' fill='white' aria-hidden='true'>
        <path d='M21.94 4.03a1.5 1.5 0 0 0-2.02-1.7L2.9 9.36c-1.28.5-1.2 2.35.12 2.73l4.3 1.25 1.6 5.13c.37 1.2 1.9 1.5 2.7.55l2.03-2.44 4.06 2.98c.9.66 2.18.17 2.4-.92l2.16-13.61-.33-.99v-.01ZM8.03 12.4l9.36-5.78c.42-.26.85.3.49.63l-7.16 6.55a1.5 1.5 0 0 0-.47.9l-.27 2.02c-.03.28-.42.31-.5.04l-1.06-3.45a.9.9 0 0 1 .38-1.03l-.77.12Z' />
      </svg>
    </a>
  );
}
