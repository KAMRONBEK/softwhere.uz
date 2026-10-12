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

/** Where the screen's "here" line sits, as a share of its height (useCurrentSection's band, LabHeader.hooks.ts). */
const HERE_LINE = 0.45;

/**
 * The id of the homepage section the visitor is reading (the one crossing the
 * "here" line), or null at the first section and on pages without sections:
 * there the new language starts at the top anyway.
 */
function sectionHere(): string | null {
  const line = window.innerHeight * HERE_LINE;
  const sections = Array.from(document.querySelectorAll<HTMLElement>('main [data-section]'));
  const here = sections.find(section => {
    const { top, bottom } = section.getBoundingClientRect();
    return top <= line && bottom > line;
  });
  return here && here !== sections[0] ? here.id : null;
}

/**
 * uz / ru / en as plain links to the same page in each language, server
 * rendered so crawlers follow them (the hreflang alternates are in the page
 * metadata). A full page load, so every section starts in the new language;
 * the click adds the section being read as #hash, and the new page lands
 * there (useHashLanding) instead of at the top.
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
                onClick={event => {
                  if (isCurrent) return;
                  trackEvent('language_switch', { from: locale, to: language.id });
                  // On the element only: the rendered href stays hash-free for crawlers, and the next click re-reads the place.
                  event.currentTarget.hash = sectionHere() ?? '';
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
