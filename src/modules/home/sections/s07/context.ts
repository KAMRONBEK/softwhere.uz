'use client';

import { createContext, useContext, type Dispatch } from 'react';
import type { Currency } from './data';
import type { ChatAction, ChatState } from './machine';
import type { S07Copy } from './useCopy';

export interface DemoContextValue {
  state: ChatState;
  dispatch: Dispatch<ChatAction>;
  currency: Currency;
  /** The section's words for the route locale, plus `copy.price()` for amounts. */
  copy: S07Copy;
  needsCode: boolean;
  isReduced: boolean;
  /** The button the autopilot will tap next (pulsing hint), if any. */
  hintTarget: string | null;
  /** A visitor tap on a target: same action as the autopilot's, marked 'user'. */
  tap: (target: string) => void;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error('useDemo must be used inside the S07 DemoContext provider');
  return value;
}

/** Data attributes for a tappable target: hint pulse, autopilot press, cursor label. */
export function targetProps(target: string, ctx: Pick<DemoContextValue, 'state' | 'hintTarget' | 'copy'>) {
  return {
    'data-target': target,
    'data-hint': ctx.hintTarget === target ? 'true' : undefined,
    'data-ghost': ctx.state.ghost === target ? 'true' : undefined,
    'data-cursor': ctx.copy.cursor.tap,
    'data-cursor-icon': 'tap',
  };
}
