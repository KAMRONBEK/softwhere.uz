import { gsap, ScrollTrigger } from '../../global/gsap';
import { formatCount } from './MiniSite';
import { noise, PIECE_LAYER, T, type CameraPose, type PieceId, type SiteLayout } from './layout';

/**
 * The scroll-scrubbed assembly: exploded wireframes → snapped to the grid →
 * styled → data and AI → flattened into a browser that loads with 200 OK.
 * Built inside a gsap.matchMedia() context, so every set/tween here is
 * reverted when the context is (unmount, breakpoint or motion-pref change).
 */

export interface AssemblyFx {
  /** Target slots on the floor (cheap, flat). */
  hasSlots: boolean;
  /** 3D leader lines from slot to piece (two extra layers per piece). */
  hasPosts: boolean;
  /** Per-stage light sweep. */
  hasSweep: boolean;
}

interface BuildOptions {
  root: HTMLElement;
  layout: SiteLayout;
  fx: AssemblyFx;
  /** Scroll position where the story starts (ScrollTrigger syntax). */
  start: string;
  /** Called with the timeline time (0..T.total) whenever it renders. */
  onTime: (time: number) => void;
}

interface BuiltAssembly {
  timeline: gsap.core.Timeline;
  /** Restores text the timeline rewrote (counters, typed lines). */
  restore: () => void;
}

interface PieceInfo {
  el: HTMLElement;
  id: PieceId;
  slot: HTMLElement | null;
  posts: HTMLElement[];
  wire: HTMLElement | null;
  final: HTMLElement | null;
  /** Depth in the layered (design) view. */
  z: number;
  exploded: gsap.TweenVars;
  /** Reading order (top-left first), for the styling pass. */
  order: number;
}

function cameraVars(pose: CameraPose): gsap.TweenVars {
  return { rotationX: pose.rx, scale: pose.scale, x: pose.x, y: pose.y };
}

/** Layout offset of `el` inside `ancestor` (ignores transforms, unlike getBoundingClientRect). */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function collectPieces(root: HTMLElement, page: HTMLElement, layout: SiteLayout): PieceInfo[] {
  const pageW = page.offsetWidth;
  const pageH = page.offsetHeight;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-piece]')).filter(el => el.offsetParent !== null);

  return nodes.map((el, index) => {
    const id = el.dataset.piece as PieceId;
    const offset = offsetWithin(el, page);
    const cx = offset.x + el.offsetWidth / 2;
    const cy = offset.y + el.offsetHeight / 2;
    const z = (PIECE_LAYER[id] + 0.6) * layout.zStep;
    return {
      el,
      id,
      slot: root.querySelector<HTMLElement>(`[data-shadow="${id}"]`),
      posts: Array.from(root.querySelectorAll<HTMLElement>(`[data-post="${id}"]`)),
      wire: el.querySelector<HTMLElement>(':scope > [data-copy="wire"]'),
      final: el.querySelector<HTMLElement>(':scope > [data-copy="final"]'),
      z,
      exploded: {
        x: (cx - pageW / 2) * layout.scatter + noise(index, 1) * layout.jitter,
        y: (cy - pageH / 2) * layout.scatter + noise(index, 2) * layout.jitter,
        z: z * 1.25 + layout.zStep * 1.4 + Math.abs(noise(index, 3)) * layout.zStep * 1.5,
        rotationX: noise(index, 4) * 14,
        rotationY: noise(index, 5) * 12,
        rotation: noise(index, 6) * 12,
      },
      order: cy * 2 + cx * 0.4,
    };
  });
}

/**
 * DOM text driven by the timeline (count-ups, typed lines). Tweens only move
 * plain proxy numbers; `write()` copies them into the DOM. It runs from the
 * timeline's onUpdate AND ScrollTrigger's onRefresh, because a refresh
 * renders the timeline with callbacks suppressed.
 */
interface TextDriver {
  write: () => void;
  restore: () => void;
}

/** A number that counts up from 0 as the timeline scrubs. */
function addCounter(tl: gsap.core.Timeline, el: HTMLElement, at: number): TextDriver {
  const target = Number(el.dataset.count) || 0;
  const format = el.dataset.format === 'time' ? 'time' : undefined;
  const state = { value: 0 };
  let shown = -1;
  tl.to(state, { value: target, duration: 1, ease: 'power2.out' }, at);
  return {
    write: () => {
      const next = Math.round(state.value);
      if (next === shown) return;
      shown = next;
      el.textContent = formatCount(next, format);
    },
    restore: () => {
      el.textContent = formatCount(target, format);
    },
  };
}

/** Types a line: typed + transparent rest keeps the box size (and centering) fixed. */
function addTyping(
  tl: gsap.core.Timeline,
  typed: HTMLElement | null,
  rest: HTMLElement | null,
  at: number,
  duration: number
): TextDriver | null {
  if (!typed || !rest) return null;
  const full = typed.textContent ?? '';
  const state = { chars: 0 };
  let shown = -1;
  tl.to(state, { chars: full.length, duration, ease: 'none' }, at);
  return {
    write: () => {
      const next = Math.round(state.chars);
      if (next === shown) return;
      shown = next;
      typed.textContent = full.slice(0, next);
      rest.textContent = full.slice(next);
    },
    restore: () => {
      typed.textContent = full;
      rest.textContent = '';
    },
  };
}

/** A soft band of light crossing the page plane at depth `z`. */
function addSweep(tl: gsap.core.Timeline, plane: Element | null, band: Element | null, at: number, z: number, strength = 1): void {
  if (!plane || !band) return;
  tl.set(plane, { z, opacity: strength }, at);
  tl.fromTo(band, { xPercent: -100 }, { xPercent: 260, duration: 0.9, ease: 'power1.inOut', immediateRender: false }, at);
}

export function buildAssemblyTimeline({ root, layout, fx, start, onTime }: BuildOptions): BuiltAssembly | null {
  const q = gsap.utils.selector(root);
  const one = (selector: string) => root.querySelector<HTMLElement>(selector);
  const camera = one('[data-camera]');
  const page = one('[data-page]');
  if (!camera || !page) return null;

  const pieces = collectPieces(root, page, layout);
  const code = pieces.find(piece => piece.id === 'code');
  const gridPieces = pieces.filter(piece => piece.id !== 'code');
  const byLayer = [...pieces].sort((a, b) => a.z - b.z || a.order - b.order);
  const byReading = [...pieces].sort((a, b) => a.order - b.order);
  const maxZ = Math.max(...gridPieces.map(piece => piece.z));
  const slots = gridPieces.map(piece => piece.slot).filter((el): el is HTMLElement => el !== null);
  const final = (selector: string) => q(`[data-copy="final"] ${selector}`);
  const sweep = one('[data-sweep]');
  const sweepBand = one('[data-sweep-band]');
  const { exploded, design, frontend, backend, launch } = layout.camera;

  // ── Starting state: an exploded, wireframed stack seen from above ──────
  gsap.set(camera, { ...cameraVars(exploded), transformOrigin: '50% 50%' });
  gsap.set(page, { rotation: exploded.rz, transformOrigin: '50% 50%' });
  pieces.forEach(piece => {
    gsap.set(piece.el, { ...piece.exploded, transformOrigin: '50% 50%' });
    gsap.set(piece.wire, { autoAlpha: 1 });
    gsap.set(piece.final, { autoAlpha: 0 });
  });
  gsap.set(slots, { autoAlpha: fx.hasSlots ? 0.22 : 0, scale: 1 });
  gsap.set(q('[data-post]'), { rotationX: -90, scaleY: 0.01, autoAlpha: 0, transformOrigin: '50% 100%' });
  gsap.set(q('[data-frame]'), { z: -4, scale: 1.04, autoAlpha: 0, transformOrigin: '50% 40%' });
  gsap.set(q('[data-surface]'), { autoAlpha: 0 });
  gsap.set(q('[data-blueprint]'), { autoAlpha: 0.7 });
  gsap.set(sweep, { z: -0.5, autoAlpha: fx.hasSweep ? 1 : 0 });
  gsap.set(sweepBand, { x: 0, xPercent: -100 });
  gsap.set(q('[data-floor]'), { autoAlpha: 0, scaleX: 0.86 });
  gsap.set(q('[data-copycol]'), { opacity: 1, x: 0 });
  gsap.set(final('[data-word]'), { yPercent: 115 });
  gsap.set(final('[data-media] video'), { scale: 1.18, transformOrigin: '50% 50%' });
  gsap.set(final('[data-bar]'), { scaleX: 0 });
  // Code reads dim (not running yet) until the backend stage lights it up.
  gsap.set(final('[data-line]'), { opacity: 0.3, x: -6 });
  gsap.set(final('[data-answer]'), { autoAlpha: 0, y: 8 });
  gsap.set(final('[data-source]'), { autoAlpha: 0, y: 6 });
  gsap.set(final('[data-typing]'), { autoAlpha: 0 });
  gsap.set(final('[data-caret]'), { autoAlpha: 0 });
  gsap.set(final('[data-status="ready"]'), { autoAlpha: 0, scale: 0.8 });
  gsap.set(final('[data-status="pending"]'), { autoAlpha: 1 });
  gsap.set(final('[data-live="on"]'), { autoAlpha: 0 });
  gsap.set(final('[data-live="idle"]'), { autoAlpha: 1 });
  gsap.set(q('[data-url-caret]'), { autoAlpha: 0 });
  gsap.set(q('[data-load]'), { scaleX: 0, autoAlpha: 1, transformOrigin: '0% 50%' });
  gsap.set(q('[data-ok]'), { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%' });
  gsap.set(q('[data-tick]'), { strokeDashoffset: 1 });

  const drivers: TextDriver[] = [];
  const sync = () => {
    drivers.forEach(driver => driver.write());
    onTime(tl.time());
  };
  const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true, onUpdate: sync });

  const toCamera = (pose: CameraPose, at: number, duration: number, ease: string) => {
    tl.to(camera, { ...cameraVars(pose), duration, ease }, at);
    tl.to(page, { rotation: pose.rz, duration, ease }, at);
  };

  // ── 1 · Design: pieces tumble in and snap onto the grid, still layered ─
  toCamera(design, T.design, T.frontend - T.design, 'sine.inOut');
  tl.to(q('[data-blueprint]'), { autoAlpha: 1, duration: 0.6 }, T.design);
  byLayer.forEach((piece, k) => {
    const at = T.design + 0.1 + k * 0.085;
    tl.to(piece.el, { x: 0, y: 0, z: piece.z, rotationX: 0, rotationY: 0, rotation: 0, duration: 1.05, ease: 'back.out(1.5)' }, at);
    if (fx.hasSlots && piece.slot) {
      // The target slot locks in as its piece arrives overhead.
      tl.fromTo(
        piece.slot,
        { scale: 1.08 },
        { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'power2.out', immediateRender: false },
        at + 0.5
      );
    }
    if (fx.hasPosts && piece.posts.length > 0) {
      tl.to(piece.posts, { scaleY: piece.z / 100, autoAlpha: 1, duration: 0.45, ease: 'power2.out' }, at + 0.55);
    }
  });
  if (fx.hasSweep) addSweep(tl, sweep, sweepBand, T.design + 1.3, -0.5);

  // ── 2 · Frontend: wireframes become the real thing, layers draw closer ─
  toCamera(frontend, T.frontend, T.backend - T.frontend, 'sine.inOut');
  byReading.forEach((piece, k) => {
    const at = T.frontend + 0.1 + k * 0.1;
    tl.to(piece.wire, { autoAlpha: 0, duration: 0.45 }, at);
    tl.to(piece.final, { autoAlpha: 1, duration: 0.45 }, at);
    if (fx.hasPosts && piece.posts.length > 0) tl.to(piece.posts, { autoAlpha: 0, duration: 0.4 }, at);
    if (piece.id === 'head') tl.to(final('[data-word]'), { yPercent: 0, duration: 0.55, stagger: 0.05, ease: 'power3.out' }, at + 0.12);
    if (piece.id === 'video') tl.to(final('[data-media] video'), { scale: 1, duration: 1.3, ease: 'power2.out' }, at);
  });
  tl.to(q('[data-surface]'), { autoAlpha: 1, duration: 0.7 }, T.frontend + 1.1);
  tl.to(q('[data-blueprint]'), { autoAlpha: 0, duration: 0.7 }, T.frontend + 1.4);
  pieces.forEach(piece =>
    tl.to(
      piece.el,
      { z: piece === code ? piece.z * 0.8 * layout.codeLift : piece.z * 0.5, duration: T.backend - T.frontend, ease: 'sine.inOut' },
      T.frontend
    )
  );
  if (fx.hasSlots) tl.to(slots, { autoAlpha: 0.4, duration: T.backend - T.frontend }, T.frontend);
  if (fx.hasSweep) addSweep(tl, sweep, sweepBand, T.frontend + 1.25, -0.5);

  // ── 3 · Backend & AI: the API runs, numbers load, the tutor answers ────
  const b = T.backend;
  toCamera(backend, b, T.launch - b, 'sine.inOut');
  gridPieces.forEach(piece => tl.to(piece.el, { z: piece.z * 0.2, duration: T.launch - b, ease: 'sine.inOut' }, b));
  if (code) tl.to(code.el, { z: maxZ * 0.55 * layout.codeLift, duration: T.launch - b, ease: 'sine.inOut' }, b);
  tl.to(final('[data-line]'), { opacity: 1, x: 0, duration: 0.3, stagger: 0.12, ease: 'power2.out' }, b + 0.05);
  tl.to(final('[data-live="idle"]'), { autoAlpha: 0, duration: 0.12 }, b + 0.85);
  tl.to(final('[data-live="on"]'), { autoAlpha: 1, duration: 0.15 }, b + 0.9);
  tl.to(final('[data-status="pending"]'), { autoAlpha: 0, duration: 0.15 }, b + 0.3);
  tl.to(final('[data-status="ready"]'), { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, b + 0.35);
  final('[data-count]').forEach((el, index) => drivers.push(addCounter(tl, el as HTMLElement, b + 0.35 + index * 0.1)));
  tl.to(final('[data-bar]'), { scaleX: 1, duration: 1.1, ease: 'power3.out' }, b + 0.6);
  tl.to(final('[data-answer]'), { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out' }, b + 0.75);
  tl.to(final('[data-typing]'), { autoAlpha: 1, duration: 0.1 }, b + 0.85);
  tl.fromTo(
    final('[data-typing] i'),
    { y: 0 },
    { y: -2.5, duration: 0.1, stagger: 0.05, repeat: 3, yoyo: true, ease: 'sine.inOut' },
    b + 0.9
  );
  tl.to(final('[data-typing]'), { autoAlpha: 0, duration: 0.08 }, b + 1.3);
  tl.to(final('[data-caret]'), { autoAlpha: 1, duration: 0.05 }, b + 1.32);
  const answer = addTyping(tl, one('[data-copy="final"] [data-typed]'), one('[data-copy="final"] [data-rest]'), b + 1.34, 0.85);
  if (answer) drivers.push(answer);
  tl.to(final('[data-caret]'), { autoAlpha: 0, duration: 0.05 }, b + 2.2);
  tl.to(final('[data-source]'), { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, b + 2.05);
  if (fx.hasSweep) addSweep(tl, sweep, sweepBand, b + 0.4, -0.5);

  // ── 4 · Launch: flatten, the backend sinks out of sight, the browser
  //       fills the screen, the URL resolves with 200 OK ──────────────────
  const l = T.launch;
  toCamera(launch, l, 1.3, 'power3.inOut');
  gridPieces.forEach(piece => tl.to(piece.el, { z: 0, duration: 1.1, ease: 'power2.inOut' }, l));
  if (code) {
    tl.to(code.el, { z: -180, x: 40, y: 30, rotationX: 0, duration: 0.9, ease: 'power2.in' }, l + 0.05);
    tl.to(code.el, { autoAlpha: 0, duration: 0.45 }, l + 0.45);
  }
  if (fx.hasSlots) tl.to(slots, { autoAlpha: 0, duration: 0.6 }, l);
  // Opacity, not autoAlpha: the section heading stays in the accessibility tree.
  tl.to(q('[data-copycol]'), { opacity: 0, x: -36, duration: 0.6, ease: 'power2.in' }, l);
  tl.to(q('[data-frame]'), { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'power3.out' }, l + 0.55);
  tl.to(q('[data-floor]'), { autoAlpha: 1, scaleX: 1, duration: 0.9, ease: 'power2.out' }, l + 0.7);
  tl.to(q('[data-url-caret]'), { autoAlpha: 1, duration: 0.05 }, l + 0.95);
  const url = addTyping(tl, one('[data-url-typed]'), one('[data-url-rest]'), l + 1, 0.55);
  if (url) drivers.push(url);
  tl.to(q('[data-load]'), { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, l + 1.15);
  tl.to(q('[data-url-caret]'), { autoAlpha: 0, duration: 0.05 }, l + 1.6);
  tl.to(q('[data-load]'), { autoAlpha: 0, duration: 0.2 }, l + 1.72);
  tl.to(q('[data-ok]'), { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2.2)' }, l + 1.75);
  tl.to(q('[data-tick]'), { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out' }, l + 1.85);
  // Over the finished page the sheen stays light, so it never tints the copy.
  if (fx.hasSweep) addSweep(tl, sweep, sweepBand, l + 1.8, 2, 0.55);
  // Hold the finished frame for the last stretch of scroll.
  tl.set({}, {}, T.total);

  // Attached last, so a synchronous refresh already sees the whole timeline.
  ScrollTrigger.create({ animation: tl, trigger: root, start, end: 'bottom bottom', scrub: 0.6, onRefresh: sync });
  sync();

  return {
    timeline: tl,
    restore: () => drivers.forEach(driver => driver.restore()),
  };
}
