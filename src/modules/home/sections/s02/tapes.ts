/**
 * The two crossing tapes of 02 · Manifesto.
 *
 * - The base marquee is a CSS animation on each track (compositor only, so an
 *   idle section costs nothing on the main thread); the rig only sets its
 *   duration from the measured width.
 * - Scrolling adds on top of it: an extra offset on the `lean` wrapper speeds
 *   the run up with scroll velocity, reverses it while scrolling up, and tips
 *   the lettering into the direction of travel. When the scroll stops the
 *   tapes ease back to their own pace and direction, and the rig goes idle.
 * - Seal: the tapes are pulled across the payoff as it rises into view — a
 *   transform-only reveal (the band slides in, its content counter-slides so
 *   the lettering does not). It follows the scroll, and finishes by itself
 *   once a fifth of it has been revealed so it never rests half-drawn. The
 *   wide band's leading edge is exposed (`bandLead`) so the engine can jolt
 *   each letter of the payoff as the band slaps across it.
 */

export const TAPE_ATTR = {
  tapes: 'data-k-tapes',
  tape: 'data-k-tape',
  reel: 'data-k-reel',
  counter: 'data-k-counter',
  lean: 'data-k-lean',
  track: 'data-k-track',
  group: 'data-k-group',
} as const;

/** On the tapes box while the seal reveal is moving: CSS promotes the bands only then. */
export const SEALING_ATTR = 'data-k-sealing';

// Base pace: px/s relative to the viewport width.
const TRACK_BASE = 0.032;
const TRACK_BASE_MIN = 22;
const TRACK_BASE_MAX = 64;
/** Extra speed at full scroll velocity, as a multiple of the base pace. */
const TRACK_BOOST = 14;
const FLOW_EASE = 2.6;
/** Calm time before a reversed tape turns back to its own direction (s). */
const FLOW_RETURN_AFTER = 0.45;
const FLOW_THRESHOLD = 0.03;
const TRACK_LEAN_DEG = 12;

// Seal: progress runs while the tapes' centre rises from START to END (share of the viewport height).
const SEAL_START = 1.04;
const SEAL_END = 0.72;
/** Once this much is revealed by scrolling, the rest completes in AUTO_DURATION. */
const SEAL_AUTO_AFTER = 0.2;
const SEAL_AUTO_DURATION = 0.7;
/** The tapes re-arm (hide) once their centre is this far below the viewport top. */
const SEAL_REARM = 1.2;

const EPS = 0.002;

interface TapeState {
  el: HTMLElement;
  reel: HTMLElement;
  counter: HTMLElement;
  lean: HTMLElement;
  track: HTMLElement;
  group: HTMLElement;
  /** 1 runs left, -1 runs right. */
  dir: number;
  speed: number;
  /** Side the band is pulled in from: -1 left, 1 right. */
  side: number;
  /** Share of the seal progress this tape waits for. */
  delay: number;
  /** The wide band (its reel carries data-fit-band). */
  isBand: boolean;
  /** Root x of the tape's left edge and its width (the reel spans it). */
  left: number;
  span: number;
  /** Seal progress of this tape, 0 (parked) → 1 (sealed). */
  local: number;
  width: number;
  extraX: number;
  wSeal: string;
  wLean: string;
  wDuration: string;
}

/** Where the wide band's leading edge is while it seals (root x), and which way it travels. */
export interface BandLead {
  x: number;
  /** 1: travelling right (pulled in from the left), -1: travelling left. */
  dir: 1 | -1;
}

export interface TapeFrame {
  /** Viewport y of the section root's top. */
  rootTop: number;
  vh: number;
  /** Normalised scroll velocity, -1..1 (positive = scrolling down). */
  velocity: number;
  dt: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ease(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function q(parent: ParentNode, attr: string): HTMLElement | null {
  return parent.querySelector<HTMLElement>(`[${attr}]`);
}

export class TapeRig {
  private readonly root: HTMLElement;
  private readonly box: HTMLElement | null;
  private readonly tapes: TapeState[];
  private centerOffset = 0;
  private base = TRACK_BASE_MIN;
  private flow = 1;
  private flowTarget = 1;
  private calm = 0;
  private sealAuto = 0;
  private isAutoStarted = false;
  private isSealing = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.box = q(root, TAPE_ATTR.tapes);
    this.tapes = Array.from(root.querySelectorAll<HTMLElement>(`[${TAPE_ATTR.tape}]`)).flatMap(el => this.createTape(el));
  }

  private createTape(el: HTMLElement): TapeState[] {
    const reel = q(el, TAPE_ATTR.reel);
    const counter = q(el, TAPE_ATTR.counter);
    const lean = q(el, TAPE_ATTR.lean);
    const track = q(el, TAPE_ATTR.track);
    const group = q(el, TAPE_ATTR.group);
    if (!reel || !counter || !lean || !track || !group) return [];
    return [
      {
        el,
        reel,
        counter,
        lean,
        track,
        group,
        dir: Number(el.dataset.dir ?? '1') || 1,
        speed: Number(el.dataset.speed ?? '1') || 1,
        side: Number(el.dataset.side ?? '-1') || -1,
        delay: clamp(Number(el.dataset.delay ?? '0') || 0, 0, 0.9),
        isBand: reel.hasAttribute('data-fit-band'),
        left: 0,
        span: 0,
        local: 0,
        width: 0,
        extraX: 0,
        wSeal: '',
        wLean: '',
        wDuration: '',
      },
    ];
  }

  /** Layout reads (offsets are transform-free); call on resize and font loads. */
  measure(vw: number): void {
    if (this.box) {
      let y = 0;
      let node: HTMLElement | null = this.box;
      while (node && node !== this.root) {
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      this.centerOffset = y + this.box.offsetHeight / 2;
    }
    this.base = clamp(vw * TRACK_BASE, TRACK_BASE_MIN, TRACK_BASE_MAX);
    const boxLeft = this.box?.offsetLeft ?? 0;
    this.tapes.forEach(tape => {
      tape.left = boxLeft + tape.el.offsetLeft;
      tape.span = tape.el.offsetWidth;
      tape.width = tape.group.offsetWidth;
      if (tape.width <= 0) return;
      tape.extraX = wrap(tape.extraX, tape.width);
      // One group per cycle at the base pace (the track holds four copies, the keyframe moves 25%).
      const duration = `${(tape.width / (this.base * tape.speed)).toFixed(2)}s`;
      if (duration !== tape.wDuration) {
        tape.wDuration = duration;
        tape.track.style.animationDuration = duration;
      }
    });
  }

  /** Advances one frame; returns true while anything is still moving. */
  update({ rootTop, vh, velocity, dt }: TapeFrame): boolean {
    const isSealBusy = this.updateSeal(rootTop, vh, dt);
    const isFlowBusy = this.updateFlow(velocity, dt);
    return isSealBusy || isFlowBusy;
  }

  /** The wide band's leading edge while it is on its way in; null when parked. */
  bandLead(): BandLead | null {
    const band = this.tapes.find(tape => tape.isBand);
    if (!band || band.local <= 0 || band.span <= 0) return null;
    // Pulled in from the left (side -1): its right edge leads; from the right, its left edge.
    return band.side < 0 ? { x: band.left + band.local * band.span, dir: 1 } : { x: band.left + (1 - band.local) * band.span, dir: -1 };
  }

  /** Clears every inline style the rig wrote (unmount, or the mode left 'full'). */
  reset(): void {
    this.box?.removeAttribute(SEALING_ATTR);
    this.tapes.forEach(tape => {
      tape.reel.style.transform = '';
      tape.counter.style.transform = '';
      tape.lean.style.transform = '';
      tape.track.style.animationDuration = '';
    });
  }

  private updateSeal(rootTop: number, vh: number, dt: number): boolean {
    const center = rootTop + this.centerOffset;
    const scrolled = clamp((SEAL_START * vh - center) / ((SEAL_START - SEAL_END) * vh), 0, 1);
    if (center > SEAL_REARM * vh) {
      this.isAutoStarted = false;
      this.sealAuto = 0;
    } else if (!this.isAutoStarted && scrolled >= SEAL_AUTO_AFTER) {
      this.isAutoStarted = true;
      this.sealAuto = scrolled;
    }
    const isAutoRunning = this.isAutoStarted && this.sealAuto < 1;
    if (isAutoRunning) this.sealAuto = Math.min(1, this.sealAuto + dt / SEAL_AUTO_DURATION);
    const progress = Math.max(scrolled, this.isAutoStarted ? this.sealAuto : 0);

    let isMoving = false;
    this.tapes.forEach(tape => {
      const local = easeOutCubic(clamp((progress - tape.delay) / (1 - tape.delay), 0, 1));
      tape.local = local;
      const offset = (1 - local) * 100 * tape.side;
      if (local > 0 && local < 1) isMoving = true;
      // 'none' (not ''): in full mode the stylesheet parks the bands off-screen until the first frame.
      const out = local >= 1 ? 'none' : offset.toFixed(2);
      if (out === tape.wSeal) return;
      tape.wSeal = out;
      tape.reel.style.transform = local >= 1 ? 'none' : `translate3d(${out}%,0,0)`;
      tape.counter.style.transform = local >= 1 ? 'none' : `translate3d(${(-offset).toFixed(2)}%,0,0)`;
    });
    this.setSealing(isMoving);
    return isAutoRunning || isMoving;
  }

  private updateFlow(velocity: number, dt: number): boolean {
    const speed = Math.abs(velocity);
    if (speed > FLOW_THRESHOLD) {
      this.flowTarget = Math.sign(velocity);
      this.calm = 0;
    } else {
      this.calm += dt;
      if (this.calm > FLOW_RETURN_AFTER) this.flowTarget = 1;
    }
    this.flow += (this.flowTarget - this.flow) * ease(FLOW_EASE, dt);
    if (Math.abs(this.flow - this.flowTarget) < EPS) this.flow = this.flowTarget;

    // Extra speed on top of the CSS run (whose own speed is 1 × base, forward).
    const factor = this.flow * (1 + speed * TRACK_BOOST) - 1;
    this.tapes.forEach(tape => {
      if (tape.width <= 0) return;
      tape.extraX = wrap(tape.extraX - tape.dir * this.base * tape.speed * factor * dt, tape.width);
      // Positive skewX tips the tops left: leaning into a leftward run.
      const lean = tape.dir * this.flow * speed * TRACK_LEAN_DEG;
      const x = tape.extraX.toFixed(1);
      const skew = Math.abs(lean) < 0.01 ? '' : ` skewX(${lean.toFixed(2)}deg)`;
      const out = `translate3d(${x}px,0,0)${skew}`;
      if (out === tape.wLean) return;
      tape.wLean = out;
      tape.lean.style.transform = out;
    });
    return speed > EPS || this.flow !== 1;
  }

  private setSealing(isSealing: boolean): void {
    if (isSealing === this.isSealing || !this.box) return;
    this.isSealing = isSealing;
    if (isSealing) this.box.setAttribute(SEALING_ATTR, '');
    else this.box.removeAttribute(SEALING_ATTR);
  }
}

/** Keeps an offset within (-width, 0] so the repeated copies always cover the band. */
function wrap(x: number, width: number): number {
  if (width <= 0) return 0;
  const r = x % width;
  return r > 0 ? r - width : r;
}
