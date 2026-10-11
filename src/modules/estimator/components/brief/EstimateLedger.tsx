'use client';

import { useTranslations } from 'next-intl';
import { useId, useEffect, useState, type ReactNode } from 'react';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { isPricedEstimate, type BriefPreview, type DiscoveryEstimate } from '@/modules/estimator/ai-brief/types';
import { useCurrency, type CurrencyCode } from '../CurrencySwitcher';
import { priceRange, usdFormatter } from './format';
import css from './brief.module.css';

type EstimateLedgerProps = {
  preview: BriefPreview | null;
  locale: BriefLocale;
  /** Count the numbers up when they first arrive (not for a restored brief). */
  isAnimated: boolean;
  /** The call to action, shown once the whole brief is ready. */
  action?: ReactNode;
};

const COUNT_MS = 900;
/** From this high/low ratio the ledger says what the two ends of the range stand for. */
const WIDE_RANGE_RATIO = 2;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 0 → 1 over COUNT_MS with a strong ease-out, once; 1 straight away when motion is reduced or animation is off. */
function useCountUp(isActive: boolean, isAnimated: boolean): number {
  const [progress, setProgress] = useState(0);
  const shouldAnimate = isAnimated && !prefersReducedMotion();
  useEffect(() => {
    if (!isActive || !shouldAnimate) return;
    let frame = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const p = Math.min(1, (time - start) / COUNT_MS);
      setProgress(1 - Math.pow(1 - p, 4));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isActive, shouldAnimate]);
  return shouldAnimate ? progress : 1;
}

function LedgerSkeleton() {
  return (
    <aside className={`${css.ledger} ${css.ledgerLoading}`} aria-hidden>
      <span className={`${css.skel} ${css.skelLabel}`} />
      <span className={`${css.skel} ${css.skelPrice}`} />
      <span className={`${css.skel} ${css.skelLine}`} />
      <span className={`${css.skel} ${css.skelLine} ${css.skelShort}`} />
    </aside>
  );
}

type CurrencyPillsProps = { label: string; currency: CurrencyCode; available: CurrencyCode[]; onChange: (c: CurrencyCode) => void };

function CurrencyPills({ label, currency, available, onChange }: CurrencyPillsProps) {
  if (available.length < 2) return null;
  return (
    <div className={css.currency} role='group' aria-label={label}>
      {available.map(code => (
        <button key={code} type='button' aria-pressed={currency === code} className={css.currencyPill} onClick={() => onChange(code)}>
          {code}
        </button>
      ))}
    </div>
  );
}

type DiscoveryCardProps = { estimate: DiscoveryEstimate; action?: ReactNode };

/**
 * A very large idea: no price, no weeks — why it needs a discovery call, the
 * team the first module would need, and the call to action.
 */
function DiscoveryCard({ estimate, action }: DiscoveryCardProps) {
  const t = useTranslations('aiBrief.estimate.discovery');
  const tTeam = useTranslations('aiBrief.estimate');
  const tEstimator = useTranslations('estimator');
  const tx = tEstimator as unknown as (key: string) => string;
  const tr = t as unknown as (key: string) => string;
  const headingId = useId();

  return (
    <aside className={`${css.ledger} ${css.reveal}`} aria-labelledby={headingId}>
      <h3 id={headingId} className={css.discoveryTitle}>
        {t('title')}
      </h3>
      <p className={css.discoveryBody}>{t('body')}</p>
      {estimate.reasons.length > 0 && (
        <div className={css.ledgerRow}>
          <span className={css.ledgerRowLabel}>{t('reasonsTitle')}</span>
          <ul className={css.discoveryReasons}>
            {estimate.reasons.map(reason => (
              <li key={reason}>{tr(`reasons.${reason}`)}</li>
            ))}
          </ul>
        </div>
      )}
      {estimate.team.length > 0 && (
        <div className={css.ledgerRow}>
          <span className={css.ledgerRowLabel}>{tTeam('team')}</span>
          <ul className={css.team}>
            {estimate.team.map(role => (
              <li key={role}>{tx(role)}</li>
            ))}
          </ul>
        </div>
      )}
      {action}
    </aside>
  );
}

/**
 * The engine's numbers for the first version and the full vision: price
 * ranges and weeks, never hours or rates (the API sends none). Every figure
 * comes from `calculateEstimate` via the API — the component only formats
 * and (for uz/ru) converts the currency, and says the exact price follows
 * the technical specification. A very large idea has no figures at all: it
 * shows the discovery-call card instead.
 */
export default function EstimateLedger({ preview, locale, isAnimated, action }: EstimateLedgerProps) {
  const t = useTranslations('aiBrief.estimate');
  const headingId = useId();
  const tEstimator = useTranslations('estimator');
  const tx = tEstimator as unknown as (key: string) => string;
  const local = useCurrency();
  const progress = useCountUp(preview !== null && isPricedEstimate(preview.estimate), isAnimated);

  if (!preview) return <LedgerSkeleton />;
  if (!isPricedEstimate(preview.estimate)) return <DiscoveryCard estimate={preview.estimate} action={action} />;

  const isEn = locale === 'en';
  const format = isEn ? usdFormatter(locale) : local.format;
  const { mvp, fullVision, extras, confidence } = preview.estimate;
  const shown = { min: Math.round(mvp.price.min * progress), max: Math.round(mvp.price.max * progress) };

  return (
    <aside className={`${css.ledger} ${css.reveal}`} aria-labelledby={headingId}>
      <div className={css.ledgerTop}>
        <h3 id={headingId} className={css.ledgerLabel}>
          {t('title')}
        </h3>
        <span className={`${css.confidence} ${css[`confidence_${confidence}`]}`}>{t(`confidence.${confidence}`)}</span>
      </div>
      <p className={css.price}>
        <span className={css.srOnly}>{t('cost')}: </span>
        <span aria-hidden={progress < 1}>{priceRange(shown, format)}</span>
      </p>
      <dl className={css.ledgerStats}>
        <div>
          <dt className={css.srOnly}>{tx('timeframe')}</dt>
          <dd className={css.ledgerStat}>{t('weeks', { min: mvp.weeks.min, max: mvp.weeks.max })}</dd>
        </div>
      </dl>
      {mvp.price.max >= mvp.price.min * WIDE_RANGE_RATIO && (
        <div className={css.spread}>
          <span className={css.spreadTrack} aria-hidden style={{ transform: `scaleX(${progress})` }} />
          <p className={css.spreadEnds}>
            <span>{t('spread.low')}</span>
            <span className={css.srOnly}> — </span>
            <span>{t('spread.high')}</span>
          </p>
        </div>
      )}
      <p className={css.rangeNote}>{t('rangeNote')}</p>
      {!isEn && (
        <CurrencyPills label={tx('currencyLabel')} currency={local.currency} available={local.available} onChange={local.setCurrency} />
      )}

      {fullVision && (
        <div className={css.ledgerRow}>
          <span className={css.ledgerRowLabel}>{t('full')}</span>
          <span className={css.ledgerRowValue}>
            {priceRange(fullVision.price, format)}
            <span className={css.ledgerRowSub}>{t('weeks', { min: fullVision.weeks.min, max: fullVision.weeks.max })}</span>
          </span>
        </div>
      )}

      {extras.length > 0 && (
        <div className={css.ledgerRow}>
          <span className={css.ledgerRowLabel}>{t('extras')}</span>
          <ul className={css.extras}>
            {extras.map(extra => (
              <li key={extra.subtype}>
                <span>{tx(extra.labelKey)}</span>
                <span className={css.ledgerRowSub}>{priceRange(extra.price, format)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={css.ledgerRow}>
        <span className={css.ledgerRowLabel}>{t('team')}</span>
        <ul className={css.team}>
          {mvp.team.map(role => (
            <li key={role}>{tx(role)}</li>
          ))}
        </ul>
      </div>
      {action}
    </aside>
  );
}
