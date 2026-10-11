import type { Metadata } from 'next';
import { Locale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Wizard } from '@/modules/estimator/components';
import { ENV, BLOG_CONFIG } from '@/core/constants';
import { buildOgUrl } from '@/core/og';
import { pickMessages } from '@/core/messages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'estimator' });

  // A commercial title/description with a price token. The live title was
  // "Loyiha kalkulyatori | SoftWhere.uz" — nothing to rank for. Phrased so it
  // does not collide with the service pages, which own "veb-sayt yaratish".
  const title = t('metaTitle');
  const description = t('metaDescription');
  const ogImageUrl = await buildOgUrl({ title, locale });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${ENV.BASE_URL}/${locale}/estimator`,
      siteName: 'SoftWhere.uz',
      locale,
      type: 'website',
      // Page metadata shallow-replaces the layout's openGraph, so re-declare the
      // dynamic OG card here or the estimator would have no og:image.
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    // Own canonical so /uz/estimator no longer inherits the home canonical and
    // becomes independently indexable.
    alternates: {
      canonical: `${ENV.BASE_URL}/${locale}/estimator`,
      languages: {
        'x-default': `${ENV.BASE_URL}/${BLOG_CONFIG.DEFAULT_LOCALE}/estimator`,
        uz: `${ENV.BASE_URL}/uz/estimator`,
        ru: `${ENV.BASE_URL}/ru/estimator`,
        en: `${ENV.BASE_URL}/en/estimator`,
      },
    },
  };
}

export default async function EstimatorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  // The wizard is the only client tree that reads `estimator` (11–16KB), so it
  // gets its own provider instead of the layout shipping it on every page.
  const messages = pickMessages(await getMessages(), ['estimator']);
  return (
    <NextIntlClientProvider messages={messages}>
      <Wizard />
    </NextIntlClientProvider>
  );
}
