'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, type CSSProperties, type MouseEvent, type RefObject } from 'react';
import type { SectionId, StyleId } from '../types';
import { BUILD_STORIES, CTA_TARGET, HEADER_LINKS } from './LabHeader.copy';
import { LanguageLinks } from './LabHeaderLanguage';
import { useDismiss, type DismissReason } from './LabHeader.hooks';
import { StoryList } from './LabHeaderStories';
import { ThemeOptions, type PickHandler } from './LabHeaderTheme';
import { getLabLenis } from './scroll';
import css from './LabHeader.module.css';

/** Where the bar shows the chapter links itself (LabHeader.module.css uses the same width). */
/* 1280, not 1100: Russian and Uzbek labels plus the language codes need the room. */
export const LINKS_QUERY = '(min-width: 1280px)';

/**
 * While the sheet is open the page behind it neither scrolls (Lenis stopped,
 * the root overflow clipped) nor takes focus or taps (`inert`).
 */
function usePageLock(rootRef: RefObject<HTMLElement | null>, isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;
    const html = document.documentElement;
    const main = rootRef.current?.closest('[data-lab-root]')?.querySelector('main');
    const previousOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    getLabLenis()?.stop();
    if (main) main.inert = true;
    return () => {
      html.style.overflow = previousOverflow;
      getLabLenis()?.start();
      if (main) main.inert = false;
    };
  }, [rootRef, isLocked]);
}

interface MenuButtonProps {
  isOpen: boolean;
  controls: string;
  onToggle: () => void;
}

/** Two bars that cross into an X; the label is for screen readers. */
export function MenuButton({ isOpen, controls, onToggle }: MenuButtonProps) {
  const t = useTranslations('home.header.menu');
  return (
    <button
      type='button'
      className={css.menuButton}
      aria-expanded={isOpen}
      aria-controls={controls}
      aria-label={isOpen ? t('close') : t('open')}
      onClick={onToggle}
    >
      <span className={css.menuBars} aria-hidden='true'>
        <span />
        <span />
      </span>
    </button>
  );
}

interface MenuSheetProps {
  id: string;
  /** The header element: the sheet and its toggle both live inside it. */
  headerRef: RefObject<HTMLElement | null>;
  style: StyleId;
  currentSection: SectionId | null;
  currentLink: SectionId | null;
  /** Escape or a press outside the header; the parent closes the sheet (and refocuses the toggle on Escape). */
  onDismiss: (reason: DismissReason) => void;
  /** Close without a dismissal (the window grew to the desktop layout). */
  onClose: () => void;
  /** A look was picked: the parent closes the sheet as the new look grows over the page. */
  onPickStyle: PickHandler;
  onJump: (id: SectionId) => void;
}

/**
 * The phone (and narrow tablet) menu: the five build stories with how far
 * the visitor has read each, the other chapters in the style's display face,
 * the four looks in a row, the languages, and the call to action, in a sheet that drops
 * from under the bar. Rendered only while open (the bar's toggle mounts it).
 */
export function MenuSheet({ id, headerRef, style, currentSection, currentLink, onDismiss, onClose, onPickStyle, onJump }: MenuSheetProps) {
  const t = useTranslations('home.header');
  const tShared = useTranslations('home.shared');
  const sheetRef = useRef<HTMLDivElement>(null);
  usePageLock(headerRef, true);
  useDismiss(headerRef, true, onDismiss);

  useEffect(() => {
    sheetRef.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus({ preventScroll: true });
    // A phone turned into a desktop-width window: the bar shows the links again.
    const desktop = window.matchMedia(LINKS_QUERY);
    const onChange = () => desktop.matches && onClose();
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, [onClose]);

  const jump = (target: SectionId) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onJump(target);
  };
  const linksFrom = BUILD_STORIES.length + 1;

  return (
    <div ref={sheetRef} id={id} className={css.sheet} data-lenis-prevent=''>
      <nav aria-label={t('menu.label')} className={css.sheetNav}>
        <div className={css.sheetGroup}>
          <p className={css.sheetLabel} style={{ '--i': 0 } as CSSProperties}>
            {t('build.label')}
          </p>
          <StoryList variant='grid' currentSection={currentSection} isLive onJump={onJump} staggerFrom={1} />
        </div>
        <ul className={css.sheetLinks}>
          {HEADER_LINKS.map((link, index) => (
            <li key={link.target} style={{ '--i': linksFrom + index } as CSSProperties}>
              <a
                href={`#${link.target}`}
                className={css.sheetLink}
                aria-current={currentLink === link.target ? 'true' : undefined}
                onClick={jump(link.target)}
              >
                {t(`links.${link.target}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className={css.sheetTheme} style={{ '--i': linksFrom + HEADER_LINKS.length } as CSSProperties}>
        <p className={css.sheetLabel}>{t('theme.label')}</p>
        <ThemeOptions value={style} onPick={onPickStyle} layout='row' />
        <p className={css.sheetHint}>{t('theme.hint')}</p>
      </div>
      <div className={css.sheetLanguageGroup} style={{ '--i': linksFrom + HEADER_LINKS.length + 1 } as CSSProperties}>
        <p className={css.sheetLabel}>{t('language.label')}</p>
        <LanguageLinks variant='sheet' />
      </div>
      <a
        href={`#${CTA_TARGET}`}
        className={css.sheetCta}
        style={{ '--i': linksFrom + HEADER_LINKS.length + 2 } as CSSProperties}
        onClick={jump(CTA_TARGET)}
      >
        {tShared('callCta')}
      </a>
    </div>
  );
}
