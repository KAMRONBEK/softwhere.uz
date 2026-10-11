import { gsap } from '../../global/gsap';
import { TAPE_ATTR, TapeRig, type BandLead } from './tapes';

/**
 * Kinetic type engine for 02 · Manifesto. One GSAP-ticker loop (in the same
 * frame as Lenis and ScrollTrigger) that runs only while something moves and
 * sleeps otherwise: an idle section costs nothing on the main thread (the
 * tapes' base run is a CSS animation). It writes only transforms, opacity and
 * the text of tiny absolutely positioned flip slots:
 *
 * - scroll velocity → each line leans (skewX) with its own lag, so the three
 *   sway out of step; on the high tier every letter also stretches along the
 *   motion with a lag that grows across the line (a wave); on the mid tier the
 *   line stretches as one piece. Echo copies trail behind (≤ 2% of the
 *   viewport width per echo: ~8px on a phone);
 * - decode → the line is always readable: as it enters, a weight wave rolls
 *   across it and about a quarter of its letters flip through stand-in glyphs
 *   first (≈0.35s in all). A fast scroll skips it, and a decode still running
 *   after 0.4 viewport of scroll snaps to the final text. Click / tap a line
 *   to replay it from that point;
 * - proximity → letters near the cursor swell and, past a threshold (with
 *   hysteresis, so nothing flickers at the edge), flip to a contrasting weight
 *   in ~90ms — two stacked glyphs, one always fully opaque, so nothing
 *   reflows and nothing reads half-and-half; on touch only a finger held
 *   still for 120ms does it, never a scroll;
 * - seal impact → as the wide tape slaps across "We ship.", each letter it
 *   passes is jolted down and springs back (a damped spring per letter).
 *
 * Letter and line offsets are read once per resize/font load (offsetLeft/Top,
 * transform-free); per frame the loop reads window.scrollY and the section's
 * rect before it writes anything.
 */

export type KineticTier = 'high' | 'mid';

export interface KineticEngineOptions {
  tier: KineticTier;
}

/** Data attributes the markup carries (S02Manifesto / KineticLine render them). */
export const K = {
  block: 'data-k-block',
  char: 'data-k-char',
  glyph: 'data-k-glyph',
  alt: 'data-k-alt',
  flip: 'data-k-flip',
  ghost: 'data-k-ghost',
  ...TAPE_ATTR,
} as const;

/** On the root while the type is in motion: CSS shows the echoes and promotes layers only then. */
export const LIVE_ATTR = 'data-k-live';

/** Dispatched on the root by useFitLines after it resizes the lines (positions must be re-read). */
export const FIT_EVENT = 'kineticfit';

/**
 * Stand-ins by case and width class, so a flipping letter stays a letter of
 * its own kind and size (a wide capital in a lowercase "r" slot collides with
 * its neighbours and reads as a rendering bug, not as type settling).
 */
const STAND_INS: Record<string, string> = {
  lowerNarrow: 'fijlrt',
  lower: 'abcdeghknopqsuvxyz',
  lowerWide: 'mw',
  upperNarrow: 'IJLT',
  upper: 'ABCDEFGHKNOPRSUVXYZ',
  upperWide: 'MW',
  digit: '0123456789',
  // Russian lines flip through Cyrillic, so a stand-in never switches script (or font).
  cyrLower: 'абвгдезиклнопрстуэя',
  cyrLowerWide: 'жмшщыю',
  cyrUpper: 'АБВГДЕЗИКЛНОПРСУЭЯ',
  cyrUpperWide: 'ЖМШЩЫЮ',
};
const CYRILLIC = /\p{Script=Cyrillic}/u;
const FLIPPABLE = /[\p{L}\p{N}]/u;

// Velocity: px/s that counts as "full speed", as a multiple of the viewport height.
const VELOCITY_NORM = 3.4;
const VELOCITY_SMOOTHING = 9;
const MAX_SKEW_DEG = 9;
/** Vertical stretch at full speed: per letter (high) or per line (mid). */
const STRETCH = { high: 0.42, mid: 0.2 } as const;
// Lags (1/s): lines follow the scroll at different rates; letters lag more across a line.
const LINE_LAGS = [15, 10, 6.5];
const LAG_FAST = 16;
const LAG_SLOW = 4.5;
/** Echo offset at full speed, per echo, as a share of the viewport width (and at most 0.3em). */
const ECHO_SHIFT_VW = 0.02;
const ECHO_SHIFT_MAX_EM = 0.3;
const ECHO_OPACITY = [0.9, 0.42];

// Decode (seconds).
const FLIP_SHARE = 0.28;
const FLIP_LEAD = 0.1;
const FLIP_JITTER = 0.05;
const WAVE_SPAN = 0.24;
const SWAP_INTERVAL = 0.045;
/** On landing a letter snaps to the contrasting weight for this long (no half-and-half blend)... */
const LAND_HOLD = 0.08;
/** ...and its pop (swell + lift) settles at this rate (1/s). */
const LAND_DECAY = 7;
/** A line decodes once its top is above this share of the viewport. */
const ENTER_LINE = 0.92;
/** Faster than this (normalised) and lines just appear, no decode. */
const SNAP_VELOCITY = 0.3;
/** A decode still running after this much scroll (share of the viewport) snaps to the final text. */
const SNAP_SCROLL = 0.4;

// Proximity.
const PROX_SWELL = 0.09;
const PROX_LIFT = 0.05;
const PROX_IN = 16;
const PROX_OUT = 5;
/** The weight flips on above ALT_ON and back below ALT_OFF (hysteresis)... */
const ALT_ON = 0.5;
const ALT_OFF = 0.3;
/** ...in this long (s): the incoming glyph is opaque before the outgoing one fades. */
const ALT_FADE = 0.09;
const HOLD_MS = 120;
const HOLD_SLOP_PX = 10;

// Seal impact: a damped spring per payoff letter, position in letter heights.
const KICK_IMPULSE = 1.7;
const KICK_STIFFNESS = 520;
const KICK_DAMPING = 15;
const KICK_SQUASH_X = 0.4;
const KICK_SQUASH_Y = 0.6;

/** Calm time before the loop sleeps (s). */
const SLEEP_AFTER = 0.25;
const REST = 5e-4;
const EPS = 0.002;

const BUSY = 1;
const MOVING = 2;
const PROX = 4;

interface CharState {
  el: HTMLElement;
  glyph: HTMLElement;
  alt: HTMLElement;
  flip: HTMLElement;
  ch: string;
  canFlip: boolean;
  cx: number;
  cy: number;
  h: number;
  lag: number;
  vel: number;
  prox: number;
  /** Landing pop, 1 → 0 (transform only). */
  land: number;
  /** Until this time the letter shows its contrasting weight outright. */
  altUntil: number;
  /** Proximity weight flip: target and its 0 → 1 crossfade. */
  isAltOn: boolean;
  altMix: number;
  /** On the payoff's last row: the wide tape crosses it. */
  isCrossed: boolean;
  /** Seal impact spring (letter heights, letter heights/s); once per seal. */
  kick: number;
  kickVel: number;
  isKicked: boolean;
  isPending: boolean;
  landAt: number;
  isFlipping: boolean;
  flipFrom: number;
  nextSwap: number;
  flipText: string;
  wTransform: string;
  wGlyph: number;
  wAlt: number;
  wFlip: string;
}

interface BlockState {
  el: HTMLElement;
  isPayoff: boolean;
  chars: CharState[];
  ghosts: HTMLElement[];
  align: 'start' | 'end';
  lag: number;
  vel: number;
  x: number;
  y: number;
  h: number;
  fs: number;
  isArmed: boolean;
  isDecoding: boolean;
  decodeTop: number;
  wTransform: string;
  wGhosts: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ease(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Eases `value` toward `target`, landing on it exactly once close. */
function follow(value: number, target: number, rate: number, dt: number): number {
  const next = value + (target - value) * ease(rate, dt);
  return Math.abs(next - target) < REST ? target : next;
}

function standInPool(real: string): string {
  if (/\p{N}/u.test(real)) return STAND_INS.digit;
  const isUpper = real !== real.toLowerCase();
  const key = real.toLowerCase();
  if (CYRILLIC.test(real)) return STAND_INS[`cyr${isUpper ? 'Upper' : 'Lower'}${'жмшщыю'.includes(key) ? 'Wide' : ''}`] ?? STAND_INS.lower;
  const width = 'fijlrt'.includes(key) ? 'Narrow' : 'mw'.includes(key) ? 'Wide' : '';
  return STAND_INS[`${isUpper ? 'upper' : 'lower'}${width}`] ?? STAND_INS.lower;
}

/** A different glyph of the same case and width class as `real` (and not the one showing now). */
function standIn(real: string, current: string): string {
  const pool = standInPool(real);
  let glyph = real;
  for (let tries = 0; tries < 8 && (glyph === real || glyph === current); tries++) {
    glyph = pool[Math.floor(Math.random() * pool.length)];
  }
  return glyph;
}

/** n random picks without repeats (partial Fisher–Yates on a copy). */
function pick<T>(items: readonly T[], n: number): Set<T> {
  const pool = [...items];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return new Set(pool.slice(0, count));
}

/** Offset of `el` inside `root`, summed through offsetParents (ignores transforms). */
function offsetWithin(el: HTMLElement, root: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function q(parent: ParentNode, attr: string): HTMLElement | null {
  return parent.querySelector<HTMLElement>(`[${attr}]`);
}

function qa(parent: ParentNode, attr: string): HTMLElement[] {
  return Array.from(parent.querySelectorAll<HTMLElement>(`[${attr}]`));
}

export class KineticEngine {
  private readonly root: HTMLElement;
  private readonly opts: KineticEngineOptions;
  private readonly blocks: BlockState[];
  private readonly tapes: TapeRig;
  private readonly observer: ResizeObserver | null;

  private isActive = false;
  private isAwake = false;
  private isDestroyed = false;
  private isLive = false;
  private hasProx = false;
  private calmFor = 0;
  private rootLeft = 0;
  private vw = 1;
  private vh = 1;
  private radius = 160;
  private lastY = 0;
  private velocity = 0;
  private pointerX = -1e4;
  private pointerY = -1e4;
  private isPointerActive = false;
  private isTouch = false;
  private touchX = 0;
  private touchY = 0;
  private holdTimer = 0;
  private isHolding = false;
  private measureFrame = 0;
  /** False until the first frame after activation: letters the band already covers are not jolted. */
  private isPrimed = false;
  private lead: BandLead | null = null;

  constructor(root: HTMLElement, opts: KineticEngineOptions) {
    this.root = root;
    this.opts = opts;
    this.blocks = qa(root, K.block).map((el, index) => this.createBlock(el, index));
    this.tapes = new TapeRig(root);
    this.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.scheduleMeasure);
    this.observer?.observe(root);
    document.fonts?.addEventListener('loadingdone', this.scheduleMeasure);
    window.addEventListener('resize', this.scheduleMeasure, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('blur', this.onPointerLeave);
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
    root.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    root.addEventListener('click', this.onClick);
    root.addEventListener(FIT_EVENT, this.scheduleMeasure);
    this.measure();
  }

  /** Runs the loop while the section is on screen; stops it otherwise. */
  setActive(isActive: boolean): void {
    if (this.isDestroyed || isActive === this.isActive) return;
    this.isActive = isActive;
    if (isActive) {
      this.lastY = window.scrollY;
      this.velocity = 0;
      this.isPrimed = false;
      this.measure();
      this.wake();
    } else {
      this.sleep();
    }
  }

  /** A finger gets a wider field than a cursor. */
  setTouch(isTouch: boolean): void {
    this.isTouch = isTouch;
    this.measure();
  }

  /** Decodes the lines on screen again (style switch: the new face arrives with a wave). */
  rearm(): void {
    this.blocks.forEach(block => {
      block.isArmed = true;
    });
    this.measure();
    this.wake();
  }

  destroy(): void {
    this.setActive(false);
    this.isDestroyed = true;
    cancelAnimationFrame(this.measureFrame);
    window.clearTimeout(this.holdTimer);
    this.observer?.disconnect();
    document.fonts?.removeEventListener('loadingdone', this.scheduleMeasure);
    window.removeEventListener('resize', this.scheduleMeasure);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('blur', this.onPointerLeave);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    this.root.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener(FIT_EVENT, this.scheduleMeasure);
    this.root.removeAttribute(LIVE_ATTR);
    this.blocks.forEach(block => {
      block.el.style.transform = '';
      block.ghosts.forEach(ghost => {
        ghost.style.transform = '';
        ghost.style.opacity = '';
      });
      block.chars.forEach(c => {
        c.el.style.transform = '';
        c.glyph.style.opacity = '';
        c.alt.style.opacity = '';
        c.flip.textContent = '';
      });
    });
    this.tapes.reset();
  }

  // ── setup ────────────────────────────────────────────────────────────────

  private createBlock(el: HTMLElement, index: number): BlockState {
    const charEls = qa(el, K.char);
    const last = Math.max(1, charEls.length - 1);
    const chars = charEls.map((charEl, i): CharState => {
      const glyph = q(charEl, K.glyph) ?? charEl;
      const ch = charEl.getAttribute(K.char) ?? '';
      return {
        el: charEl,
        glyph,
        alt: q(charEl, K.alt) ?? glyph,
        flip: q(charEl, K.flip) ?? glyph,
        ch,
        canFlip: FLIPPABLE.test(ch),
        cx: 0,
        cy: 0,
        h: 0,
        lag: LAG_FAST + (LAG_SLOW - LAG_FAST) * (i / last),
        vel: 0,
        prox: 0,
        land: 0,
        altUntil: 0,
        isAltOn: false,
        altMix: 0,
        isCrossed: false,
        kick: 0,
        kickVel: 0,
        isKicked: false,
        isPending: false,
        landAt: 0,
        isFlipping: false,
        flipFrom: 0,
        nextSwap: 0,
        flipText: '',
        wTransform: '',
        wGlyph: 1,
        wAlt: 0,
        wFlip: '',
      };
    });
    const ghosts = qa(el, K.ghost);
    return {
      el,
      isPayoff: el.hasAttribute('data-payoff'),
      chars,
      ghosts,
      align: el.dataset.align === 'end' ? 'end' : 'start',
      lag: LINE_LAGS[index] ?? LINE_LAGS[LINE_LAGS.length - 1],
      vel: 0,
      x: 0,
      y: 0,
      h: 0,
      fs: 16,
      isArmed: true,
      isDecoding: false,
      decodeTop: 0,
      wTransform: '',
      wGhosts: ghosts.map(() => ''),
    };
  }

  private readonly scheduleMeasure = (): void => {
    cancelAnimationFrame(this.measureFrame);
    this.measureFrame = requestAnimationFrame(() => {
      this.measure();
      this.wake();
    });
  };

  private measure(): void {
    if (this.isDestroyed) return;
    this.rootLeft = this.root.getBoundingClientRect().left;
    this.vw = window.innerWidth || 1;
    this.vh = window.innerHeight || 1;
    this.radius = clamp(this.vw * (this.isTouch ? 0.3 : 0.15), 110, 270);
    this.blocks.forEach(block => {
      const offset = offsetWithin(block.el, this.root);
      block.x = offset.x;
      block.y = offset.y;
      block.h = block.el.offsetHeight;
      block.fs = parseFloat(getComputedStyle(block.el).fontSize) || 16;
      let lastRow = -Infinity;
      block.chars.forEach(c => {
        c.cx = c.el.offsetLeft + c.el.offsetWidth / 2;
        c.cy = c.el.offsetTop + c.el.offsetHeight / 2;
        c.h = c.el.offsetHeight;
        lastRow = Math.max(lastRow, c.el.offsetTop);
      });
      block.chars.forEach(c => {
        c.isCrossed = block.isPayoff && c.el.offsetTop >= lastRow - 1;
      });
    });
    this.tapes.measure(this.vw);
  }

  private wake(): void {
    if (!this.isActive || this.isAwake || this.isDestroyed) return;
    this.isAwake = true;
    this.calmFor = 0;
    gsap.ticker.add(this.tick);
  }

  private sleep(): void {
    if (!this.isAwake) return;
    this.isAwake = false;
    gsap.ticker.remove(this.tick);
    this.setLive(false);
  }

  private setLive(isLive: boolean): void {
    if (isLive === this.isLive) return;
    this.isLive = isLive;
    if (isLive) this.root.setAttribute(LIVE_ATTR, '');
    else this.root.removeAttribute(LIVE_ATTR);
  }

  // ── input ────────────────────────────────────────────────────────────────

  private readonly onScroll = (): void => this.wake();

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.isPointerActive = true;
    const isOver = event.target instanceof Node && this.root.contains(event.target);
    if (isOver || this.hasProx) this.wake();
  };

  private readonly onPointerLeave = (): void => {
    this.isPointerActive = false;
    this.wake();
  };

  // Touch: only a finger held still lights the letters up; a swipe is a scroll.
  private readonly onTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    this.cancelHold();
    if (!touch || event.touches.length > 1) return;
    this.touchX = touch.clientX;
    this.touchY = touch.clientY;
    this.holdTimer = window.setTimeout(this.onHold, HOLD_MS);
  };

  private readonly onHold = (): void => {
    this.holdTimer = 0;
    this.isHolding = true;
    this.pointerX = this.touchX;
    this.pointerY = this.touchY;
    this.isPointerActive = true;
    this.wake();
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (!this.holdTimer && !this.isHolding) return;
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - this.touchX;
    const dy = touch.clientY - this.touchY;
    if (dx * dx + dy * dy > HOLD_SLOP_PX * HOLD_SLOP_PX) this.cancelHold();
    else if (this.isHolding) {
      this.pointerX = touch.clientX;
      this.pointerY = touch.clientY;
    }
  };

  private readonly onTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length === 0) this.cancelHold();
  };

  private cancelHold(): void {
    window.clearTimeout(this.holdTimer);
    this.holdTimer = 0;
    if (!this.isHolding) return;
    this.isHolding = false;
    this.isPointerActive = false;
    this.wake();
  }

  /** Click / tap on a statement line decodes it again, the wave starting where it was hit. */
  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest(`[${K.block}]`) : null;
    const block = target && this.blocks.find(candidate => candidate.el === target);
    if (!block) return;
    const rect = this.root.getBoundingClientRect();
    this.decode(block, gsap.ticker.time, event.clientX - rect.left - block.x, rect.top + block.y);
    this.wake();
  };

  // ── decode ───────────────────────────────────────────────────────────────

  private decode(block: BlockState, now: number, originX: number | null, top: number): void {
    const { chars } = block;
    block.isArmed = false;
    if (chars.length === 0) return;
    block.isDecoding = true;
    block.decodeTop = top;
    let minX = Infinity;
    let maxX = -Infinity;
    chars.forEach(c => {
      minX = Math.min(minX, c.cx);
      maxX = Math.max(maxX, c.cx);
    });
    const origin = originX ?? (block.align === 'end' ? maxX : minX);
    const reach = Math.max(origin - minX, maxX - origin, 1);
    const flippable = chars.filter(c => c.canFlip);
    const flips = pick(flippable, Math.max(1, Math.round(flippable.length * FLIP_SHARE)));
    chars.forEach(c => {
      c.isPending = true;
      c.landAt = now + FLIP_LEAD + (Math.abs(c.cx - origin) / reach) * WAVE_SPAN;
      c.isFlipping = flips.has(c);
      c.flipFrom = c.landAt - FLIP_LEAD + Math.random() * FLIP_JITTER;
      c.nextSwap = c.flipFrom;
    });
  }

  /** Straight to the final text: no flips, no wave. */
  private snap(block: BlockState): void {
    block.isDecoding = false;
    block.chars.forEach(c => {
      c.isPending = false;
      c.isFlipping = false;
      c.land = 0;
      c.altUntil = 0;
    });
  }

  private updateTrigger(block: BlockState, top: number, now: number): void {
    const isFast = Math.abs(this.velocity) > SNAP_VELOCITY;
    if (block.isArmed) {
      if (top < this.vh * ENTER_LINE && top + block.h > 0) {
        if (isFast) block.isArmed = false;
        else this.decode(block, now, null, top);
      }
    } else if (top > this.vh) {
      block.isArmed = true;
    }
    if (block.isDecoding && (isFast || block.decodeTop - top > this.vh * SNAP_SCROLL)) this.snap(block);
  }

  // ── frame ────────────────────────────────────────────────────────────────

  private readonly tick = (time: number, deltaMs: number): void => {
    const dt = clamp(deltaMs / 1000, 1 / 240, 1 / 30);
    const scrollY = window.scrollY;
    let dy = scrollY - this.lastY;
    this.lastY = scrollY;
    // An instant jump (panel navigation, anchor) is not a flick.
    if (Math.abs(dy) > this.vh * 1.5) dy = 0;
    const target = clamp(dy / dt / (this.vh * VELOCITY_NORM), -1, 1);
    this.velocity = follow(this.velocity, target, VELOCITY_SMOOTHING, dt);

    // One rect read per frame, before any write: content above may change height
    // (lazy sections) without resizing this root, so a cached offset would drift.
    const rect = this.root.getBoundingClientRect();
    this.rootLeft = rect.left;
    let flags = target !== 0 || this.velocity !== 0 ? BUSY | MOVING : 0;
    if (this.tapes.update({ rootTop: rect.top, vh: this.vh, velocity: this.velocity, dt })) flags |= BUSY;
    this.lead = this.tapes.bandLead();
    this.blocks.forEach(block => {
      flags |= this.updateBlock(block, rect.top, time, dt);
    });
    this.isPrimed = true;
    this.hasProx = (flags & PROX) !== 0;
    this.setLive((flags & MOVING) !== 0);

    this.calmFor = flags & BUSY ? 0 : this.calmFor + dt;
    if (this.calmFor >= SLEEP_AFTER) this.sleep();
  };

  private updateBlock(block: BlockState, rootTop: number, now: number, dt: number): number {
    const top = rootTop + block.y;
    this.updateTrigger(block, top, now);
    const isHigh = this.opts.tier === 'high';
    block.vel = follow(block.vel, this.velocity, block.lag, dt);
    let flags = block.vel !== 0 ? BUSY | MOVING : 0;
    this.writeLine(block, isHigh);
    this.updateGhosts(block);

    const stretchMax = isHigh ? STRETCH.high : 0;
    const localX = this.pointerX - (this.rootLeft + block.x);
    const localY = this.pointerY - top;
    const isNear = this.isPointerActive && localY > -this.radius && localY < block.h + this.radius;
    const radius2 = this.radius * this.radius;
    let isDecoding = false;

    block.chars.forEach(c => {
      this.updateDecode(c, now);
      if (c.isPending) isDecoding = true;
      if (isHigh) c.vel = follow(c.vel, this.velocity, c.lag, dt);

      let proxTarget = 0;
      if (isNear && !c.isPending) {
        const dx = localX - c.cx;
        const dyc = localY - c.cy;
        const d2 = dx * dx + dyc * dyc;
        if (d2 < radius2) proxTarget = smoothstep(0, 1, 1 - Math.sqrt(d2) / this.radius);
      }
      c.prox = follow(c.prox, proxTarget, proxTarget > c.prox ? PROX_IN : PROX_OUT, dt);
      this.updateAlt(c, dt);
      this.updateKick(block, c, dt);
      c.land = c.land < 1e-3 ? 0 : c.land * Math.exp(-LAND_DECAY * dt);
      if (c.prox > 0 || c.isAltOn) flags |= PROX;
      if (c.vel !== 0) flags |= BUSY | MOVING;
      if (c.land > 0 || c.isPending || c.altUntil > now || c.prox !== proxTarget) flags |= BUSY;
      if (c.kick !== 0 || c.kickVel !== 0 || c.altMix !== (c.isAltOn ? 1 : 0)) flags |= BUSY;
      this.writeChar(c, now, stretchMax);
    });
    if (!isDecoding) block.isDecoding = false;
    return flags;
  }

  private writeLine(block: BlockState, isHigh: boolean): void {
    const v = block.vel;
    let out = '';
    if (v !== 0) {
      const skew = (-v * MAX_SKEW_DEG).toFixed(2);
      if (isHigh) out = `skewX(${skew}deg)`;
      else {
        // Mid tier: the whole line stretches toward its trailing edge (down-scroll moves text up).
        const stretch = Math.abs(v) * STRETCH.mid;
        const ty = Math.sign(v) * stretch * block.h * 0.5;
        out = `translate3d(0,${ty.toFixed(1)}px,0) skewX(${skew}deg) scale(1,${(1 + stretch).toFixed(4)})`;
      }
    }
    if (out === block.wTransform) return;
    block.wTransform = out;
    block.el.style.transform = out;
  }

  private updateGhosts(block: BlockState): void {
    const v = block.vel;
    const maxShift = Math.min(this.vw * ECHO_SHIFT_VW, block.fs * ECHO_SHIFT_MAX_EM);
    block.ghosts.forEach((ghost, index) => {
      const opacity = Math.min(1, Math.abs(v) * 3) * (ECHO_OPACITY[index] ?? 0.3);
      const shift = v * maxShift * (index + 1);
      const isOff = opacity < 0.004;
      const out = isOff ? '' : `${shift.toFixed(1)}|${opacity.toFixed(3)}`;
      if (out === block.wGhosts[index]) return;
      block.wGhosts[index] = out;
      ghost.style.transform = isOff ? '' : `translate3d(0,${shift.toFixed(1)}px,0)`;
      ghost.style.opacity = isOff ? '' : opacity.toFixed(3);
    });
  }

  /** Proximity weight flip with hysteresis, then a short crossfade toward it. */
  private updateAlt(c: CharState, dt: number): void {
    if (c.isPending) {
      c.isAltOn = false;
      c.altMix = 0;
      return;
    }
    if (c.isAltOn ? c.prox < ALT_OFF : c.prox > ALT_ON) c.isAltOn = !c.isAltOn;
    const target = c.isAltOn ? 1 : 0;
    const step = dt / ALT_FADE;
    c.altMix = c.altMix < target ? Math.min(target, c.altMix + step) : Math.max(target, c.altMix - step);
  }

  /** The band's leading edge passing a payoff letter jolts it once per seal. */
  private updateKick(block: BlockState, c: CharState, dt: number): void {
    if (!c.isCrossed) return;
    const lead = this.lead;
    if (!lead) {
      c.isKicked = false;
    } else if (!c.isKicked) {
      const x = block.x + c.cx;
      const isPassed = lead.dir > 0 ? lead.x >= x : lead.x <= x;
      if (isPassed) {
        c.isKicked = true;
        if (this.isPrimed) c.kickVel += KICK_IMPULSE;
      }
    }
    if (c.kick === 0 && c.kickVel === 0) return;
    // Semi-implicit Euler, substepped: stable at any frame time the ticker hands us.
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      c.kickVel += (-KICK_STIFFNESS * c.kick - KICK_DAMPING * c.kickVel) * h;
      c.kick += c.kickVel * h;
    }
    if (Math.abs(c.kick) < REST * 0.5 && Math.abs(c.kickVel) < REST * 20) {
      c.kick = 0;
      c.kickVel = 0;
    }
  }

  private updateDecode(c: CharState, now: number): void {
    if (!c.isPending) return;
    if (now >= c.landAt) {
      c.isPending = false;
      c.isFlipping = false;
      c.land = 1;
      c.altUntil = now + LAND_HOLD;
      return;
    }
    if (c.isFlipping && now >= c.flipFrom && now >= c.nextSwap) {
      c.flipText = standIn(c.ch, c.flipText);
      c.nextSwap = now + SWAP_INTERVAL;
    }
  }

  private writeChar(c: CharState, now: number, stretchMax: number): void {
    const t = Math.max(c.prox, c.land);
    const stretch = Math.abs(c.vel) * stretchMax;
    const kick = c.kick;
    let out = '';
    if (stretch > REST || t > REST || kick !== 0) {
      const swell = 1 + t * PROX_SWELL;
      // Stretch toward the trailing edge: down-scroll moves text up, so it smears downward.
      const ty = Math.sign(c.vel) * stretch * c.h * 0.5 - t * c.h * PROX_LIFT + kick * c.h;
      const sx = swell * (1 + kick * KICK_SQUASH_X);
      const sy = (1 + stretch) * swell * (1 - kick * KICK_SQUASH_Y);
      out = `translate3d(0,${ty.toFixed(1)}px,0) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    }
    if (out !== c.wTransform) {
      c.wTransform = out;
      c.el.style.transform = out;
    }

    const isFlipShown = c.isFlipping && c.isPending && now >= c.flipFrom;
    const flipText = isFlipShown ? c.flipText : '';
    if (flipText !== c.wFlip) {
      c.wFlip = flipText;
      c.flip.textContent = flipText;
    }
    // The decode swaps outright (a crisp ripple); the proximity flip runs the
    // incoming glyph up to full opacity before the outgoing one fades, so one
    // layer is always solid (two half-faded weights read as a muddy misprint).
    const isAltForced = !isFlipShown && now < c.altUntil;
    const altOpacity = isFlipShown ? 0 : isAltForced ? 1 : clamp(c.altMix * 2, 0, 1);
    const glyphOpacity = isFlipShown || isAltForced ? 0 : 1 - clamp(c.altMix * 2 - 1, 0, 1);
    if (Math.abs(glyphOpacity - c.wGlyph) > EPS || (glyphOpacity !== c.wGlyph && (glyphOpacity === 0 || glyphOpacity === 1))) {
      c.wGlyph = glyphOpacity;
      c.glyph.style.opacity = glyphOpacity === 1 ? '' : glyphOpacity.toFixed(3);
    }
    if (Math.abs(altOpacity - c.wAlt) > EPS || (altOpacity !== c.wAlt && altOpacity === 0)) {
      c.wAlt = altOpacity;
      c.alt.style.opacity = altOpacity === 0 ? '' : altOpacity.toFixed(3);
    }
  }
}
