import type { TowerLayout } from './layout';
import { StackWorld, type TileSpec } from './world';

/**
 * Binds a StackWorld to the DOM: runs the rAF loop only while something moves
 * and the section is visible, writes each block's pose as a transform (crisp
 * DOM text, no canvas), turns pointer input into drags, taps and cursor
 * flicks, and rebuilds the tower on its own once a heap has rested.
 *
 * Touch never traps the page: blocks keep `touch-action: pan-y`, so a
 * vertical swipe that starts on one still scrolls. A block is only picked up
 * after a short hold or a mostly sideways first move (the X-Ray model). The
 * one non-passive listener (touchmove, to hold the page still while a finger
 * drags a block) sits on the blocks themselves, never on the section: a swipe
 * that starts on the empty floor scrolls without waiting on the main thread.
 */

export type StageState = 'building' | 'tower' | 'falling' | 'resting';
export type ActiveSource = 'hover' | 'tap' | 'grab';

const FLICK_SPEED = 1.1; // px per ms before the cursor becomes solid
const CURSOR_IDLE_MS = 90;
const IMPACT_FLASH_MS = 520;
const MAX_FLASHES_PER_FRAME = 3;
const HOLD_MS = 150;
const TOUCH_SLOP = 8;
// Floor shockwaves and the stage thud
const RIPPLE_MS = 680;
const THUD_SPEED = 6.5; // px per step: only a real fall shakes the stage
const THUD_COOLDOWN_MS = 900;
const THUD_MS = 340;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
// Before anyone touches it, the foundation shifts a little now and then: loose, pull it.
const NUDGE_FIRST_MS = 4200;
const NUDGE_REPEAT_MS = 9000;
const NUDGE_LIMIT = 2;
/** From the last touch to the rebuild (the heap may still be sliding: the rebuild takes it from there). */
export const REBUILD_DELAY_MS = 3400;

export interface BuildTiming {
  /** Farthest a block falls on the entrance (px). */
  maxDrop: number;
  rowDelayMs: number;
  colDelayMs: number;
}

export interface StageOptions {
  root: HTMLElement;
  list: HTMLElement;
  tiles: readonly HTMLElement[];
  faces: readonly HTMLElement[];
  flashes: readonly (HTMLElement | null)[];
  /** Pooled floor shockwaves (each centered on x = 0, moved by transform). */
  ripples: readonly HTMLElement[];
  /** The layer that shakes on a heavy landing (tiles, blueprint and floor; never the copy). */
  shaker: HTMLElement | null;
  layout: TowerLayout;
  /** Floor line in root coordinates. */
  floor: number;
  /** Knocks never throw a block above this line (root coordinates). */
  ceiling: number;
  /** The left wall in root coordinates (wide screens fence the tower into its column). */
  fenceLeft: number;
  /** 'build': blocks drop into the tower now. 'placed': the finished tower, instantly. */
  entrance: 'build' | 'placed';
  timing: BuildTiming;
  seed: number;
  /** Drag, throw, flick and knock. Off under reduced motion (captions still work). */
  isInteractive: boolean;
  /** Cursor flicks and impact flashes. */
  hasFlourish: boolean;
  onActive: (index: number, source: ActiveSource) => void;
  onState: (state: StageState) => void;
  /** The last block of a layer landed on its slot (entrance and rebuilds). */
  onLayerBuilt: (layerIndex: number) => void;
}

interface PendingTouch {
  pointerId: number;
  index: number;
  tile: HTMLElement;
  start: { x: number; y: number };
  last: PointerEvent;
  timer: number;
}

function radiusOf(element: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
  return Number.isFinite(value) ? value : 0;
}

function tileIndexOf(target: EventTarget | null): { tile: HTMLElement; index: number } | null {
  const tile = target instanceof Element ? target.closest<HTMLElement>('[data-tile]') : null;
  if (!tile) return null;
  const index = Number(tile.dataset.tile);
  return Number.isInteger(index) ? { tile, index } : null;
}

export class StackStage {
  private readonly world: StackWorld;
  private readonly options: StageOptions;
  private readonly written: Float64Array;
  private readonly heldTiles = new Map<number, HTMLElement>();
  private pending: PendingTouch | null = null;
  private raf = 0;
  private last = 0;
  private flashesThisFrame = 0;
  private isVisible = false;
  private isDisposed = false;
  private isAutoRebuild = true;
  private rebuildTimer = 0;
  private emitted: StageState | null = null;
  private cursorSample: { x: number; y: number; t: number } | null = null;
  private cursorTimer = 0;
  private rippleCursor = 0;
  private lastThud = -Infinity;
  private nudgeTimer = 0;
  private nudges = 0;
  private hasInteracted = false;
  /** Blocks per layer still in flight in the current build. */
  private layerLeft: number[] = [];

  constructor(options: StageOptions) {
    this.options = options;
    const { layout, tiles, faces } = options;
    const chamfer = faces[0] ? radiusOf(faces[0]) : 0;
    const specs: TileSpec[] = layout.slots.map(slot => ({
      width: slot.width,
      height: slot.height,
      chamfer,
      slot: { x: slot.x, y: slot.y },
    }));
    this.written = new Float64Array(tiles.length * 4).fill(Number.NaN);
    this.world = new StackWorld({
      width: options.root.clientWidth,
      floor: options.floor,
      ceiling: options.ceiling,
      fenceLeft: options.fenceLeft,
      tiles: specs,
      rows: layout.rows,
      seed: options.seed,
    });
    this.world.onLand = this.squash;
    if (options.hasFlourish) {
      this.world.onImpact = this.flash;
      this.world.onFloorImpact = this.floorHit;
    }
    if (options.entrance === 'placed') this.world.placeAll();
    else {
      this.startBatch();
      this.world.build(options.timing.maxDrop, options.timing.rowDelayMs, options.timing.colDelayMs);
    }
    this.render();
    this.emitState();
    this.listen();
  }

  setVisible(isVisible: boolean): void {
    this.isVisible = isVisible;
    if (isVisible) {
      this.wake();
      this.scheduleRebuild();
      if (this.world.state() === 'tower') this.scheduleNudge();
      return;
    }
    this.sleep();
    this.cancelRebuild();
    this.cancelNudge();
    // Scrolled away mid-build: the visitor comes back to a finished tower, not a half one.
    if (this.world.state() === 'building') {
      this.world.finishFlights();
      this.render();
    }
    this.emitState();
  }

  /** Off while the phone's tilt drives gravity: a rebuilt tower would only fall again. */
  setAutoRebuild(isOn: boolean): void {
    this.isAutoRebuild = isOn;
    if (isOn) this.scheduleRebuild();
    else this.cancelRebuild();
    this.emitState();
  }

  knock(): void {
    if (!this.options.isInteractive) return;
    this.markInteracted();
    this.cancelRebuild();
    this.world.knock();
    this.wake();
  }

  rebuild(): void {
    if (!this.options.isInteractive) return;
    this.markInteracted();
    this.cancelRebuild();
    this.startBatch();
    this.world.rebuild();
    this.wake();
  }

  shake(): void {
    if (!this.options.isInteractive) return;
    this.markInteracted();
    this.cancelRebuild();
    this.world.shake();
    this.wake();
  }

  /** Device tilt. The loop only restarts on a real turn (~2°), not on sensor jitter. */
  setGravity(x: number, y: number): void {
    if (!this.world.setGravity(x, y)) return;
    if (Math.abs(x) > 0.05 || Math.abs(y - 1) > 0.05) this.markInteracted();
    this.wake();
  }

  dispose(): void {
    this.isDisposed = true;
    this.sleep();
    this.unlisten();
    this.cancelRebuild();
    this.cancelNudge();
    this.clearPending();
    window.clearTimeout(this.cursorTimer);
    this.heldTiles.forEach(tile => delete tile.dataset.held);
    this.heldTiles.clear();
    this.world.dispose();
  }

  // ---------- loop ----------

  private readonly wake = (): void => {
    if (this.raf || !this.isVisible || this.isDisposed) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  private sleep(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private readonly frame = (now: number): void => {
    this.raf = 0;
    if (!this.isVisible || this.isDisposed) return;
    const isActive = this.world.tick(now - this.last);
    this.last = now;
    this.flashesThisFrame = 0;
    this.render();
    if (isActive) this.raf = requestAnimationFrame(this.frame);
    this.scheduleRebuild();
    this.emitState();
  };

  private render(): void {
    const { tiles, layout } = this.options;
    for (let index = 0; index < tiles.length; index++) {
      const pose = this.world.pose(index);
      if (!pose) continue;
      const slot = layout.slots[index];
      let x = pose.x - slot.width / 2;
      let y = pose.y - slot.height / 2;
      // At rest, whole pixels keep the type crisp.
      if (pose.isResting) {
        x = Math.round(x);
        y = Math.round(y);
      }
      const base = index * 4;
      const written = this.written;
      if (Math.abs(written[base + 3] - pose.alpha) > 0.004 || Number.isNaN(written[base + 3])) {
        written[base + 3] = pose.alpha;
        tiles[index].style.opacity = pose.alpha >= 1 ? '' : pose.alpha.toFixed(3);
      }
      if (
        Math.abs(written[base] - x) < 0.01 &&
        Math.abs(written[base + 1] - y) < 0.01 &&
        Math.abs(written[base + 2] - pose.angle) < 0.0001
      ) {
        continue;
      }
      written[base] = x;
      written[base + 1] = y;
      written[base + 2] = pose.angle;
      tiles[index].style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${pose.angle.toFixed(4)}rad)`;
    }
  }

  private stageState(): StageState {
    const state = this.world.state();
    if (state !== 'free') return state;
    return this.rebuildTimer ? 'resting' : 'falling';
  }

  private emitState(): void {
    const state = this.stageState();
    if (state === this.emitted) return;
    this.emitted = state;
    this.options.onState(state);
    if (state !== 'tower') return;
    // Counted from the moment the tower stands, not from when it started building.
    this.cancelNudge();
    this.scheduleNudge();
  }

  // ---------- idle invitation ----------

  private markInteracted(): void {
    this.hasInteracted = true;
    this.cancelNudge();
  }

  private scheduleNudge(): void {
    const { hasFlourish, isInteractive } = this.options;
    if (this.nudgeTimer || this.hasInteracted || this.nudges >= NUDGE_LIMIT || !hasFlourish || !isInteractive || !this.isVisible) return;
    this.nudgeTimer = window.setTimeout(
      () => {
        this.nudgeTimer = 0;
        if (this.isDisposed || this.hasInteracted || !this.isVisible || this.world.state() !== 'tower') return;
        this.nudges++;
        this.nudge();
        this.scheduleNudge();
      },
      this.nudges === 0 ? NUDGE_FIRST_MS : NUDGE_REPEAT_MS
    );
  }

  private cancelNudge(): void {
    window.clearTimeout(this.nudgeTimer);
    this.nudgeTimer = 0;
  }

  /** The foundation bricks shift in their slots, one after another, like loose blocks. */
  private nudge(): void {
    const row = this.options.layout.rows[0] ?? [];
    row.forEach((index, column) => {
      const face = this.options.faces[index];
      if (!face || typeof face.animate !== 'function') return;
      face.animate(
        [
          { transform: 'none' },
          { transform: 'translateX(5px)', offset: 0.22 },
          { transform: 'translateX(-3px)', offset: 0.5 },
          { transform: 'translateX(1.5px)', offset: 0.74 },
          { transform: 'none' },
        ],
        { duration: 560, delay: column * 90, easing: 'ease-in-out' }
      );
    });
  }

  // ---------- auto rebuild ----------

  private scheduleRebuild(): void {
    if (
      this.rebuildTimer ||
      !this.isAutoRebuild ||
      !this.isVisible ||
      !this.options.isInteractive ||
      this.heldTiles.size > 0 ||
      this.world.state() !== 'free'
    ) {
      return;
    }
    this.rebuildTimer = window.setTimeout(() => {
      this.rebuildTimer = 0;
      if (this.isDisposed) return;
      this.startBatch();
      this.world.rebuild();
      this.wake();
      this.emitState();
    }, REBUILD_DELAY_MS);
    this.emitState();
  }

  private cancelRebuild(): void {
    if (!this.rebuildTimer) return;
    window.clearTimeout(this.rebuildTimer);
    this.rebuildTimer = 0;
  }

  // ---------- feedback ----------

  private startBatch(): void {
    const left: number[] = [];
    this.options.layout.slots.forEach(slot => {
      left[slot.layerIndex] = (left[slot.layerIndex] ?? 0) + 1;
    });
    this.layerLeft = left;
  }

  /** A block landing on its slot: a short squash on its face, and a flash. */
  private readonly squash = (index: number, kind: 'drop' | 'return'): void => {
    const slot = this.options.layout.slots[index];
    if (slot && this.layerLeft[slot.layerIndex] > 0) {
      this.layerLeft[slot.layerIndex]--;
      if (this.layerLeft[slot.layerIndex] === 0) this.options.onLayerBuilt(slot.layerIndex);
    }
    // The foundation meets the floor: a shockwave runs along it.
    if (slot?.row === 0 && this.options.hasFlourish) this.ripple(slot.x, kind === 'drop' ? 5 : 3.5);
    const face = this.options.faces[index];
    if (!face || typeof face.animate !== 'function') return;
    const depth = kind === 'drop' ? 0.075 : 0.045;
    face.animate(
      [
        { transform: `scale(${1 + depth * 0.6}, ${1 - depth})` },
        { transform: `scale(${1 - depth * 0.15}, ${1 + depth * 0.25})`, offset: 0.45 },
        { transform: 'none' },
      ],
      { duration: 300, easing: EASE_OUT }
    );
    if (kind === 'drop') this.flash(index, 9);
  };

  /** A free block hit the floor: a shockwave, and on a real fall, a short thud of the stage. */
  private readonly floorHit = (x: number, strength: number): void => {
    this.ripple(x, strength);
    const shaker = this.options.shaker;
    const now = performance.now();
    if (!shaker || strength < THUD_SPEED || now - this.lastThud < THUD_COOLDOWN_MS || typeof shaker.animate !== 'function') return;
    this.lastThud = now;
    const depth = Math.min(4, 1.2 + strength * 0.22);
    shaker.animate(
      [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: `translate3d(0, ${depth.toFixed(2)}px, 0)`, offset: 0.18 },
        { transform: `translate3d(0, ${(-depth * 0.32).toFixed(2)}px, 0)`, offset: 0.52 },
        { transform: 'translate3d(0, 0, 0)' },
      ],
      { duration: THUD_MS, easing: 'ease-out' }
    );
  };

  private ripple(x: number, strength: number): void {
    const { ripples } = this.options;
    if (ripples.length === 0) return;
    const ring = ripples[this.rippleCursor % ripples.length];
    this.rippleCursor++;
    if (typeof ring.animate !== 'function') return;
    const reach = Math.min(1.9, 0.55 + strength * 0.13);
    const peak = Math.min(1, 0.45 + strength * 0.07);
    ring.animate(
      [
        { transform: `translate3d(${x.toFixed(1)}px, 0, 0) scale(0.12, 0.6)`, opacity: peak },
        { transform: `translate3d(${x.toFixed(1)}px, 0, 0) scale(${reach.toFixed(2)}, 1)`, opacity: 0 },
      ],
      { duration: RIPPLE_MS, easing: EASE_OUT }
    );
  }

  private readonly flash = (index: number, strength: number): void => {
    const target = this.options.flashes[index];
    if (!target || typeof target.animate !== 'function' || this.flashesThisFrame >= MAX_FLASHES_PER_FRAME) return;
    this.flashesThisFrame++;
    const peak = Math.min(1, 0.35 + strength / 30);
    target.animate([{ opacity: peak }, { opacity: 0 }], { duration: IMPACT_FLASH_MS, easing: EASE_OUT });
  };

  // ---------- input ----------

  private listen(): void {
    const { root, list, tiles } = this.options;
    list.addEventListener('pointerover', this.onPointerOver);
    list.addEventListener('pointerdown', this.onPointerDown);
    list.addEventListener('contextmenu', this.onContextMenu);
    root.addEventListener('pointermove', this.onPointerMove);
    root.addEventListener('pointerup', this.onPointerUp);
    root.addEventListener('pointercancel', this.onPointerCancel);
    root.addEventListener('pointerleave', this.onPointerLeave);
    // A touch's events stay with the element it started on, so the blocks are enough.
    tiles.forEach(tile => tile.addEventListener('touchmove', this.onTouchMove, { passive: false }));
  }

  private unlisten(): void {
    const { root, list, tiles } = this.options;
    list.removeEventListener('pointerover', this.onPointerOver);
    list.removeEventListener('pointerdown', this.onPointerDown);
    list.removeEventListener('contextmenu', this.onContextMenu);
    root.removeEventListener('pointermove', this.onPointerMove);
    root.removeEventListener('pointerup', this.onPointerUp);
    root.removeEventListener('pointercancel', this.onPointerCancel);
    root.removeEventListener('pointerleave', this.onPointerLeave);
    tiles.forEach(tile => tile.removeEventListener('touchmove', this.onTouchMove));
  }

  private readonly onPointerOver = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || this.heldTiles.size > 0) return;
    const hit = tileIndexOf(event.target);
    if (hit) this.options.onActive(hit.index, 'hover');
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const hit = tileIndexOf(event.target);
    if (!hit) return;
    this.markInteracted();
    if (event.pointerType === 'touch') {
      this.startPending(event, hit.tile, hit.index);
      return;
    }
    if (event.button !== 0) return;
    this.options.onActive(hit.index, 'grab');
    if (this.options.isInteractive && this.grab(event, hit.tile, hit.index)) event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.heldTiles.has(event.pointerId)) {
      this.world.moveGrab(event.pointerId, this.toStage(event));
      this.wake();
      return;
    }
    const pending = this.pending;
    if (pending && pending.pointerId === event.pointerId) {
      pending.last = event;
      const point = this.toStage(event);
      const dx = point.x - pending.start.x;
      const dy = point.y - pending.start.y;
      if (Math.abs(dx) > TOUCH_SLOP && Math.abs(dx) > Math.abs(dy)) this.promotePending();
      else if (Math.abs(dy) > TOUCH_SLOP) this.clearPending(); // a scroll: the page has it
      return;
    }
    if (event.pointerType === 'mouse' && this.options.hasFlourish && this.options.isInteractive && this.heldTiles.size === 0) {
      this.flick(event);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const pending = this.pending;
    if (pending && pending.pointerId === event.pointerId) {
      this.clearPending();
      this.options.onActive(pending.index, 'tap');
      return;
    }
    this.releasePointer(event);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (this.pending?.pointerId === event.pointerId) this.clearPending();
    this.releasePointer(event);
  };

  private readonly onPointerLeave = (): void => this.parkCursor();

  /** While a finger holds a block, vertical moves drag it instead of scrolling the page. */
  private readonly onTouchMove = (event: TouchEvent): void => {
    if (event.cancelable && this.heldTiles.size > 0) event.preventDefault();
  };

  private readonly onContextMenu = (event: Event): void => {
    if (this.options.isInteractive) event.preventDefault();
  };

  private startPending(event: PointerEvent, tile: HTMLElement, index: number): void {
    this.clearPending();
    if (!this.options.isInteractive) {
      // Captions only: a tap is the whole interaction.
      this.pending = { pointerId: event.pointerId, index, tile, start: this.toStage(event), last: event, timer: 0 };
      return;
    }
    tile.dataset.pressing = 'true';
    this.pending = {
      pointerId: event.pointerId,
      index,
      tile,
      start: this.toStage(event),
      last: event,
      timer: window.setTimeout(() => this.promotePending(), HOLD_MS),
    };
  }

  private promotePending(): void {
    const pending = this.pending;
    if (!pending || !this.options.isInteractive) return;
    this.clearPending();
    this.options.onActive(pending.index, 'grab');
    if (this.grab(pending.last, pending.tile, pending.index)) {
      try {
        navigator.vibrate?.(8);
      } catch {
        // Haptics are a nicety; some browsers refuse without a prior tap.
      }
    }
  }

  private clearPending(): void {
    const pending = this.pending;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    delete pending.tile.dataset.pressing;
    this.pending = null;
  }

  /** Returns true when the pointer grabbed a block. */
  private grab(event: PointerEvent, tile: HTMLElement, index: number): boolean {
    if (!this.world.grab(event.pointerId, index, this.toStage(event))) return false;
    this.cancelRebuild();
    try {
      tile.setPointerCapture(event.pointerId);
    } catch {
      // The pointer may already be gone (a hold that ended on the same frame).
    }
    tile.dataset.held = 'true';
    this.heldTiles.set(event.pointerId, tile);
    this.world.moveCursor(null);
    this.wake();
    this.emitState();
    return true;
  }

  private releasePointer(event: PointerEvent): void {
    const tile = this.heldTiles.get(event.pointerId);
    if (!tile) return;
    this.world.release(event.pointerId);
    this.heldTiles.delete(event.pointerId);
    if (!this.world.isHeld(Number(tile.dataset.tile))) delete tile.dataset.held;
    if (tile.hasPointerCapture(event.pointerId)) tile.releasePointerCapture(event.pointerId);
    this.wake();
  }

  private flick(event: PointerEvent): void {
    const point = this.toStage(event);
    const now = event.timeStamp || performance.now();
    const previous = this.cursorSample;
    this.cursorSample = { ...point, t: now };
    if (!previous) return;
    const elapsed = Math.max(1, now - previous.t);
    const speed = Math.hypot(point.x - previous.x, point.y - previous.y) / elapsed;
    if (speed < FLICK_SPEED) {
      this.world.moveCursor(null);
      return;
    }
    this.cancelRebuild();
    this.markInteracted();
    this.world.moveCursor(point);
    this.wake();
    window.clearTimeout(this.cursorTimer);
    this.cursorTimer = window.setTimeout(() => this.parkCursor(), CURSOR_IDLE_MS);
  }

  private parkCursor(): void {
    this.cursorSample = null;
    this.world.moveCursor(null);
  }

  private toStage(event: PointerEvent): { x: number; y: number } {
    const rect = this.options.root.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}
