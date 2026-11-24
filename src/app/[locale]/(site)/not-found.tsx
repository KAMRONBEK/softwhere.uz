import { getLocale, getTranslations } from 'next-intl/server';
import { ButtonLink, Page, PageHero } from '@/shared/components/site';

// notFound() inside a site page (an unknown service, a deleted post). Unknown
// paths outside the site's routes get the document in src/app/not-found.tsx.
export default async function SiteNotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'notFound' });

  return (
    <Page>
      <PageHero
        eyebrow='404'
        title={t('title')}
        lead={t('body')}
        actions={
          <>
            <ButtonLink href={`/${locale}`}>{t('home')}</ButtonLink>
            <ButtonLink href={`/${locale}/services`} variant='secondary'>
              {t('services')}
            </ButtonLink>
          </>
        }
      />
    </Page>
  );
}
