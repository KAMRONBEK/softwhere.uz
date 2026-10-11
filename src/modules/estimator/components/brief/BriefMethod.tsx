'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { GENERIC_SUBTYPES } from '@/modules/estimator/ai-brief/constants';
import { isPricedEstimate, type AiBrief, type BriefPreview } from '@/modules/estimator/ai-brief/types';
import css from './brief.module.css';

/** Biggest effort lines of the first version, as shares of its raw hours (engine data). */
export function PriceDrivers({ preview }: { preview: BriefPreview }) {
  const t = useTranslations('aiBrief.estimate');
  const headingId = useId();
  const tEstimator = useTranslations('estimator');
  const tx = tEstimator as unknown as (key: string) => string;
  const drivers = isPricedEstimate(preview.estimate) ? preview.estimate.mvp.drivers : [];
  if (drivers.length === 0) return null;
  const top = Math.max(...drivers.map(d => d.share));

  return (
    <section className={css.asideSection} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.asideTitle}>
        {t('drivers')}
      </h3>
      <ul className={css.drivers}>
        {drivers.map(driver => (
          <li key={driver.id} className={css.driver}>
            <span className={css.driverLabel}>{tx(driver.labelKey)}</span>
            <span className={css.driverValue}>{driver.share}%</span>
            <span className={css.driverTrack} aria-hidden>
              <span className={css.driverBar} style={{ '--share': `${(driver.share / top) * 100}%` } as CSSProperties} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "How we calculated this": the exact engine input the first version was
 * priced with, what is outside the numbers and what we assumed. This is the
 * page's honesty statement — the AI chose options, the engine did the math.
 * A discovery-call brief has no numbers: the same section says what the plan
 * rests on and lists what else the call covers.
 */
export function Method({ preview, brief }: { preview: BriefPreview; brief: AiBrief | null }) {
  const t = useTranslations('aiBrief.estimate');
  const headingId = useId();
  const tResult = useTranslations('aiBrief.result');
  const tEstimator = useTranslations('estimator');
  const tx = tEstimator as unknown as (key: string) => string;
  const locale = useLocale();
  const { config, unpricedItems } = preview.estimate;
  const isPriced = isPricedEstimate(preview.estimate);
  const isMobile = config.projectType === 'mobile';
  const platforms = config.platforms.length === 1 ? (config.platforms[0] === 'ios' ? 'iOS' : 'Android') : t('bothPlatforms');

  const rows: [string, string][] = [
    [
      t('config.product'),
      // A catch-all subtype ("Something else") reads as a glitch next to the service: show the service alone.
      GENERIC_SUBTYPES.includes(config.subtype)
        ? tx(`service.${config.projectType}`)
        : `${tx(`service.${config.projectType}`)}: ${tx(`subtype.${config.subtype}`)}`,
    ],
    ...(isMobile
      ? ([
          [t('config.platforms'), platforms],
          [t('config.approach'), tx(`approach.${config.approach}`)],
        ] as [string, string][])
      : []),
    [t('config.level'), tx(`tier.${config.tier}`)],
    [t('config.design'), tx(`design.${config.design}`)],
    ...(config.screens > 0 ? ([[t('config.screens'), String(config.screens)]] as [string, string][]) : []),
    [t('config.languages'), String(config.languages)],
    [t('config.urgency'), tx(`urgency.${config.urgency}`)],
  ];
  const assumptions = brief?.narrative.assumptions ?? [];

  return (
    <section className={css.asideSection} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.asideTitle}>
        {isPriced ? t('howTitle') : t('discovery.howTitle')}
      </h3>
      <p className={css.methodBody}>{isPriced ? t('howBody') : t('discovery.howBody')}</p>
      {isPriced && (
        <dl className={css.config}>
          {rows.map(([label, value]) => (
            <div key={label} className={css.configRow}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {preview.stack.length > 0 && (
        <div className={css.methodBlock}>
          <h4 className={css.miniHeading}>{tResult('stack')}</h4>
          <ul className={css.stack}>
            {preview.stack.map(item => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </div>
      )}
      {unpricedItems.length > 0 && (
        <div className={css.methodBlock}>
          <h4 className={css.miniHeading}>{isPriced ? t('unpriced') : t('discovery.unpriced')}</h4>
          <ul className={css.plainList}>
            {unpricedItems.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {assumptions.length > 0 && (
        <div className={css.methodBlock}>
          <h4 className={css.miniHeading}>{tResult('assumptions')}</h4>
          <ul className={css.plainList}>
            {assumptions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <Link href={`/${locale}/estimator`} className={css.textLink}>
        {t('openEstimator')}
      </Link>
    </section>
  );
}
