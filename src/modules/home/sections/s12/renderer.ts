import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { gsap } from '../../global/gsap';
import { PROCESS_STEPS } from './copy';
import { STAGE_ICONS } from './icons';
import { sampleAt, type SampledRoute } from './route';

if (typeof window !== 'undefined') gsap.registerPlugin(MorphSVGPlugin);

/**
 * Turns route lengths into DOM writes. Two inputs:
 *
 * - `draw(pen)`: the eased pen. Dash offsets, the pen tip, the camera, title
 *   blocks, decorations and fact flags follow the ink.
 * - `status(target)`: the scroll position itself. The active stage, week
 *   counter, HUD and progress bar answer at once instead of waiting for the
 *   pen to finish a long figure.
 *
 * Every write happens only when its value changes; transforms and opacity
 * only (plus the line's dash offset, which is the point of the section). The
 * paths use pathLength="1", so offsets are fractions of each piece.
 *
 * ScrollTrigger calls back inside the scroll event, before Lenis and other
 * listeners read the scroll position. Writing there would make each of those
 * reads recalculate style, so scroll callbacks only queue: `queueStatus`
 * applies the latest target on the next GSAP tick (the same frame's rAF), and
 * the pen draws on the ticker too, so a frame has one write phase.
 */

export interface RendererDom {
  root: HTMLElement;
  /** Element whose transform the camera drives (desktop track), if any. */
  track?: HTMLElement | null;
  /** Background layer moved at a fraction of the camera (parallax), if any. */
  parallax?: HTMLElement | null;
  tip?: HTMLElement | null;
  morph?: SVGPathElement | null;
  tens?: HTMLElement | null;
  ones?: HTMLElement | null;
  plus?: HTMLElement | null;
  /** Stage-name wheel (a strip of the five names). */
  names?: HTMLElement | null;
  /** Overall progress hairline. */
  hudFill?: HTMLElement | null;
}

export interface RendererOptions {
  /** Camera: keep the pen at this screen x, clamped to [minCam, 0]. */
  camera?: {
    focusX: number;
    minCam: number;
    /** Once the camera has moved this far (px), the intro steps back (data-intro="out"). */
    introOutAt?: number;
  };
  /** Title block entrance: px of pen travel before its station, and over how far it plays. */
  blockLead: number;
  blockSpan: number;
  /** Title block slide-in offset. */
  blockFrom: { x: number; y: number };
}

export interface FrameRenderer {
  draw: (length: number) => void;
  status: (length: number) => void;
  /** `status` deferred to the next tick (coalesced): call this from scroll callbacks. */
  queueStatus: (length: number) => void;
  /** The pen stopped (true) or started moving (false): the tip only breathes at rest. */
  rest: (isAtRest: boolean) => void;
  destroy: () => void;
}

/** Speed of the background layer relative to the camera. */
export const PARALLAX = 0.45;
/** Length (px) of the bright "wet ink" run behind the pen. */
const HOT_LENGTH = 90;
/** Dash offset (in path lengths) that parks a dash, round cap included, before the path start. */
const HIDDEN = 1.1;
const MORPH_SECONDS = 0.4;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function buildBlockTimelines(root: HTMLElement, from: RendererOptions['blockFrom']): gsap.core.Timeline[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-block]')).map(block => {
    const parts = block.querySelectorAll<HTMLElement>('[data-rise]');
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(parts, { opacity: 0, x: from.x, y: from.y }, { opacity: 1, x: 0, y: 0, duration: 0.5, stagger: 0.09, ease: 'power3.out' }, 0);
    return tl;
  });
}

export function createRenderer(route: SampledRoute, dom: RendererDom, options: RendererOptions): FrameRenderer {
  const { root } = dom;
  const lines = Array.from(root.querySelectorAll<SVGPathElement>('[data-piece]'));
  const halos = Array.from(root.querySelectorAll<SVGPathElement>('[data-halo]'));
  const hots = Array.from(root.querySelectorAll<SVGPathElement>('[data-hot]'));
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-node]'));
  const stages = Array.from(root.querySelectorAll<HTMLElement>('[data-stage]'));
  const progress = Array.from(root.querySelectorAll<HTMLElement>('[data-progress]'));
  const progressFills = progress.map(item => item.querySelector<HTMLElement>('[data-fill]'));
  const switches = Array.from(root.querySelectorAll<HTMLElement | SVGGElement>('[data-detail], [data-flag]')).map(el => ({
    el,
    at: route.triggerLen.get(el.dataset.detail ?? el.dataset.flag ?? '') ?? Infinity,
    isOn: false,
  }));
  const weekDots = Array.from(root.querySelectorAll<SVGGElement>('[data-kind="dot"]'))
    .map(el => route.triggerLen.get(el.dataset.detail ?? '') ?? Infinity)
    .sort((a, b) => a - b);
  const blockTimelines = buildBlockTimelines(root, options.blockFrom);
  const hotShare = route.pieceLen.map(len => Math.min(1, HOT_LENGTH / Math.max(1, len)));

  hots.forEach((path, i) => {
    path.style.strokeDasharray = `${hotShare[i]} 2`;
    path.style.strokeDashoffset = String(hotShare[i] + 0.1);
  });
  root.dataset.ready = '';

  const lastOffset = lines.map(() => NaN);
  const lastHot = hots.map(() => NaN);
  const lastBlock = blockTimelines.map(() => -1);
  const lastFill = progress.map(() => -1);
  let lastStep = -2;
  let lastWeek = '';
  let lastCam = NaN;
  let lastHudFill = -1;
  let isTipHidden: boolean | null = null;
  let isDrawn: boolean | null = null;
  let isAtEnd: boolean | null = null;
  let isIntroOut: boolean | null = null;
  let morphTween: gsap.core.Tween | null = null;

  const draw = (length: number) => {
    const L = Math.max(0, Math.min(route.total, length));

    lines.forEach((path, i) => {
      const len = route.pieceLen[i];
      const local = L - route.pieceStart[i];
      // Half-pixel steps, written as a share of the piece.
      const offset = local <= 0 ? HIDDEN : Math.round(Math.max(0, len - local) * 2) / 2 / len;
      if (offset === lastOffset[i]) return;
      lastOffset[i] = offset;
      path.style.strokeDashoffset = String(offset);
      const halo = halos[i];
      if (halo) halo.style.strokeDashoffset = String(offset);
    });

    // Wet ink: a short bright run ending at the pen, in whichever pieces it spans.
    hots.forEach((path, i) => {
      const len = route.pieceLen[i];
      const local = L - route.pieceStart[i];
      const isLive = local > 0 && local < len + HOT_LENGTH && L < route.total - 1;
      const offset = isLive ? Math.round((hotShare[i] - local / len) * len * 2) / 2 / len : hotShare[i] + 0.1;
      if (offset === lastHot[i]) return;
      lastHot[i] = offset;
      path.style.strokeDashoffset = String(offset);
    });

    const pen = sampleAt(route, L);
    if (dom.tip) {
      dom.tip.style.transform = `translate3d(${pen.x.toFixed(1)}px, ${pen.y.toFixed(1)}px, 0)`;
      const shouldHide = L <= 1 || L >= route.total - 1;
      if (shouldHide !== isTipHidden) {
        isTipHidden = shouldHide;
        dom.tip.dataset.hidden = shouldHide ? 'true' : 'false';
      }
    }
    const hasInk = L > 1;
    if (hasInk !== isDrawn) {
      isDrawn = hasInk;
      root.dataset.drawn = hasInk ? 'true' : 'false';
    }
    const hasLanded = L >= route.total - 2;
    if (hasLanded !== isAtEnd) {
      isAtEnd = hasLanded;
      root.dataset.end = hasLanded ? 'true' : 'false';
    }

    if (options.camera && dom.track) {
      const { focusX, minCam } = options.camera;
      const cam = Math.round(Math.min(0, Math.max(minCam, focusX - pen.cmx)) * 2) / 2;
      if (cam !== lastCam) {
        lastCam = cam;
        dom.track.style.transform = `translate3d(${cam}px, 0, 0)`;
        if (dom.parallax) dom.parallax.style.transform = `translate3d(${(cam * PARALLAX).toFixed(1)}px, 0, 0)`;
        const isOut = options.camera.introOutAt !== undefined && -cam >= options.camera.introOutAt;
        if (isOut !== isIntroOut) {
          isIntroOut = isOut;
          root.dataset.intro = isOut ? 'out' : 'in';
        }
      }
    }

    blockTimelines.forEach((tl, i) => {
      const c = clamp01((L - route.nodeLen[i] + options.blockLead) / options.blockSpan);
      const rounded = Math.round(c * 1000) / 1000;
      if (rounded === lastBlock[i]) return;
      lastBlock[i] = rounded;
      tl.progress(rounded);
    });

    switches.forEach(item => {
      const isOn = L >= item.at - 0.5;
      if (isOn === item.isOn) return;
      item.isOn = isOn;
      item.el.dataset.on = isOn ? 'true' : 'false';
    });
  };

  const stateOf = (i: number, step: number) => (i < step ? 'done' : i === step ? 'active' : 'todo');

  const setStep = (step: number) => {
    nodes.forEach((node, i) => {
      node.dataset.state = stateOf(i, step);
    });
    stages.forEach((stage, i) => {
      stage.dataset.state = stateOf(i, step);
    });
    progress.forEach((item, i) => {
      item.dataset.state = stateOf(i, step);
      if (i === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    root.dataset.step = String(step);
    const shown = Math.max(0, step);
    if (dom.names) dom.names.style.transform = `translateY(-${shown * 20}%)`;
    if (dom.morph) {
      morphTween?.kill();
      morphTween = gsap.to(dom.morph, {
        morphSVG: STAGE_ICONS[PROCESS_STEPS[shown].id].morph,
        duration: lastStep === -2 ? 0 : MORPH_SECONDS,
        ease: 'power2.inOut',
      });
    }
  };

  const weekAt = (L: number, step: number): string => {
    if (step < 0) return '1';
    const [from, to] = PROCESS_STEPS[step].weeks;
    if (to === null) return `${from}+`;
    if (to === from) return String(from);
    const passed = weekDots.reduce((count, at) => (L >= at - 0.5 ? count + 1 : count), 0);
    return String(Math.min(to, Math.max(from, from - 1 + passed)));
  };

  const status = (length: number) => {
    const L = Math.max(0, Math.min(route.total, length));
    let step = -1;
    route.nodeLen.forEach((at, i) => {
      if (L >= at - 1) step = i;
    });
    if (step !== lastStep) {
      setStep(step);
      lastStep = step;
    }

    const weekKey = weekAt(L, step);
    if (weekKey !== lastWeek) {
      lastWeek = weekKey;
      const week = parseInt(weekKey, 10);
      if (dom.tens) dom.tens.style.transform = `translateY(-${Math.floor(week / 10) * 10}%)`;
      if (dom.ones) dom.ones.style.transform = `translateY(-${(week % 10) * 10}%)`;
      if (dom.plus) dom.plus.dataset.on = weekKey.endsWith('+') ? 'true' : 'false';
    }

    progress.forEach((_, i) => {
      const start = route.nodeLen[i];
      const end = route.nodeLen[i + 1] ?? route.total;
      const f = Math.round(clamp01((L - start) / Math.max(1, end - start)) * 500) / 500;
      if (f === lastFill[i]) return;
      lastFill[i] = f;
      const fill = progressFills[i];
      if (fill) fill.style.transform = `scaleX(${f})`;
    });

    if (dom.hudFill) {
      const f = Math.round((L / route.total) * 500) / 500;
      if (f !== lastHudFill) {
        lastHudFill = f;
        dom.hudFill.style.transform = `scaleX(${f})`;
      }
    }
  };

  let isAtRest: boolean | null = null;
  const rest = (value: boolean) => {
    if (!dom.tip || value === isAtRest) return;
    isAtRest = value;
    dom.tip.dataset.rest = value ? 'true' : 'false';
  };

  let queued = NaN;
  let isQueued = false;
  const flushStatus = () => {
    isQueued = false;
    status(queued);
  };
  const queueStatus = (length: number) => {
    queued = length;
    if (isQueued) return;
    isQueued = true;
    gsap.ticker.add(flushStatus, true);
  };

  return {
    draw,
    status,
    queueStatus,
    rest,
    destroy: () => {
      gsap.ticker.remove(flushStatus);
      blockTimelines.forEach(tl => tl.kill());
      morphTween?.kill();
    },
  };
}
