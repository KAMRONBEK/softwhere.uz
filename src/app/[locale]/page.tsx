import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ENV, BLOG_CONFIG } from '@/core/constants';
import { buildOgUrl } from '@/core/og';

import LatestPostsSection from '@/modules/blog/components/LatestPostsSection';
import HomeClientLayer from '@/shared/components/HomeClientLayer';
import Hero from '@/shared/components/sections/Hero';
import Trust from '@/shared/components/sections/Trust';
import Service from '@/shared/components/sections/Service';
import AISpotlight from '@/shared/components/sections/AISpotlight';
import Process from '@/shared/components/sections/Process';
import Projects from '@/shared/components/sections/Projects';
import Contact from '@/shared/components/sections/Contact';
import EstimatorCTA from '@/shared/components/sections/EstimatorCTA';

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
  const description = t('description');
  const ogImageUrl = await buildOgUrl({ title, locale });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${ENV.BASE_URL}/${locale}`,
      siteName: 'SoftWhere.uz',
      locale,
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

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  return (
    <main>
      <HomeClientLayer locale={locale} />
      <Hero />
      <Trust />
      <Service />
      <AISpotlight />
      <Process />
      <Projects />
      <LatestPostsSection locale={locale} />
      <Contact />
      <EstimatorCTA />
    </main>
  );
}
