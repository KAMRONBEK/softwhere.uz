'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LAB_STATE } from '../config';
import type { LabState, SectionId } from '../types';

/**
 * The lab state without the style. The style lives in its own store
 * (theme/themeStore.ts): read it with useLabStyle() or useLabTheme(), so a
 * theme switch re-renders only the components that use it in JS, not every
 * consumer of this context.
 */
export type LabContextState = Omit<LabState, 'style'>;

export interface LabContextValue {
  state: LabContextState;
  /**
   * Merges a patch into the state and mirrors it into the URL (no navigation).
   * A `style` change is the visitor's theme pick: the new look grows from the
   * middle of the screen and is remembered per visitor (theme/switchStyle.ts,
   * theme/themeStore.ts); it stays out of the URL unless the founder's panel
   * is on (?panel=1). Pickers call pickStyle() directly to pass an origin.
   */
  update: (patch: Partial<LabState>) => void;
}

const { logo, logoColor, quality, only } = DEFAULT_LAB_STATE;
const DEFAULT_CONTEXT_STATE: LabContextState = { logo, logoColor, quality, only };

/**
 * Defaults keep every hook usable outside LabShell (e.g. a section promoted to
 * the real homepage): quality 'auto', the default logo.
 */
export const LabContext = createContext<LabContextValue>({ state: DEFAULT_CONTEXT_STATE, update: () => undefined });

export function useLabState(): LabContextValue {
  return useContext(LabContext);
}

/**
 * Real features the app layer injects into a section by id. The lab module
 * may not import another module (layer rule), so the page passes them in:
 * `<LabShell slots={{ 'ai-demo': <AiBrief /> }} />`. A Server Component page
 * can pass client components here; React nodes cross the client boundary.
 */
export type LabSlots = Partial<Record<SectionId, ReactNode>>;

const NO_SLOTS: LabSlots = {};

export const LabSlotsContext = createContext<LabSlots>(NO_SLOTS);

/**
 * Server-rendered extra static content per section, shown inside its stand-in
 * (SectionFallback) so crawlers and the first paint get it. Separate from
 * LabSlotsContext on purpose: a stand-in is not a filled slot.
 */
export const LabStandInsContext = createContext<LabSlots>(NO_SLOTS);

/** The node injected for this section, or null when the section should render its own fallback. */
export function useLabSlot(id: SectionId): ReactNode {
  return useContext(LabSlotsContext)[id] ?? null;
}
