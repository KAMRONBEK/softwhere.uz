/**
 * Grab to spin: the visitor turns the phone by hand. A drag follows the
 * finger 1:1; on release the phone keeps its momentum and springs to the
 * nearest full turn, so a flick sends it round once (or twice) and a nudge
 * swings back. Purely visual: the scroll story keeps the playhead.
 */

const TURN = Math.PI * 2;
/** Seconds of momentum projected forward when choosing the turn to land on. */
const THROW = 0.22;
/** Landing spring (rad/s² per rad) and its damping ratio: a little overshoot. */
const STIFFNESS = 34;
const DAMPING_RATIO = 0.72;
const DAMPING = 2 * DAMPING_RATIO * Math.sqrt(STIFFNESS);
/** A pause this long before the release means the finger stopped: no throw. */
const STALE_MS = 90;
/** Velocity smoothing between pointer samples (0 = raw). */
const SMOOTHING = 0.55;
const REST = 1e-3;

export class GrabSpin {
  /** Radians added to the phone's turn. */
  offset = 0;
  /** rad/s */
  velocity = 0;
  isDragging = false;
  /** Set on the first grab of this mount: the hint retires. */
  hasGrabbed = false;
  private target = 0;
  private lastX = 0;
  private lastTime = 0;

  start(x: number, time: number): void {
    this.isDragging = true;
    this.hasGrabbed = true;
    this.lastX = x;
    this.lastTime = time;
    this.velocity = 0;
  }

  /** `pxPerTurn`: how far a finger travels for one full turn (about two phone widths). */
  move(x: number, time: number, pxPerTurn: number): void {
    if (!this.isDragging) return;
    const delta = ((x - this.lastX) / Math.max(1, pxPerTurn)) * TURN;
    const seconds = Math.max(4, time - this.lastTime) / 1000;
    this.offset += delta;
    this.velocity = this.velocity * SMOOTHING + (delta / seconds) * (1 - SMOOTHING);
    this.lastX = x;
    this.lastTime = time;
  }

  end(time: number, isCancelled = false): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (isCancelled || time - this.lastTime > STALE_MS) this.velocity = 0;
    this.target = Math.round((this.offset + this.velocity * THROW) / TURN) * TURN;
  }

  get isMoving(): boolean {
    return this.isDragging || Math.abs(this.offset - this.target) > REST || Math.abs(this.velocity) > REST;
  }

  /** Advance the landing spring; returns whether anything is still moving. */
  step(dt: number): boolean {
    if (this.isDragging) return true;
    if (!this.isMoving) return false;
    this.velocity += ((this.target - this.offset) * STIFFNESS - this.velocity * DAMPING) * dt;
    this.offset += this.velocity * dt;
    if (Math.abs(this.offset - this.target) < REST && Math.abs(this.velocity) < REST * 10) {
      // Full turns are all the same pose: settle back to zero.
      this.offset = 0;
      this.target = 0;
      this.velocity = 0;
      return false;
    }
    return true;
  }

  reset(): void {
    this.offset = 0;
    this.target = 0;
    this.velocity = 0;
    this.isDragging = false;
  }
}

/** The phone's on-screen box (px, stage coordinates) and whether the "spin me" hint may show. */
export interface GrabPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The phone is on stage and grabbable. */
  isOn: boolean;
  /** The phone faces the viewer and rests between turns. */
  isFacing: boolean;
}

/** Hit box side before scaling (px); the box is scaled, never resized, so no layout runs. */
export const GRAB_BOX = 100;
/** Gap between the phone and the hint (px). */
const HINT_GAP = 14;

/**
 * Moves the invisible hit box over the phone (and the hint beside it).
 * Transforms only, written when they change by half a pixel or more.
 */
export class GrabTargets {
  private box: HTMLElement | null = null;
  private hint: HTMLElement | null = null;
  private last = { x: -1, y: -1, width: -1, height: -1 };
  private isOn = false;
  private isHintShown = false;

  /** Point at the DOM elements (null on unmount); the next place() writes them from scratch. */
  attach(box: HTMLElement | null, hint: HTMLElement | null): void {
    this.box = box;
    this.hint = hint;
    this.last = { x: -1, y: -1, width: -1, height: -1 };
    this.isOn = false;
    this.isHintShown = false;
  }

  place(placement: GrabPlacement, isHintAllowed: boolean): void {
    const { box, hint } = this;
    if (!box) return;
    if (placement.isOn !== this.isOn) {
      this.isOn = placement.isOn;
      box.dataset.on = placement.isOn ? 'true' : 'false';
    }
    const showHint = isHintAllowed && placement.isOn && placement.isFacing;
    if (hint && showHint !== this.isHintShown) {
      this.isHintShown = showHint;
      hint.dataset.shown = showHint ? 'true' : 'false';
    }
    if (!placement.isOn) return;
    const last = this.last;
    const isSame =
      Math.abs(placement.x - last.x) < 0.5 &&
      Math.abs(placement.y - last.y) < 0.5 &&
      Math.abs(placement.width - last.width) < 0.5 &&
      Math.abs(placement.height - last.height) < 0.5;
    if (isSame) return;
    this.last = { x: placement.x, y: placement.y, width: placement.width, height: placement.height };
    const scaleX = placement.width / GRAB_BOX;
    const scaleY = placement.height / GRAB_BOX;
    box.style.transform = `translate3d(${placement.x.toFixed(1)}px, ${placement.y.toFixed(1)}px, 0) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
    if (hint) {
      const hx = placement.x + placement.width + HINT_GAP;
      const hy = placement.y + placement.height / 2;
      hint.style.transform = `translate3d(${hx.toFixed(1)}px, ${hy.toFixed(1)}px, 0) translateY(-50%)`;
    }
  }
}
