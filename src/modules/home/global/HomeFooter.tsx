import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CONTACT_INFO, SOCIAL_LINKS } from '@/core/constants';
import css from './HomeFooter.module.css';

const PHONE_PRETTY = CONTACT_INFO.PHONE.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4');
const TELEGRAM_HANDLE = `@${SOCIAL_LINKS.TELEGRAM.replace(/^https:\/\/t\.me\//, '')}`;
const DEVELOPER_URL = 'https://kamuran.dev';

interface HomeFooterProps {
  locale: Locale;
}

/**
 * The homepage's own footer, painted with the page's style tokens (it
 * stands in for the site Footer, which only (site)/layout.tsx renders): the service pages, blog,
 * estimator and privacy policy as real links, and the studio's phone, email,
 * Telegram and address. A server component (static HTML, no JS); the shell
 * renders it inside the themed root, after the latest posts.
 */
export default async function HomeFooter({ locale }: HomeFooterProps) {
  const t = await getTranslations({ locale, namespace: 'home.shared.footer' });
  const year = new Date().getFullYear();

  return (
    <footer className={css.root} aria-label={t('label')}>
      <div className={css.inner}>
        <nav className={css.column} aria-labelledby='home-footer-services'>
          <p id='home-footer-services' className={css.label}>
            {t('servicesLabel')}
          </p>
          <ul className={css.list}>
            <li>
              <Link href={`/${locale}/services/web-development`}>{t('web')}</Link>
            </li>
            <li>
              <Link href={`/${locale}/services/mobile-apps`}>{t('mobile')}</Link>
            </li>
            <li>
              <Link href={`/${locale}/services/telegram-bots`}>{t('bots')}</Link>
            </li>
          </ul>
        </nav>

        <nav className={css.column} aria-labelledby='home-footer-more'>
          <p id='home-footer-more' className={css.label}>
            {t('moreLabel')}
          </p>
          <ul className={css.list}>
            <li>
              <Link href={`/${locale}/blog`}>{t('blog')}</Link>
            </li>
            <li>
              <Link href={`/${locale}/estimator`}>{t('estimator')}</Link>
            </li>
            <li>
              <Link href={`/${locale}/privacy-policy`}>{t('privacy')}</Link>
            </li>
          </ul>
        </nav>

        <div className={css.column}>
          <p className={css.label}>{t('contactLabel')}</p>
          <ul className={css.list}>
            <li>
              <a href={`tel:${CONTACT_INFO.PHONE}`}>{PHONE_PRETTY}</a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_INFO.EMAIL}`}>{CONTACT_INFO.EMAIL}</a>
            </li>
            <li>
              <a href={SOCIAL_LINKS.TELEGRAM} target='_blank' rel='noopener noreferrer'>
                Telegram {TELEGRAM_HANDLE}
              </a>
            </li>
            <li>
              <address className={css.address}>{t('address')}</address>
            </li>
          </ul>
        </div>
      </div>

      <div className={css.legal}>
        <p>{t('rights', { year })}</p>
        <p>
          {t.rich('developedBy', {
            link: chunks => (
              <a href={DEVELOPER_URL} target='_blank' rel='noopener noreferrer'>
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </footer>
  );
}
