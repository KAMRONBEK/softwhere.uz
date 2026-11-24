import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import AIBriefSection from '@/modules/estimator/components/brief/AIBriefSection';
import { Container, Page } from '@/shared/components/site';
import ContactForm from './ContactForm';
import PageToasts from './PageToasts';

// Not launched yet: noindex, absent from the sitemap and not linked from the
// live site. Remove the robots block (and add the route to sitemap.ts) on launch.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'aiBrief.meta' });
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
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
