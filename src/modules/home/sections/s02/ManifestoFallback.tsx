'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import SectionFallback from '../../components/SectionFallback';
import type { LabSectionProps } from '../../types';

/** The service each linked word of the summary leads to (src/app/[locale]/(site)/services/[service]). */
const SERVICE_PATHS = { web: 'web-development', mobile: 'mobile-apps', bots: 'telegram-bots' } as const;

/**
 * The manifesto before its code mounts: heading and the "what we build"
 * summary, with websites, mobile apps and Telegram bots linked to their
 * service pages, so the homepage's server HTML links to them in context
 * (not only from the footer). Light: registry.ts imports it statically.
 */
export default function ManifestoFallback({ meta }: LabSectionProps) {
  const t = useTranslations('home.manifesto');
  const locale = useLocale();
  const link = (service: keyof typeof SERVICE_PATHS) =>
    function ServiceLink(chunks: ReactNode) {
      return <Link href={`/${locale}/services/${SERVICE_PATHS[service]}`}>{chunks}</Link>;
    };
  const summary = t.rich('summaryLinked', { web: link('web'), mobile: link('mobile'), bots: link('bots') });
  return <SectionFallback meta={meta} summary={summary} />;
}
