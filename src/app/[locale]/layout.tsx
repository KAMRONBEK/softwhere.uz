import ThemeProvider from '@/shared/components/ThemeProvider';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { hasLocale, Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import React from 'react';
import { CONTACT_INFO, ENV, SOCIAL_LINKS } from '@/core/constants';
import { HOME_FACTS } from '@/modules/home/media/facts';
import { safeJsonLd } from '@/shared/utils/security';

// The site fonts (Inter, Sora, Manrope) live in (site)/layout.tsx: the
// homepage never uses them, so it neither preloads nor downloads them.

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
  const description = t('description', { projects: HOME_FACTS.projects });

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

// One Organization node for the whole site: the homepage OfferCatalog, the
// service pages' provider and blog posts' publisher reference it by this @id.
const ORGANIZATION_ID = `${ENV.BASE_URL}/#organization`;

function StructuredData() {
  const schemas = [
    {
      '@context': 'https://schema.org',
      // Plain Organization: schema.org deprecated ProfessionalService, and
      // local-intent ranking comes from a Business Profile, not from markup.
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'SoftWhere.uz',
      alternateName: 'SoftWhere',
      url: ENV.BASE_URL,
      // Raster logo: Google's logo guidelines do not accept SVG.
      logo: { '@type': 'ImageObject', url: `${ENV.BASE_URL}/favicon-256.png`, width: 256, height: 256 },
      email: CONTACT_INFO.EMAIL,
      address: { '@type': 'PostalAddress', addressLocality: 'Tashkent', addressCountry: 'UZ' },
      areaServed: [
        { '@type': 'Country', name: 'Uzbekistan' },
        { '@type': 'City', name: 'Tashkent' },
      ],
      knowsLanguage: ['uz', 'ru', 'en'],
      sameAs: [SOCIAL_LINKS.TELEGRAM, SOCIAL_LINKS.INSTAGRAM],
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: CONTACT_INFO.PHONE,
        contactType: 'customer service',
        availableLanguage: ['Uzbek', 'Russian', 'English'],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${ENV.BASE_URL}/#website`,
      name: 'SoftWhere.uz',
      alternateName: 'SoftWhere',
      url: ENV.BASE_URL,
      inLanguage: ['uz', 'ru', 'en'],
      publisher: { '@id': ORGANIZATION_ID },
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
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <StructuredData />
          {/* The homepage and /lab bring their own chrome and messages; every other
              page gets the site header, footer and fonts from (site)/layout.tsx. */}
          {children}
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
