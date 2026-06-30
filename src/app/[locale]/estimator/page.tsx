import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Wizard } from '@/components/Estimator';
import { ENV, BLOG_CONFIG } from '@/constants';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const tEstimator = await getTranslations({ locale, namespace: 'estimator' });
  const tCta = await getTranslations({ locale, namespace: 'estimatorCTA' });

  const title = `${tEstimator('title')} | SoftWhere.uz`;
  const description = tCta('description');

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
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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
  return <Wizard />;
}
