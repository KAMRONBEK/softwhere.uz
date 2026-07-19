import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ENV, BLOG_CONFIG } from '@/core/constants';
import { safeJsonLd } from '@/shared/utils/security';

// Commercial landing pages for the estimator's strongest categories. Slugs are
// stable URL segments; namespaces key into `servicePages.*` in the messages.
const SERVICE_NAMESPACES = {
  'web-development': 'webDevelopment',
  'mobile-apps': 'mobileApps',
  'telegram-bots': 'telegramBots',
} as const;

type ServiceSlug = keyof typeof SERVICE_NAMESPACES;

const OFFERING_KEYS = ['offer1', 'offer2', 'offer3', 'offer4', 'offer5'] as const;
const WHY_KEYS = ['why1', 'why2', 'why3', 'why4'] as const;
// Price anchors mirror src/modules/estimator/data/catalog.ts (Tashkent 2026
// bands); mobile has a single MVP anchor, the rest are estimator territory.
const PRICE_ROW_COUNT: Record<ServiceSlug, number> = {
  'web-development': 4,
  'mobile-apps': 1,
  'telegram-bots': 4,
};

function resolveNamespace(service: string): (typeof SERVICE_NAMESPACES)[ServiceSlug] | null {
  return Object.prototype.hasOwnProperty.call(SERVICE_NAMESPACES, service) ? SERVICE_NAMESPACES[service as ServiceSlug] : null;
}

export function generateStaticParams() {
  return Object.keys(SERVICE_NAMESPACES).map(service => ({ service }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; service: string }> }): Promise<Metadata> {
  const { locale, service } = (await params) as { locale: Locale; service: string };
  const namespace = resolveNamespace(service);
  if (!namespace) notFound();

  const t = await getTranslations({ locale, namespace: `servicePages.${namespace}` });
  const title = t('metaTitle');
  const description = t('metaDescription');
  const url = `${ENV.BASE_URL}/${locale}/services/${service}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'SoftWhere.uz',
      locale,
      type: 'website',
      images: [{ url: `${ENV.BASE_URL}/api/og?title=${encodeURIComponent(t('h1'))}&locale=${locale}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${ENV.BASE_URL}/api/og?title=${encodeURIComponent(t('h1'))}&locale=${locale}`],
    },
    alternates: {
      canonical: url,
      languages: {
        'x-default': `${ENV.BASE_URL}/${BLOG_CONFIG.DEFAULT_LOCALE}/services/${service}`,
        uz: `${ENV.BASE_URL}/uz/services/${service}`,
        ru: `${ENV.BASE_URL}/ru/services/${service}`,
        en: `${ENV.BASE_URL}/en/services/${service}`,
      },
    },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ locale: string; service: string }> }) {
  const { locale, service } = (await params) as { locale: Locale; service: string };
  const namespace = resolveNamespace(service);
  if (!namespace) notFound();

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: `servicePages.${namespace}` });
  const tc = await getTranslations({ locale, namespace: 'servicePages.common' });
  const url = `${ENV.BASE_URL}/${locale}/services/${service}`;

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: t('h1'),
      description: t('metaDescription'),
      serviceType: t('h1'),
      url,
      inLanguage: locale,
      areaServed: [
        { '@type': 'Country', name: 'Uzbekistan' },
        { '@type': 'City', name: 'Tashkent' },
      ],
      provider: { '@type': 'Organization', name: 'SoftWhere.uz', url: ENV.BASE_URL },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SoftWhere.uz', item: `${ENV.BASE_URL}/${locale}` },
        { '@type': 'ListItem', position: 2, name: t('h1'), item: url },
      ],
    },
  ];

  const otherServices = (Object.keys(SERVICE_NAMESPACES) as ServiceSlug[]).filter(slug => slug !== service);

  return (
    <main className='page-layout' style={{ backgroundColor: 'var(--bg)' }}>
      {schemas.map((schema, i) => (
        <script key={i} type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      ))}
      <div className='container py-20'>
        <div className='max-w-4xl mx-auto'>
          <header className='mb-12'>
            <h1 className='text-4xl md:text-5xl font-bold font-display text-ember-text leading-tight tracking-tight mb-5'>{t('h1')}</h1>
            <p className='text-ember-muted text-lg leading-8 max-w-3xl'>{t('intro')}</p>
          </header>

          <section className='mb-12'>
            <h2 className='text-2xl font-bold font-display tracking-tight text-ember-text mb-6'>{tc('offeringsTitle')}</h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {OFFERING_KEYS.map(key => (
                <div key={key} className='bg-ember-surface rounded-lg border border-ember-border p-5'>
                  <h3 className='font-semibold font-display text-ember-text mb-2'>{t(`${key}Title`)}</h3>
                  <p className='text-ember-muted text-sm leading-6'>{t(`${key}Desc`)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className='mb-12'>
            <h2 className='text-2xl font-bold font-display tracking-tight text-ember-text mb-6'>{tc('pricingTitle')}</h2>
            <div className='bg-ember-surface rounded-lg border border-ember-border divide-y divide-ember-border'>
              {Array.from({ length: PRICE_ROW_COUNT[service as ServiceSlug] }, (_, i) => (
                <div key={i} className='flex items-center justify-between gap-4 p-5'>
                  {/* Row counts differ per service (mobile has only the MVP
                      anchor), so these keys can't be statically typed. */}
                  <span className='text-ember-text font-medium'>{t(`price${i + 1}Name` as never)}</span>
                  <span className='text-ember-accent font-semibold whitespace-nowrap'>{t(`price${i + 1}Range` as never)}</span>
                </div>
              ))}
            </div>
            <p className='text-ember-muted text-sm mt-3'>{tc('pricingNote')}</p>
          </section>

          <section className='mb-12'>
            <h2 className='text-2xl font-bold font-display tracking-tight text-ember-text mb-6'>{tc('whyTitle')}</h2>
            <ul className='space-y-3'>
              {WHY_KEYS.map(key => (
                <li key={key} className='flex gap-3 text-ember-text leading-7'>
                  <span className='text-ember-accent font-bold'>✓</span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </section>

          <section className='mb-12 bg-ember-surface rounded-lg border border-ember-border p-8 text-center'>
            <h2 className='text-2xl font-bold font-display tracking-tight text-ember-text mb-3'>{tc('ctaTitle')}</h2>
            <p className='text-ember-muted mb-6'>{tc('ctaBody')}</p>
            <div className='flex flex-wrap justify-center gap-4'>
              <Link
                href={`/${locale}/estimator`}
                className='!bg-ember-accent !text-[#0a0705] font-bold !rounded-full px-6 py-3 inline-block'
              >
                {tc('estimateCta')}
              </Link>
              <Link
                href={`/${locale}#contact`}
                className='border border-ember-border text-ember-text font-semibold rounded-full px-6 py-3 inline-block hover:opacity-70'
              >
                {tc('contactCta')}
              </Link>
            </div>
          </section>

          <section>
            <h2 className='text-xl font-bold font-display tracking-tight text-ember-text mb-4'>{tc('otherServicesTitle')}</h2>
            <div className='flex flex-wrap gap-4'>
              {otherServices.map(slug => (
                <Link
                  key={slug}
                  href={`/${locale}/services/${slug}`}
                  className='text-ember-accent font-semibold hover:underline underline-offset-4'
                >
                  {tc(`link_${SERVICE_NAMESPACES[slug]}`)} →
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
