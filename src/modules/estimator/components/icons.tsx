import type { ReactNode } from 'react';
import type { ProjectType, Tier } from '@/modules/estimator/types';
import css from './ui.module.css';

const SERVICE_PATHS: Record<ProjectType, ReactNode> = {
  mobile: (
    <>
      <rect x='7' y='2.5' width='10' height='19' rx='2' />
      <path d='M10.5 18.5h3' />
    </>
  ),
  web: (
    <>
      <rect x='2.5' y='4.5' width='19' height='15' rx='1.5' />
      <path d='M2.5 9h19M5.5 6.8h.01M8 6.8h.01' />
    </>
  ),
  telegram: <path d='M21 3.5 2.8 10.7l6 2.3 2.3 7 3.3-4.5 4.8 3.6zM8.8 13 21 3.5' />,
  ai: (
    <>
      <path d='m12 4.5 6.5 4v7L12 19.5l-6.5-4v-7z' />
      <path d='M12 12v7.5M12 12l6.5-3.5M12 12 5.5 8.5' />
      <circle cx='12' cy='12' r='2.2' fill='currentColor' stroke='none' />
    </>
  ),
  desktop: (
    <>
      <rect x='4' y='4.5' width='16' height='11' rx='1.5' />
      <path d='M1.8 19.5h20.4' />
    </>
  ),
  other: (
    <>
      <path d='M3 7h9M18 7h3M3 17h3M12 17h9' />
      <circle cx='15' cy='7' r='2.6' />
      <circle cx='9' cy='17' r='2.6' />
    </>
  ),
};

/** A drawn icon per service, in the homepage's stroke. */
export function ServiceIcon({ type }: { type: ProjectType }) {
  return (
    <svg
      viewBox='0 0 24 24'
      width='26'
      height='26'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.6'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
    >
      {SERVICE_PATHS[type]}
    </svg>
  );
}

const TIER_LEVEL: Record<Tier, number> = { mvp: 1, standard: 2, enterprise: 3 };

/** The depth of a tier as one, two or three filled bars. */
export function TierIcon({ tier }: { tier: Tier }) {
  return (
    <span className={css.level} aria-hidden='true'>
      {[1, 2, 3].map(n => (
        <i key={n} data-on={n <= TIER_LEVEL[tier] || undefined} />
      ))}
    </span>
  );
}

export function CheckIcon() {
  return (
    <svg
      viewBox='0 0 12 12'
      width='11'
      height='11'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.2'
      aria-hidden='true'
      focusable='false'
    >
      <path d='M2 6.2 4.8 9 10 3' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

export function PhoneIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      width='18'
      height='18'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      aria-hidden='true'
      focusable='false'
    >
      <path
        d='M5 3.5h3.5l1.7 4.5-2.2 1.6a12 12 0 0 0 6.4 6.4l1.6-2.2 4.5 1.7V19a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.7 2 2 0 0 1 5 3.5Z'
        strokeLinejoin='round'
      />
    </svg>
  );
}

export function TelegramIcon() {
  return (
    <svg
      viewBox='0 0 24 24'
      width='18'
      height='18'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      aria-hidden='true'
      focusable='false'
    >
      <g strokeLinejoin='round'>{SERVICE_PATHS.telegram}</g>
    </svg>
  );
}
