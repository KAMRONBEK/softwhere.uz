import Footer from '@/shared/components/Footer';
import Header from '@/shared/components/Header';
import ScrollToTop from '@/shared/components/ScrollToTop';
import TelegramChat from '@/shared/components/TelegramChat';
import ThemeProvider from '@/shared/components/ThemeProvider';
import { BlogProvider } from '@/modules/blog/context/BlogContext';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { hasLocale, Locale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Inter, Sora, Manrope } from 'next/font/google';
import { notFound } from 'next/navigation';
import React from 'react';
import { ENV, SOCIAL_LINKS } from '@/core/constants';
import { safeJsonLd } from '@/shared/utils/security';

// Inter stays loaded with the Cyrillic subset so RU/UZ text always has full
// glyph coverage; Sora (display) and Manrope (body) are Latin-only and fall
// back to Inter for Cyrillic via the --disp/--body stacks in globals.css.
const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap', variable: '--font-inter' });
const sora = Sora({ subsets: ['latin'], display: 'swap', variable: '--font-sora', weight: ['400', '500', '600', '700', '800'] });
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope', weight: ['400', '500', '600', '700', '800'] });
// JetBrains Mono intentionally NOT loaded here — see src/shared/fonts.ts.

// Only the three known locales are valid; anything else 404s via the
// hasLocale() check in the layout body. Do NOT add `dynamicParams = false`
// here: on a parent layout it requires the ENTIRE nested path (locale AND
// slug) to be pre-generated, which made every on-demand blog post URL die
// with NoFallbackError — the runtime notFound() below already covers bad
// locales without breaking nested ISR routes.
export function generateStaticParams() {
  return [{ locale: 'uz' }, { locale: 'ru' }, { locale: 'en' }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const title = t('title');
  const description = t('description');

  // Only site-wide defaults belong here. openGraph/twitter/alternates used to
  // live in this layout, but Next merges page metadata shallowly: any route
  // that set `title` without also setting `twitter` inherited the HOMEPAGE's
  // og/twitter card and the homepage canonical. /uz/blog and /uz/privacy-policy
  // were both emitting the homepage's twitter:title. Those fields now live in
  // src/app/[locale]/page.tsx, which is the page they actually describe.
  return {
    title,
    description,
    icons: {
      icon: [
        { url: '/favicon-256.png', sizes: '256x256', type: 'image/png' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
      shortcut: '/favicon-256.png',
      apple: '/favicon-256.png',
    },
  };
}

function StructuredData() {
  const schemas = [
    {
      '@context': 'https://schema.org',
      // Plain Organization: schema.org deprecated ProfessionalService, and
      // local-intent ranking comes from a Business Profile, not from markup.
      '@type': 'Organization',
      name: 'SoftWhere.uz',
      url: ENV.BASE_URL,
      logo: `${ENV.BASE_URL}/icons/logo.svg`,
      email: 'kamuranbek98@gmail.com',
      areaServed: [
        { '@type': 'Country', name: 'Uzbekistan' },
        { '@type': 'City', name: 'Tashkent' },
      ],
      knowsLanguage: ['uz', 'ru', 'en'],
      sameAs: [SOCIAL_LINKS.TELEGRAM, SOCIAL_LINKS.INSTAGRAM],
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+998332499111',
        contactType: 'customer service',
        availableLanguage: ['Uzbek', 'Russian', 'English'],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'SoftWhere.uz',
      url: ENV.BASE_URL,
      inLanguage: ['uz', 'ru', 'en'],
      publisher: { '@type': 'Organization', name: 'SoftWhere.uz' },
    },
  ];

  return (
    <>
      {schemas.map((s, i) => (
        <script key={i} type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(s) }} />
      ))}
    </>
  );
}

type Props = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export default async function RootLayout({ children, params }: Props) {
  const { locale } = (await params) as { locale: Locale };

  if (!hasLocale(['en', 'ru', 'uz'] as const, locale)) {
    notFound();
  }

  // Enables static rendering: without this next-intl reads headers() and the
  // whole tree opts into dynamic rendering.
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${sora.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <StructuredData />
          <NextIntlClientProvider messages={messages}>
            <BlogProvider>
              <Header />
              {children}
              <ScrollToTop />
              <TelegramChat />
              <Footer />
            </BlogProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
