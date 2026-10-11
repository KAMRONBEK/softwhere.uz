import { gsap } from '../../global/gsap';
import { introPresence, smoothstep, TRACK_VIEWPORTS, type WarpEngine } from './engine';

/**
 * Layout probes and the scroll-driven DOM choreography of the finale. All
 * positions come from offsetTop/offsetLeft (transform-free), measured on
 * resize and font load, so nothing reads layout per frame.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FinaleLayout {
  /** Document y of the section top. */
  rootTop: number;
  rootH: number;
  /** The sticky stage (100lvh). */
  stageH: number;
  stageW: number;
  /** One viewport of the warp track, px (the track is TRACK_VIEWPORTS of these). */
  unit: number;
  trackH: number;
  /** The lead-in's sticky rail and box (the rail spans the section, or the track under reduced motion). */
  introRailH: number;
  introStickyH: number;
  /** The lead-in text, relative to its sticky box. */
  intro: Box;
  /** The panel's heading + deck, relative to the section. */
  lead: Box;
}

export interface LayoutNodes {
  root: HTMLElement;
  stage: HTMLElement;
  track: HTMLElement;
  introRail: HTMLElement;
  introSticky: HTMLElement;
  intro: HTMLElement;
  heading: HTMLElement;
  deck: HTMLElement;
}

/** Position of `el` inside a positioned ancestor, ignoring transforms. */
export function offsetWithin(el: HTMLElement, ancestor: HTMLElement): Box {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

export function measureLayout(nodes: LayoutNodes): FinaleLayout {
  const { root, stage, track, introRail, introSticky, intro, heading, deck } = nodes;
  const head = offsetWithin(heading, root);
  const body = offsetWithin(deck, root);
  const left = Math.min(head.x, body.x);
  const right = Math.max(head.x + head.w, body.x + body.w);
  return {
    rootTop: root.getBoundingClientRect().top + window.scrollY,
    rootH: root.offsetHeight,
    stageH: stage.clientHeight,
    stageW: stage.clientWidth,
    unit: Math.max(1, track.offsetHeight / TRACK_VIEWPORTS),
    trackH: track.offsetHeight,
    introRailH: introRail.offsetHeight,
    introStickyH: introSticky.offsetHeight,
    intro: offsetWithin(intro, introSticky),
    lead: { x: left, y: head.y, w: right - left, h: body.y + body.h - head.y },
  };
}

const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Scroll position → the engine's view of the page: how far into the section
 * we are, and where (in stage px) the text the light must keep clear of sits.
 */
export function placeScene(e: WarpEngine, layout: FinaleLayout, scrollY: number, isStill: boolean): void {
  const L = layout;
  const into = scrollY - L.rootTop;
  e.s = into / L.unit;
  e.width = L.stageW;
  e.height = L.stageH;
  e.feather = clampTo(Math.min(L.stageW, L.stageH) * 0.12, 36, 110);

  // Both the stage and the lead-in are sticky at top: 0 inside their rails.
  const stageOffset = clampTo(into, 0, Math.max(0, L.rootH - L.stageH));
  const introOffset = clampTo(into, 0, Math.max(0, L.introRailH - L.introStickyH));
  const padX = 14 + L.stageW * 0.03;
  const padY = 16 + L.stageH * 0.02;

  const a = e.zoneA;
  a.x = L.intro.x + L.intro.w / 2;
  a.y = introOffset + L.intro.y + L.intro.h / 2 - stageOffset;
  a.hx = L.intro.w / 2 + padX;
  a.hy = L.intro.h / 2 + padY;
  a.k = isStill ? 1 : introPresence(e.s);

  const b = e.zoneB;
  b.x = L.lead.x + L.lead.w / 2;
  b.y = L.lead.y + L.lead.h / 2 - stageOffset;
  b.hx = L.lead.w / 2 + padX;
  b.hy = L.lead.h / 2 + padY;
  b.k = isStill ? 1 : smoothstep(0.26, 0.66, e.s);

  e.calm = smoothstep(0.25, 1, e.s);
}

// ── Scroll-scrubbed DOM timelines (progress is set from the engine's s) ────

/** The lead-in scatters into the warp over this scroll range (viewports). */
export const SCATTER_RANGE: readonly [number, number] = [0.06, 0.4];
/** "Let's build yours." flies out of the vanishing point over this range. */
export const ARRIVE_RANGE: readonly [number, number] = [0.32, 0.72];

export const rangeProgress = (s: number, [from, to]: readonly [number, number]) => Math.min(1, Math.max(0, (s - from) / (to - from)));

/**
 * The lead-in's letters get pulled into the tunnel: each one flies out along
 * its own radius from the vanishing point, growing like a passing star, and
 * is gone before it reaches the screen edge.
 */
export function buildScatter(chars: HTMLElement[], intro: HTMLElement): gsap.core.Timeline {
  const radial = (el: HTMLElement): [number, number] => {
    const box = offsetWithin(el, intro);
    return [box.x + box.w / 2 - intro.offsetWidth / 2, box.y + box.h / 2 - intro.offsetHeight / 2];
  };
  const stagger = { amount: 0.3, from: 'edges' as const };
  return gsap
    .timeline({ paused: true })
    .fromTo(
      chars,
      { x: 0, y: 0, scale: 1 },
      {
        x: (_: number, el: HTMLElement) => radial(el)[0] * 0.85,
        y: (_: number, el: HTMLElement) => {
          const dy = radial(el)[1];
          return dy * 2 + Math.sign(dy) * 24;
        },
        scale: 1.65,
        ease: 'power2.in',
        duration: 1,
        stagger,
      },
      0
    )
    .fromTo(chars, { opacity: 1 }, { opacity: 0, ease: 'power1.in', duration: 0.58, stagger }, 0.1);
}

export interface ArrivalView {
  /** Stage centre (the vanishing point), viewport px. */
  cx: number;
  cy: number;
  /** Viewport y of the panel's top when the arrival starts. */
  panelTop: number;
}

/**
 * "Let's build yours." drops out of warp: the letters start small at the
 * vanishing point and decelerate into place while the panel slides up.
 */
export function buildArrival(chars: HTMLElement[], panel: HTMLElement, view: () => ArrivalView): gsap.core.Timeline {
  const from = (el: HTMLElement): [number, number] => {
    const box = offsetWithin(el, panel);
    const v = view();
    return [v.cx - (panel.offsetLeft + box.x + box.w / 2), v.cy - (v.panelTop + box.y + box.h / 2)];
  };
  // The farthest letters leave first, so no letter flies through one that has landed.
  const STAGGER = 0.3;
  const delay = (_: number, el: HTMLElement, list: HTMLElement[]) => {
    const far = Math.max(...list.map(item => Math.hypot(...from(item))), 1);
    return (1 - Math.hypot(...from(el)) / far) * STAGGER;
  };
  return gsap.timeline({ paused: true }).fromTo(
    chars,
    {
      x: (_: number, el: HTMLElement) => from(el)[0] * 0.82,
      y: (_: number, el: HTMLElement) => from(el)[1] * 0.82,
      scale: 0.22,
      opacity: 0,
    },
    { x: 0, y: 0, scale: 1, opacity: 1, ease: 'expo.out', duration: 1, stagger: delay }
  );
}

/** Viewport y of the panel top at scroll position s (viewports). */
export function panelTopAt(layout: FinaleLayout, s: number): number {
  return layout.trackH - s * layout.unit;
}
