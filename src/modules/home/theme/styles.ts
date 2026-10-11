import type { StyleId } from '../types';
import type { LabFontKey } from './fonts';

/**
 * Style directions the founder flips between (panel: Style A/B/C/D).
 *
 * The four are deliberately far apart — two dark, two light; one per hue
 * family (orange, cobalt, jade, pomegranate) — so a section that only
 * looks good in one of them shows up immediately.
 *
 * Contract for the art director:
 * - Every key in LabStyleColors except `glow` MUST be a 6-digit hex
 *   ('#rrggbb'): WebGL materials read them through useLabTheme() and
 *   THREE.Color does not parse alpha. `glow` is CSS-only (shadows, blurs) and
 *   may be any CSS color, e.g. 'rgba(255, 90, 31, 0.35)'.
 * - Contrast floor, checked for every style: `fg` and `muted` on `bg` and
 *   `bg2` ≥ 4.5:1; `accent` on `bg` ≥ 3:1 (large text, icons, strokes);
 *   `onAccent` on `accent` ≥ 4.5:1. `accent2` is for gradients, data and
 *   particles only — never body text.
 * - `fonts` keys come from LAB_FONTS in fonts.ts.
 * - Nothing else reads these values directly: CSS gets them as custom
 *   properties via theme/tokens.ts, JS via useLabTheme().
 *
 * WebGL note for section agents: on the light styles (B, C) additive glow
 * vanishes into the background. Use `useLabTheme().blending` — 'additive' on
 * dark, 'normal' on light — and let particles read as solid ink or pigment.
 */

export interface LabStyleColors {
  /** Page background. */
  bg: string;
  /** Raised surfaces, cards, alternate section backgrounds. */
  bg2: string;
  /** Primary text. */
  fg: string;
  /** Secondary text, hairlines. */
  muted: string;
  /** Brand accent (CTAs, highlights, the hero glow). */
  accent: string;
  /** Second accent for gradients, data and particles. */
  accent2: string;
  /** Text/icon color on an `accent` fill (buttons, chips). */
  onAccent: string;
  /** Glow/shadow color, CSS only. */
  glow: string;
}

export interface LabStyleType {
  /** Default weight for display headings (h1/h2); the face is tuned for it. */
  displayWeight: number;
  /** Default letter-spacing for display headings, tuned for 40px and up. */
  displayTracking: string;
  /**
   * Optical size correction: multiply display font sizes by it so the four
   * faces read at the same visual size (Science Gothic runs wide, Sofia
   * Extra Condensed and Cormorant's small x-height run small).
   */
  displayScale: number;
}

export interface LabStyle {
  id: StyleId;
  name: string;
  /** One line shown in the panel: the mood of the direction. */
  note: string;
  isPlaceholder?: boolean;
  scheme: 'dark' | 'light';
  colors: LabStyleColors;
  fonts: { display: LabFontKey; body: LabFontKey; mono: LabFontKey };
  type: LabStyleType;
  /** Base corner radius as a CSS length. */
  radius: string;
}

/**
 * A · Observatory — Ulugh Beg's 15th-century Samarkand observatory meets the
 * Kosmonavtlar metro station: a lapis night sky, an ultraviolet second light.
 * Science Gothic is squared and extended, like lettering engraved on an
 * instrument. The WebGL-first direction, and the homepage default.
 *
 * Accent: SoftWhere brand orange #FE4502 (founder's decision 2026-10-11, was
 * turquoise #3cf2d6). 5.8:1 on bg (large text, icons); text on an orange fill
 * is the dark `onAccent` (5.4:1) — white on this orange is 3.5:1 and fails.
 */
const OBSERVATORY: LabStyle = {
  id: 'A',
  name: 'Observatory',
  note: 'Samarkand night sky: deep lapis, SoftWhere orange and ultraviolet, engraved-instrument type.',
  scheme: 'dark',
  colors: {
    bg: '#050816',
    bg2: '#0c1230',
    fg: '#edf1ff',
    muted: '#8f97c2',
    accent: '#fe4502',
    accent2: '#8e6bff',
    onAccent: '#03141a',
    glow: 'rgba(254, 69, 2, 0.4)',
  },
  fonts: { display: 'science-gothic', body: 'onest', mono: 'martian-mono' },
  type: { displayWeight: 500, displayTracking: '-0.01em', displayScale: 0.9 },
  radius: '12px',
};

/**
 * B · Concrete — Tashkent modernism (Hotel Uzbekistan's concrete lattice,
 * the 1970s panel blocks): raw concrete ground, pure black ink, one cobalt
 * signal borrowed from Rishtan glaze. Poster-condensed headlines over a
 * bookish serif; square corners because slabs do not have radii.
 */
const CONCRETE: LabStyle = {
  id: 'B',
  name: 'Concrete',
  note: 'Tashkent modernism: raw concrete, black ink and one cobalt signal, poster-condensed headlines.',
  scheme: 'light',
  colors: {
    bg: '#d8d7d1',
    bg2: '#e9e8e3',
    fg: '#000000',
    muted: '#4f4e48',
    accent: '#2b2bff',
    accent2: '#000000',
    onAccent: '#f2f1ec',
    glow: 'rgba(43, 43, 255, 0.28)',
  },
  fonts: { display: 'sofia-sans-xcond', body: 'literata', mono: 'ibm-plex-mono' },
  type: { displayWeight: 800, displayTracking: '-0.005em', displayScale: 1.2 },
  radius: '0px',
};

/**
 * C · Silk — the light premium direction. Pearl daylight and generous air,
 * with colour arriving only as soft bleeds the way Margilan ikat silk blurs
 * its dye edges: jade into apricot. One quiet grotesk carries everything.
 */
const SILK: LabStyle = {
  id: 'C',
  name: 'Silk',
  note: 'Daylight premium: pearl white and air, jade and apricot that bleed softly like ikat silk.',
  scheme: 'light',
  colors: {
    bg: '#f4f5f2',
    bg2: '#ffffff',
    fg: '#0e1512',
    muted: '#58625d',
    accent: '#00835e',
    accent2: '#ff9f5a',
    onAccent: '#ffffff',
    glow: 'rgba(0, 131, 94, 0.22)',
  },
  fonts: { display: 'geologica', body: 'geologica', mono: 'geist-mono' },
  type: { displayWeight: 300, displayTracking: '-0.035em', displayScale: 1 },
  radius: '22px',
};

/**
 * D · Pomegranate — cinema after dark. Wine-black like a theatre before the
 * curtain, pomegranate red (the anor of suzani embroidery) and candle gold;
 * big Garamond-cut titles as in a film's opening credits.
 */
const POMEGRANATE: LabStyle = {
  id: 'D',
  name: 'Pomegranate',
  note: 'Cinema after dark: wine-black, pomegranate red and candle gold, big serif title cards.',
  scheme: 'dark',
  colors: {
    bg: '#120709',
    bg2: '#1f0d11',
    fg: '#f7eae4',
    muted: '#b5968f',
    accent: '#ff2e4c',
    accent2: '#f2b95b',
    onAccent: '#120709',
    glow: 'rgba(255, 46, 76, 0.38)',
  },
  fonts: { display: 'cormorant', body: 'commissioner', mono: 'ibm-plex-mono' },
  type: { displayWeight: 600, displayTracking: '-0.015em', displayScale: 1.1 },
  radius: '4px',
};

export const LAB_STYLES: Record<StyleId, LabStyle> = {
  A: OBSERVATORY,
  B: CONCRETE,
  C: SILK,
  D: POMEGRANATE,
};
