'use client';

import { Flip } from 'gsap/Flip';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useDeviceTier, useIsTouch, useReducedMotion } from '../device/useDeviceTier';
import { gsap, useGSAP } from '../global/gsap';
import { scrollToSection } from '../global/scroll';
import { HOME_FACTS } from '../media/facts';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import { buildFilters, findFilter, tileOf, WALL_PROJECTS, wallOrder, type WallFilterId } from './s09/data';
import { WallEngine, type WallDirection } from './s09/engine';
import FilterDock from './s09/FilterDock';
import Lightbox from './s09/Lightbox';
import ProjectList from './s09/ProjectList';
import { WallCard } from './s09/WallCard';
import css from './s09/wall.module.css';

gsap.registerPlugin(Flip);

const KEY_DIRECTIONS: Partial<Record<string, WallDirection>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/** Tile shapes by project index (the engine lays rows out of them). */
const ASPECTS: readonly number[] = WALL_PROJECTS.map(p => tileOf(p).aspect);

/** The title's number: every product on the wall (counted from the portfolio). */
const TITLE_COUNT = HOME_FACTS.projects;

/** Share of the viewport scrolled while the header folds into a corner title. */
const HEADER_FOLD_VH = 0.42;
const TITLE_FOLD_SCALE = 0.6;
/** Solid space under the folded title, then the band's fade (wall.module.css .band). */
const BAND_GAP = 18;
const BAND_FADE = 56;

type View = 'wall' | 'list';

interface LightboxState {
  index: number;
  origin: DOMRect | null;
}

function DragIcon() {
  return (
    <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true' focusable='false'>
      <path
        d='M7 8l-4 4 4 4M17 8l4 4-4 4M3 12h18'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

/**
 * 13 · Work Wall — every real project on an endless wall you can grab.
 *
 * DOM + transforms only (no WebGL): 54 tiles, each the product's own screen
 * cropped out of its walkthrough, on a torus that wraps both ways. The stage
 * is pinned for a viewport of scroll while the page scroll drifts the wall
 * diagonally (rows at their own depth) and the header folds into a corner.
 * Drag/flick with inertia, lift and lean on top. Hover (or, without hover,
 * the tile at the focus point) plays one walkthrough at a time, its crop
 * following the device from slide to slide; a tap opens it in a lightbox
 * that zooms out of the tile into the full frame. Filters fold into one pill
 * and re-deal the wall with GSAP Flip. Reduced motion starts on the list.
 */
export default function S09WorkWall({ meta }: LabSectionProps) {
  const reducedMotion = useReducedMotion();
  const isTouch = useIsTouch();
  const tier = useDeviceTier();
  const { scheme } = useLabTheme();
  const locale = useLocale();
  const t = useTranslations('home.work-wall');

  const order = useMemo(() => wallOrder(locale), [locale]);
  const filters = useMemo(() => buildFilters(order), [order]);
  const [filterId, setFilterId] = useState<WallFilterId>('all');
  const [viewChoice, setViewChoice] = useState<View | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tabStop, setTabStop] = useState<number>(() => order[0] ?? 0);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [isDockOpen, setIsDockOpen] = useState(false);

  const view: View = viewChoice ?? (reducedMotion ? 'list' : 'wall');
  const filter = findFilter(filters, filterId);
  const statusText = t(`status.${filter.id}`, { count: filter.indices.length });
  const canPlay = !reducedMotion && tier !== 'low';

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<WallEngine | null>(null);
  const slotsRef = useRef<Array<HTMLDivElement | null>>([]);
  const flippersRef = useRef<Array<HTMLDivElement | null>>([]);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const indicesRef = useRef<readonly number[]>(filter.indices);
  const listStateRef = useRef<Flip.FlipState | null>(null);
  const shouldFocusToggleRef = useRef(false);
  const hasCountedRef = useRef(false);
  /** Header fold progress (0 → 1), read by the engine every frame to veil captions under the header. */
  const foldRef = useRef(0);
  const countTweenRef = useRef<gsap.core.Tween | null>(null);

  const setSlot = useCallback((index: number, el: HTMLDivElement | null) => {
    slotsRef.current[index] = el;
  }, []);
  const setFlipper = useCallback((index: number, el: HTMLDivElement | null) => {
    flippersRef.current[index] = el;
  }, []);
  const setButton = useCallback((index: number, el: HTMLButtonElement | null) => {
    buttonsRef.current[index] = el;
  }, []);

  // The title counts up to the real number the first time it is read (later landings just show it).
  const countUp = useCallback(() => {
    const el = countRef.current;
    if (!el) return;
    if (hasCountedRef.current) {
      if (!countTweenRef.current?.isActive()) el.textContent = String(TITLE_COUNT);
      return;
    }
    hasCountedRef.current = true;
    const counter = { value: 0 };
    countTweenRef.current = gsap.to(counter, {
      value: TITLE_COUNT,
      duration: 1.6,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = String(Math.round(counter.value)).padStart(2, '0');
      },
    });
  }, []);

  useEffect(() => () => void countTweenRef.current?.kill(), []);

  // Count as soon as the whole title is on screen (the wall's intro waits for more of the stage),
  // so "00" is never what someone reads while the section scrolls in.
  useEffect(() => {
    const el = countRef.current;
    if (view !== 'wall' || reducedMotion || !el) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && countUp(), { threshold: 1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [view, reducedMotion, countUp]);

  // The engine lives as long as the wall view; filters are applied to it imperatively.
  useEffect(() => {
    if (view !== 'wall') return;
    const stage = stageRef.current;
    if (!stage) return;
    const titleEl = headerRef.current?.querySelector<HTMLElement>('[data-fold="title"]') ?? null;
    const engine = new WallEngine({
      scrim: headerRef.current?.querySelector<HTMLElement>('[data-fold="scrim"]') ?? null,
      getFold: () => foldRef.current,
      stage,
      track: rootRef.current,
      slots: slotsRef.current,
      flippers: flippersRef.current,
      header: headerRef.current,
      foldTitle: titleEl ? { el: titleEl, scale: TITLE_FOLD_SCALE } : null,
      footer: footerRef.current,
      indices: indicesRef.current,
      aspects: ASPECTS,
      reducedMotion,
      tier,
      isTouch,
      onActiveChange: setActiveIndex,
      onIntro: reducedMotion ? undefined : countUp,
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
      setActiveIndex(null);
    };
  }, [view, reducedMotion, tier, isTouch, order, countUp]);

  // Light styles frame every tile in a mat, which changes its size.
  useEffect(() => {
    engineRef.current?.refresh();
  }, [scheme]);

  // Same deps as the engine effect too, so a re-created engine gets the pin back.
  useEffect(() => {
    engineRef.current?.setPinned(view === 'wall' ? tabStop : null);
  }, [tabStop, view, reducedMotion, tier, isTouch, order]);

  // Pinned stage: the first stretch of scroll folds the header into a corner title.
  useGSAP(
    () => {
      const root = rootRef.current;
      const header = headerRef.current;
      foldRef.current = 0;
      if (view !== 'wall' || reducedMotion || !root || !header) return;
      const title = header.querySelector<HTMLElement>('[data-fold="title"]');
      const scrim = header.querySelector<HTMLElement>('[data-fold="scrim"]');
      const band = header.querySelector<HTMLElement>('[data-fold="band"]');
      if (!title || !scrim || !band) return;
      // The band is as tall as the folded title (it scales from its top-left corner) plus its fade.
      const sizeBand = () => {
        const titleTop = title.getBoundingClientRect().top - header.getBoundingClientRect().top;
        band.style.height = `${Math.round(titleTop + title.offsetHeight * TITLE_FOLD_SCALE + BAND_GAP + BAND_FADE)}px`;
      };
      sizeBand();
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => `+=${window.innerHeight * HEADER_FOLD_VH}`,
          scrub: true,
          onUpdate: self => {
            foldRef.current = self.progress;
          },
          onRefresh: self => {
            foldRef.current = self.progress;
            sizeBand();
          },
        },
      });
      // The wide scrim behind the full header gives way to a slim top band behind the folded title.
      // Band in first, scrim out after the words it sat behind are gone: never a half veil over the title.
      timeline
        .to(header.querySelectorAll('[data-fold="fade"]'), { opacity: 0, y: -18, duration: 0.45, stagger: 0.08 }, 0)
        .to(title, { scale: TITLE_FOLD_SCALE, duration: 1 }, 0)
        .fromTo(band, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0)
        .to(scrim, { opacity: 0, duration: 0.35 }, 0.55);
    },
    { scope: rootRef, dependencies: [view, reducedMotion] }
  );

  const selectFilter = (id: WallFilterId) => {
    if (id === filterId) return;
    const next = findFilter(filters, id);
    if (!reducedMotion && view === 'list') {
      const items = listRef.current?.querySelectorAll<HTMLElement>('[data-flip-id]');
      listStateRef.current = items?.length ? Flip.getState(items) : null;
    }
    indicesRef.current = next.indices;
    engineRef.current?.setIndices(next.indices);
    setFilterId(id);
    setTabStop(next.indices[0] ?? 0);
  };

  // The list re-deals with Flip once React has committed the new order.
  useLayoutEffect(() => {
    const listState = listStateRef.current;
    listStateRef.current = null;
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-flip-id]');
    if (!listState || !items?.length) return;
    const flip = Flip.from(listState, {
      targets: items,
      duration: 0.6,
      ease: 'power3.inOut',
      scale: true,
      simple: true,
      onEnter: entering =>
        gsap.fromTo(entering, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.2, stagger: 0.015 }),
    });
    return () => {
      flip.progress(1).kill();
    };
  }, [filterId]);

  // Entering the list: the first rows rise in (motion only).
  useLayoutEffect(() => {
    if (view !== 'list' || reducedMotion || viewChoice === null) return;
    const items = Array.from(listRef.current?.children ?? []).slice(0, 16);
    const tween = gsap.fromTo(
      items,
      { opacity: 0, y: 32 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.035, clearProps: 'transform,opacity' }
    );
    return () => {
      tween.kill();
    };
  }, [view, reducedMotion, viewChoice]);

  useEffect(() => {
    if (!shouldFocusToggleRef.current) return;
    shouldFocusToggleRef.current = false;
    toggleRef.current?.focus({ preventScroll: true });
  }, [view]);

  const toggleView = () => {
    const next: View = view === 'wall' ? 'list' : 'wall';
    shouldFocusToggleRef.current = true;
    setViewChoice(next);
    setIsDockOpen(false);
    // Switching views changes the section's height: keep the reader at its top.
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) requestAnimationFrame(() => scrollToSection(meta.id));
  };

  const openProject = useCallback((index: number, media: HTMLElement | null) => {
    engineRef.current?.setPaused(true);
    setLightbox({ index, origin: media?.getBoundingClientRect() ?? null });
  }, []);

  const handleKeyboardFocus = useCallback((index: number) => {
    setTabStop(index);
    const engine = engineRef.current;
    if (!engine) return;
    engine.centerOn(index);
    engine.setActive(index);
  }, []);

  const handleWallKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = KEY_DIRECTIONS[event.key];
    const engine = engineRef.current;
    if (!direction || !engine || !(event.target instanceof HTMLElement)) return;
    const card = event.target.closest<HTMLElement>('[data-wall-index]');
    if (!card) return;
    event.preventDefault();
    const next = engine.neighbor(Number(card.dataset.wallIndex), direction);
    setTabStop(next);
    engine.setPinned(next);
    buttonsRef.current[next]?.focus({ preventScroll: true });
  };

  // Plain function: only called from the lightbox's close handler.
  const getReturnRect = (index: number): DOMRect | null => {
    if (view === 'wall') return engineRef.current?.mediaRect(index) ?? null;
    const slug = WALL_PROJECTS[index]?.slug;
    const media = listRef.current?.querySelector<HTMLElement>(`[data-flip-id="list-${slug}"] [data-media]`);
    const rect = media?.getBoundingClientRect();
    return rect && rect.bottom > 0 && rect.top < window.innerHeight ? rect : null;
  };

  const handleNavigate = useCallback((index: number) => {
    setLightbox(prev => (prev ? { ...prev, index } : prev));
  }, []);

  const handleClosed = useCallback(() => {
    setLightbox(null);
    engineRef.current?.setPaused(false);
  }, []);

  const heading = (
    <SectionHeading meta={meta} className={css.title}>
      <span className={css.srOnly}>{t('heading', HOME_FACTS)}</span>
      <span className={css.titleText} aria-hidden='true' data-fold='title'>
        {/* Motion: starts at 00 and counts up when the wall lands (countUp). */}
        <span ref={countRef}>{view === 'wall' && !reducedMotion ? '00' : TITLE_COUNT}</span> {t('headingRest', HOME_FACTS)}
      </span>
    </SectionHeading>
  );

  const dock = (
    <FilterDock
      filters={filters}
      selected={filter.id}
      reducedMotion={reducedMotion}
      onSelect={selectFilter}
      onOpenChange={setIsDockOpen}
      companionRef={toggleRef}
    />
  );

  const viewToggle = (
    <button ref={toggleRef} type='button' className={css.viewLink} onClick={toggleView}>
      {view === 'wall' ? t('showList') : t('showWall')}
      <svg viewBox='0 0 16 16' width='14' height='14' aria-hidden='true' focusable='false'>
        <path d='M3 8h10M9 4l4 4-4 4' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </button>
  );

  const status = (
    <p className={css.srOnly} aria-live='polite'>
      {statusText}
    </p>
  );

  return (
    <div ref={rootRef} className={css.root} data-view={view} data-scheme={scheme} data-dock-open={isDockOpen || undefined}>
      {view === 'wall' ? (
        <div className={css.sticky}>
          <div
            ref={stageRef}
            className={css.stage}
            role='group'
            aria-label={t('wallLabel')}
            aria-describedby={`${meta.id}-wall-help`}
            data-cursor={t('cursorDrag')}
            onKeyDown={handleWallKeyDown}
          >
            <p id={`${meta.id}-wall-help`} className={css.srOnly}>
              {t('wallInstructions')}
            </p>
            <div className={css.wall} data-wall-plane=''>
              {WALL_PROJECTS.map((project, index) => (
                <WallCard
                  key={project.slug}
                  project={project}
                  index={index}
                  isActive={activeIndex === index}
                  isTabStop={tabStop === index}
                  canPlay={canPlay}
                  setSlot={setSlot}
                  setFlipper={setFlipper}
                  setButton={setButton}
                  onOpen={openProject}
                  onKeyboardFocus={handleKeyboardFocus}
                />
              ))}
            </div>
            <div className={css.edges} aria-hidden='true' />
          </div>

          <div ref={headerRef} className={css.header}>
            <div className={css.band} data-fold='band' aria-hidden='true' />
            <div className={css.intro}>
              <div className={css.scrim} data-fold='scrim' aria-hidden='true' />
              {heading}
              <p className={css.lede} data-fold='fade'>
                {t('summary', HOME_FACTS)}
              </p>
              <p className={css.hint} data-fold='fade' aria-hidden='true'>
                <DragIcon />
                {isTouch ? t('hintTouch') : t('hintPointer')}
              </p>
            </div>
          </div>

          <div ref={footerRef} className={css.footer}>
            {dock}
            {viewToggle}
            {status}
          </div>
        </div>
      ) : (
        <>
          <div className={css.listHeader}>
            <div className={css.intro}>
              {heading}
              <p className={css.lede}>{t('summary', HOME_FACTS)}</p>
            </div>
            <div className={css.listControls}>
              {dock}
              {viewToggle}
              {status}
            </div>
          </div>
          <ProjectList indices={filter.indices} listRef={listRef} onOpen={openProject} />
        </>
      )}

      {lightbox ? (
        <Lightbox
          index={lightbox.index}
          order={filter.indices}
          origin={lightbox.origin}
          reducedMotion={reducedMotion}
          getReturnRect={getReturnRect}
          onNavigate={handleNavigate}
          onClosed={handleClosed}
        />
      ) : null}
    </div>
  );
}
