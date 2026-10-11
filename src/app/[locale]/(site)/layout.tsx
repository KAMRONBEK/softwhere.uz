import Footer from '@/shared/components/Footer';
import Header from '@/shared/components/Header';
import ScrollToTop from '@/shared/components/ScrollToTop';
import TelegramChat from '@/shared/components/TelegramChat';
import { BlogProvider } from '@/modules/blog/context/BlogContext';
import { NextIntlClientProvider, type Locale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Inter, Manrope, Sora } from 'next/font/google';
import React from 'react';
import { CLIENT_MESSAGE_NAMESPACES, pickMessages } from '@/core/messages';

// Inter stays loaded with the Cyrillic subset so RU/UZ text always has full
// glyph coverage; Sora (display) and Manrope (body) are Latin-only and fall
// back to Inter for Cyrillic via the --font-* stacks in globals.css.
// JetBrains Mono intentionally NOT loaded here — see src/shared/fonts.ts.
//
// Declared in this route group's layout, not the locale layout, so only the
// site's pages preload and ship them: the homepage (src/modules/home) draws
// with its own faces and never uses these.
const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap' });
const sora = Sora({ subsets: ['latin'], display: 'swap', weight: ['400', '500', '600', '700', '800'] });
const manrope = Manrope({ subsets: ['latin'], display: 'swap', weight: ['400', '500', '600', '700', '800'] });

// The faces as the --font-* variables globals.css, tailwind.config and the
// shared components read. Set on :root (not a wrapper element) because
// body's own font-family and portalled UI (toasts, dialogs) resolve them there.
const FONT_VARIABLES_CSS = `:root{--font-inter:${inter.style.fontFamily};--font-sora:${sora.style.fontFamily};--font-manrope:${manrope.style.fontFamily};}`;

/**
 * Every page except the homepage: the site header and footer, the floating
 * widgets (scroll-to-top, Telegram chat), the site fonts and the client
 * messages they read. The homepage (src/app/[locale]/page.tsx) and the
 * noindex /lab staging pages sit outside this group, so none of it is built
 * into or sent with them.
 */
interface SiteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { locale } = (await params) as { locale: Locale };
  // Static rendering: set per layout, as the locale layout does.
  setRequestLocale(locale);
  // Only the namespaces this chrome's client tree reads go to the browser.
  // Pages with extra client needs nest their own provider (src/core/messages.ts, docs/i18n.md).
  const messages = pickMessages(await getMessages(), CLIENT_MESSAGE_NAMESPACES);

  return (
    <>
      <style>{FONT_VARIABLES_CSS}</style>
      <NextIntlClientProvider messages={messages}>
        <BlogProvider>
          <Header />
          {children}
          <ScrollToTop />
          <TelegramChat />
          <Footer />
        </BlogProvider>
      </NextIntlClientProvider>
    </>
  );
}
