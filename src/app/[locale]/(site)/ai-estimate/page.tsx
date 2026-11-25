import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BRIEF_PRICE_MODE, IS_PLAN_LAUNCHED } from '@/core/briefPriceMode';
import { BLOG_CONFIG, ENV, ogLocaleFields } from '@/core/constants';
import { buildOgUrl } from '@/core/og';
import AIBriefSection from '@/modules/estimator/components/brief/AIBriefSection';
import { Container, Page } from '@/shared/components/site';
import ContactForm from './ContactForm';
import PageToasts from './PageToasts';

// Until launch (src/core/briefPriceMode.ts): noindex, absent from the sitemap and not linked from the live site.
const META_KEYS = ({ range: 'meta', from: 'from', request: 'request' } as const)[BRIEF_PRICE_MODE];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'aiBrief' });
  const title = META_KEYS === 'meta' ? t('meta.title') : t(`${META_KEYS}.metaTitle`);
  const description = META_KEYS === 'meta' ? t('meta.description') : t(`${META_KEYS}.metaDescription`);
  if (!IS_PLAN_LAUNCHED) return { title, description, robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };

  const url = (l: string) => `${ENV.BASE_URL}/${l}/ai-estimate`;
  const ogImageUrl = await buildOgUrl({ title, locale });
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: url(locale),
      siteName: 'SoftWhere.uz',
      ...ogLocaleFields(locale),
      type: 'website',
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImageUrl] },
    alternates: {
      canonical: url(locale),
      languages: { 'x-default': url(BLOG_CONFIG.DEFAULT_LOCALE), uz: url('uz'), ru: url('ru'), en: url('en') },
    },
  };
}

export default async function AiEstimatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  return (
    <Page>
      <Container>
        <AIBriefSection variant='full' />
      </Container>
      {/* "Talk to us about this plan" prefills this form; it stays outside the
          brief's provider, which only carries the brief's messages. */}
      <ContactForm />
      <PageToasts />
    </Page>
  );
}
