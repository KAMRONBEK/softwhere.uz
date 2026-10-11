'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { gsap } from '../../global/gsap';
import { VIEWPORT_WIDTH, type WidthMode } from './data';

/** Stages at least this wide (px) show every width at one scale, so a narrower page is visibly narrower. */
const WIDE_STAGE_PX = 560;
const MORPH_S = 1.05;
const EASE = 'power3.inOut';
/** Each block starts a beat after the one above it (s per block, by position). */
const STAGGER_S = 0.022;

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface Size {
  w: number;
  h: number;
}

interface Parts {
  layers: Map<WidthMode, HTMLElement>;
  paper: HTMLElement | null;
  handles: HTMLElement[];
}

/**
 * Display scale for a layout. Wide stages (desktops, tablets): one scale that
 * fits the desktop page, so tablet and phone widths shrink on screen like
 * DevTools' device mode. Narrow stages (phones): each layout fills the frame
 * (never upscaled), so the phone layout stays legible.
 */
function scaleFor(mode: WidthMode, stageWidth: number): number {
  const base = stageWidth >= WIDE_STAGE_PX ? VIEWPORT_WIDTH.desktop : VIEWPORT_WIDTH[mode];
  return Math.min(1, stageWidth / base);
}

function partsOf(area: HTMLElement): Parts {
  const layers = new Map<WidthMode, HTMLElement>();
  area.querySelectorAll<HTMLElement>('[data-layer]').forEach(el => layers.set(el.dataset.layer as WidthMode, el));
  return {
    layers,
    paper: area.querySelector<HTMLElement>('[data-paper]'),
    handles: Array.from(area.querySelectorAll<HTMLElement>('[data-handle]')),
  };
}

/** The morphing blocks of one layout, by key, for the phase it shows (wireframe boxes or designed blocks). */
function blocksOf(layer: HTMLElement): Map<string, HTMLElement> {
  const phase = layer.querySelector<HTMLElement>('[data-phase]')?.dataset.phase === 'design' ? 'design' : 'wire';
  const blocks = new Map<string, HTMLElement>();
  layer.querySelectorAll<HTMLElement>('[data-m]').forEach(el => {
    const only = el.dataset.mOnly;
    if (!only || only === phase) blocks.set(el.dataset.m ?? '', el);
  });
  return blocks;
}

function isShown(rect: DOMRect): boolean {
  return rect.width > 0.5 && rect.height > 0.5;
}

/** The transform (in the element's own, unscaled layer space) that lays rect `from` over rect `to`. */
function mapping(from: DOMRect, to: DOMRect, layerScale: number, isBox: boolean) {
  const k = to.width / from.width;
  return {
    x: (to.left - from.left) / layerScale,
    y: (to.top - from.top) / layerScale,
    scaleX: k,
    scaleY: isBox ? to.height / from.height : k,
  };
}

/**
 * Shows the example site at a layout width and animates width changes, using
 * transforms and opacity only. The site is pre-rendered once per layout
 * (SiteStack); each copy is scaled to the stage. A change crossfades the two
 * layouts while every block (announcement, logo, headline, photo, cards…)
 * flies from its place in the old layout to its place in the new one (a
 * shared-element morph from measured rects), the page's paper scales to the
 * new width and the resize handles ride its edges. Nothing changes size or
 * position in layout, so the demo adds no layout shift and no per-frame
 * reflow. Low tier, reduced motion and the first frame: an instant swap.
 *
 * The readout shows the width in px, counted along with the morph.
 */
export function useViewportMorph(
  areaRef: RefObject<HTMLDivElement | null>,
  readoutRef: RefObject<HTMLElement | null>,
  mode: WidthMode,
  isInstant: boolean,
  isLite: boolean
): { isWide: boolean } {
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const shownRef = useRef<WidthMode | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(prev => (Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: width, h: height }));
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, [areaRef]);

  useIsoLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || size.w === 0) return;
    const { layers, paper, handles } = partsOf(area);
    const readout = readoutRef.current;
    const visibleWidth = (layout: WidthMode) => VIEWPORT_WIDTH[layout] * scaleFor(layout, size.w);
    const paperFor = (layout: WidthMode) => ({ scaleX: visibleWidth(layout) / size.w });
    const handleFor = (layout: WidthMode, side: number) => ({
      x: (side * visibleWidth(layout)) / 2,
      autoAlpha: visibleWidth(layout) < size.w - 2 ? 1 : 0,
    });
    const writeReadout = (vw: number) => {
      if (readout) readout.textContent = `${Math.round(vw)} px`;
    };

    // Each layout's scale (a size change re-fits them; a mode change keeps them).
    layers.forEach((layer, layout) => {
      const scale = scaleFor(layout, size.w);
      gsap.set(layer, { xPercent: -50, scale, transformOrigin: '50% 0' });
      layer.style.setProperty('--s', String(scale));
    });

    const settle = (layout: WidthMode) => {
      layers.forEach((layer, key) => gsap.set(layer, { autoAlpha: key === layout ? 1 : 0, zIndex: key === layout ? 2 : 1 }));
      if (paper) gsap.set(paper, paperFor(layout));
      handles.forEach(handle => gsap.set(handle, handleFor(layout, Number(handle.dataset.handle))));
      writeReadout(VIEWPORT_WIDTH[layout]);
      shownRef.current = layout;
    };

    // A morph in flight jumps to its end before anything else.
    tlRef.current?.progress(1);
    tlRef.current = null;

    const from = shownRef.current;
    const fromLayer = from ? layers.get(from) : undefined;
    const toLayer = layers.get(mode);
    if (!from || from === mode || isInstant || !fromLayer || !toLayer) {
      settle(mode);
      return;
    }

    // Measure both layouts as they rest (the incoming one is laid out, just hidden).
    const fromScale = scaleFor(from, size.w);
    const toScale = scaleFor(mode, size.w);
    const fromBlocks = blocksOf(fromLayer);
    const toBlocks = blocksOf(toLayer);
    const pairs: Array<{ out: HTMLElement; into: HTMLElement; a: DOMRect; b: DOMRect }> = [];
    if (!isLite) {
      fromBlocks.forEach((out, key) => {
        const into = toBlocks.get(key);
        if (!into) return;
        const a = out.getBoundingClientRect();
        const b = into.getBoundingClientRect();
        if (isShown(a) && isShown(b)) pairs.push({ out, into, a, b });
      });
      pairs.sort((p, q) => p.a.top - q.a.top);
    }

    const moved = pairs.flatMap(pair => [pair.out, pair.into]);
    const readoutProxy = { vw: VIEWPORT_WIDTH[from] };
    const tl = gsap.timeline({
      defaults: { duration: MORPH_S, ease: EASE },
      onComplete: () => {
        gsap.set(moved, { clearProps: 'transform,transformOrigin,willChange' });
        gsap.set([fromLayer, toLayer], { clearProps: 'willChange' });
        settle(mode);
      },
    });
    gsap.set(moved, { willChange: 'transform', transformOrigin: '0 0' });
    gsap.set([fromLayer, toLayer], { willChange: 'opacity' });
    // The new layout fades in on top while the old one is still opaque below, then the old one fades out.
    gsap.set(toLayer, { autoAlpha: 0, zIndex: 2 });
    gsap.set(fromLayer, { zIndex: 1 });
    tl.to(toLayer, { autoAlpha: 1, duration: MORPH_S * 0.42, ease: 'power1.inOut' }, MORPH_S * 0.22);
    tl.to(fromLayer, { autoAlpha: 0, duration: MORPH_S * 0.3, ease: 'power1.in' }, MORPH_S * 0.5);
    pairs.forEach(({ out, into, a, b }, index) => {
      const isBox = out.dataset.mFit === 'box';
      const at = index * STAGGER_S;
      tl.to(out, mapping(a, b, fromScale, isBox), at);
      tl.fromTo(into, mapping(b, a, toScale, isBox), { x: 0, y: 0, scaleX: 1, scaleY: 1 }, at);
    });
    if (paper) tl.to(paper, paperFor(mode), 0);
    // The handles ride the paper's edges whenever either width is narrower than the frame.
    const isFramed = visibleWidth(from) < size.w - 2 || visibleWidth(mode) < size.w - 2;
    handles.forEach(handle => {
      const side = Number(handle.dataset.handle);
      if (isFramed) gsap.set(handle, { autoAlpha: 1 });
      tl.to(handle, handleFor(mode, side), 0);
    });
    tl.to(readoutProxy, { vw: VIEWPORT_WIDTH[mode], onUpdate: () => writeReadout(readoutProxy.vw) }, 0);
    tlRef.current = tl;
  }, [mode, size, isInstant, isLite, areaRef, readoutRef]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
      tlRef.current = null;
    },
    []
  );

  return { isWide: size.w >= WIDE_STAGE_PX };
}
