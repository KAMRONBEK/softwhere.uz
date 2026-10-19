import type { Metadata, Viewport } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ENV, BLOG_CONFIG, ogLocaleFields } from '@/core/constants';
import { buildOgUrl } from '@/core/og';
import { DEFAULT_LAB_STATE } from '@/modules/home/config';
import { HOME_FACTS } from '@/modules/home/media/facts';
import { LAB_STYLES } from '@/modules/home/theme/styles';
import { SERVICE_NAMESPACES, SERVICE_SLUGS } from '@/shared/data/services';
import { safeJsonLd } from '@/shared/utils/security';
import HomeExperience from './_home/HomeExperience';

// ISR: publishes bust the 'blog-posts' tag, which re-renders this page and
// keeps the latest-posts block fresh — the time window is only a safety net,
// so keep it long. Hourly re-renders here were a measurable Fluid CPU cost.
export const revalidate = 86400;

// The homepage's own og/twitter card and canonical. These used to sit in
// [locale]/layout.tsx, where every route that didn't set them inherited the
// homepage's card and canonical URL.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const title = t('title');
  // {projects} comes from the portfolio data, so it matches the hero's count.
  const description = t('description', { projects: HOME_FACTS.projects });
  const ogImageUrl = await buildOgUrl({ title, locale });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${ENV.BASE_URL}/${locale}`,
      siteName: 'SoftWhere.uz',
      ...ogLocaleFields(locale),
      type: 'website',
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${ENV.BASE_URL}/${locale}`,
      languages: {
        'x-default': `${ENV.BASE_URL}/${BLOG_CONFIG.DEFAULT_LOCALE}`,
        uz: `${ENV.BASE_URL}/uz`,
        ru: `${ENV.BASE_URL}/ru`,
        en: `${ENV.BASE_URL}/en`,
      },
    },
  };
}

// viewport-fit=cover makes env(safe-area-inset-*) real on notched phones (the
// full-bleed sections rely on it). The bar colour is the default style's page;
// the theme script switches it to the visitor's remembered style before paint.
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: LAB_STYLES[DEFAULT_LAB_STATE.style].colors.bg,
};

// The homepage is src/modules/home (see its README). The server HTML is the
// same for every visitor — default style, every section's static stand-in
// (heading + summary from src/messages/home/*) — so it stays cacheable; the
// visitor's style and each section's interactive version arrive on the client.
// The site Header, Footer, widgets and fonts live in (site)/layout.tsx, which
// this page is outside of: the home module draws its own header and footer.
// JSON-LD (Organization, WebSite) comes from the locale layout; this page adds
// the services the Organization offers, referenced by its @id.
async function OfferCatalogJsonLd({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'servicePages' });
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${ENV.BASE_URL}/#organization`,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: t('index.h1'),
      url: `${ENV.BASE_URL}/${locale}/services`,
      itemListElement: SERVICE_SLUGS.map(slug => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: t(`${SERVICE_NAMESPACES[slug]}.h1`),
          url: `${ENV.BASE_URL}/${locale}/services/${slug}`,
          areaServed: { '@type': 'City', name: 'Tashkent' },
        },
      })),
    },
  };

  return <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />;
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  return (
    <>
      <OfferCatalogJsonLd locale={locale} />
      <HomeExperience locale={locale} mode='home' initial={DEFAULT_LAB_STATE} />
    </>
  );
}
