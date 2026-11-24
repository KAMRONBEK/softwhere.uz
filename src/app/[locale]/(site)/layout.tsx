import type { Viewport } from 'next';
import { NextIntlClientProvider, type Locale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import React from 'react';
import { CLIENT_MESSAGE_NAMESPACES, pickMessages, pickSiteChromeMessages } from '@/core/messages';
import { DEFAULT_LAB_STATE } from '@/modules/home/config';
import HomeFooter from '@/modules/home/global/HomeFooter';
import SiteShell from '@/modules/home/site/SiteShell';
import { LAB_FONTS } from '@/modules/home/theme/fonts';
import { LAB_STYLES } from '@/modules/home/theme/styles';
import ThemeScript from '@/modules/home/theme/ThemeScript';

// As on the homepage: the default look's colour, which the theme script
// switches to the visitor's look before paint, and real safe-area insets.
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: LAB_STYLES[DEFAULT_LAB_STATE.style].colors.bg,
};

// The looks' faces on :root too: body's font and portalled UI (toasts,
// dialogs) resolve --font-body there, outside the themed root.
const FONT_VARIABLES_CSS = `:root{${Object.values(LAB_FONTS)
  .map(font => `${font.cssVar}:${font.family}`)
  .join(';')}}`;

/**
 * Every page except the homepage: the homepage's own look (theme tokens,
 * header, footer) without its sections, the floating widgets and the client
 * messages they read. The homepage (src/app/[locale]/page.tsx) and the
 * noindex /lab staging pages sit outside this group and draw their own.
 */
interface SiteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { locale } = (await params) as { locale: Locale };
  // Static rendering: set per layout, as the locale layout does.
  setRequestLocale(locale);
  // Only what this chrome's client tree reads goes to the browser.
  // Pages with extra client needs nest their own provider (src/core/messages.ts, docs/i18n.md).
  const all = await getMessages();
  const messages = { ...pickMessages(all, CLIENT_MESSAGE_NAMESPACES), ...pickSiteChromeMessages(all) };

  return (
    <>
      <style>{FONT_VARIABLES_CSS}</style>
      <NextIntlClientProvider messages={messages}>
        <SiteShell bootScript={<ThemeScript />} footer={<HomeFooter locale={locale} />}>
          {children}
        </SiteShell>
      </NextIntlClientProvider>
    </>
  );
}
