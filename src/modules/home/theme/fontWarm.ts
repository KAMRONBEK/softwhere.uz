import type { StyleId } from '../types';
import { LAB_FONTS } from './fonts';
import { LAB_STYLES } from './styles';

/** The three faces a style paints with, as CSS `font` shorthands for the FontFace API. */
function styleFaces(id: StyleId): string[] {
  const { fonts, type } = LAB_STYLES[id];
  return [
    `${type.displayWeight} 16px ${LAB_FONTS[fonts.display].family}`,
    `400 16px ${LAB_FONTS[fonts.body].family}`,
    `400 16px ${LAB_FONTS[fonts.mono].family}`,
  ];
}

/**
 * Starts downloading a style's fonts before it is applied, so the switch
 * lands with its own type instead of a fallback swap. Latin files only (the
 * default sample text), cached by the browser.
 */
export function warmStyleFonts(id: StyleId): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return Promise.all(styleFaces(id).map(face => document.fonts.load(face)))
    .then(() => undefined)
    .catch(() => undefined);
}

function isSaveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * Fetches one look's faces ahead of a likely pick (its option was pointed
 * at, focused or pressed). Skipped under Save-Data, where a pick waits for
 * its own fonts instead (switchStyle.ts).
 */
export function prefetchStyleFonts(id: StyleId): void {
  if (typeof navigator === 'undefined' || isSaveData()) return;
  void warmStyleFonts(id);
}

/** True when the style's faces are already loaded (no wait needed before switching). */
export function areStyleFontsReady(id: StyleId): boolean {
  if (typeof document === 'undefined' || !document.fonts) return true;
  try {
    return styleFaces(id).every(face => document.fonts.check(face));
  } catch {
    return true;
  }
}
