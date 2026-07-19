import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ENV, BLOG_CONFIG } from '@/core/constants';

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
      locale,
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
    <main className='page-layout' style={{ backgroundColor: 'var(--bg)' }}>
      <div className='container py-20'>
        <div className='max-w-3xl mx-auto'>
          <h1 className='text-4xl font-bold font-display text-ember-text leading-tight tracking-tight mb-3'>{t('title')}</h1>
          <p className='text-ember-muted text-sm mb-8'>{t('updated')}</p>
          <p className='text-ember-text leading-7'>{t('intro')}</p>
          {SECTIONS.map(section => (
            <section key={section} className='mt-10'>
              <h2 className='text-2xl font-bold font-display tracking-tight text-ember-text mb-3'>{t(`${section}Title`)}</h2>
              <p className='text-ember-text leading-7 whitespace-pre-line'>{t(`${section}Body`)}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
