'use client';

import type { ReactNode } from 'react';

/** Section heading inside a step body. */
export function StepLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className='mb-3'>
      <div className='font-display font-bold text-ember-text'>{children}</div>
      {hint && <p className='text-[13px] text-ember-muted mt-0.5 leading-relaxed'>{hint}</p>}
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
    <button
      type='button'
      aria-pressed={selected}
      onClick={onClick}
      className={`relative border rounded-2xl text-left transition-all duration-150 cursor-pointer w-full ${compact ? 'p-3' : 'p-4'} ${
        selected
          ? 'border-ember-accent bg-[rgba(255,91,30,0.10)] shadow-[0_0_0_1px_var(--accent)]'
          : 'bg-ember-surface border-ember-border hover:border-ember-accent hover:-translate-y-px'
      }`}
    >
      {badge && (
        <span className='absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[rgba(255,91,30,0.16)] text-ember-accent'>
          {badge}
        </span>
      )}
      <div className='flex items-start gap-3'>
        {icon && <div className={compact ? 'text-xl leading-none mt-0.5' : 'text-2xl leading-none mt-0.5'}>{icon}</div>}
        <div className='min-w-0'>
          <div className='font-semibold text-ember-text text-[15px] leading-tight'>{title}</div>
          {desc && <div className='text-xs text-ember-muted mt-1 leading-relaxed'>{desc}</div>}
        </div>
      </div>
    </button>
  );
}

/** Multi-select chip with optional icon and price hint. */
export function ToggleChip({
  selected,
  onClick,
  icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={onClick}
      className={`flex items-center gap-2 border rounded-full pl-3 pr-3.5 py-2 text-sm transition-all duration-150 cursor-pointer ${
        selected
          ? 'border-ember-accent bg-[rgba(255,91,30,0.12)] text-ember-text'
          : 'bg-ember-surface border-ember-border text-ember-text hover:border-ember-accent'
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
          selected ? 'bg-ember-accent border-ember-accent' : 'border-ember-border'
        }`}
        aria-hidden
      >
        {selected && (
          <svg viewBox='0 0 12 12' className='w-2.5 h-2.5 text-[#0a0705]' fill='none' stroke='currentColor' strokeWidth='2.5'>
            <path d='M2 6l3 3 5-6' strokeLinecap='round' strokeLinejoin='round' />
          </svg>
        )}
      </span>
      {icon}
      <span className='font-medium'>{label}</span>
      {hint && <span className={`text-xs ${selected ? 'text-ember-accent' : 'text-ember-muted'}`}>{hint}</span>}
    </button>
  );
}

/** Small pill for segmented single-selects (urgency, languages, currency…). */
export function SegmentedPill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
        selected
          ? 'bg-ember-accent text-[#0a0705] border-ember-accent'
          : 'bg-ember-surface text-ember-text border-ember-border hover:border-ember-accent'
      }`}
    >
      {children}
    </button>
  );
}
