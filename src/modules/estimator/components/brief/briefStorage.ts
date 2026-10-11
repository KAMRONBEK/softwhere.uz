import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import type { AiBrief } from '@/modules/estimator/ai-brief/types';

/**
 * What the AI brief remembers in this browser (localStorage, so it outlives
 * the tab; every access is guarded — private mode, blocked site data or a
 * full quota only mean nothing is remembered):
 *  - the last finished brief per page locale, for SAVED_BRIEF_DAYS: it comes
 *    back on a reload, in a new tab or on a return visit, and it is what the
 *    visitor still sees once today's free brief is used;
 *  - when the next free brief opens (one per visitor a day). The server
 *    enforces the limit per IP; this copy only lets the page say so before
 *    the visitor types a new idea.
 * Plain functions over a `Storage`, so they are unit-tested without a browser.
 */

export const DAY_MS = 24 * 60 * 60_000;
const SAVED_BRIEF_DAYS = 7;
const BRIEF_KEY_PREFIX = 'ai-brief:brief:';
const NEXT_FREE_KEY = 'ai-brief:next-free';

export interface SavedBrief {
  v: 2;
  idea: string;
  brief: AiBrief;
  elapsedMs: number | null;
  savedAt: number;
}

/** The browser's localStorage, or null where it is blocked. */
export function browserStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(store: Storage | null, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(store: Storage | null, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or privacy mode: it simply isn't remembered.
  }
}

function remove(store: Storage | null, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    // nothing to remove
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function saveBrief(store: Storage | null, locale: BriefLocale, saved: Omit<SavedBrief, 'v'>): void {
  write(store, BRIEF_KEY_PREFIX + locale, { v: 2, ...saved } satisfies SavedBrief);
}

/** The saved brief of this locale, or null when there is none, it is malformed or older than SAVED_BRIEF_DAYS (then it is removed). */
export function loadBrief(store: Storage | null, locale: BriefLocale, now: number): SavedBrief | null {
  const saved = read(store, BRIEF_KEY_PREFIX + locale);
  if (!isRecord(saved)) return null;
  const brief = saved.brief;
  const isValid =
    saved.v === 2 &&
    typeof saved.idea === 'string' &&
    typeof saved.savedAt === 'number' &&
    isRecord(brief) &&
    brief.version === 1 &&
    brief.locale === locale &&
    isRecord(brief.estimate);
  if (!isValid || now - (saved.savedAt as number) > SAVED_BRIEF_DAYS * DAY_MS) {
    remove(store, BRIEF_KEY_PREFIX + locale);
    return null;
  }
  return saved as unknown as SavedBrief;
}

/** Remember when the next free brief opens (a later time never moves it earlier). */
export function saveNextFree(store: Storage | null, at: number): void {
  const current = read(store, NEXT_FREE_KEY);
  const known = isRecord(current) && typeof current.at === 'number' ? current.at : 0;
  write(store, NEXT_FREE_KEY, { v: 1, at: Math.max(known, at) });
}

/** When the next free brief opens, or null when it is open now (a stale value is removed). */
export function loadNextFree(store: Storage | null, now: number): number | null {
  const saved = read(store, NEXT_FREE_KEY);
  const at = isRecord(saved) && saved.v === 1 && typeof saved.at === 'number' && Number.isFinite(saved.at) ? saved.at : null;
  // A value more than a day ahead is not ours to trust (a clock change, an edit): one day is the most a brief costs.
  if (at === null || at <= now || at - now > DAY_MS) {
    remove(store, NEXT_FREE_KEY);
    return null;
  }
  return at;
}
