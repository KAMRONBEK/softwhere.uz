import { DISHES, STEPS } from './data';

/**
 * The demo's state: which step the phone shows, plus the little app's own
 * state (theme, cart, tab, push, install). Scroll picks the step; timers
 * (useDirector) play each step's beats; taps take over.
 */

export type AppTheme = 'light' | 'dark';
export type AppTab = 'home' | 'track';
export type InstallState = 'get' | 'loading' | 'open';
export type ScopeView = 'notes' | 'list';

export const STEP_COUNT = STEPS.length;
export const STEP_INDEX = {
  scope: 0,
  wire: 1,
  design: 2,
  build: 3,
  test: 4,
  release: 5,
} as const;

export interface DemoState {
  step: number;
  /** Bumped on every step entry: re-keys one-shot CSS animations. */
  run: number;
  scope: ScopeView;
  theme: AppTheme;
  /** The theme the wipe grows over (the one shown before the last change). */
  themeFrom: AppTheme;
  /** Bumped per theme change: re-keys the wipe. */
  themeFlips: number;
  /** The design step's automatic light → dark flip has happened this visit to the step. */
  isThemeShown: boolean;
  /** The visitor picked a theme themselves: the demo never overrides it. */
  hasPickedTheme: boolean;
  cart: number;
  /** Bumped per add: re-keys the cart badge bump. */
  adds: number;
  tab: AppTab;
  isToast: boolean;
  isPush: boolean;
  /** The build step plays itself once through, until the visitor taps. */
  isAutopilot: boolean;
  beat: number;
  install: InstallState;
  /** The target the autopilot just "tapped" (a touch ripple plays on it). */
  ghost: string | null;
}

export const INITIAL_STATE: DemoState = {
  step: 0,
  run: 0,
  scope: 'notes',
  theme: 'dark',
  themeFrom: 'dark',
  themeFlips: 0,
  isThemeShown: false,
  hasPickedTheme: false,
  cart: 0,
  adds: 0,
  tab: 'home',
  isToast: false,
  isPush: false,
  isAutopilot: true,
  beat: 0,
  install: 'get',
  ghost: null,
};

export type DemoAction =
  | { type: 'STEP'; step: number; isStatic: boolean }
  | { type: 'SCOPE_LIST' }
  | { type: 'THEME'; theme: AppTheme; isUser: boolean }
  | { type: 'ADD'; dish: string; isUser: boolean }
  | { type: 'ORDER'; isUser: boolean; isStatic?: boolean }
  | { type: 'PUSH' }
  | { type: 'HIDE_PUSH' }
  | { type: 'TAB'; tab: AppTab; isUser: boolean; ghost?: string }
  | { type: 'BEAT' }
  | { type: 'INSTALL'; install: InstallState; isUser: boolean };

/** Each step opens on its first beat; the still (reduced-motion) version opens on its finished frame. */
function enterStep(state: DemoState, step: number, isStatic: boolean): DemoState {
  // Passing through design on the way down can leave its light first draft
  // on; past it, the app is dark unless the visitor picked a theme.
  const isDraftLight = step > STEP_INDEX.design && !state.hasPickedTheme && state.theme === 'light';
  const theme = isDraftLight ? ({ theme: 'dark', themeFrom: 'dark' } as const) : {};
  const base: DemoState = { ...state, ...theme, step, run: state.run + 1, ghost: null, beat: 0 };
  switch (step) {
    case STEP_INDEX.scope:
      return { ...base, scope: isStatic ? 'list' : 'notes' };
    case STEP_INDEX.design: {
      // The design step shows the home screen, whatever the build step left open.
      const home = { ...base, tab: 'home' as const, isToast: false, isPush: false };
      if (state.hasPickedTheme || isStatic) return { ...home, isThemeShown: true };
      return { ...home, theme: 'light', themeFrom: 'light', isThemeShown: false };
    }
    case STEP_INDEX.build:
      return isStatic
        ? { ...base, cart: 2, tab: 'home', isToast: false, isPush: true, isAutopilot: false }
        : { ...base, cart: 0, tab: 'home', isToast: false, isPush: false, isAutopilot: true };
    case STEP_INDEX.release:
      return { ...base, install: 'get' };
    default:
      return base;
  }
}

/**
 * One autopilot beat of the build step: add, add, order, push, open, back.
 * After one loop the autopilot rests on the home screen (no timers while the
 * visitor reads); entering the step again plays it again.
 */
function playBeat(state: DemoState): DemoState {
  const next = { ...state, beat: (state.beat + 1) % BUILD_BEATS.length };
  switch (BUILD_BEATS[state.beat]) {
    case 'add-0':
      return { ...next, cart: state.cart + 1, adds: state.adds + 1, ghost: `add-${DISHES[0].id}` };
    case 'add-1':
      return { ...next, cart: state.cart + 1, adds: state.adds + 1, ghost: `add-${DISHES[1].id}` };
    case 'order':
      return { ...next, cart: 0, isToast: true, ghost: 'cart' };
    case 'push':
      return { ...next, isToast: false, isPush: true, ghost: null };
    case 'open':
      return { ...next, isPush: false, tab: 'track', ghost: 'push' };
    case 'home':
      return { ...next, tab: 'home', ghost: 'tab-home', isAutopilot: false };
    default:
      return next;
  }
}

export const BUILD_BEATS = ['add-0', 'add-1', 'order', 'push', 'open', 'home'] as const;
/** Wait before each beat (ms). */
export const BEAT_DELAYS: Record<(typeof BUILD_BEATS)[number], number> = {
  'add-0': 900,
  'add-1': 1000,
  order: 1100,
  push: 1300,
  open: 1700,
  home: 5600,
};

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'STEP':
      return action.step === state.step && state.run > 0 ? state : enterStep(state, action.step, action.isStatic);
    case 'SCOPE_LIST':
      return { ...state, scope: 'list' };
    case 'THEME':
      if (action.theme === state.theme) return state;
      return {
        ...state,
        theme: action.theme,
        themeFrom: state.theme,
        themeFlips: state.themeFlips + 1,
        isThemeShown: true,
        hasPickedTheme: state.hasPickedTheme || action.isUser,
      };
    case 'ADD':
      return {
        ...state,
        cart: state.cart + 1,
        adds: state.adds + 1,
        // A tap in the app dismisses a notification that is still showing.
        isPush: action.isUser ? false : state.isPush,
        isAutopilot: action.isUser ? false : state.isAutopilot,
        ghost: action.isUser ? null : `add-${action.dish}`,
      };
    case 'ORDER':
      if (state.cart === 0) return state;
      // The still version has no timers: the notification arrives at once.
      if (action.isStatic) return { ...state, cart: 0, isToast: false, isPush: true, isAutopilot: false, ghost: null };
      return { ...state, cart: 0, isToast: true, isAutopilot: action.isUser ? false : state.isAutopilot, ghost: null };
    case 'PUSH':
      return { ...state, isToast: false, isPush: true };
    case 'HIDE_PUSH':
      return { ...state, isPush: false };
    case 'TAB':
      return {
        ...state,
        tab: action.tab,
        isPush: action.tab === 'track' ? false : state.isPush,
        isAutopilot: action.isUser ? false : state.isAutopilot,
        ghost: action.ghost ?? null,
      };
    case 'BEAT':
      return playBeat(state);
    case 'INSTALL':
      return { ...state, install: action.install, ghost: action.isUser ? null : action.install === 'loading' ? 'get' : null };
    default:
      return state;
  }
}

export interface PlannedStep {
  delay: number;
  action: DemoAction;
}

/**
 * The next timed thing to happen, or null. Consequences (a placed order
 * pushes a notification) run whether or not the autopilot is on; the
 * autopilot's own taps stop once the visitor takes over.
 */
export function planNext(state: DemoState, isStatic: boolean): PlannedStep | null {
  if (isStatic) return null;
  switch (state.step) {
    case STEP_INDEX.scope:
      return state.scope === 'notes' ? { delay: 1300, action: { type: 'SCOPE_LIST' } } : null;
    case STEP_INDEX.design:
      return !state.isThemeShown && !state.hasPickedTheme ? { delay: 1700, action: { type: 'THEME', theme: 'dark', isUser: false } } : null;
    case STEP_INDEX.build:
      if (state.isAutopilot) return { delay: BEAT_DELAYS[BUILD_BEATS[state.beat]], action: { type: 'BEAT' } };
      if (state.isToast) return { delay: 1300, action: { type: 'PUSH' } };
      if (state.isPush) return { delay: 6000, action: { type: 'HIDE_PUSH' } };
      return null;
    case STEP_INDEX.release:
      if (state.install === 'get') return { delay: 1600, action: { type: 'INSTALL', install: 'loading', isUser: false } };
      if (state.install === 'loading') return { delay: 1500, action: { type: 'INSTALL', install: 'open', isUser: false } };
      return null;
    default:
      return null;
  }
}
