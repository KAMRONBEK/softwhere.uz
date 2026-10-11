import { couriersBusy, createCouriers, drawCouriers, launchCouriers, type CourierSpec, type Couriers } from './dustCouriers';
import { clearFrame, drawFrame, gradientColors, type Scene } from './dustDraw';
import {
  applyTargets,
  createAmbient,
  createPool,
  fillTargets,
  release,
  scatter,
  settle,
  slotCounts,
  stepAmbient,
  stepPool,
  type ReleaseMode,
  type StepContext,
} from './dustParticles';
import { ORBITS, type Ambient, type DustPalette, type DustQuality, type Placement, type Pointer, type Pool } from './dustTypes';
import { createGlyphBank, loadFont, type GlyphBank } from './glyphs';
import { BURST_COUNT_DELAY, COUNT_DELAY, countDuration, countEase } from './timing';

export type { CourierSpec } from './dustCouriers';
export type { DustPalette, DustQuality } from './dustTypes';

/**
 * "Numbers from dust": one stage-sized 2D canvas holding a single numeral made
 * of particles. show(i) releases the swarm in a swirl and re-forms it as fact
 * i while the number counts up from zero (every count step re-targets the
 * flight); particles the new value does not need hover around it as a halo.
 * sendCouriers() launches one spark per counted unit from the numeral to its
 * chart dot. The formed numeral breathes for a few seconds, then everything
 * settles and the loop stops until the pointer, a finger, a scroll or the next
 * fact wakes it (wake()).
 *
 * Framework-free: the React section owns the lifecycle.
 */

export interface DustFieldOptions {
  canvas: HTMLCanvasElement;
  /** The numeral's box: values are fitted inside it and aligned by its CSS text-align. */
  figure: HTMLElement;
  values: readonly number[];
  fontFamily: string;
  fontWeight: number;
  palette: DustPalette;
  quality: DustQuality;
  dprMax: number;
  /** Reduced motion / low tier: still frames only, never a loop. */
  isStatic: boolean;
  onReady?: () => void;
}

/** Seconds the formed numeral stays alive after the last count, touch, pointer move or scroll. */
const IDLE_S = 3;
const LIFE_RATE = 0.045;
const MAX_DT = 0.25;
const FADE_S = 1.1;
const FORM_RATE = 0.06;
/** Halo orbit speed per class, rad/s. */
const ORBIT_SPEED = [0.05, 0.11, -0.08];
/** Glint: first sweep this long after a re-form starts, then one every GLINT_EVERY s while awake. */
const GLINT_AT = 1.1;
const GLINT_EVERY = 7;
const GLINT_CROSS = 1.4;
/** Rebuild the pool when the numeral's size changes the particle spacing by more than this. */
const RESTRIDE = 0.2;

type Align = 'left' | 'center' | 'right';

export class DustField {
  private readonly opts: DustFieldOptions;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly colors: string[];
  private readonly resizeObserver: ResizeObserver | null;
  private bank: GlyphBank | null = null;
  private pool: Pool | null = null;
  private ambient: Ambient | null = null;
  private couriers: Couriers | null = null;
  private stride = 0;
  private finalWidths: number[] = [];
  private maxWidth = 1;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private align: Align = 'left';
  private scale = 1;
  private place: Placement = { ox: 0, oy: 0, scale: 1, cx: 0, cy: 0, rx: 1, ry: 1 };
  private raf = 0;
  private lastT = 0;
  private isActive = false;
  private isReady = false;
  private isDestroyed = false;
  private index = -1;
  private display = -1;
  private isCounting = false;
  private countT0 = 0;
  private countDur = 1;
  private t0 = 0;
  private wakeAt = 0;
  private life = 1;
  private form = 0;
  private fade = 0;
  private lastFlying = 0;
  private readonly rot = new Float32Array(ORBITS * 2);
  private readonly pointer: Pointer = { x: 0, y: 0, vx: 0, vy: 0, clientX: 0, clientY: 0, isActive: false, hasPrev: false };

  constructor(opts: DustFieldOptions) {
    this.opts = opts;
    this.ctx = opts.canvas.getContext('2d');
    this.colors = gradientColors(opts.palette);
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.onResize);
    this.resizeObserver?.observe(opts.canvas);
    this.resizeObserver?.observe(opts.figure);
    this.measure();
    void this.prepare();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Run the loop only while the section is on screen. */
  setActive(isActive: boolean): void {
    this.isActive = isActive;
    if (isActive) {
      if (this.opts.isStatic) this.drawStatic();
      else this.wake();
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  /** Form fact `index` (from dust, or morphing out of the current numeral). */
  show(index: number): void {
    if (index === this.index) return;
    const wasDust = this.index < 0;
    this.index = index;
    if (!this.isReady) return;
    this.begin(wasDust ? 'gather' : 'morph', null, null);
  }

  /** Back to free dust (the stage is offscreen): the next show() assembles from scratch. */
  hide(): void {
    if (this.index < 0 || this.opts.isStatic) return;
    this.index = -1;
    this.isCounting = false;
    this.couriers = null;
    if (this.pool) scatter(this.pool, this.width, this.height);
    this.fade = 0;
    this.wake();
  }

  /** Scatter the numeral from a client point (null = its centre), then count it up again. */
  burst(clientX: number | null, clientY: number | null): void {
    if (this.index < 0 || this.opts.isStatic || !this.isReady) return;
    const rect = this.opts.canvas.getBoundingClientRect();
    this.begin('burst', clientX === null ? null : clientX - rect.left, clientY === null ? null : clientY - rect.top);
  }

  /**
   * One spark per counted unit, flying from the numeral to its dot (canvas
   * px, delays from now). Replaces any batch still in flight.
   */
  sendCouriers(specs: readonly CourierSpec[]): void {
    if (this.opts.isStatic || !this.isReady || this.isDestroyed || specs.length === 0) return;
    this.couriers = createCouriers(specs, performance.now() / 1000);
    this.wake();
  }

  setPointer(clientX: number, clientY: number): void {
    this.pointer.clientX = clientX;
    this.pointer.clientY = clientY;
    this.pointer.isActive = true;
    this.wake();
  }

  clearPointer(): void {
    this.pointer.isActive = false;
    this.pointer.hasPrev = false;
    this.wake();
  }

  /** Keep (or bring) the dust alive for another IDLE_S seconds. */
  wake(): void {
    const now = performance.now() / 1000;
    this.wakeAt = now;
    if (this.opts.isStatic || !this.isActive || !this.isReady || this.raf || this.isDestroyed) return;
    this.lastT = now;
    this.raf = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
    this.bank?.dispose();
    if (this.ctx) clearFrame(this.ctx, this.opts.canvas.width, this.opts.canvas.height);
    this.bank = null;
    this.pool = null;
    this.ambient = null;
    this.couriers = null;
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  private async prepare(): Promise<void> {
    const { fontFamily, fontWeight, values, quality } = this.opts;
    await loadFont(fontWeight, fontFamily);
    if (this.isDestroyed || !this.ctx) return;
    const bank = createGlyphBank(fontWeight, fontFamily);
    if (!bank) return;
    this.bank = bank;
    this.finalWidths = values.map(value => bank.layout(String(value)).width);
    this.maxWidth = Math.max(...this.finalWidths);
    this.measure();
    this.fit();
    this.build();
    this.ambient = createAmbient(quality.ambient, this.width, this.height);
    this.isReady = true;
    this.opts.onReady?.();
    if (this.opts.isStatic) {
      this.drawStatic();
      return;
    }
    if (this.index >= 0) this.begin('gather', null, null);
    else this.wake();
  }

  /** Canvas size and the numeral box (both live in the same sticky stage, so the offset is stable). */
  private measure(): void {
    const { canvas, figure, dprMax } = this.opts;
    const canvasRect = canvas.getBoundingClientRect();
    const figureRect = figure.getBoundingClientRect();
    this.width = canvas.clientWidth;
    this.height = canvas.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, dprMax);
    const w = Math.max(1, Math.round(this.width * this.dpr));
    const h = Math.max(1, Math.round(this.height * this.dpr));
    // Assigning the size clears the canvas, even to the same value.
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    this.box = { x: figureRect.left - canvasRect.left, y: figureRect.top - canvasRect.top, w: figureRect.width, h: figureRect.height };
    const textAlign = getComputedStyle(figure).textAlign;
    this.align = textAlign === 'center' ? 'center' : textAlign === 'right' || textAlign === 'end' ? 'right' : 'left';
  }

  /** Band height in px: as tall as the box allows while the widest value still fits. */
  private fit(): void {
    this.scale = Math.max(8, Math.min(this.box.h, this.box.w / this.maxWidth));
  }

  /** Particle pool for the current scale (spacing grows to respect the tier's particle cap). */
  private build(): void {
    const { bank } = this;
    if (!bank) return;
    const { values, quality } = this.opts;
    let stride = quality.spacing / this.scale;
    let counts = slotCounts(bank, values, stride);
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (total > quality.maxParticles) {
      stride *= Math.sqrt(total / quality.maxParticles) * 1.02;
      counts = slotCounts(bank, values, stride);
    }
    this.stride = stride;
    this.pool = createPool(counts, this.width, this.height);
    fillTargets(this.pool, bank, values[Math.max(0, this.index)], stride);
  }

  private onResize = (): void => {
    if (this.isDestroyed) return;
    this.measure();
    if (!this.isReady || !this.bank) return;
    const previous = this.stride * this.scale;
    this.fit();
    if (Math.abs((this.stride * this.scale) / previous - 1) > RESTRIDE) {
      this.build();
      if (this.index >= 0 && this.pool) {
        this.updatePlacement();
        settle(this.pool, this.place);
      }
    }
    this.ambient = createAmbient(this.opts.quality.ambient, this.width, this.height);
    if (this.opts.isStatic) this.drawStatic();
    else this.wake();
  };

  // ── Forming ───────────────────────────────────────────────────────────────

  private begin(mode: ReleaseMode, ox: number | null, oy: number | null): void {
    const { pool, bank } = this;
    if (!pool || !bank || this.index < 0) return;
    if (this.opts.isStatic) {
      this.drawStatic();
      return;
    }
    const t = performance.now() / 1000;
    this.updatePlacement();
    release(pool, t, mode, ox ?? this.place.cx, oy ?? this.place.cy);
    this.display = 0;
    fillTargets(pool, bank, 0, this.stride);
    applyTargets(pool, t);
    const value = this.opts.values[this.index];
    this.t0 = t;
    this.countT0 = t + (mode === 'burst' ? BURST_COUNT_DELAY : COUNT_DELAY);
    this.countDur = countDuration(value);
    this.isCounting = true;
    this.wake();
  }

  /** Steps the count; each new displayed value re-targets the swarm. */
  private count(t: number): void {
    const { pool, bank } = this;
    if (!this.isCounting || !pool || !bank || this.index < 0 || t < this.countT0) return;
    const value = this.opts.values[this.index];
    const p = Math.min(1, (t - this.countT0) / this.countDur);
    const shown = Math.round(value * countEase(p));
    if (shown !== this.display) {
      this.display = shown;
      fillTargets(pool, bank, shown, this.stride);
      applyTargets(pool, t);
    }
    if (p >= 1) {
      this.isCounting = false;
      this.wakeAt = t;
    }
  }

  /**
   * Where the value sits this frame. Alignment uses the fact's final width, so
   * the numeral does not slide while it counts.
   */
  private updatePlacement(): void {
    const S = this.scale;
    const w = (this.index >= 0 ? this.finalWidths[this.index] : this.maxWidth) * S;
    const { x, y, w: bw, h: bh } = this.box;
    const ox = this.align === 'center' ? x + (bw - w) / 2 : this.align === 'right' ? x + bw - w : x;
    const oy = y + (bh - S) / 2;
    const p = this.place;
    p.ox = ox;
    p.oy = oy;
    p.scale = S;
    p.cx = ox + w / 2;
    p.cy = oy + S / 2;
    p.rx = w / 2 + S * 0.22;
    p.ry = S / 2 + S * 0.14;
  }

  // ── Frame ─────────────────────────────────────────────────────────────────

  private scene(): Scene {
    const { palette, quality } = this.opts;
    const spacing = this.stride * this.scale;
    return {
      pool: this.pool as Pool,
      ambient: this.ambient,
      palette,
      hasGlow: quality.hasGlow,
      colors: this.colors,
      width: this.width,
      height: this.height,
      dpr: this.dpr,
      place: this.place,
      dot: Math.min(3.6, Math.max(1, spacing * (palette.isDark ? 0.62 : 0.7))),
      form: this.form,
      fade: this.fade,
    };
  }

  private trackPointer(): void {
    const p = this.pointer;
    if (!p.isActive) return;
    const rect = this.opts.canvas.getBoundingClientRect();
    const x = p.clientX - rect.left;
    const y = p.clientY - rect.top;
    p.vx = p.hasPrev ? p.vx * 0.5 + (x - p.x) * 0.5 : 0;
    p.vy = p.hasPrev ? p.vy * 0.5 + (y - p.y) * 0.5 : 0;
    p.x = x;
    p.y = y;
    p.hasPrev = true;
  }

  private glintAt(t: number): number {
    if (!this.opts.quality.hasGlint || this.index < 0 || !this.opts.palette.isDark) return -9;
    const since = t - this.t0 - GLINT_AT;
    if (since < 0) return -9;
    return (since % GLINT_EVERY) / GLINT_CROSS - 0.1;
  }

  private tick = (ms: number): void => {
    this.raf = 0;
    const { pool, ctx } = this;
    if (this.isDestroyed || !this.isActive || !ctx || !pool) return;
    const t = ms / 1000;
    const dt = Math.min(Math.max(t - this.lastT, 0), MAX_DT);
    // Physics steps are capped (a long frame never teleports particles); the
    // fades run on real time, so a slow device still settles and sleeps on time.
    const f = Math.min(dt, 1 / 30) * 60;
    this.lastT = t;
    this.count(t);
    const { couriers } = this;
    const hasCouriers = couriers !== null && couriersBusy(couriers, t);
    if (couriers && !hasCouriers) this.couriers = null;
    const isAwake = this.isCounting || hasCouriers || this.lastFlying > 0 || this.pointer.isActive || t - this.wakeAt < IDLE_S;
    this.life += ((isAwake ? 1 : 0) - this.life) * Math.min(1, LIFE_RATE * dt * 60);
    this.form += ((this.index >= 0 ? 1 : 0) - this.form) * Math.min(1, FORM_RATE * dt * 60);
    this.fade = Math.min(1, this.fade + dt / FADE_S);
    for (let c = 0; c < ORBITS; c++) {
      const angle = ORBIT_SPEED[c] * (f / 60) * this.life;
      this.rot[c * 2] = Math.cos(angle);
      this.rot[c * 2 + 1] = Math.sin(angle);
    }
    this.trackPointer();
    this.updatePlacement();
    const step: StepContext = {
      t,
      f,
      life: this.life,
      width: this.width,
      height: this.height,
      pointer: this.pointer,
      quality: this.opts.quality,
      radius: Math.min(120, Math.max(60, this.scale * 0.32)),
      place: this.place,
      rot: this.rot,
      glint: this.glintAt(t),
    };
    const ambientMotion = this.ambient ? stepAmbient(this.ambient, step) : 0;
    if (couriers && hasCouriers) launchCouriers(couriers, t, pool, this.place);
    const { flying, motion } = stepPool(pool, step);
    this.lastFlying = flying;
    drawFrame(ctx, this.scene());
    if (couriers && hasCouriers) drawCouriers(ctx, couriers, t, this.opts.palette.courier, this.opts.palette.isDark);
    const isSettled = !isAwake && this.life < 0.02 && flying === 0 && this.fade >= 1 && Math.max(motion, ambientMotion) < 0.02;
    if (!isSettled) this.raf = requestAnimationFrame(this.tick);
  };

  // ── Still frames ──────────────────────────────────────────────────────────

  /** Reduced motion / low tier: the fact's final numeral, the halo at rest, no loop. */
  private drawStatic(): void {
    const { pool, bank, ctx } = this;
    if (!pool || !bank || !ctx || this.isDestroyed) return;
    this.fade = 1;
    this.life = 0;
    this.form = this.index >= 0 ? 1 : 0;
    if (this.index >= 0) {
      fillTargets(pool, bank, this.opts.values[this.index], this.stride);
      this.updatePlacement();
      settle(pool, this.place);
    }
    drawFrame(ctx, this.scene());
  }
}
