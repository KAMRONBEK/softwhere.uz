'use client';

import { useEffect, useLayoutEffect, useSyncExternalStore, type RefObject } from 'react';
import { DEFAULT_LAB_STATE } from '../config';
import { STYLE_IDS, type StyleId } from '../types';
import { LAB_FONTS } from './fonts';
import { LAB_STYLES, type LabStyle, type LabStyleColors, type LabStyleType } from './styles';
import { getStoredStyle, subscribeStoredStyle } from './themeStore';

export interface LabTheme {
  styleId: StyleId;
  style: LabStyle;
  scheme: LabStyle['scheme'];
  /** Hex colors (glow excepted) — pass straight to THREE.Color / materials. */
  colors: LabStyleColors;
  /**
   * How glow and particles should blend: 'additive' on the dark styles,
   * 'normal' on the light ones (additive light disappears on a pale ground).
   * Map it to THREE.AdditiveBlending / THREE.NormalBlending.
   */
  blending: 'additive' | 'normal';
  /** Resolved font-family strings for 2D canvas or SDF text. */
  fontFamily: { display: string; body: string; mono: string };
  /** Display heading defaults (also --display-weight / --display-tracking / --display-scale). */
  type: LabStyleType;
  radius: string;
}

function resolve(style: LabStyle): LabTheme {
  return {
    styleId: style.id,
    style,
    scheme: style.scheme,
    colors: style.colors,
    blending: style.scheme === 'dark' ? 'additive' : 'normal',
    fontFamily: {
      display: LAB_FONTS[style.fonts.display].family,
      body: LAB_FONTS[style.fonts.body].family,
      mono: LAB_FONTS[style.fonts.mono].family,
    },
    type: style.type,
    radius: style.radius,
  };
}

// Resolved once per style so consumers get a stable object identity and can
// put `theme.colors` straight into effect/memo dependency arrays.
const THEMES = Object.fromEntries(STYLE_IDS.map(id => [id, resolve(LAB_STYLES[id])])) as Record<StyleId, LabTheme>;

/** The theme for a style id, outside React (e.g. previews of other styles). */
export function getLabTheme(id: StyleId): LabTheme {
  return THEMES[id];
}

/** The server always renders the default style; the boot script and the store take over on the client. */
const getServerStyle = (): StyleId => DEFAULT_LAB_STATE.style;

/**
 * The active style id. Its own small store (theme/themeStore.ts), not the lab
 * context: a switch re-renders only the components that read the style in
 * JS (WebGL, canvases, the pickers). Everything painted with the CSS tokens
 * follows the root's `data-style` without rendering at all.
 */
export function useLabStyle(): StyleId {
  return useSyncExternalStore(subscribeStoredStyle, getStoredStyle, getServerStyle);
}

/** The active style's tokens as JS; re-renders the caller when the style changes. */
export function useLabTheme(): LabTheme {
  return THEMES[useLabStyle()];
}

/** Sets `data-style` on every lab root (the token stylesheet keys off it). Idempotent, no React render. */
export function applyStyleToDocument(id: StyleId): void {
  document.querySelectorAll<HTMLElement>('[data-lab-root]').forEach(root => {
    if (root.getAttribute('data-style') !== id) root.setAttribute('data-style', id);
  });
}

/**
 * Keeps the lab root's `data-style` and <meta name="theme-color"> on the
 * visitor's style. LabShell renders the root with the default and never
 * re-renders for a switch; this flips the attribute instead (the boot script
 * did it before first paint). It reads the store, not the hook's value: while
 * hydrating the hook still reports the server's default, and writing that
 * would flash the default look for a frame. Restores the meta on unmount.
 * Render it after the root element: a layout effect sees refs attached only
 * for elements committed before it. On a client-side navigation to the
 * homepage the boot script does not run, so this is what sets the style.
 */
export function StyleRootSync({ rootRef }: { rootRef: RefObject<HTMLElement | null> }): null {
  const style = useLabStyle();
  useLayoutEffect(() => {
    const id = getStoredStyle();
    const root = rootRef.current;
    // No root through the ref yet (a sibling rendered before it): set every lab root instead.
    if (!root) applyStyleToDocument(id);
    else if (root.getAttribute('data-style') !== id) root.setAttribute('data-style', id);
  }, [rootRef, style]);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = LAB_STYLES[getStoredStyle()].colors.bg;
    return () => {
      meta.content = previous;
    };
  }, [style]);
  return null;
}
