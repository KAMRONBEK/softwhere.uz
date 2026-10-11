import { useRef, type CSSProperties } from 'react';
import { gsap, useGSAP } from '../../global/gsap';
import { CheckIcon } from './art';
import { useCopy } from './useCopy';
import css from './panels.module.css';

const RING_R = 20;
const RING_LENGTH = 2 * Math.PI * RING_R;
const COUNT_S = 1.5;

type Grade = 'fail' | 'average' | 'pass';

/** Lighthouse's bands: 0–49 red, 50–89 orange, 90–100 green. */
function gradeOf(value: number): Grade {
  if (value >= 90) return 'pass';
  return value >= 50 ? 'average' : 'fail';
}

function dashFor(value: number): string {
  return String(RING_LENGTH * (1 - value / 100));
}

interface ChecksPanelProps {
  isActive: boolean;
  isReduced: boolean;
}

/**
 * The example site's speed & SEO report: four score rings count up through
 * red and orange into green each time the step opens, then the Core Web
 * Vitals and the SEO checks tick in. Reduced motion: the final report.
 */
export default function ChecksPanel({ isActive, isReduced }: ChecksPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const copy = useCopy().panels.checks;

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const rings = Array.from(root.querySelectorAll<HTMLElement>('[data-score]'));
      const paint = (ring: HTMLElement, value: number) => {
        const rounded = Math.round(value);
        ring.dataset.grade = gradeOf(rounded);
        ring.querySelector('[data-arc]')?.setAttribute('stroke-dashoffset', dashFor(value));
        const label = ring.querySelector('[data-value]');
        if (label) label.textContent = String(rounded);
      };
      const finals = rings.map(ring => Number(ring.dataset.score));
      if (isReduced) {
        rings.forEach((ring, index) => paint(ring, finals[index]));
        root.dataset.done = 'true';
        return;
      }
      // Leaving: keep the finished report while the card fades out.
      if (!isActive) return;
      root.dataset.done = '';
      rings.forEach((ring, index) => {
        const proxy = { value: 0 };
        paint(ring, 0);
        gsap.to(proxy, {
          value: finals[index],
          duration: COUNT_S + index * 0.15,
          delay: 0.2 + index * 0.12,
          ease: 'power2.out',
          onUpdate: () => paint(ring, proxy.value),
        });
      });
      gsap.delayedCall(COUNT_S * 0.75, () => {
        root.dataset.done = 'true';
      });
    },
    { scope: rootRef, dependencies: [isActive, isReduced], revertOnUpdate: true }
  );

  return (
    <div ref={rootRef} className={css.checks}>
      <p className={css.head}>
        {copy.title}
        <span className={css.bp}>{copy.device}</span>
      </p>
      <ul className={css.rings}>
        {copy.scores.map(score => (
          <li key={score.id} className={css.ring} data-score={score.value} data-grade='fail'>
            <svg viewBox='0 0 48 48' aria-hidden='true'>
              <circle className={css.ringTrack} cx='24' cy='24' r={RING_R} />
              <circle
                className={css.ringArc}
                data-arc=''
                cx='24'
                cy='24'
                r={RING_R}
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={dashFor(0)}
                transform='rotate(-90 24 24)'
              />
            </svg>
            <span className={css.ringValue} data-value=''>
              0
            </span>
            <span className={css.ringLabel}>{score.label}</span>
            <span className={css.srOnly}>{score.srLabel}</span>
          </li>
        ))}
      </ul>
      <div className={css.vitals}>
        <span className={css.tokenLabel}>{copy.vitalsTitle}</span>
        <ul className={css.vitalList}>
          {copy.vitals.map((vital, index) => (
            <li key={vital.id} className={css.vital} style={{ '--i': index } as CSSProperties}>
              <b>{vital.label}</b>
              <span>{vital.value}</span>
              <em>{copy.good}</em>
            </li>
          ))}
        </ul>
      </div>
      <ul className={css.checkRows}>
        {copy.rows.map((row, index) => (
          <li key={row} className={css.checkRow} style={{ '--i': index + 3 } as CSSProperties}>
            <CheckIcon className={css.checkIcon} />
            {row}
          </li>
        ))}
      </ul>
    </div>
  );
}
