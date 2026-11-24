import type { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { ENV, BLOG_CONFIG, ogLocaleFields } from '@/core/constants';
import { buildOgUrl } from '@/core/og';
import { Arrow, ButtonLink, CtaBand, Page, Section } from '@/shared/components/site';
import { SERVICE_NAMESPACES, SERVICE_SLUGS } from '@/shared/data/services';
import { safeJsonLd } from '@/shared/utils/security';
import { HalftoneGlyph } from './_components/HalftoneGlyph';
import { splitRange } from './_components/PriceTable';
import { ServiceHero } from './_components/ServiceHero';
import css from './services.module.css';

// The /services hub: one card per service landing page, plus the work that has
// no landing page yet (CRM/ERP, AI on documents), which links to the estimator.
const MORE_KEYS = ['crm', 'ai'] as const;

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

  const actions = (
    <>
      <ButtonLink href={`/${locale}/estimator`}>{t('common.estimateCta')}</ButtonLink>
      <ButtonLink variant='secondary' href={`/${locale}#contact`}>
        {t('common.contactCta')}
      </ButtonLink>
    </>
  );

  return (
    <Page>
      {schemas.map((schema, i) => (
        <script key={i} type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      ))}
      <ServiceHero title={t('index.h1')} lead={t('index.intro')} glyph='mark' actions={actions} />

      <Section>
        <ul className={css.index}>
          {SERVICE_SLUGS.map(slug => {
            const ns = SERVICE_NAMESPACES[slug];
            const [price, dollars] = splitRange(t(`${ns}.price1Range`));
            return (
              <li key={slug} className={css.service}>
                <div className={css.serviceCopy}>
                  <h2 className={css.serviceTitle}>
                    <Link href={`/${locale}/services/${slug}`} className={css.link}>
                      {t(`${ns}.h1`)}
                    </Link>
                  </h2>
                  <p className={css.serviceText}>{t(`${ns}.intro`)}</p>
                </div>
                <HalftoneGlyph name={slug} className={css.serviceGlyph} />
                <div className={css.facts}>
                  <p className={css.fact}>
                    {t(`${ns}.price1Name`)} <strong>{price}</strong> {dollars}
                  </p>
                  <Arrow className={css.arrow} />
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section heading={t('index.moreTitle')}>
        <ul className={css.moreGrid}>
          {MORE_KEYS.map(key => (
            <li key={key} className={css.more}>
              <div>
                <h3 className={css.moreTitle}>
                  <Link href={`/${locale}/estimator`} className={css.link}>
                    {t(`index.${key}Title`)}
                  </Link>
                </h3>
                <p className={css.text}>{t(`index.${key}Desc`)}</p>
                <Arrow className={css.arrow} />
              </div>
              <HalftoneGlyph name={key} className={css.moreGlyph} />
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <CtaBand title={t('common.ctaTitle')} body={t('common.ctaBody')} actions={actions} />
      </Section>
    </Page>
  );
}
