import { DEFAULT_LAB_STATE, LAB_PARAMS } from '../config';
import { STYLE_IDS, type StyleId } from '../types';

/**
 * The visitor's style (theme) choice, remembered per visitor.
 *
 * - A pick is stored in localStorage and mirrored in a first-party cookie (one
 *   year), so it survives a browser that blocks one of them, and a server can
 *   read it later if the page ever needs to.
 * - `?style=` in the URL (shared links, the founder's panel) wins for this
 *   visit only: it is kept in sessionStorage, never over the visitor's own
 *   saved pick, so opening a shared link does not change the look they chose.
 * - First-time visitors and crawlers (no storage, no cookie) get the default,
 *   style A. Every style renders the same content, so the choice is cosmetic
 *   for search engines, and the server never needs to know it (the page stays
 *   cacheable).
 * - The boot script (ThemeScript.tsx) applies the choice to the lab root
 *   before first paint with the same rules; React reads it through
 *   `useLabStyle()` (theme/useLabTheme.ts) and writes it with `setStoredStyle()`.
 */

export const STYLE_STORAGE_KEY = 'sw-style';
/** sessionStorage key for a style that came from a link (?style=), this visit only. */
export const STYLE_LINK_KEY = 'sw-style-link';
export const STYLE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

export function isStyleId(value: unknown): value is StyleId {
  return typeof value === 'string' && (STYLE_IDS as readonly string[]).includes(value);
}

function readUrlStyle(): StyleId | null {
  try {
    const raw = new URLSearchParams(window.location.search).get(LAB_PARAMS.style)?.trim().toUpperCase();
    return isStyleId(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readSession(): StyleId | null {
  try {
    const raw = window.sessionStorage.getItem(STYLE_LINK_KEY);
    return isStyleId(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeSession(id: StyleId | null): void {
  try {
    if (id) window.sessionStorage.setItem(STYLE_LINK_KEY, id);
    else window.sessionStorage.removeItem(STYLE_LINK_KEY);
  } catch {
    // Ignored on purpose: without sessionStorage a link's style lasts until the URL is cleaned.
  }
}

function readStorageStyle(): StyleId | null {
  try {
    const raw = window.localStorage.getItem(STYLE_STORAGE_KEY);
    return isStyleId(raw) ? raw : null;
  } catch {
    // Storage blocked (private mode, disabled site data): the cookie may still have it.
    return null;
  }
}

function readCookieStyle(): StyleId | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${STYLE_STORAGE_KEY}=([^;]*)`));
  const raw = match?.[1];
  return isStyleId(raw) ? raw : null;
}

/** The visitor's own saved pick (storage or cookie), or null when they never picked. */
export function readSavedPick(): StyleId | null {
  if (typeof window === 'undefined') return null;
  return readStorageStyle() ?? readCookieStyle();
}

function persist(id: StyleId): void {
  try {
    window.localStorage.setItem(STYLE_STORAGE_KEY, id);
  } catch {
    // Ignored on purpose: the cookie below carries the choice when storage is blocked.
  }
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${STYLE_STORAGE_KEY}=${id}; Path=/; Max-Age=${STYLE_COOKIE_MAX_AGE_S}; SameSite=Lax${secure}`;
}

/** URL (this visit), then the visit's link style, then the saved pick, then the default: the boot script's order. */
function resolveStyle(): StyleId {
  const fromUrl = readUrlStyle();
  if (fromUrl) {
    writeSession(fromUrl);
    return fromUrl;
  }
  return readSession() ?? readSavedPick() ?? DEFAULT_LAB_STATE.style;
}

let current: StyleId | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(listener => listener());
}

function onStorage(event: StorageEvent): void {
  if (event.key !== STYLE_STORAGE_KEY || !isStyleId(event.newValue) || event.newValue === current) return;
  // Another tab picked a style: follow it without writing it back.
  current = event.newValue;
  notify();
}

/** useSyncExternalStore subscribe: also follows picks made in other tabs. */
export function subscribeStoredStyle(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** The visitor's style on the client (resolved once, then kept in memory). */
export function getStoredStyle(): StyleId {
  current ??= resolveStyle();
  return current;
}

/**
 * Applies and remembers the visitor's pick. Picking the active style still
 * saves it (a look that came from a shared link becomes their own); only a
 * change notifies subscribers.
 */
export function setStoredStyle(id: StyleId): void {
  if (!isStyleId(id)) return;
  const isChange = id !== getStoredStyle();
  current = id;
  persist(id);
  writeSession(null);
  if (isChange) notify();
}
