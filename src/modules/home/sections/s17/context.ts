'use client';

import { createContext, useContext, type Dispatch } from 'react';
import type { CiteFocus, RagAction, RagState, Turn } from './machine';

export interface RagDemoValue {
  state: RagState;
  dispatch: Dispatch<RagAction>;
  isReduced: boolean;
  isTouch: boolean;
  /** What the autopilot presses next (a chip id or 'tab-insights'): it breathes until then. */
  hintTarget: string | null;
  /** The turn the library and the map show: the focused citation's turn, else the latest one. */
  shownTurn: Turn | null;
  /** Point at a citation (hover, focus or tap); null clears it. */
  focusCite: (focus: CiteFocus | null) => void;
}

export const RagDemoContext = createContext<RagDemoValue | null>(null);

export function useRagDemo(): RagDemoValue {
  const value = useContext(RagDemoContext);
  if (!value) throw new Error('useRagDemo must be used inside the S17 RagDemoContext provider');
  return value;
}
