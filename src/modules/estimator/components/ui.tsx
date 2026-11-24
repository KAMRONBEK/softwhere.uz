'use client';

import type { CSSProperties, ReactNode } from 'react';
import { CheckIcon } from './icons';
import css from './ui.module.css';

/** Section heading inside a step body. */
export function StepLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className={css.label}>
      <h2>{children}</h2>
      {hint && <p>{hint}</p>}
    </div>
  );
}

/** Big single-select card (project type, subtype, tier…). */
export function SelectCard({
  selected,
  onClick,
  icon,
  title,
  desc,
  badge,
  compact = false,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  badge?: ReactNode;
  compact?: boolean;
}) {
  return (
    <button type='button' aria-pressed={selected} onClick={onClick} className={compact ? `${css.card} ${css.compact}` : css.card}>
      {icon && <span className={css.icon}>{icon}</span>}
      <span className={css.text}>
        <span className={css.title}>{title}</span>
        {desc && <span className={css.desc}>{desc}</span>}
        {badge && <span className={css.badge}>{badge}</span>}
      </span>
    </button>
  );
}

/** Multi-select row with optional icon, badge and price hint. */
export function ToggleChip({
  selected,
  onClick,
  icon,
  label,
  badge,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: ReactNode;
  badge?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button type='button' aria-pressed={selected} onClick={onClick} className={css.option}>
      <span className={css.box} aria-hidden>
        {selected && <CheckIcon />}
      </span>
      {icon}
      <span className={css.optionLabel}>
        <span>{label}</span>
        {badge && <span className={css.badge}>{badge}</span>}
      </span>
      {hint && <span className={css.hint}>{hint}</span>}
    </button>
  );
}

/** Small pill for segmented single-selects (urgency, languages, currency…). */
export function SegmentedPill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type='button' aria-pressed={selected} onClick={onClick} className={css.pill}>
      {children}
    </button>
  );
}

/** "$4,000 – $6,500" in the display face, as large as its box allows. */
export function PriceRange({ min, max, testId }: { min: string; max: string; testId: string }) {
  const len = Math.max(min.length + 2, max.length);
  return (
    <div className={css.rangeBox}>
      <div data-testid={testId} className={css.range} style={{ '--len': len } as CSSProperties}>
        <span>{min} –</span> <span>{max}</span>
      </div>
    </div>
  );
}

/** Ends of the scale line, in USD: about what the formula can quote. */
const SCALE_MIN = 200;
const SCALE_MAX = 60_000;

function scalePosition(usd: number): string {
  const part = Math.log(Math.max(usd, SCALE_MIN) / SCALE_MIN) / Math.log(SCALE_MAX / SCALE_MIN);
  return `${(Math.min(1, part) * 100).toFixed(1)}%`;
}

/** The range as a segment of a line; takes the USD amounts. */
export function RangeScale({ min, max }: { min: number; max: number }) {
  return (
    <div className={css.scale} style={{ '--from': scalePosition(min), '--to': scalePosition(max) } as CSSProperties} aria-hidden>
      <i />
    </div>
  );
}
