'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import SectionFallback from '../../components/SectionFallback';
import css from '../../components/SectionFallback.module.css';
import type { LabSectionProps } from '../../types';

/**
 * The AI demo before its code mounts: heading, summary and the other way to
 * a price, the step-by-step estimator, as a real link in the server HTML.
 * Light: registry.ts imports it statically.
 */
export default function AIDemoFallback({ meta }: LabSectionProps) {
  const t = useTranslations('home.ai-demo');
  const locale = useLocale();
  return (
    <SectionFallback meta={meta}>
      <p className={css.extra}>
        {t('estimator.lead')} <Link href={`/${locale}/estimator`}>{t('estimator.link')}</Link>
      </p>
    </SectionFallback>
  );
}
