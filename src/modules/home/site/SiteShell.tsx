'use client';

import '../theme/okina.css';
import { usePathname } from 'next/navigation';
import { useRef, type MouseEvent, type ReactNode } from 'react';
import ScrollToTop from '@/shared/components/ScrollToTop';
import TelegramChat from '@/shared/components/TelegramChat';
import { trackEvent } from '@/shared/utils/analytics';
import { DEFAULT_LAB_STATE } from '../config';
import LabHeader from '../global/LabHeader';
import { HeaderModeContext } from '../global/SectionLink';
import { LAB_FONT_CLASSNAMES } from '../theme/fonts';
import { LAB_TOKENS_CSS } from '../theme/tokens';
import { StyleRootSync } from '../theme/useLabTheme';
import css from './SiteShell.module.css';

/** A phone or email link followed in the footer (the footer itself is static HTML). */
function trackFooterContact(event: MouseEvent<HTMLElement>): void {
  const href = event.target instanceof Element ? event.target.closest('a')?.getAttribute('href') : null;
  if (href?.startsWith('tel:')) trackEvent('external_link_click', { type: 'phone', source: 'footer' });
  else if (href?.startsWith('mailto:')) trackEvent('external_link_click', { type: 'email', source: 'footer' });
}

interface SiteShellProps {
  children: ReactNode;
  /** The pre-paint style script (theme/ThemeScript.tsx): the root's first child. */
  bootScript: ReactNode;
  /** Server-rendered footer (global/HomeFooter.tsx). */
  footer: ReactNode;
}

/**
 * The homepage's look around every other page: the themed root (the
 * visitor's style, kept as LabShell keeps it), the visitor header linking to
 * the homepage, the footer and the floating widgets. None of the homepage's
 * sections, smooth scroll, GSAP or WebGL: these are pages to read and fill in.
 */
export default function SiteShell({ children, bootScript, footer }: SiteShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const segment = usePathname()?.split('/')[2];
  const isAdmin = segment === 'admin';

  return (
    <HeaderModeContext.Provider value='site'>
      <style>{LAB_TOKENS_CSS}</style>
      {/* React only ever renders the default style; the boot script (before hydration) and
          StyleRootSync (after) set the visitor's, hence suppressHydrationWarning. */}
      <div
        ref={rootRef}
        data-lab-root=''
        data-site-root=''
        data-site-admin={isAdmin ? '' : undefined}
        data-style={DEFAULT_LAB_STATE.style}
        data-logo-color={DEFAULT_LAB_STATE.logoColor}
        className={`${LAB_FONT_CLASSNAMES} ${css.root}`}
        suppressHydrationWarning
      >
        {bootScript}
        <LabHeader />
        <div className={css.content} data-page-content=''>
          {children}
        </div>
        <div className={css.footer} data-page-chrome='' onClick={trackFooterContact}>
          {footer}
        </div>
        {/* On phones the estimator's sticky bar owns the bottom edge, and the AI plan's page is one long form. */}
        <div
          className={css.floats}
          data-page-chrome=''
          data-lifted={segment === 'estimator' ? '' : undefined}
          data-form={segment === 'ai-estimate' ? '' : undefined}
        >
          {isAdmin ? null : <TelegramChat />}
          <ScrollToTop />
        </div>
      </div>
      {/* After the root, so rootRef is attached when its layout effect runs (client-side mounts). */}
      <StyleRootSync rootRef={rootRef} />
    </HeaderModeContext.Provider>
  );
}
