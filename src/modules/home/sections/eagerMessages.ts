import type { SectionId } from '../types';

/**
 * The `home` copy the homepage's first HTML and hydration need, and nothing
 * more: the visitor header, the copy several sections share, the hero (it
 * mounts at once), and for every other section only the keys its static
 * fallback renders. Each section loads the rest of its part with its own code
 * (components/SectionMessages.tsx), so the document does not carry ~75 KB of
 * copy for sections a visitor may never reach. Plain module (no 'use client'):
 * the app layer calls it on the server.
 */
const EAGER_PARTS = ['shared', 'header', 'hero'] as const;

/** Keys of `home.<id>` that a section's static fallback reads (sections/registry.ts FALLBACKS). */
const FALLBACK_KEYS: Partial<Record<SectionId, readonly string[]>> = {
  manifesto: ['heading', 'summary', 'summaryLinked'],
  'ai-demo': ['heading', 'summary', 'estimator'],
  finale: ['heading', 'summary', 'direct', 'estimate'],
};
const DEFAULT_FALLBACK_KEYS = ['heading', 'summary'] as const;

type MessageTree = { [key: string]: unknown };

function isTree(value: unknown): value is MessageTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickKeys(part: unknown, keys: readonly string[]): MessageTree {
  if (!isTree(part)) return {};
  return Object.fromEntries(keys.filter(key => key in part).map(key => [key, part[key]]));
}

/** `home` trimmed to what the eager client tree reads; `sectionIds` are the page's sections. */
export function eagerHomeMessages(home: unknown, sectionIds: readonly SectionId[]): MessageTree {
  if (!isTree(home)) return {};
  const eager = Object.fromEntries(EAGER_PARTS.filter(part => part in home).map(part => [part, home[part]]));
  const fallbacks = sectionIds
    .filter(id => !(id in eager))
    .map(id => [id, pickKeys(home[id], FALLBACK_KEYS[id] ?? DEFAULT_FALLBACK_KEYS)] as const);
  return { ...Object.fromEntries(fallbacks), ...eager };
}
