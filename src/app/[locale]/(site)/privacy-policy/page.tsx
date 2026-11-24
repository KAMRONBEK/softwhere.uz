import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ENV, BLOG_CONFIG, ogLocaleFields } from '@/core/constants';
import { Page, PageHero, Section } from '@/shared/components/site';
import css from './privacy.module.css';

const SECTIONS = ['collect', 'use', 'store', 'analytics', 'cookies', 'ai', 'rights', 'changes'] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'privacy' });

  const title = `${t('title')} | SoftWhere.uz`;
  const description = t('metaDescription');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${ENV.BASE_URL}/${locale}/privacy-policy`,
      siteName: 'SoftWhere.uz',
      ...ogLocaleFields(locale),
      type: 'website',
    },
    // Own canonical: without it the page would inherit the home canonical
    // from the [locale] layout (see estimator/page.tsx for the precedent).
    alternates: {
      canonical: `${ENV.BASE_URL}/${locale}/privacy-policy`,
      languages: {
        'x-default': `${ENV.BASE_URL}/${BLOG_CONFIG.DEFAULT_LOCALE}/privacy-policy`,
        uz: `${ENV.BASE_URL}/uz/privacy-policy`,
        ru: `${ENV.BASE_URL}/ru/privacy-policy`,
        en: `${ENV.BASE_URL}/en/privacy-policy`,
      },
    },
  };
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'privacy' });

  return (
    <Page>
      <PageHero title={<span className={css.title}>{t('title')}</span>} meta={t('updated')} />
      <Section>
        <p className={css.intro}>{t('intro')}</p>
        {SECTIONS.map(section => (
          <section key={section} className={css.clause}>
            <h2 className={css.heading}>{t(`${section}Title`)}</h2>
            <p className={css.body}>{t(`${section}Body`)}</p>
          </section>
        ))}
      </Section>
    </Page>
  );
}
