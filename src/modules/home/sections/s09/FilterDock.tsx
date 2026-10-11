'use client';

import { Flip } from 'gsap/Flip';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { gsap } from '../../global/gsap';
import type { WallFilter, WallFilterId } from './data';
import css from './wall.module.css';

gsap.registerPlugin(Flip);

/** The chosen chip stays open this long, so the pill slide and the re-deal are seen before it folds. */
const FOLD_DELAY_MS = 520;

interface FilterDockProps {
  filters: readonly WallFilter[];
  selected: WallFilterId;
  reducedMotion: boolean;
  onSelect: (id: WallFilterId) => void;
  onOpenChange: (isOpen: boolean) => void;
  /** A neighbour that shifts when the pill unfolds (the list link): it glides along. */
  companionRef?: RefObject<HTMLElement | null>;
}

function Chevron() {
  return (
    <svg className={css.chevron} viewBox='0 0 16 16' width='14' height='14' aria-hidden='true' focusable='false'>
      <path d='M4 6l4 4 4-4' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

/**
 * The filters as one pill that unfolds: folded, it is the active filter
 * (tap to unfold); unfolded, every chip slides out of it (GSAP Flip) and the
 * accent pill glides to the one you pick, then it folds back around it.
 */
export default function FilterDock({ filters, selected, reducedMotion, onSelect, onOpenChange, companionRef }: FilterDockProps) {
  const t = useTranslations('home.work-wall');
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const chipsStateRef = useRef<Flip.FlipState | null>(null);
  const pillStateRef = useRef<Flip.FlipState | null>(null);
  const foldTimerRef = useRef(0);

  const flipTargets = useCallback((): HTMLElement[] => {
    const chips = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-chip]') ?? []);
    const companion = companionRef?.current;
    return companion ? [...chips, companion] : chips;
  }, [companionRef]);

  /** Captures the chips (and the companion) for the Flip, then folds or unfolds. */
  const setOpen = useCallback(
    (next: boolean) => {
      window.clearTimeout(foldTimerRef.current);
      const targets = reducedMotion ? [] : flipTargets();
      chipsStateRef.current = targets.length ? Flip.getState(targets) : null;
      setIsOpen(next);
      onOpenChange(next);
    },
    [flipTargets, onOpenChange, reducedMotion]
  );

  const pick = (id: WallFilterId) => {
    if (!isOpen) {
      setOpen(true);
      return;
    }
    if (id === selected) {
      setOpen(false);
      return;
    }
    if (!reducedMotion) {
      const pill = rootRef.current?.querySelector<HTMLElement>('[data-flip-id="chip-pill"]');
      pillStateRef.current = pill ? Flip.getState(pill) : null;
    }
    onSelect(id);
    window.clearTimeout(foldTimerRef.current);
    foldTimerRef.current = window.setTimeout(() => setOpen(false), FOLD_DELAY_MS);
  };

  // Unfold / fold: chips slide out of (and back into) the active one.
  useLayoutEffect(() => {
    const state = chipsStateRef.current;
    chipsStateRef.current = null;
    const targets = flipTargets();
    if (!state || !targets.length) return;
    const flip = Flip.from(state, {
      targets,
      duration: 0.42,
      ease: 'power3.inOut',
      // Only the chips that fold away leave the flow; the rest (and the link) glide on transforms.
      absolute: '[data-chip][hidden]',
      onEnter: entering =>
        gsap.fromTo(
          entering,
          { opacity: 0, x: -18, scale: 0.94 },
          { opacity: 1, x: 0, scale: 1, duration: 0.36, ease: 'power3.out', stagger: 0.04 }
        ),
      onLeave: leaving => gsap.to(leaving, { opacity: 0, x: -14, scale: 0.94, duration: 0.2, ease: 'power2.in' }),
    });
    return () => {
      flip.progress(1).kill();
    };
  }, [isOpen, flipTargets]);

  // The accent pill glides from the old chip to the new one.
  useLayoutEffect(() => {
    const state = pillStateRef.current;
    pillStateRef.current = null;
    const pill = rootRef.current?.querySelector<HTMLElement>('[data-flip-id="chip-pill"]');
    if (!state || !pill) return;
    const flip = Flip.from(state, { targets: pill, duration: 0.5, ease: 'power3.inOut', scale: true });
    return () => {
      flip.progress(1).kill();
    };
  }, [selected]);

  // Unfolded: a tap anywhere else folds it.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointer);
    return () => document.removeEventListener('pointerdown', handlePointer);
  }, [isOpen, setOpen]);

  useEffect(() => () => window.clearTimeout(foldTimerRef.current), []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.stopPropagation();
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"], [aria-expanded]')?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={css.dock}
      role='group'
      aria-label={t('filtersLabel')}
      data-open={isOpen || undefined}
      onKeyDown={handleKeyDown}
    >
      {filters.map(filter => {
        const isSelected = filter.id === selected;
        const isShown = isOpen || isSelected;
        const count = filter.indices.length;
        const label = t(`filters.${filter.id}`);
        return (
          <button
            key={filter.id}
            type='button'
            className={css.chip}
            data-chip=''
            hidden={!isShown}
            aria-pressed={isOpen ? isSelected : undefined}
            aria-expanded={isOpen ? undefined : false}
            aria-label={isOpen ? undefined : t('filterChipLabel', { filter: label, status: t(`status.${filter.id}`, { count }) })}
            onClick={() => pick(filter.id)}
          >
            {isSelected ? <span className={css.chipPill} data-flip-id='chip-pill' aria-hidden='true' /> : null}
            <span className={css.chipLabel}>{label}</span>
            {filter.showsCount ? <span className={css.chipCount}>{count}</span> : null}
            {isSelected ? <Chevron /> : null}
          </button>
        );
      })}
    </div>
  );
}
