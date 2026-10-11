'use client';

import { useSyncExternalStore } from 'react';

/**
 * The founder's Lab panel is hidden from visitors. `?panel=1` turns it on for
 * the rest of the browser session (sessionStorage), `?panel=0` turns it off.
 * While it is on, the page URL keeps `panel=1` and the active style, so a
 * copied link reopens exactly what the founder sees.
 */
export const PANEL_PARAM = 'panel';
const PANEL_SESSION_KEY = 'sw-lab-panel';
const ON_VALUES = new Set(['1', 'true', 'on', 'yes']);
const OFF_VALUES = new Set(['0', 'false', 'off', 'no']);

function resolvePanelFlag(): boolean {
  try {
    const raw = new URLSearchParams(window.location.search).get(PANEL_PARAM)?.trim().toLowerCase();
    if (raw !== undefined && ON_VALUES.has(raw)) window.sessionStorage.setItem(PANEL_SESSION_KEY, '1');
    if (raw !== undefined && OFF_VALUES.has(raw)) window.sessionStorage.removeItem(PANEL_SESSION_KEY);
    return window.sessionStorage.getItem(PANEL_SESSION_KEY) === '1';
  } catch {
    // sessionStorage blocked: the URL alone decides.
    return ON_VALUES.has(new URLSearchParams(window.location.search).get(PANEL_PARAM) ?? '');
  }
}

/**
 * Read once when this module loads in the browser, before hydration: UrlSync's
 * first effect (a child of LabShell, so it runs before LabShell's store check)
 * cleans the URL, and a lazy read after it would no longer see `?panel=1`.
 */
let isEnabled: boolean | null = typeof window === 'undefined' ? null : resolvePanelFlag();

function getSnapshot(): boolean {
  isEnabled ??= resolvePanelFlag();
  return isEnabled;
}

const subscribe = () => () => undefined;

/** True once the founder opened the page with ?panel=1 in this session; false on the server. */
export function usePanelFlag(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
