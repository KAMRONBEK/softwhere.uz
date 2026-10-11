'use client';

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { useLabState } from '../context/LabContext';
import { LAB_COPY } from '../copy';
import { DPR_CAPS, useDetectedTier, useDeviceTier } from '../device/useDeviceTier';
import { scrollToSection } from '../global/scroll';
import { getLogo, LOGOS } from '../logos';
import { LAB_FONTS } from '../theme/fonts';
import { LAB_STYLES, type LabStyle } from '../theme/styles';
import { pickStyle } from '../theme/switchStyle';
import { useLabStyle } from '../theme/useLabTheme';
import { STYLE_IDS, type LogoColor, type LogoId, type Quality, type SectionId, type SectionMeta, type StyleId } from '../types';
import css from './ControlPanel.module.css';

const COPIED_RESET_MS = 1500;
const COPY = LAB_COPY.panel;

interface Option<T> {
  value: T;
  label: string;
  isDim?: boolean;
  isDisabled?: boolean;
  title?: string;
}

interface SegmentedProps<T extends string | number> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

function Segmented<T extends string | number>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <fieldset className={css.group}>
      <legend className={css.legend}>{label}</legend>
      <div className={css.segmented}>
        {options.map(option => (
          <button
            key={String(option.value)}
            type='button'
            className={`${css.segment} ${option.isDim ? css.dim : ''}`}
            aria-pressed={option.value === value}
            disabled={option.isDisabled}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function fontsLine(style: LabStyle): string {
  const { display, body, mono } = style.fonts;
  const names = [display, body, mono].map(key => LAB_FONTS[key].label);
  return [...new Set(names)].join(' / ');
}

/** A style card: its own ground, ink, accents and display face, whatever style is active. */
function StyleSwatch({ style }: { style: LabStyle }) {
  const { colors } = style;
  return (
    <span
      className={css.swatch}
      style={{ background: colors.bg, color: colors.fg, borderRadius: `min(${style.radius}, 10px)` }}
      aria-hidden='true'
    >
      <span
        className={css.swatchType}
        style={{
          fontFamily: `var(${LAB_FONTS[style.fonts.display].cssVar})`,
          fontWeight: style.type.displayWeight,
          letterSpacing: style.type.displayTracking,
        }}
      >
        Aa
      </span>
      <span className={css.swatchDots}>
        <span style={{ background: colors.accent }} />
        <span style={{ background: colors.accent2 }} />
      </span>
    </span>
  );
}

/** The new look grows from the card the founder tapped. */
function pickFromCard(id: StyleId, event: MouseEvent<HTMLButtonElement>): void {
  const rect = event.currentTarget.getBoundingClientRect();
  void pickStyle(id, { origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } });
}

function StylePicker({ value }: { value: StyleId }) {
  return (
    <fieldset className={css.group}>
      <legend className={css.legend}>{COPY.style}</legend>
      <div className={css.cards}>
        {STYLE_IDS.map(id => {
          const style = LAB_STYLES[id];
          return (
            <button
              key={id}
              type='button'
              className={`${css.card} ${style.isPlaceholder ? css.dim : ''}`}
              aria-pressed={id === value}
              onClick={event => pickFromCard(id, event)}
            >
              <StyleSwatch style={style} />
              <span className={css.cardLabel}>
                <span className={css.cardKey}>{id}</span>
                {style.name}
              </span>
            </button>
          );
        })}
      </div>
      <p className={css.note}>{LAB_STYLES[value].note}</p>
      <p className={css.fonts}>{fontsLine(LAB_STYLES[value])}</p>
    </fieldset>
  );
}

/**
 * Logo cards show each mark big enough to judge the drawing on a phone, then
 * at its real 32px and 16px, on the active style's ground.
 */
function LogoPicker({ value, onChange }: { value: LogoId; onChange: (id: LogoId) => void }) {
  return (
    <fieldset className={css.group}>
      <legend className={css.legend}>{COPY.logo}</legend>
      <div className={css.cards}>
        {LOGOS.map(({ id, name, Mark }) => (
          <button key={id} type='button' className={css.card} aria-pressed={id === value} onClick={() => onChange(id)}>
            <span className={css.logoPreview} aria-hidden='true'>
              <Mark className={css.logoMarkLarge} />
              <span className={css.logoSizes}>
                <Mark className={css.logoMark32} />
                <Mark className={css.logoMark16} />
              </span>
            </span>
            <span className={css.cardLabel}>
              <span className={css.cardKey}>{id}</span>
              {name}
            </span>
          </button>
        ))}
      </div>
      <p className={css.note}>{getLogo(value).concept}</p>
    </fieldset>
  );
}

// The mark keeps SoftWhere's orange by default, whatever the style; the founder can try it in the style's accent.
const LOGO_COLOR_OPTIONS: Option<LogoColor>[] = [
  { value: 'brand', label: COPY.logoColorBrand },
  { value: 'accent', label: COPY.logoColorAccent },
];

// 'mid' stays URL-only (?q=mid) for testing; the panel offers the three the founder needs.
const QUALITY_OPTIONS: Option<Quality>[] = [
  { value: 'auto', label: COPY.qualityAuto },
  { value: 'high', label: COPY.qualityHigh },
  { value: 'low', label: COPY.qualityLow },
];

function useCopyLink(): [boolean, () => void] {
  const [isCopied, setIsCopied] = useState(false);
  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [isCopied]);
  const copy = () => {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => setIsCopied(true))
      .catch(() => undefined);
  };
  return [isCopied, copy];
}

interface SectionListProps {
  sections: readonly SectionMeta[];
  activeId: SectionId | null;
  onJump: (id: SectionId) => void;
  onSolo: (id: SectionId) => void;
}

function SectionList({ sections, activeId, onJump, onSolo }: SectionListProps) {
  return (
    <ol className={css.list}>
      {sections.map(section => (
        <li key={section.id} className={css.row} data-active={section.id === activeId ? 'true' : undefined}>
          <button type='button' className={css.jump} onClick={() => onJump(section.id)}>
            <span className={css.num}>{section.number}</span>
            {section.name}
          </button>
          <button type='button' className={css.solo} onClick={() => onSolo(section.id)} aria-label={`${COPY.solo} ${section.name}`}>
            {COPY.solo}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Floating, collapsible lab controls; every choice is mirrored into the URL. */
export default function ControlPanel({ sections }: { sections: readonly SectionMeta[] }) {
  const { state, update } = useLabState();
  const style = useLabStyle();
  const detected = useDetectedTier();
  const tier = useDeviceTier();
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, copyLink] = useCopyLink();
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleJump = (id: SectionId) => {
    setIsOpen(false);
    if (state.only) update({ only: id });
    else scrollToSection(id);
  };
  const handleSolo = (id: SectionId) => {
    setIsOpen(false);
    update({ only: id });
  };
  const soloMeta = sections.find(section => section.id === state.only);

  return (
    <div className={css.dock} data-lab-panel='' data-lenis-prevent=''>
      {isOpen && (
        <aside id={panelId} className={css.panel} aria-label={COPY.title}>
          <header className={css.header}>
            <strong className={css.title}>{COPY.title}</strong>
            <button type='button' className={css.ghost} onClick={copyLink}>
              {isCopied ? COPY.copied : COPY.copyLink}
            </button>
            <button ref={closeRef} type='button' className={css.ghost} onClick={() => setIsOpen(false)}>
              {COPY.close}
            </button>
          </header>
          <StylePicker value={style} />
          <LogoPicker value={state.logo} onChange={logo => update({ logo })} />
          <Segmented
            label={COPY.logoColor}
            options={LOGO_COLOR_OPTIONS}
            value={state.logoColor}
            onChange={logoColor => update({ logoColor })}
          />
          <Segmented label={COPY.quality} options={QUALITY_OPTIONS} value={state.quality} onChange={quality => update({ quality })} />
          <p className={css.note}>
            {COPY.detected}: {detected} · now {tier}, DPR ≤ {DPR_CAPS[tier][1]}
          </p>
          <fieldset className={css.group}>
            <legend className={css.legend}>{COPY.sections}</legend>
            {state.only && (
              <button type='button' className={css.wide} onClick={() => update({ only: null })}>
                {COPY.showAll}
              </button>
            )}
            <SectionList sections={sections} activeId={state.only} onJump={handleJump} onSolo={handleSolo} />
          </fieldset>
        </aside>
      )}
      <div className={css.bar}>
        {soloMeta && (
          <button type='button' className={css.pill} onClick={() => update({ only: null })} title={COPY.showAll}>
            {COPY.solo} {soloMeta.number} ×
          </button>
        )}
        <button
          type='button'
          className={css.toggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen(open => !open)}
        >
          {COPY.open}
          <span className={css.status}>
            {style}·{state.logo}·{state.quality}
          </span>
        </button>
      </div>
    </div>
  );
}
