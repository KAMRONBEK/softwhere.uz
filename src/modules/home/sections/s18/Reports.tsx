'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { DEALS, MONTH_IDS, REPORT_HISTORY, type Currency, type ReportMetric } from './data';
import { stageTotal, type Board } from './board';
import type { Demo } from './demo';
import css from './reports.module.css';

const COUNT_MS = 800;
const DONUT_GAP = 1.4;
/** A counting total ticks in whole dollars, or in steps of 100 000 so'm. */
const COUNT_STEP: Record<Currency, number> = { usd: 1, uzs: 100_000 };

/** Eases a displayed number to `value` (from wherever it was) once shown. */
function useCountUp(value: number, isShown: boolean, isReduced: boolean): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!isShown || isReduced) return;
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / COUNT_MS);
      const current = from + (value - from) * (1 - (1 - k) ** 3);
      fromRef.current = current;
      setDisplay(current);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, isShown, isReduced]);

  return isReduced ? value : display;
}

interface ReportsProps {
  board: Board;
  demo: Demo;
  isActive: boolean;
  isReduced: boolean;
}

/**
 * Reports: KPIs, revenue (or deals) by month and lead sources. The past five
 * months are sample data; this month is the live board, so a card dragged
 * to Won a minute ago shows up here. Bars grow and numbers count up the
 * first time the module shows.
 */
export default function Reports({ board, demo, isActive, isReduced }: ReportsProps) {
  const t = useTranslations('home.crm-build');
  const { currency } = demo;
  const [metric, setMetric] = useState<ReportMetric>('revenue');
  const [isShown, setIsShown] = useState(isReduced);

  // First showing: let the zero state paint, then grow (a frame later).
  useEffect(() => {
    if (!isActive || isShown) return;
    const frame = requestAnimationFrame(() => setIsShown(true));
    return () => cancelAnimationFrame(frame);
  }, [isActive, isShown]);

  const wonTotal = stageTotal(board, 'won', currency);
  const wonCount = board.won.length;
  const openCount = board.new.length + board.quote.length;
  const winRate = Math.round((wonCount / DEALS.length) * 100);

  const wonShown = useCountUp(wonTotal, isShown, isReduced);
  const openShown = useCountUp(openCount, isShown, isReduced);
  const rateShown = useCountUp(winRate, isShown, isReduced);

  const values = metric === 'revenue' ? [...REPORT_HISTORY.revenue[currency], wonTotal] : [...REPORT_HISTORY.deals, wonCount];
  const max = Math.max(...values) * 1.22;
  const format = (value: number) => (metric === 'revenue' ? demo.money.short(value) : String(value));

  const segments = demo.sources.map((source, index) => ({
    ...source,
    index,
    offset: demo.sources.slice(0, index).reduce((sum, previous) => sum + previous.share, 0),
  }));

  return (
    <div className={css.reports} data-shown={isShown ? '' : undefined}>
      <div className={css.head}>
        <span className={css.sample}>{t('reports.sample')}</span>
        <div className={css.metric} role='group' aria-label={t(`reports.chartTitle.${metric}`)}>
          {(['revenue', 'deals'] as const).map(id => (
            <button key={id} type='button' className={css.metricButton} aria-pressed={metric === id} onClick={() => setMetric(id)}>
              {t(`reports.metric.${id}`)}
            </button>
          ))}
        </div>
      </div>

      <dl className={css.kpis}>
        <div className={css.kpi} data-live>
          <dt>{t('reports.kpis.won')}</dt>
          <dd>{demo.money.short(Math.round(wonShown / COUNT_STEP[currency]) * COUNT_STEP[currency])}</dd>
        </div>
        <div className={css.kpi}>
          <dt>{t('reports.kpis.open')}</dt>
          <dd>{Math.round(openShown)}</dd>
        </div>
        <div className={css.kpi}>
          <dt>{t('reports.kpis.rate')}</dt>
          <dd>{Math.round(rateShown)}%</dd>
        </div>
      </dl>

      <div className={css.charts}>
        <figure className={css.card}>
          <figcaption className={css.cardTitle}>{t(`reports.chartTitle.${metric}`)}</figcaption>
          <div className={css.bars}>
            {values.map((value, index) => {
              const isLive = index === values.length - 1;
              return (
                <div
                  key={MONTH_IDS[index]}
                  className={css.barCol}
                  data-live={isLive ? '' : undefined}
                  style={{ '--h': isShown ? value / max : 0, '--n': index } as CSSProperties}
                >
                  {isLive && <span className={css.barValue}>{format(value)}</span>}
                  <span className={css.bar} />
                  <span className={css.month}>{t(`reports.months.${MONTH_IDS[index]}`)}</span>
                </div>
              );
            })}
          </div>
          <p className={css.liveNote}>{t('reports.liveNote')}</p>
        </figure>

        <figure className={css.card}>
          <figcaption className={css.cardTitle}>{t('reports.sourcesTitle')}</figcaption>
          <div className={css.sources}>
            <svg className={css.donut} viewBox='0 0 120 120' aria-hidden='true'>
              <circle className={css.donutTrack} cx='60' cy='60' r='46' />
              {segments.map(segment => (
                <circle
                  key={segment.id}
                  className={css.segment}
                  data-n={segment.index}
                  cx='60'
                  cy='60'
                  r='46'
                  pathLength={100}
                  strokeDasharray={`${isShown ? Math.max(0, segment.share - DONUT_GAP) : 0} 100`}
                  strokeDashoffset={-segment.offset}
                  style={{ '--n': segment.index } as CSSProperties}
                />
              ))}
            </svg>
            <ul className={css.legend}>
              {segments.map(segment => (
                <li key={segment.id} className={css.legendRow}>
                  <span className={css.swatch} data-n={segment.index} aria-hidden='true' />
                  <span className={css.legendName}>{segment.name}</span>
                  <span className={css.legendValue}>{segment.share}%</span>
                </li>
              ))}
            </ul>
          </div>
        </figure>
      </div>
    </div>
  );
}
