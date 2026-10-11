import type { LabTheme } from '../../theme/useLabTheme';

/**
 * How the globe reads in each style, from the theme tokens only. Dark styles
 * glow (additive light on a night sky); light styles print (ink dots on a
 * paper body, a hairline limb, solid pigment comets).
 */
export interface GlobeLook {
  isDark: boolean;
  blending: LabTheme['blending'];
  land: string;
  landOpacity: number;
  /** Far-side dots, seen through the body. */
  backOpacity: number;
  lit: string;
  litOpacity: number;
  /** Ripple flash colour. */
  flash: string;
  body: string;
  bodyOpacity: number;
  rim: string;
  rimStrength: number;
  shade: number;
  /** Land-dot brightness on the night side of the live terminator (1 = no night). */
  night: number;
  /** How much the body darkens on the night side. */
  nightShade: number;
  halo: string;
  haloStrength: number;
  haloSpread: number;
  limbLine: string;
  limbLineStrength: number;
  grid: string;
  gridOpacity: number;
  arcFrom: string;
  arcTo: string;
  arcHead: string;
  arcTrail: number;
  comet: string;
  cometCore: string;
  cometSoftness: number;
  ring: string;
  ringAlpha: number;
}

export function getGlobeLook(theme: LabTheme): GlobeLook {
  const { colors } = theme;
  const isDark = theme.scheme === 'dark';
  if (isDark) {
    return {
      isDark,
      blending: theme.blending,
      land: colors.muted,
      landOpacity: 0.78,
      backOpacity: 0.32,
      lit: colors.accent,
      litOpacity: 1,
      flash: colors.fg,
      body: colors.bg2,
      bodyOpacity: 0.84,
      rim: colors.accent,
      rimStrength: 0.42,
      shade: 0.35,
      night: 0.42,
      nightShade: 0.4,
      halo: colors.accent,
      haloStrength: 0.62,
      haloSpread: 0.075,
      limbLine: colors.accent,
      limbLineStrength: 0.22,
      grid: colors.muted,
      gridOpacity: 0.09,
      arcFrom: colors.accent,
      arcTo: colors.accent2,
      arcHead: colors.fg,
      arcTrail: 0.34,
      comet: colors.accent,
      cometCore: colors.fg,
      cometSoftness: 1,
      ring: colors.accent,
      ringAlpha: 0.95,
    };
  }
  return {
    isDark,
    blending: theme.blending,
    land: colors.fg,
    landOpacity: 0.5,
    backOpacity: 0.12,
    lit: colors.accent,
    litOpacity: 1,
    // accent2 (black ink in Concrete, apricot in Silk) so a ripple never reads as a lit country.
    flash: colors.accent2,
    body: colors.bg2,
    bodyOpacity: 0.94,
    rim: colors.accent,
    rimStrength: 0.12,
    shade: 0.07,
    night: 0.55,
    nightShade: 0.07,
    halo: colors.accent,
    haloStrength: 0.17,
    haloSpread: 0.06,
    limbLine: colors.fg,
    limbLineStrength: 0.42,
    grid: colors.fg,
    gridOpacity: 0.075,
    arcFrom: colors.accent,
    arcTo: colors.accent2,
    arcHead: colors.accent,
    arcTrail: 0.55,
    comet: colors.accent,
    cometCore: colors.accent,
    cometSoftness: 0.3,
    ring: colors.accent,
    ringAlpha: 0.85,
  };
}

/** '#rrggbb' + alpha → rgba() for the 2D still. */
export function rgba(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
