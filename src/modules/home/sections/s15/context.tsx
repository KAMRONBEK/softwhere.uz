'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type Context,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import type { Currency } from './data';
import { useDirector } from './hooks';
import { CopyContext, type S15Copy } from './useCopy';
import {
  INITIAL_STATE,
  STEP_INDEX,
  demoReducer,
  type AppTab,
  type AppTheme,
  type DemoAction,
  type DemoState,
  type InstallState,
  type ScopeView,
} from './state';

/**
 * The demo's state, served in slices so a change re-renders only what shows
 * it: a scroll step change touches the steps, the stage and the layer flags;
 * an autopilot beat touches the live bits of the app (cart, tabs, the
 * notification), never the whole ~1,000-node phone. One provider owns the
 * reducer and the director (the timed beats); the section's root never
 * re-renders on a beat.
 */

export interface DemoEnv {
  dispatch: Dispatch<DemoAction>;
  currency: Currency;
  /** The status-bar clock (12-hour on the English site). */
  clock: string;
  /** Reduced motion: the still, tap-to-switch version. */
  isStatic: boolean;
}

export interface StepSlice {
  step: number;
  /** Bumped on every step entry: re-keys one-shot effects. */
  run: number;
}

export interface ThemeSlice {
  theme: AppTheme;
  themeFrom: AppTheme;
  themeFlips: number;
}

export interface BuildSlice {
  cart: number;
  adds: number;
  tab: AppTab;
  isToast: boolean;
  isPush: boolean;
  beat: number;
  ghost: string | null;
}

export interface InstallSlice {
  install: InstallState;
  isGetGhost: boolean;
}

/** What the section root may do without subscribing to the state. */
export interface DemoApi {
  dispatch: Dispatch<DemoAction>;
  getStep: () => number;
}

const EnvContext = createContext<DemoEnv | null>(null);
const StepContext = createContext<StepSlice | null>(null);
const ThemeContext = createContext<ThemeSlice | null>(null);
const ScopeContext = createContext<ScopeView | null>(null);
const BuildContext = createContext<BuildSlice | null>(null);
const InstallContext = createContext<InstallSlice | null>(null);

function useSlice<T>(context: Context<T | null>): T {
  const value = useContext(context);
  if (value === null) throw new Error('08 · Mobile App: demo hooks must be used inside DemoProvider');
  return value;
}

export const useDemoEnv = (): DemoEnv => useSlice(EnvContext);
export const useStep = (): StepSlice => useSlice(StepContext);
export const useAppTheme = (): ThemeSlice => useSlice(ThemeContext);
export const useScopeView = (): ScopeView => useSlice(ScopeContext);
export const useBuild = (): BuildSlice => useSlice(BuildContext);
export const useInstall = (): InstallSlice => useSlice(InstallContext);

interface DemoProviderProps {
  apiRef: MutableRefObject<DemoApi | null>;
  currency: Currency;
  clock: string;
  /** The section's words (useS15Copy), served to the demo through CopyContext. */
  copy: S15Copy;
  isStatic: boolean;
  /** The director plays beats only while this is true (stage well on screen, tab visible). */
  isActive: boolean;
  children: ReactNode;
}

/** Layout timing on the client (before the section root's scroll hook runs), plain effect on the server. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function DemoProvider({ apiRef, currency, clock, copy, isStatic, isActive, children }: DemoProviderProps) {
  const [state, dispatch] = useReducer(demoReducer, INITIAL_STATE);
  const stateRef = useRef<DemoState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Children's layout effects run before their parent's: the root's scroll
  // hook finds the API ready for its first step.
  useIsoLayoutEffect(() => {
    apiRef.current = { dispatch, getStep: () => stateRef.current.step };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  // Reduced motion opens on the finished story: the app in the stores.
  // (The flag turns true after hydration, so this runs on the change.)
  useEffect(() => {
    if (isStatic) dispatch({ type: 'STEP', step: STEP_INDEX.release, isStatic: true });
  }, [isStatic]);

  useDirector(state, dispatch, isActive, isStatic);

  const { step, run, theme, themeFrom, themeFlips, scope, cart, adds, tab, isToast, isPush, beat, ghost, install } = state;
  const env = useMemo<DemoEnv>(() => ({ dispatch, currency, clock, isStatic }), [currency, clock, isStatic]);
  const stepSlice = useMemo<StepSlice>(() => ({ step, run }), [step, run]);
  const themeSlice = useMemo<ThemeSlice>(() => ({ theme, themeFrom, themeFlips }), [theme, themeFrom, themeFlips]);
  const buildSlice = useMemo<BuildSlice>(
    () => ({ cart, adds, tab, isToast, isPush, beat, ghost }),
    [cart, adds, tab, isToast, isPush, beat, ghost]
  );
  const isGetGhost = ghost === 'get';
  const installSlice = useMemo<InstallSlice>(() => ({ install, isGetGhost }), [install, isGetGhost]);

  return (
    <CopyContext.Provider value={copy}>
      <EnvContext.Provider value={env}>
        <StepContext.Provider value={stepSlice}>
          <ThemeContext.Provider value={themeSlice}>
            <ScopeContext.Provider value={scope}>
              <BuildContext.Provider value={buildSlice}>
                <InstallContext.Provider value={installSlice}>{children}</InstallContext.Provider>
              </BuildContext.Provider>
            </ScopeContext.Provider>
          </ThemeContext.Provider>
        </StepContext.Provider>
      </EnvContext.Provider>
    </CopyContext.Provider>
  );
}
