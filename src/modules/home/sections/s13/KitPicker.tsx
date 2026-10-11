'use client';

import { Flip } from 'gsap/Flip';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from '../../global/gsap';
import type { Kit, KitId } from './stack-data';
import css from './kits.module.css';

gsap.registerPlugin(Flip);

/**
 * "What are you building?": one chip per kit, the chosen one under an accent
 * pill that glides from chip to chip (Flip). Phones: one row that scrolls
 * sideways and brings the chosen chip into view. The tower and the toolbox
 * drawer each render one, driven by the same state.
 */

interface KitPickerProps {
  kits: readonly Kit[];
  value: KitId;
  onPick: (id: KitId) => void;
  labelledBy: string;
  /** Unique per picker, so one picker's pill never glides into another's. */
  name: string;
  reducedMotion: boolean;
  /** Cursor badge over the kits not shown yet. */
  cursorLabel?: string;
  /** Extra chips after the kits (the drawer's proof switch). */
  children?: ReactNode;
}

const PILL_SELECTOR = '[data-pill]';

export default function KitPicker({ kits, value, onPick, labelledBy, name, reducedMotion, cursorLabel, children }: KitPickerProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const pillStateRef = useRef<Flip.FlipState | null>(null);

  const pick = (id: KitId) => {
    if (id === value) return;
    const pill = rowRef.current?.querySelector<HTMLElement>(PILL_SELECTOR);
    pillStateRef.current = pill && !reducedMotion ? Flip.getState(pill) : null;
    onPick(id);
  };

  // The pill glides to the chosen chip; a chip out of a phone's row scrolls into view.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const pill = row?.querySelector<HTMLElement>(PILL_SELECTOR);
    const chip = pill?.parentElement;
    if (row && chip && row.scrollWidth > row.clientWidth) {
      const isHidden = chip.offsetLeft < row.scrollLeft || chip.offsetLeft + chip.offsetWidth > row.scrollLeft + row.clientWidth;
      if (isHidden) {
        const target = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
        row.scrollTo({ left: Math.max(0, target), behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    }
    const state = pillStateRef.current;
    pillStateRef.current = null;
    if (!state || !pill) return;
    const flip = Flip.from(state, { targets: pill, duration: 0.42, ease: 'power3.inOut', scale: true });
    return () => {
      flip.progress(1).kill();
    };
  }, [value, reducedMotion]);

  return (
    <div ref={rowRef} className={css.row} role='group' aria-labelledby={labelledBy}>
      {kits.map(kit => {
        const isActive = kit.id === value;
        return (
          <button
            key={kit.id}
            type='button'
            className={css.chip}
            aria-pressed={isActive}
            onClick={() => pick(kit.id)}
            data-cursor={!isActive && cursorLabel ? cursorLabel : undefined}
            data-cursor-icon={!isActive && cursorLabel ? 'none' : undefined}
            data-cursor-hide={isActive ? '' : undefined}
          >
            {isActive && <span className={css.pill} data-pill='' data-flip-id={`${name}-pill`} aria-hidden='true' />}
            <span className={css.label}>{kit.label}</span>
          </button>
        );
      })}
      {children}
    </div>
  );
}

interface ProofChipProps {
  label: string;
  isOn: boolean;
  onToggle: () => void;
}

/** A switch, not a kit: marks the tools a real portfolio project lists. */
export function ProofChip({ label, isOn, onToggle }: ProofChipProps) {
  return (
    <>
      <span className={css.rule} aria-hidden='true' />
      <button type='button' className={`${css.chip} ${css.proof}`} aria-pressed={isOn} onClick={onToggle}>
        <span className={css.mark} aria-hidden='true' />
        <span className={css.label}>{label}</span>
      </button>
    </>
  );
}
