import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ENV, BLOG_CONFIG, ogLocaleFields } from '@/core/constants';
import { ESTIMATE_PATH } from '@/core/briefPriceMode';
import { buildOgUrl } from '@/core/og';
import { Arrow, Breadcrumbs, ButtonLink, CtaBand, Page, Section } from '@/shared/components/site';
import { SERVICE_NAMESPACES, type ServiceSlug } from '@/shared/data/services';
import { safeJsonLd } from '@/shared/utils/security';
import { PriceTable } from '../_components/PriceTable';
import { ServiceHero } from '../_components/ServiceHero';
import css from '../services.module.css';

// Commercial landing pages for the estimator's strongest categories. The
// slug → `servicePages.*` namespace map lives in shared/data/services.ts.

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
      provider: { '@id': `${ENV.BASE_URL}/#organization` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'SoftWhere.uz', item: `${ENV.BASE_URL}/${locale}` },
        { '@type': 'ListItem', position: 2, name: tc('servicesHub'), item: `${ENV.BASE_URL}/${locale}/services` },
        { '@type': 'ListItem', position: 3, name: t('h1'), item: url },
      ],
    },
  ];

  const otherServices = (Object.keys(SERVICE_NAMESPACES) as ServiceSlug[]).filter(slug => slug !== service);

  // Row counts differ per service (mobile has only the MVP anchor), so these
  // keys can't be statically typed.
  const prices = Array.from({ length: PRICE_ROW_COUNT[service as ServiceSlug] }, (_, i) => ({
    name: t(`price${i + 1}Name` as never),
    range: t(`price${i + 1}Range` as never),
  }));
  const actions = (
    <>
      <ButtonLink href={`/${locale}${ESTIMATE_PATH}`}>{tc('estimateCta')}</ButtonLink>
      <ButtonLink variant='secondary' href={`/${locale}#contact`}>
        {tc('contactCta')}
      </ButtonLink>
    </>
  );

  return (
    <Page>
      {schemas.map((schema, i) => (
        <script key={i} type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      ))}
      <ServiceHero
        title={t('h1')}
        lead={t('intro')}
        glyph={service as ServiceSlug}
        breadcrumb={
          <Breadcrumbs
            label={tc('breadcrumb')}
            items={[
              { label: 'SoftWhere.uz', href: `/${locale}` },
              { label: tc('servicesHub'), href: `/${locale}/services` },
            ]}
          />
        }
        actions={actions}
      />

      <Section>
        <div className={css.split}>
          <h2 className={css.heading}>{tc('offeringsTitle')}</h2>
          <ul className={css.list}>
            {OFFERING_KEYS.map(key => (
              <li key={key} className={css.offer}>
                <h3 className={css.offerTitle}>{t(`${key}Title`)}</h3>
                <p className={css.text}>{t(`${key}Desc`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section className={css.prices} heading={tc('pricingTitle')}>
        <PriceTable rows={prices} />
        <p className={css.note}>{tc('pricingNote')}</p>
      </Section>

      <Section>
        <div className={css.split}>
          <h2 className={css.heading}>{tc('whyTitle')}</h2>
          <ul className={css.list}>
            {WHY_KEYS.map(key => (
              <li key={key} className={css.reason}>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section>
        <CtaBand title={tc('ctaTitle')} body={tc('ctaBody')} actions={actions} />
      </Section>

      <Section heading={tc('otherServicesTitle')}>
        <ul className={css.others}>
          {otherServices.map(slug => (
            <li key={slug}>
              <Link href={`/${locale}/services/${slug}`} className={css.other}>
                <span>{tc(`link_${SERVICE_NAMESPACES[slug]}`)}</span>
                <Arrow className={css.arrow} />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
