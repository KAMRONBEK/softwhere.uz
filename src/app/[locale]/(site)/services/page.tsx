import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { ENV, BLOG_CONFIG, ogLocaleFields } from '@/core/constants';
import { buildOgUrl } from '@/core/og';
import { SERVICE_NAMESPACES, SERVICE_SLUGS } from '@/shared/data/services';
import { safeJsonLd } from '@/shared/utils/security';

// The /services hub: one card per service landing page, plus the work that has
// no landing page yet (CRM/ERP, AI on documents), which links to the estimator.
// Same layout and card styles as services/[service]/page.tsx.
const MORE_KEYS = ['crm', 'ai'] as const;

const CARD_CLASS =
  'bg-ember-surface rounded-lg border border-ember-border p-5 relative transition-colors hover:border-ember-accent focus-within:border-ember-accent';
/** The card's title link covers the whole card (a stretched link), so the card itself is the tap target. */
const CARD_LINK_CLASS = "underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']";
const H2_CLASS = 'text-2xl font-bold font-display tracking-tight text-ember-text mb-6';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'servicePages.index' });
  const title = t('metaTitle');
  const description = t('metaDescription');
  const url = `${ENV.BASE_URL}/${locale}/services`;
  const ogImageUrl = await buildOgUrl({ title: t('h1'), locale });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'SoftWhere.uz',
      ...ogLocaleFields(locale),
      type: 'website',
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: url,
      languages: {
        'x-default': `${ENV.BASE_URL}/${BLOG_CONFIG.DEFAULT_LOCALE}/services`,
        uz: `${ENV.BASE_URL}/uz/services`,
        ru: `${ENV.BASE_URL}/ru/services`,
        en: `${ENV.BASE_URL}/en/services`,
      },
    },
  };
}

export default async function ServicesHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'servicePages' });
  const url = `${ENV.BASE_URL}/${locale}/services`;
  const serviceUrl = (slug: string) => `${url}/${slug}`;

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: t('index.h1'),
      itemListElement: SERVICE_SLUGS.map((slug, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: t(`${SERVICE_NAMESPACES[slug]}.h1`),
        url: serviceUrl(slug),
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SoftWhere.uz', item: `${ENV.BASE_URL}/${locale}` },
        { '@type': 'ListItem', position: 2, name: t('common.servicesHub'), item: url },
      ],
    },
  ];

  return (
    <main className='page-layout' style={{ backgroundColor: 'var(--bg)' }}>
      {schemas.map((schema, i) => (
        <script key={i} type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      ))}
      <div className='container py-20'>
        <div className='max-w-4xl mx-auto'>
          <header className='mb-12'>
            <h1 className='text-4xl md:text-5xl font-bold font-display text-ember-text leading-tight tracking-tight mb-5'>
              {t('index.h1')}
            </h1>
            <p className='text-ember-muted text-lg leading-8 max-w-3xl'>{t('index.intro')}</p>
          </header>

          <section className='mb-12 grid grid-cols-1 md:grid-cols-3 gap-4'>
            {SERVICE_SLUGS.map(slug => {
              const ns = SERVICE_NAMESPACES[slug];
              return (
                <div key={slug} className={CARD_CLASS}>
                  <h2 className='text-xl font-semibold font-display text-ember-text mb-2'>
                    <Link href={`/${locale}/services/${slug}`} className={CARD_LINK_CLASS}>
                      {t(`${ns}.h1`)}
                      <span aria-hidden='true' className='text-ember-accent'>
                        {'\u00A0'}→
                      </span>
                    </Link>
                  </h2>
                  <p className='text-ember-muted text-sm leading-6'>{t(`${ns}.intro`)}</p>
                </div>
              );
            })}
          </section>

          <section className='mb-12'>
            <h2 className={H2_CLASS}>{t('index.moreTitle')}</h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {MORE_KEYS.map(key => (
                <div key={key} className={CARD_CLASS}>
                  <h3 className='font-semibold font-display text-ember-text mb-2'>
                    <Link href={`/${locale}/estimator`} className={CARD_LINK_CLASS}>
                      {t(`index.${key}Title`)}
                      <span aria-hidden='true' className='text-ember-accent'>
                        {'\u00A0'}→
                      </span>
                    </Link>
                  </h3>
                  <p className='text-ember-muted text-sm leading-6'>{t(`index.${key}Desc`)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className='bg-ember-surface rounded-lg border border-ember-border p-8 text-center'>
            <h2 className='text-2xl font-bold font-display tracking-tight text-ember-text mb-3'>{t('common.ctaTitle')}</h2>
            <p className='text-ember-muted mb-6'>{t('common.ctaBody')}</p>
            <div className='flex flex-wrap justify-center gap-4'>
              <Link
                href={`/${locale}/estimator`}
                className='!bg-ember-accent !text-[#0a0705] font-bold !rounded-full px-6 py-3 inline-block'
              >
                {t('common.estimateCta')}
              </Link>
              <Link
                href={`/${locale}#contact`}
                className='border border-ember-border text-ember-text font-semibold rounded-full px-6 py-3 inline-block hover:opacity-70'
              >
                {t('common.contactCta')}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
