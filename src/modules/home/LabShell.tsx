'use client';

import 'lenis/dist/lenis.css';
import './lab.css';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PANEL_PARAM, usePanelFlag } from './components/ControlPanel.flag';
import LabSection from './components/LabSection';
import LazyMount from './components/LazyMount';
import SectionErrorBoundary from './components/SectionErrorBoundary';
import { DEFAULT_LAB_STATE, LAB_PARAMS, toLabSearch } from './config';
import { HomeFactsContext, type HomeFacts } from './context/HomeFactsContext';
import {
  LabContext,
  LabSlotsContext,
  LabStandInsContext,
  type LabContextState,
  type LabContextValue,
  type LabSlots,
} from './context/LabContext';
import { useReducedMotion } from './device/useDeviceTier';
import CursorLayer from './global/CursorLayer';
import LabHeader from './global/LabHeader';
import { scrollToSection, scrollToY } from './global/scroll';
import { useHashLanding, useHashLinks } from './global/useHashLinks';
import SmoothScroll from './global/SmoothScroll';
import { SECTION_METAS, SECTIONS, withSlotFloor } from './sections/registry';
import { LAB_FONT_CLASSNAMES } from './theme/fonts';
import { pickStyle } from './theme/switchStyle';
import { LAB_TOKENS_CSS } from './theme/tokens';
import { StyleRootSync, useLabStyle } from './theme/useLabTheme';
import type { LabSectionDef, LabState, SectionId } from './types';
import css from './LabShell.module.css';

/** The founder's panel exists only on /lab with ?panel=1: its code never ships with the homepage's first load. */
const ControlPanel = dynamic(() => import('./components/ControlPanel'), { ssr: false });

/**
 * Mirrors the state into the URL so the founder can share exactly what he
 * sees. Visitors keep a clean URL: their style is remembered by the theme
 * store, not the link. With the panel on (?panel=1) the style and the flag
 * stay in the URL. A component of its own, so a style switch re-renders only
 * it, never the shell and its sections.
 */
function UrlSync({ local, isPanel }: { local: LabContextState; isPanel: boolean }): null {
  const style = useLabStyle();
  useEffect(() => {
    const state: LabState = { ...local, style: isPanel ? style : DEFAULT_LAB_STATE.style };
    // Only the lab's own params are rewritten; anything else in the URL (utm_*, gclid, …) is kept.
    const search = new URLSearchParams(window.location.search);
    for (const name of [...Object.values(LAB_PARAMS), PANEL_PARAM]) search.delete(name);
    new URLSearchParams(toLabSearch(state)).forEach((value, name) => search.set(name, value));
    if (isPanel) search.set(PANEL_PARAM, '1');
    const query = search.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      // Next.js syncs native history calls with its router; null state is the documented form.
      window.history.replaceState(null, '', url);
    }
  }, [local, style, isPanel]);
  return null;
}

/** Entering or leaving solo mode changes the whole page, so start at the top. */
function useScrollTopOnSoloChange(only: LabState['only']): void {
  const previous = useRef(only);
  useEffect(() => {
    if (previous.current === only) return;
    previous.current = only;
    scrollToY(0);
  }, [only]);
}

/** Handle for scripts/lab-shot.mjs and console debugging. */
function useToolingHandle(): void {
  useEffect(() => {
    const handle = { scrollTo: scrollToY, scrollToSection, sections: SECTION_METAS.map(meta => meta.id) };
    Object.assign(window, { __LAB__: handle });
    return () => {
      Reflect.deleteProperty(window, '__LAB__');
    };
  }, []);
}

/**
 * A crashed section falls back to its static stand-in for good (no loading
 * skeleton: data-lab-crashed, components/Skeleton.module.css); the founder's
 * panel also says so.
 */
function SectionCrash({ section, isPanel }: { section: LabSectionDef; isPanel: boolean }) {
  const t = useTranslations('home.shared');
  const { meta, Fallback } = section;
  return (
    <div data-lab-crashed=''>
      <Fallback meta={meta} />
      {isPanel ? <p className={css.crash}>{t('sectionError')}</p> : null}
    </div>
  );
}

function SectionSlot({ section, isEager, isPanel }: { section: LabSectionDef; isEager: boolean; isPanel: boolean }) {
  const { meta, Component, Fallback } = section;
  const content = (
    <SectionErrorBoundary label={`section ${meta.number} ${meta.id}`} fallback={<SectionCrash section={section} isPanel={isPanel} />}>
      <Component meta={meta} />
    </SectionErrorBoundary>
  );
  // The hero never goes through LazyMount: swapping its server stand-in for `content` after
  // hydration remounted the LCP <h1> (a second, later LCP entry ~2.3s after FCP on mobile).
  // On the server HeroGate renders the same HeroFallback, so hydration adopts that DOM as is.
  const isAlwaysMounted = isEager || meta.id === FIRST_SECTION;
  return (
    <LabSection meta={meta} hasBadge={isPanel}>
      {isAlwaysMounted ? (
        content
      ) : (
        // The sections under the hero are within a viewport on load, but their code waits
        // until the page is actually scrolled.
        <LazyMount fallback={<Fallback meta={meta} />} style={{ minHeight: meta.minHeight }} waitForScroll>
          {content}
        </LazyMount>
      )}
    </LabSection>
  );
}

export type ShellMode = 'home' | 'lab';

interface LabShellProps {
  /**
   * 'home': the public homepage — static HTML, no founder panel, no URL
   * mirroring, every section. 'lab': the noindex staging copy at
   * /[locale]/lab/home with the founder's panel (?panel=1) and URL state.
   */
  mode?: ShellMode;
  /** Parsed and validated from the URL on the server (lab), or DEFAULT_LAB_STATE (home). */
  initial: LabState;
  /** Real features injected into sections by id (see LabSlots). */
  slots?: LabSlots;
  /**
   * Server-rendered extra static content per section, shown inside its stand-in
   * (SectionFallback). Kept apart from `slots`: withSlotFloor would read these
   * as filled slots and reserve the slot height.
   */
  standIns?: LabSlots;
  /**
   * The pre-paint style script (theme/ThemeScript.tsx), from the page.
   * Rendered as the lab root's first child so it sets the visitor's style on
   * the root before anything inside it is painted.
   */
  bootScript?: ReactNode;
  /**
   * Server-rendered page content placed just before the finale (the homepage's
   * latest-posts block), so the contact form stays the page's last word.
   */
  appendix?: ReactNode;
  /** Server-rendered page footer (global/HomeFooter.tsx), inside the themed root after <main>. */
  footer?: ReactNode;
  /** Portfolio counts for the copy (media/facts.ts), computed on the server. */
  facts: HomeFacts;
}

function withoutStyle({ logo, logoColor, quality, only }: LabState): LabContextState {
  return { logo, logoColor, quality, only };
}

const NO_SLOTS: LabSlots = {};

/** The section that is always mounted, never behind LazyMount (the hero, gated by its own boot signal). */
const FIRST_SECTION: SectionId = 'hero';

/** The section the `appendix` renders in front of. */
const APPENDIX_BEFORE: SectionId = 'finale';

/**
 * The homepage prototype: theme root, visitor header, smooth scroll, lazily
 * mounted sections, cursor layer and (with ?panel=1) the founder's control
 * panel.
 *
 * The style is the visitor's remembered pick (theme/themeStore.ts), outside
 * this component's state: the server always renders the default style (so
 * the HTML is the same for everyone and stays cacheable; `initial.style` is
 * ignored), the boot script sets the visitor's style on the root before
 * paint, and StyleRootSync keeps the attribute in sync afterwards. A switch
 * never re-renders the shell or the sections that only use the CSS tokens.
 * Everything else is plain state, mirrored into the URL.
 */
export default function LabShell({
  mode = 'lab',
  initial,
  slots = NO_SLOTS,
  standIns = NO_SLOTS,
  bootScript,
  appendix,
  footer,
  facts,
}: LabShellProps) {
  const [local, setLocal] = useState<LabContextState>(() => withoutStyle(initial));
  const isLab = mode === 'lab';
  const isPanelFlag = usePanelFlag();
  const isPanel = isLab && isPanelFlag;
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  const update = useCallback((patch: Partial<LabState>) => {
    const { style: nextStyle, ...rest } = patch;
    if (nextStyle) void pickStyle(nextStyle);
    if (Object.keys(rest).length > 0) setLocal(prev => ({ ...prev, ...rest }));
  }, []);
  const contextValue = useMemo<LabContextValue>(() => ({ state: local, update }), [local, update]);

  useScrollTopOnSoloChange(local.only);
  useToolingHandle();
  useHashLinks();
  useHashLanding();

  // The slots come from the server page and never change on the client, so each meta keeps its identity.
  const sections = useMemo(() => SECTIONS.map(section => withSlotFloor(section, slots)), [slots]);
  const visible = local.only ? sections.filter(section => section.meta.id === local.only) : sections;

  return (
    <LabContext.Provider value={contextValue}>
      <HomeFactsContext.Provider value={facts}>
        <LabSlotsContext.Provider value={slots}>
          <LabStandInsContext.Provider value={standIns}>
            <style>{LAB_TOKENS_CSS}</style>
            {isLab ? <UrlSync local={local} isPanel={isPanel} /> : null}
            {/* data-lab-root: the theme/token selector (theme/tokens.ts LAB_ROOT_ATTR). React only
            ever renders the default style here; the boot script (before hydration) and
            StyleRootSync (after) set the visitor's, hence suppressHydrationWarning (this
            element's own attributes only). */}
            <div
              ref={rootRef}
              data-lab-root=''
              data-style={DEFAULT_LAB_STATE.style}
              data-logo-color={local.logoColor}
              data-panel={isPanel ? '' : undefined}
              className={`${LAB_FONT_CLASSNAMES} ${css.root}`}
              suppressHydrationWarning
            >
              {bootScript}
              <LabHeader />
              <main ref={mainRef}>
                {visible.map(section => (
                  <Fragment key={section.meta.id}>
                    {local.only === null && section.meta.id === APPENDIX_BEFORE ? appendix : null}
                    <SectionSlot section={section} isEager={local.only !== null} isPanel={isPanel} />
                  </Fragment>
                ))}
              </main>
              {local.only === null ? footer : null}
              <CursorLayer />
              {isPanel && <ControlPanel sections={SECTION_METAS} />}
            </div>
            {/* After the root, so rootRef is attached when its layout effect runs (client-side mounts). */}
            <StyleRootSync rootRef={rootRef} />
            <SmoothScroll enabled={!reducedMotion} contentRef={mainRef} />
          </LabStandInsContext.Provider>
        </LabSlotsContext.Provider>
      </HomeFactsContext.Provider>
    </LabContext.Provider>
  );
}
