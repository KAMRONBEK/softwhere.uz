'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/shared/utils/analytics';
import { LANGUAGES, pathForLanguage } from './LabHeader.copy';
import css from './LabHeader.module.css';

interface LanguageLinksProps {
  /** 'bar': compact codes in the desktop bar (1280px and up); 'sheet': full names in the phone menu. */
  variant: 'bar' | 'sheet';
}

/**
 * uz / ru / en as plain links to the same page in each language, server
 * rendered so crawlers follow them (the hreflang alternates are in the page
 * metadata). A full page load, so every section starts in the new language.
 */
export function LanguageLinks({ variant }: LanguageLinksProps) {
  const t = useTranslations('home.header.language');
  const locale = useLocale();
  const pathname = usePathname() ?? `/${locale}`;

  return (
    <nav className={variant === 'bar' ? css.languages : css.sheetLanguages} aria-label={t('label')}>
      <ul>
        {LANGUAGES.map(language => {
          const isCurrent = language.id === locale;
          return (
            <li key={language.id}>
              <a
                href={pathForLanguage(pathname, language.id)}
                hrefLang={language.id}
                lang={language.id}
                className={variant === 'bar' ? css.language : css.sheetLanguage}
                aria-current={isCurrent ? 'true' : undefined}
                aria-label={variant === 'bar' ? (isCurrent ? t('current', { language: language.name }) : language.name) : undefined}
                onClick={() => {
                  if (!isCurrent) trackEvent('language_switch', { from: locale, to: language.id });
                }}
              >
                {variant === 'bar' ? language.short : language.name}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
