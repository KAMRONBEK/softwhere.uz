'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import SectionFallback from '../../components/SectionFallback';
import css from '../../components/SectionFallback.module.css';
import type { LabSectionProps } from '../../types';
import { channelsForLocale } from './channels';

/**
 * The finale before its code mounts: the shared static heading and summary,
 * the studio's direct channels (Telegram, phone, email) and the estimator
 * link, all real links in the server HTML. It carries the page's `#contact`
 * anchor, so the AI brief's hand-off finds a target while the section is
 * still far away. Landing on it mounts the finale at its top, and the finale
 * rides the warp down to the form (S14Finale); the live form card then
 * carries the id. Light on purpose: registry.ts imports it statically.
 */
export default function FinaleFallback({ meta }: LabSectionProps) {
  const t = useTranslations('home.finale');
  const locale = useLocale();
  return (
    <div id='contact'>
      <SectionFallback meta={meta}>
        <p className={css.extra}>{t('direct.label')}</p>
        <ul className={css.links}>
          {channelsForLocale(locale).map(channel => (
            <li key={channel.id}>
              <a href={channel.href} {...(channel.isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {channel.id === 'telegram'
                  ? t('direct.telegramTitle', { handle: channel.value })
                  : channel.id === 'call'
                    ? t('direct.callTitle', { phone: channel.value })
                    : t('direct.emailTitle', { email: channel.value })}
              </a>
            </li>
          ))}
        </ul>
        <p className={css.extra}>
          {t('estimate.lead')} <Link href={`/${locale}/estimator`}>{t('estimate.link')}</Link>
        </p>
      </SectionFallback>
    </div>
  );
}
