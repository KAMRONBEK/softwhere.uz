import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { PART_IDS as TELEGRAM_PARTS } from '../sections/s07/data';
import { STEPS as MOBILE_STEPS } from '../sections/s15/data';
import { DELIVER_IDS as WEB_DELIVER, STEPS as WEB_STEPS } from '../sections/s16/data';
import { GET_IDS as RAG_GET, PART_IDS as RAG_PARTS } from '../sections/s17/data';
import { DELIVER_IDS as CRM_DELIVER } from '../sections/s18/data';
import css from '../components/SectionFallback.module.css';
import { DeliverList, ServiceLink, TermList } from './StandInParts';

/** The service page each "how we build" section links to (src/app/[locale]/(site)/services/[service]). */
const SERVICE_PATHS = {
  telegram: 'telegram-bots',
  mobile: 'mobile-apps',
  web: 'web-development',
} as const;

interface StandInProps {
  locale: Locale;
}

const servicePath = (locale: Locale, service: keyof typeof SERVICE_PATHS) => `/${locale}/services/${SERVICE_PATHS[service]}`;

/** 07 · Telegram: the demo's three parts (its legend), the reach line and the service page. */
export async function TelegramStandIn({ locale }: StandInProps) {
  const t = await getTranslations({ locale, namespace: 'home.telegram' });
  const items = TELEGRAM_PARTS.map(id => ({ id, term: t(`legend.${id}.term`), text: t(`legend.${id}.text`) }));
  return (
    <>
      <TermList items={items} />
      <p className={css.extra}>{t('reach')}</p>
      <ServiceLink href={servicePath(locale, 'telegram')} label={t('serviceLink')} />
    </>
  );
}

/** Mobile app: the six build steps (the section's step list) and the service page. */
export async function MobileBuildStandIn({ locale }: StandInProps) {
  const t = await getTranslations({ locale, namespace: 'home.mobile-build' });
  const items = MOBILE_STEPS.map(({ id }) => ({ id, term: t(`steps.${id}.title`), text: t(`steps.${id}.text`) }));
  return (
    <>
      <TermList items={items} label={t('stepsLabel')} />
      <ServiceLink href={servicePath(locale, 'mobile')} label={t('serviceLink')} />
    </>
  );
}

/** Website: the six build steps, what the client gets and the service page. */
export async function WebBuildStandIn({ locale }: StandInProps) {
  const t = await getTranslations({ locale, namespace: 'home.web-build' });
  const items = WEB_STEPS.map(({ id }) => ({ id, term: t(`steps.${id}.term`), text: t(`steps.${id}.text`) }));
  return (
    <>
      <TermList items={items} />
      <DeliverList title={t('deliverTitle')} items={WEB_DELIVER.map(id => t(`deliver.${id}`))} />
      <ServiceLink href={servicePath(locale, 'web')} label={t('serviceLink')} />
    </>
  );
}

/** AI on your documents: the five parts and what the client gets (no service page yet). */
export async function RagBuildStandIn({ locale }: StandInProps) {
  const t = await getTranslations({ locale, namespace: 'home.rag-build' });
  const items = RAG_PARTS.map(id => ({ id, term: t(`steps.${id}.term`), text: t(`steps.${id}.text`) }));
  return (
    <>
      <TermList items={items} />
      <DeliverList title={t('getTitle')} items={RAG_GET.map(id => t(`get.${id}`))} />
    </>
  );
}

/** CRM & admin: what the client gets (no service page yet). */
export async function CrmBuildStandIn({ locale }: StandInProps) {
  const t = await getTranslations({ locale, namespace: 'home.crm-build' });
  return <DeliverList title={t('deliverTitle')} items={CRM_DELIVER.map(id => t(`deliver.${id}`))} />;
}
