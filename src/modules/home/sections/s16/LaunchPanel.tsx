import { useEffect, useState } from 'react';
import { CheckIcon } from './art';
import { HOURLY_VISITORS, ORDERS_START, VISITORS_NOW_RANGE, VISITORS_NOW_START, VISITORS_TODAY } from './data';
import { useCopy } from './useCopy';
import css from './panels.module.css';

const TICK_MS = 2400;
const ORDER_EVERY_TICKS = 2;
const TOAST_MS = 2200;

const CHART_W = 120;
const CHART_H = 34;
const PEAK = Math.max(...HOURLY_VISITORS);
const CHART_POINTS = HOURLY_VISITORS.map((value, index) => {
  const x = (index / (HOURLY_VISITORS.length - 1)) * CHART_W;
  const y = CHART_H - 2 - (value / PEAK) * (CHART_H - 6);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(' ');
const CHART_AREA = `0,${CHART_H} ${CHART_POINTS} ${CHART_W},${CHART_H}`;

interface Stats {
  now: number;
  today: number;
  orders: number;
  tick: number;
  /** The latest order (kept while its toast fades out). */
  toast: string;
  isToast: boolean;
}

const START: Stats = { now: VISITORS_NOW_START, today: VISITORS_TODAY, orders: ORDERS_START, tick: 0, toast: '', isToast: false };

function clampNow(value: number): number {
  return Math.min(VISITORS_NOW_RANGE[1], Math.max(VISITORS_NOW_RANGE[0], value));
}

interface LaunchPanelProps {
  isActive: boolean;
  isReduced: boolean;
  /** A visitor just pre-ordered: the site's order button pings. */
  onOrder: () => void;
}

/**
 * Launch day on the example site: deployed over HTTPS, a live visitor
 * counter that wanders, today's traffic curve, and a pre-order every few
 * seconds (a toast here, a ping on the site's order button). Only ticks
 * while the step is on screen; reduced motion shows a still snapshot.
 */
export default function LaunchPanel({ isActive, isReduced, onOrder }: LaunchPanelProps) {
  const [stats, setStats] = useState<Stats>(START);
  const copy = useCopy().panels.launch;

  useEffect(() => {
    if (!isActive || isReduced) return;
    const id = window.setInterval(() => {
      setStats(prev => {
        const tick = prev.tick + 1;
        const isOrder = tick % ORDER_EVERY_TICKS === 0;
        const drift = Math.round(Math.random() * 3) - 1;
        return {
          now: clampNow(prev.now + drift),
          today: prev.today + 1 + Math.round(Math.random() * 2),
          orders: prev.orders + (isOrder ? 1 : 0),
          tick,
          toast: isOrder ? copy.items[(prev.orders - ORDERS_START) % copy.items.length] : prev.toast,
          isToast: isOrder || prev.isToast,
        };
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [isActive, isReduced, copy.items]);

  // Each new order pings the site; its toast clears after a moment.
  useEffect(() => {
    if (stats.orders === ORDERS_START) return;
    onOrder();
    const id = window.setTimeout(() => setStats(prev => ({ ...prev, isToast: false })), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [stats.orders, onOrder]);

  const conversion = copy.percent((stats.orders / stats.today) * 100);

  return (
    <div className={css.launch} data-on={isActive || isReduced ? 'true' : undefined}>
      <p className={css.head}>
        {copy.title}
        <span className={css.deployed}>
          <CheckIcon className={css.statusIcon} />
          {copy.deployed}
        </span>
      </p>
      <dl className={css.stats}>
        <div className={css.stat}>
          <dt>{copy.now}</dt>
          <dd>
            <span className={css.pulse} aria-hidden='true' />
            {stats.now}
          </dd>
        </div>
        <div className={css.stat}>
          <dt>{copy.orders}</dt>
          <dd key={stats.orders} className={css.bump}>
            {stats.orders}
          </dd>
        </div>
        <div className={css.stat}>
          <dt>{copy.conversion}</dt>
          <dd>{conversion}</dd>
        </div>
      </dl>
      <div className={css.chart}>
        <span className={css.chartLabel}>
          {copy.today}
          <b>{stats.today}</b>
        </span>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio='none' aria-hidden='true'>
          <polygon className={css.chartArea} points={CHART_AREA} />
          <polyline className={css.chartLine} points={CHART_POINTS} pathLength={1} />
        </svg>
      </div>
      <p className={css.toast} data-show={stats.isToast ? 'true' : undefined} aria-hidden='true'>
        {stats.toast && copy.toast(stats.toast)}
      </p>
    </div>
  );
}
