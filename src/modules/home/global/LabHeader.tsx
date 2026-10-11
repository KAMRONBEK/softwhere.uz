'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState, type MouseEvent } from 'react';
import { useLabState } from '../context/LabContext';
import { useLabLogo } from '../logos';
import { pickStyle, type PickOptions } from '../theme/switchStyle';
import { useLabStyle } from '../theme/useLabTheme';
import type { SectionId, StyleId } from '../types';
import { BUILD_GROUP, CTA_TARGET, HEADER_LINKS } from './LabHeader.copy';
import { useCurrentSection, useFocusWithin, useHideOnScroll, type DismissReason } from './LabHeader.hooks';
import { LanguageLinks } from './LabHeaderLanguage';
import { MenuButton, MenuSheet } from './LabHeaderMenu';
import { BuildMenu } from './LabHeaderStories';
import { ThemePicker } from './LabHeaderTheme';
import { scrollToSection, scrollToY } from './scroll';
import css from './LabHeader.module.css';

type Layer = 'none' | 'theme' | 'menu' | 'stories';

/**
 * One header per page, so fixed ids (not useId: an id that differs between
 * the server render and hydration would mismatch on aria-controls).
 */
const SHEET_ID = 'lab-menu-sheet';

/** Moves focus to a jump's target so Tab continues from there (the section itself takes no ring). */
function focusSection(id: SectionId): void {
  const el = document.getElementById(id);
  if (!el) return;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/**
 * The visitor header: the logo, the page's chapters ("How we build" opens
 * its five stories), the languages (desktop; the phone sheet has them too),
 * the theme picker and "Book a call". Fixed over the page;
 * slides away while the visitor reads down and comes back on the first move
 * up; always there at the top. Below 1280px the chapters move into a sheet
 * behind a menu button, and the bar keeps the picker and a compact "Book a
 * call". Painted only with the style tokens, so it belongs to every style.
 */
export default function LabHeader() {
  const t = useTranslations('home.header');
  const tShared = useTranslations('home.shared');
  const { state, update } = useLabState();
  const style = useLabStyle();
  const { Logo } = useLabLogo();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonWrapRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<Layer>('none');
  const hasKeyboardFocus = useFocusWithin(headerRef);
  const { isHidden, isAtTop, hideNow, holdShown } = useHideOnScroll(layer !== 'none' || hasKeyboardFocus);
  const currentSection = useCurrentSection(headerRef, state.only);
  const currentLink = HEADER_LINKS.find(link => currentSection && link.group.includes(currentSection))?.target ?? null;
  const isBuildCurrent = currentSection !== null && BUILD_GROUP.includes(currentSection);

  const focusMenuButton = useCallback(() => {
    menuButtonWrapRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);

  // The popover stays open after a pick, so the visitor can compare looks.
  const pickFromPopover = useCallback((id: StyleId, options: PickOptions) => void pickStyle(id, options), []);
  // The phone menu covers the page: it closes in the same frame as the switch, so the new look grows over the page itself.
  const pickFromSheet = useCallback(
    (id: StyleId, options: PickOptions) =>
      void pickStyle(id, {
        ...options,
        onApply: () => {
          setLayer('none');
          // The switch re-anchors the scroll; the bar the visitor just used stays put.
          holdShown();
          requestAnimationFrame(focusMenuButton);
        },
      }),
    [focusMenuButton, holdShown]
  );

  const setThemeOpen = useCallback((isOpen: boolean) => setLayer(isOpen ? 'theme' : 'none'), []);
  const setStoriesOpen = useCallback((isOpen: boolean) => setLayer(isOpen ? 'stories' : 'none'), []);
  const closeLayer = useCallback(() => setLayer('none'), []);
  const dismissMenu = useCallback(
    (reason: DismissReason) => {
      setLayer('none');
      if (reason === 'escape') focusMenuButton();
    },
    [focusMenuButton]
  );

  const jumpTo = useCallback(
    (id: SectionId) => {
      setLayer('none');
      // Solo mode shows one section: switch to the target instead of scrolling.
      if (state.only) {
        update({ only: id });
        return;
      }
      // Next frame: the menu's scroll lock is released by then.
      requestAnimationFrame(() => {
        scrollToSection(id);
        focusSection(id);
        hideNow();
      });
    },
    [state.only, update, hideNow]
  );

  const onLinkClick = (id: SectionId) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    jumpTo(id);
  };

  const onLogoClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setLayer('none');
    scrollToY(0);
  };

  return (
    <header
      ref={headerRef}
      className={css.header}
      data-lab-header=''
      data-hidden={isHidden ? 'true' : undefined}
      data-at-top={isAtTop && layer !== 'menu' ? 'true' : undefined}
      data-menu={layer === 'menu' ? 'open' : undefined}
    >
      <div className={css.bar}>
        <a href='#hero' className={css.home} aria-label={t('homeLabel')} onClick={onLogoClick}>
          <Logo className={css.logo} title='SoftWhere' />
        </a>

        <nav className={css.nav} aria-label={t('navLabel')}>
          <ul className={css.links}>
            <li>
              <BuildMenu
                isOpen={layer === 'stories'}
                isCurrent={isBuildCurrent}
                currentSection={currentSection}
                onOpenChange={setStoriesOpen}
                onJump={jumpTo}
              />
            </li>
            {HEADER_LINKS.map(link => (
              <li key={link.target}>
                <a
                  href={`#${link.target}`}
                  className={css.link}
                  aria-current={currentLink === link.target ? 'true' : undefined}
                  onClick={onLinkClick(link.target)}
                >
                  {t(`links.${link.target}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className={css.actions}>
          <LanguageLinks variant='bar' />
          <ThemePicker
            value={style}
            isOpen={layer === 'theme'}
            isOtherLayerOpen={layer === 'menu' || layer === 'stories'}
            onOpenChange={setThemeOpen}
            onPick={pickFromPopover}
          />
          <a href={`#${CTA_TARGET}`} className={css.cta} data-magnetic='' onClick={onLinkClick(CTA_TARGET)}>
            {/* Phones: a shorter label, so the menu button keeps its place in every language. */}
            <span className={css.ctaFull}>{tShared('callCta')}</span>
            <span className={css.ctaShort} aria-hidden='true'>
              {t('ctaShort')}
            </span>
          </a>
          <div ref={menuButtonWrapRef} className={css.menuSlot}>
            <MenuButton isOpen={layer === 'menu'} controls={SHEET_ID} onToggle={() => setLayer(layer === 'menu' ? 'none' : 'menu')} />
          </div>
        </div>
      </div>

      {layer === 'menu' && (
        <MenuSheet
          id={SHEET_ID}
          headerRef={headerRef}
          style={style}
          currentSection={currentSection}
          currentLink={currentLink}
          onDismiss={dismissMenu}
          onClose={closeLayer}
          onPickStyle={pickFromSheet}
          onJump={jumpTo}
        />
      )}
    </header>
  );
}
