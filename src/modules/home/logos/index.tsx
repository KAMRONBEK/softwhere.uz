'use client';

import { useRef, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { useLabState } from '../context/LabContext';
import { useLabTheme } from '../theme/useLabTheme';
import type { LogoColor, LogoId } from '../types';
import { BRAND_ORANGE, LOGO_INK } from './brand';
import { useLogoEntrance } from './entrance';
import { MARKS, TILE, type MarkGeometry } from './marks';
import { WORDMARK } from './wordmark';
import css from './logos.module.css';

/**
 * SoftWhere's mark (founder's decision, 2026-10-10: keep the existing logo):
 * an S built from two code chevrons, '<' and '>', in brand orange, beside
 * "softwhere" in Sora 800 as the live site's header sets it. The panel flips
 * between the original drawing (Logo 1, the reference) and its faithful
 * refinement (Logo 2, the default); the hero, the finale and the panel show
 * the active one.
 *
 * Contract for every Logo / Mark / Icon component:
 * - Pure inline SVG, no external files or fonts (the word is outlined in
 *   wordmark.ts), scales from 16px to full-bleed. Size it with CSS: set a
 *   height (or a width) and leave the other `auto`.
 * - The mark paints with var(--logo-ink, var(--accent)). The lab root sets
 *   --logo-ink to BRAND_ORANGE while the panel's Logo color is "Brand
 *   orange" (the default); a `color` prop pins one logo; a section re-inks
 *   the mark on an accent fill by overriding --logo-ink. The wordmark is
 *   currentColor: set `color` on the logo (or a parent) for it. Rasterisers
 *   that swap `var(--accent)` / `currentColor` for marker inks (hero
 *   particles, the devices' phone back) keep working.
 * - At rest the S is one path ([data-logo-part="whole"]), so a translucent
 *   ink never shows a seam where the chevrons meet.
 * - role="img" + an accessible name (the `title` prop).
 * - `animate` plays the entrance once on mount: the chevrons glide in along
 *   the middle diagonal, rest a beat apart (< / >), then click shut into the
 *   S while the word rises (~1.2s); change the component's `key` to replay.
 *   Static under prefers-reduced-motion. For your own GSAP choreography,
 *   leave `animate` off and target [data-logo-part="mark|whole|letter|tile"].
 */
export interface LogoProps {
  className?: string;
  /** Accessible name. */
  title?: string;
  /** Play the entrance animation on mount. */
  animate?: boolean;
  /** Override the panel's Logo color (brand orange or the style accent). */
  color?: LogoColor;
}

export interface LabLogo {
  id: LogoId;
  name: string;
  /** One line: what this version is. */
  concept: string;
  /** Full lockup (mark + wordmark). */
  Logo: ComponentType<LogoProps>;
  /** The square mark, legible at 16px (favicon, avatar, loader). */
  Mark: ComponentType<LogoProps>;
  /** Rounded-square app icon (32px and up), where the version ships one. */
  Icon?: ComponentType<LogoProps>;
}

export { BRAND_ORANGE } from './brand';

const DEFAULT_TITLE = 'SoftWhere';
const MARK_BOX = 64;
const MARK_VIEWBOX = `0 0 ${MARK_BOX} ${MARK_BOX}`;
/** The live header's 10px between a 28px mark and the word's origin, in mark units. */
const WORD_GAP = (MARK_BOX * 10) / 28;

/** A `color` prop pins this logo's ink; otherwise it inherits --logo-ink from the lab root (the panel). */
function inkStyle(color: LogoColor | undefined): CSSProperties | undefined {
  if (!color) return undefined;
  return { '--logo-ink': color === 'brand' ? BRAND_ORANGE : 'var(--accent)' } as CSSProperties;
}

function useLogoColorFor(override: LogoColor | undefined): LogoColor {
  const { state } = useLabState();
  return override ?? state.logoColor;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

interface FrameProps {
  logoId: LogoId;
  geometry: MarkGeometry;
  viewBox: string;
  className?: string;
  title: string;
  animate: boolean;
  children: ReactNode;
}

function Frame({ logoId, geometry, viewBox, className, title, animate, children }: FrameProps) {
  const ref = useRef<SVGSVGElement>(null);
  useLogoEntrance(ref, animate, geometry.axis);
  const classes = [css.logo, className ?? ''].filter(Boolean).join(' ');
  return (
    <svg ref={ref} viewBox={viewBox} role='img' aria-label={title} className={classes} data-logo={logoId}>
      {children}
    </svg>
  );
}

// ── Mark body ─────────────────────────────────────────────────────────────
// The whole S at rest; the two chevrons, '<' then '>', only when the logo
// animates (hidden until the entrance shows them).
interface MarkBodyProps {
  geometry: MarkGeometry;
  isSplit: boolean;
  fill?: string;
}

function MarkBody({ geometry, isSplit, fill = LOGO_INK }: MarkBodyProps) {
  const { d, lt, gt, transform } = geometry;
  return (
    <>
      <path d={d} transform={transform} fill={fill} data-logo-part='whole' />
      {isSplit && (
        <>
          <g data-logo-part='lt' visibility='hidden'>
            <path d={lt} transform={transform} fill={fill} />
          </g>
          <g data-logo-part='gt' visibility='hidden'>
            <path d={gt} transform={transform} fill={fill} />
          </g>
        </>
      )}
    </>
  );
}

// ── Components ────────────────────────────────────────────────────────────

/** Builds the Mark and lockup components for one logo from its geometry. */
function defineLogo(id: LogoId, geometry: MarkGeometry) {
  const [inkLeft, inkRight] = geometry.ink;
  const wordX = round(inkRight - inkLeft + WORD_GAP);
  const baseline = round(MARK_BOX / 2 + WORDMARK.xHeight / 2);
  const lockupViewBox = `0 0 ${round(wordX + WORDMARK.x1)} ${MARK_BOX}`;

  function Mark({ className, title = DEFAULT_TITLE, animate = false, color }: LogoProps) {
    return (
      <Frame logoId={id} geometry={geometry} viewBox={MARK_VIEWBOX} className={className} title={title} animate={animate}>
        <g data-logo-part='mark' style={inkStyle(color)}>
          <MarkBody geometry={geometry} isSplit={animate} />
        </g>
      </Frame>
    );
  }

  function Lockup({ className, title = DEFAULT_TITLE, animate = false, color }: LogoProps) {
    return (
      <Frame logoId={id} geometry={geometry} viewBox={lockupViewBox} className={className} title={title} animate={animate}>
        <g transform={`translate(${-inkLeft} 0)`}>
          <g data-logo-part='mark' style={inkStyle(color)}>
            <MarkBody geometry={geometry} isSplit={animate} />
          </g>
        </g>
        <g transform={`translate(${wordX} ${baseline})`} fill='currentColor'>
          {WORDMARK.letters.map((d, index) => (
            <path key={index} d={d} data-logo-part='letter' />
          ))}
        </g>
      </Frame>
    );
  }

  return { Mark, Logo: Lockup };
}

/** The app tile: brand orange (or the style accent) with the Refined S knocked out in white / on-accent. */
function TileIcon({ className, title = DEFAULT_TITLE, animate = false, color }: LogoProps) {
  const inkColor = useLogoColorFor(color);
  const onInk = inkColor === 'brand' ? '#ffffff' : 'var(--on-accent)';
  return (
    <Frame logoId={2} geometry={MARKS.refined} viewBox={MARK_VIEWBOX} className={className} title={title} animate={animate}>
      <g data-logo-part='mark' style={inkStyle(color)}>
        <rect width={MARK_BOX} height={MARK_BOX} rx={TILE.radius} fill={LOGO_INK} data-logo-part='tile' />
        <g transform={`translate(${TILE.markOffset} ${TILE.markOffset}) scale(${TILE.markScale})`}>
          <MarkBody geometry={MARKS.refined} isSplit={animate} fill={onInk} />
        </g>
      </g>
    </Frame>
  );
}

export const LOGOS: readonly LabLogo[] = [
  {
    id: 1,
    name: 'Original',
    concept: 'Today’s logo exactly as drawn: an S of two code chevrons, < and >. The reference.',
    ...defineLogo(1, MARKS.original),
  },
  {
    id: 2,
    name: 'Refined',
    concept: 'The same S, redrawn true: one even stroke, every arm at 32°, smooth bends, the original’s leaf tips.',
    ...defineLogo(2, MARKS.refined),
    Icon: TileIcon,
  },
];

/** The logo for an id, falling back to the Refined default. */
export function getLogo(id: LogoId): LabLogo {
  return LOGOS.find(logo => logo.id === id) ?? LOGOS[LOGOS.length - 1];
}

/** The logo selected in the panel. */
export function useLabLogo(): LabLogo {
  const { state } = useLabState();
  return getLogo(state.logo);
}

/** The panel's Logo color: 'brand' (orange) or 'accent' (the style's). */
export function useLogoColor(): LogoColor {
  return useLabState().state.logoColor;
}

/** The mark's ink as a hex, for WebGL and canvas (THREE.Color takes it as is). */
export function useLogoInk(): string {
  const color = useLogoColor();
  const { colors } = useLabTheme();
  return color === 'brand' ? BRAND_ORANGE : colors.accent;
}
