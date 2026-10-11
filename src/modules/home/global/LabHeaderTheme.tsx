'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import { prefetchStyleFonts } from '../theme/fontWarm';
import { LAB_FONTS } from '../theme/fonts';
import { LAB_STYLES } from '../theme/styles';
import { getPendingStyle, subscribePendingStyle, type PickOptions } from '../theme/switchStyle';
import { readSavedPick } from '../theme/themeStore';
import { STYLE_IDS, type StyleId } from '../types';
import { useDismiss, type DismissReason } from './LabHeader.hooks';
import css from './LabHeaderTheme.module.css';

/** One picker per page (the header's); a fixed id keeps server and client markup identical. */
const POPOVER_ID = 'lab-theme-popover';
/** The first-visit nudge waits for the hero's entrance, then stays until the first scroll. */
const NUDGE_DELAY_MS = 1600;
const NUDGE_SCROLL_PX = 24;
/** Once dismissed, the nudge never comes back on this device. */
const NUDGE_SEEN_KEY = 'sw-theme-nudge';

export type PickHandler = (id: StyleId, options: PickOptions) => void;

const noPending = () => null;

function usePendingStyle(): StyleId | null {
  return useSyncExternalStore(subscribePendingStyle, getPendingStyle, noPending);
}

/**
 * A style's own miniature page, painted in its palette and faces whatever
 * style is active: a nav hairline, the headline in its display face, a call
 * to action in its accent. Rendering it fetches that style's display font.
 */
function StyleSwatch({ id }: { id: StyleId }) {
  const t = useTranslations('home.header.swatch');
  const { colors, fonts, type, radius } = LAB_STYLES[id];
  const face: CSSProperties = {
    fontFamily: `var(${LAB_FONTS[fonts.display].cssVar}), var(${LAB_FONTS[fonts.body].cssVar})`,
    fontWeight: type.displayWeight,
    letterSpacing: type.displayTracking,
    fontSize: `calc(var(--swatch-type, 15px) * ${type.displayScale})`,
  };
  return (
    <span
      className={css.swatch}
      style={{ background: colors.bg, color: colors.fg, borderRadius: `min(${radius}, 8px)` }}
      data-swatch=''
      aria-hidden='true'
    >
      <span className={css.swatchNav}>
        <span className={css.swatchMark} />
        <span className={css.swatchLinks} style={{ background: colors.muted }} />
      </span>
      <span className={css.swatchHead} style={face}>
        <span className={css.swatchLead}>{t('lead')} </span>
        {t('headline')}
      </span>
      <span className={css.swatchFoot}>
        <span className={css.swatchCta} style={{ background: colors.accent, borderRadius: `min(${radius}, 6px)` }}>
          <span style={{ background: colors.onAccent }} />
        </span>
        <span className={css.swatchRule} style={{ background: colors.accent2 }} />
      </span>
      <span className={css.spinner} />
    </span>
  );
}

/** The centre of an option's swatch: the new look grows from there. */
function originOf(button: HTMLElement): PickOptions['origin'] {
  const rect = (button.querySelector('[data-swatch]') ?? button).getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

interface ThemeOptionsProps {
  value: StyleId;
  onPick: PickHandler;
  /** 'cards' (2×2 with names and moods) in the popover, 'row' (four across, names only) in the phone menu. */
  layout?: 'cards' | 'row';
  /** Move focus to the active option on mount (the picker opened from the keyboard or a tap). */
  shouldFocusActive?: boolean;
}

/** The four looks as toggle buttons; used by the header popover and the phone menu. */
export function ThemeOptions({ value, onPick, layout = 'cards', shouldFocusActive = false }: ThemeOptionsProps) {
  const t = useTranslations('home.header');
  const activeRef = useRef<HTMLButtonElement>(null);
  const pending = usePendingStyle();
  // The tapped option takes the pressed ring at once; its spinner shows only if the fonts make it wait.
  const shown = pending ?? value;

  useEffect(() => {
    if (shouldFocusActive) activeRef.current?.focus({ preventScroll: true });
    // Only on mount: picking must not steal focus again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: StyleId) => (event: MouseEvent<HTMLButtonElement>) => onPick(id, { origin: originOf(event.currentTarget) });
  // One look's faces, fetched when its option is pointed at, focused or pressed (a tap's
  // pointerdown comes before its click), never every look at once: a pick that still
  // waits for its fonts shows the option's spinner (theme/switchStyle.ts).
  const warm = (id: StyleId) => () => prefetchStyleFonts(id);

  return (
    <div className={layout === 'row' ? css.row : css.options} role='group' aria-label={t('theme.label')}>
      {STYLE_IDS.map(id => {
        const style = LAB_STYLES[id];
        return (
          <button
            key={id}
            ref={id === value ? activeRef : undefined}
            type='button'
            className={css.option}
            aria-pressed={id === shown}
            data-pending={id === pending ? 'true' : undefined}
            data-style-option={id}
            aria-label={layout === 'row' ? `${t(`styles.${id}`)}, ${t(`moods.${id}`)}` : undefined}
            onPointerEnter={warm(id)}
            onPointerDown={warm(id)}
            onFocus={warm(id)}
            onClick={pick(id)}
          >
            <StyleSwatch id={id} />
            {layout === 'cards' ? (
              <span className={css.optionText}>
                <span className={css.optionName}>{t(`styles.${id}`)}</span>
                <span className={css.optionMood}>
                  {t(`moods.${id}`)} · {style.scheme === 'dark' ? t('theme.dark') : t('theme.light')}
                </span>
              </span>
            ) : (
              // Four across a phone: the short mood word fits where "Observatory" would be cut.
              <span className={css.optionText}>
                <span className={css.optionName}>{t(`moods.${id}`)}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function hasSeenNudge(): boolean {
  try {
    return window.localStorage.getItem(NUDGE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberNudgeSeen(): void {
  try {
    window.localStorage.setItem(NUDGE_SEEN_KEY, '1');
  } catch {
    // Storage blocked: the nudge shows again next visit, until the first scroll.
  }
}

type NudgePhase = 'waiting' | 'shown' | 'done';

/**
 * First visit only: a small "Try 4 looks" beside the trigger, after the hero
 * has entered, gone for good at the first scroll, a tap on it or any header
 * layer opening. Never for a visitor who has picked a look before.
 */
function useFirstVisitNudge(isBusy: boolean): [boolean, () => void] {
  const [phase, setPhase] = useState<NudgePhase>('waiting');
  // A header layer opened (the picker, the menu): the visitor found their way; adjust during render, no effect.
  if (isBusy && phase !== 'done') setPhase('done');

  const dismiss = useCallback(() => setPhase('done'), []);

  useEffect(() => {
    if (readSavedPick() || hasSeenNudge() || window.scrollY > NUDGE_SCROLL_PX) return;
    const timer = setTimeout(() => {
      if (window.scrollY <= NUDGE_SCROLL_PX) setPhase(previous => (previous === 'waiting' ? 'shown' : previous));
    }, NUDGE_DELAY_MS);
    const onScroll = () => {
      if (window.scrollY <= NUDGE_SCROLL_PX) return;
      clearTimeout(timer);
      setPhase('done');
      window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Remember it once it has been seen and dismissed; one that never showed may show next visit.
  const wasShown = useRef(false);
  useEffect(() => {
    if (phase === 'shown') wasShown.current = true;
    if (phase === 'done' && wasShown.current) rememberNudgeSeen();
  }, [phase]);

  return [phase === 'shown', dismiss];
}

interface ThemePickerProps {
  value: StyleId;
  isOpen: boolean;
  /** Another header layer (the phone menu, the stories) is open: the first-visit nudge gives way. */
  isOtherLayerOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPick: PickHandler;
}

/**
 * The header's theme button: the active look's two accents and the word
 * "Theme" (the look's name lives in the popover), opening the four looks.
 * On phones it is the round swatch alone, at 44px.
 */
export function ThemePicker({ value, isOpen, isOtherLayerOpen, onOpenChange, onPick }: ThemePickerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations('home.header.theme');
  const tStyles = useTranslations('home.header.styles');
  const name = tStyles(value);
  const [isNudging, dismissNudge] = useFirstVisitNudge(isOpen || isOtherLayerOpen);

  // Escape hands focus back to the trigger; a press outside leaves it where the visitor put it.
  const dismiss = useCallback(
    (reason: DismissReason) => {
      onOpenChange(false);
      if (reason === 'escape') triggerRef.current?.focus({ preventScroll: true });
    },
    [onOpenChange]
  );
  useDismiss(wrapRef, isOpen, dismiss);

  return (
    <div ref={wrapRef} className={css.picker}>
      <button
        ref={triggerRef}
        type='button'
        className={css.trigger}
        aria-expanded={isOpen}
        aria-controls={POPOVER_ID}
        aria-label={t('trigger', { name })}
        data-nudge={isNudging ? 'true' : undefined}
        onClick={() => onOpenChange(!isOpen)}
      >
        <span className={css.dot} aria-hidden='true' />
        <span className={css.triggerLabel} aria-hidden='true'>
          {t('label')}
        </span>
        <svg className={css.chevron} viewBox='0 0 10 6' aria-hidden='true'>
          <path d='M1 1l4 4 4-4' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </button>
      {isNudging && !isOpen && !isOtherLayerOpen && (
        <button
          type='button'
          className={css.nudge}
          onClick={() => {
            dismissNudge();
            onOpenChange(true);
          }}
        >
          {t('nudge')}
        </button>
      )}
      {isOpen && (
        <div id={POPOVER_ID} className={css.popover} data-lenis-prevent=''>
          <p className={css.title}>
            {t('title')}
            <span className={css.titleNow}>{name}</span>
          </p>
          <ThemeOptions value={value} onPick={onPick} shouldFocusActive />
          <p className={css.hint}>{t('hint')}</p>
        </div>
      )}
    </div>
  );
}
