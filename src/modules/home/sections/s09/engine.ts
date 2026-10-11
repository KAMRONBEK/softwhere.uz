import { Flip } from 'gsap/Flip';
import { gsap, ScrollTrigger } from '../../global/gsap';
import { computeLayout, measureMetrics, wrapCentered, type WallLayout, type WallMetrics } from './layout';
import {
  clamp,
  focusPick,
  introTweens,
  neighborIndex,
  redealTweens,
  rubberBand,
  scrollDrift,
  snapCorrection,
  tiltToward,
  type Point,
  type WallDirection,
} from './wallMotion';

export type { WallDirection } from './wallMotion';
import { Disposables } from './disposables';
import * as T from './engineConfig';
import { isCaptionVeiled, isOffscreen, measureVeil, tileTransform, type VeilLines } from './tileFrame';
import type { DragState, WallEngineOptions } from './engineConfig';

export type { WallEngineOptions } from './engineConfig';

/**
 * The Work Wall's motion engine: one gsap.ticker loop that writes a
 * translate/scale/skew transform per visible tile (transform only, culled
 * offscreen), and sleeps whenever the wall is at rest.
 *
 * Pan model: input moves a target; the wall eases toward it exponentially.
 * While dragging the ease is tight (1:1 feel); on release the target is
 * thrown by velocity / RELEASE_RATE, so the glide starts at the finger's
 * speed and decays smoothly. Page scroll through the section adds a diagonal
 * drift on top (rows at their own depth), so the wall keeps travelling while
 * the stage is pinned. While it moves fast it lifts: zooms out a touch, leans
 * with its speed and bows into a shallow dome, then lands flat (2D again).
 * Reduced motion: no easing, no throw, no drift, no lift.
 */

export class WallEngine extends Disposables {
  private readonly o: WallEngineOptions;
  private metrics: WallMetrics;
  private veil: VeilLines;
  private layout: WallLayout;
  private visible: number[];
  private readonly hasParallax: boolean;
  private readonly hasEffects: boolean;

  private pan: Point = { x: 0, y: 0 };
  private target: Point = { x: 0, y: 0 };
  private scrollPan: Point = { x: 0, y: 0 };
  private prevTotal: Point = { x: 0, y: 0 };
  private vel: Point = { x: 0, y: 0 };
  private zoom = 1;
  private skew = 0;
  private rate = T.RELEASE_RATE;
  private scrollPx = 0;
  private scrollRange = 0;
  private lastTime = 0;
  private restSince = 0;
  private settledSince = 0;
  private suppressClickUntil = 0;
  private drag: DragState | null = null;
  private isPaused = false;
  private isInView = false;
  private isTicking = false;
  private hasIntroPlayed = false;
  /** Mouse only: hovering picks the playing tile; otherwise the tile at the focus point plays. */
  private isHoverMode = false;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private layerTimer: ReturnType<typeof setTimeout> | null = null;
  private activeIndex: number | null = null;
  /** Never culled: the keyboard tab stop must stay focusable (visibility: hidden is not). */
  private pinnedIndex: number | null = null;

  private cullMargin = T.CULL_MARGIN;
  private flip: gsap.core.Timeline | null = null;
  private tiltedCard: HTMLElement | null = null;
  private readonly transforms: string[] = [];
  private readonly culled: boolean[] = [];
  private readonly posX: number[] = [];
  private readonly posY: number[] = [];
  private readonly hasStill: boolean[] = [];
  private readonly veiled: boolean[] = [];

  constructor(options: WallEngineOptions) {
    super();
    this.o = options;
    this.visible = [...options.indices];
    this.hasParallax = !options.reducedMotion;
    this.hasEffects = !options.reducedMotion && options.tier !== 'low';
    const measured = this.measure();
    this.metrics = measured.metrics;
    this.veil = measured.veil;
    this.layout = this.computeLayout();
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    const { stage } = this.o;
    this.applyLayoutStyles();
    this.syncHidden();
    this.goHome(false);
    if (!this.o.reducedMotion) {
      this.visible.forEach(i => this.o.flippers[i] && gsap.set(this.o.flippers[i], { opacity: 0 }));
    }
    this.render(true);
    stage.dataset.ready = 'true';

    this.listen(stage, 'pointerdown', this.onPointerDown);
    this.listen(stage, 'pointermove', this.onPointerMove);
    this.listen(stage, 'pointerup', this.onPointerUp);
    this.listen(stage, 'pointercancel', this.onPointerUp);
    this.listen(stage, 'pointerleave', this.onPointerLeave);
    this.listen(stage, 'click', this.onClickCapture, { capture: true });
    this.listen(stage, 'wheel', this.onWheel, { passive: false });
    this.listen(stage, 'dragstart', (event: Event) => event.preventDefault());

    // Header/footer too: their size (fonts, wrapping) sets the focus band.
    const resize = new ResizeObserver(() => this.relayout(false));
    [stage, this.o.header, this.o.footer].forEach(el => el && resize.observe(el));
    this.cleanups.push(() => resize.disconnect());

    const visibility = new IntersectionObserver(
      ([entry]) => {
        this.isInView = entry.isIntersecting;
        if (this.isInView && entry.intersectionRatio >= T.INTRO_RATIO) this.playIntro();
        if (this.isInView) this.wake();
        else this.setTicking(false);
      },
      { threshold: [0, T.INTRO_RATIO] }
    );
    visibility.observe(stage);
    this.cleanups.push(() => visibility.disconnect());

    const { track } = this.o;
    if (!this.o.reducedMotion && track) {
      const trigger = ScrollTrigger.create({
        trigger: track,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: self => this.onScroll(self.scroll() - self.start, self.end - self.start),
        onRefresh: self => this.onScroll(self.scroll() - self.start, self.end - self.start),
      });
      this.onScroll(trigger.scroll() - trigger.start, trigger.end - trigger.start);
      this.cleanups.push(() => trigger.kill());
    }
  }

  destroy(): void {
    this.setTicking(false);
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    if (this.layerTimer) clearTimeout(this.layerTimer);
    this.disposeAll();
    this.o.flippers.forEach(el => el && gsap.killTweensOf(el));
    const { stage } = this.o;
    ['data-has-active', 'data-dragging', 'data-ready', 'data-moving'].forEach(name => stage.removeAttribute(name));
  }

  // ── public API ───────────────────────────────────────────────────────────

  /** Lightbox open: stop input and hover video. */
  setPaused(isPaused: boolean): void {
    this.isPaused = isPaused;
    if (isPaused) {
      this.drag = null;
      this.setActive(null);
    }
    this.settledSince = 0;
    this.wake();
  }

  /** Style flip (mats change the tile size): re-measure and re-lay without moving the wall. */
  refresh(): void {
    this.relayout(true);
  }

  /** Re-lays the wall for a new filter and Flips tiles to their new slots. */
  setIndices(indices: readonly number[]): void {
    const before = new Set(this.visible);
    const after = new Set(indices);
    const staying = indices.filter(i => before.has(i));
    const leaving = this.visible.filter(i => !after.has(i));
    const entering = indices.filter(i => !before.has(i));
    const flippers = this.o.flippers;
    const canAnimate = !this.o.reducedMotion && this.isInView && this.hasIntroPlayed;

    const state = canAnimate ? Flip.getState(staying.map(i => flippers[i]).filter(Boolean) as HTMLElement[]) : null;
    // A re-filter mid-flight: the state above caught the tiles where they are;
    // finish the old Flip so the new one measures clean end positions.
    this.flip?.progress(1).kill();
    this.flip = null;

    this.visible = [...indices];
    this.layout = this.computeLayout();
    this.updateScrollPan();
    this.goHome();
    this.vel = { x: 0, y: 0 };
    this.skew = 0;
    this.zoom = 1;
    this.setActive(null);
    this.applyLayoutStyles();

    entering.forEach(i => {
      const slot = this.o.slots[i];
      if (slot) slot.hidden = false;
    });
    this.render(true);
    this.wake();

    if (!canAnimate || !state) {
      leaving.forEach(i => {
        const slot = this.o.slots[i];
        if (slot) slot.hidden = true;
      });
      indices.forEach(i => flippers[i] && gsap.set(flippers[i], { clearProps: 'opacity,transform' }));
      return;
    }

    const elements = (list: readonly number[]) => list.flatMap(i => (flippers[i] ? [flippers[i] as HTMLElement] : []));
    const redeal = redealTweens({
      state,
      leaving: elements(leaving),
      entering: elements(entering),
      onLeft: el => {
        const i = flippers.indexOf(el);
        const slot = this.o.slots[i];
        if (slot && !this.visible.includes(i)) slot.hidden = true;
      },
    });
    this.flip = this.track(redeal.flip);
    redeal.tweens.forEach(tween => this.track(tween));
  }

  /** Glides the wall so the tile sits on the focus point. */
  centerOn(index: number): void {
    const spec = this.layout.slots.get(index);
    if (!spec || this.posX[index] === undefined) return;
    const row = this.layout.rows[spec.row];
    const dx = this.posX[index] - this.metrics.vw / 2;
    const dy = this.posY[index] - this.metrics.focusY;
    this.target.x = this.pan.x - dx / this.zoom / row.parallax;
    if (this.layout.wrapY || this.layout.rangeY > 0) this.target.y = this.pan.y - dy / this.zoom;
    if (!this.layout.wrapX) this.target.x = clamp(this.target.x, -this.layout.rangeX, this.layout.rangeX);
    if (!this.layout.wrapY) this.target.y = clamp(this.target.y, -this.layout.rangeY, this.layout.rangeY);
    this.rate = T.KEY_RATE;
    this.wake();
  }

  /** The spatial neighbour of a tile, for arrow-key navigation (wraps). */
  neighbor(index: number, direction: WallDirection): number {
    return neighborIndex(this.layout, this.visible, i => this.posX[i] ?? 0, index, direction);
  }

  /** Screen rect of a tile's media while it is on screen, else null. */
  mediaRect(index: number): DOMRect | null {
    if (this.culled[index] || !this.visible.includes(index)) return null;
    const media = this.o.flippers[index]?.querySelector<HTMLElement>('[data-media]');
    const rect = media?.getBoundingClientRect();
    if (!rect) return null;
    const isOnScreen = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    return isOnScreen ? rect : null;
  }

  setPinned(index: number | null): void {
    this.pinnedIndex = index;
    if (index !== null && this.culled[index]) this.render(true);
  }

  setActive(index: number | null): void {
    if (this.activeIndex === index) return;
    this.activeIndex = index;
    this.resetTilt();
    this.o.stage.toggleAttribute('data-has-active', index !== null);
    this.o.onActiveChange(index);
  }

  // ── layout ───────────────────────────────────────────────────────────────

  private measure(): { metrics: WallMetrics; veil: VeilLines } {
    const { stage, header, footer, foldTitle, scrim } = this.o;
    const rect = stage.getBoundingClientRect();
    let headerBottom = header ? header.getBoundingClientRect().bottom - rect.top : 0;
    let foldedTitleBottom: number | null = null;
    if (foldTitle && !this.o.reducedMotion) {
      // The fold scales from the title's top-left corner, so its top is stable; layout height is unscaled.
      const top = foldTitle.el.getBoundingClientRect().top - rect.top;
      foldedTitleBottom = top + foldTitle.el.offsetHeight * foldTitle.scale;
      headerBottom = Math.min(headerBottom, foldedTitleBottom + T.FOLDED_TITLE_GAP);
    }
    const footerTop = footer ? footer.getBoundingClientRect().top - rect.top : rect.height;
    const mat = parseFloat(getComputedStyle(stage).getPropertyValue('--mat')) || 0;
    return {
      metrics: measureMetrics(rect.width, rect.height, headerBottom, footerTop, mat),
      veil: measureVeil({ stage: rect, scrim: scrim?.getBoundingClientRect() ?? null, foldedTitleBottom, footerTop }),
    };
  }

  private widthOf = (index: number): number => this.metrics.mediaH * (this.o.aspects[index] ?? 1) + 2 * this.metrics.mat;

  private computeLayout(): WallLayout {
    const hasDrift = !this.o.reducedMotion && this.o.track !== null;
    return computeLayout(this.visible, this.widthOf, this.metrics, this.hasParallax, hasDrift);
  }

  private relayout(force: boolean): void {
    const { metrics: next, veil } = this.measure();
    // A stage that is not laid out (detached mid-unmount after a jump) measures 0×0, which has no
    // valid row count: keep the current layout until the ResizeObserver reports a real size again.
    if (next.vw < 1 || next.vh < 1) return;
    const prev = this.metrics;
    // Veils follow the header and footer even when the tiles stay put.
    this.veil = veil;
    this.wake();
    const isSame =
      Math.abs(next.vw - prev.vw) < 2 &&
      Math.abs(next.vh - prev.vh) < 2 &&
      Math.abs(next.focusY - prev.focusY) < 2 &&
      next.mat === prev.mat;
    if (isSame && !force) return;
    this.metrics = next;
    this.layout = this.computeLayout();
    this.updateScrollPan();
    this.goHome();
    this.applyLayoutStyles();
    this.render(true);
    this.wake();
  }

  /**
   * Pan that puts the strongest project of the current set on the focus point:
   * when the stage locks in place (no drift yet), or right now (`isNow`, after
   * a filter or a resize mid-scroll).
   */
  private homePan(isNow: boolean): Point {
    const first = this.visible[0];
    const spec = first === undefined ? undefined : this.layout.slots.get(first);
    if (!spec) return { x: 0, y: 0 };
    const row = this.layout.rows[spec.row];
    const focusOffset = this.metrics.focusY - this.metrics.vh / 2;
    const drift = isNow ? this.scrollPan : { x: 0, y: 0 };
    return {
      x: this.layout.wrapX ? -spec.x / row.parallax - drift.x : 0,
      y: this.layout.wrapY ? focusOffset - row.y - drift.y : 0,
    };
  }

  private goHome(isNow = true): void {
    const home = this.homePan(isNow);
    this.pan = { ...home };
    this.target = { ...home };
    this.prevTotal = { x: home.x + this.scrollPan.x, y: home.y + this.scrollPan.y };
  }

  /**
   * Touch release: nudge the throw so the wall comes to rest with a tile
   * exactly on the focus point (that tile then plays). Positions are linear
   * in the pan, so the resting layout can be predicted from the target.
   */
  private snapTarget(): void {
    const total = { x: this.target.x + this.scrollPan.x, y: this.target.y + this.scrollPan.y };
    const correction = snapCorrection(this.layout, this.metrics, this.visible, total);
    this.target.x -= correction.x;
    this.target.y -= correction.y;
  }

  private applyLayoutStyles(): void {
    const { stage, slots } = this.o;
    const { mediaH, captionH } = this.metrics;
    stage.style.setProperty('--media-h', `${mediaH}px`);
    stage.style.setProperty('--caption-h', `${captionH}px`);
    this.visible.forEach(i => {
      const slot = slots[i];
      const spec = this.layout.slots.get(i);
      if (!slot || !spec) return;
      const row = this.layout.rows[spec.row];
      slot.style.zIndex = String(row.z);
      slot.style.setProperty('--depth-dim', row.dim.toFixed(3));
    });
  }

  private syncHidden(): void {
    const visible = new Set(this.visible);
    this.o.slots.forEach((slot, i) => {
      if (slot) slot.hidden = !visible.has(i);
    });
  }

  // ── scroll drift ─────────────────────────────────────────────────────────

  /**
   * `px` is the page scroll since the track's top met the viewport bottom.
   * The drift is zero when the track's top reaches the viewport top (the
   * stage locks in place), so the strongest project is centered right then.
   */
  private onScroll(px: number, range: number): void {
    const clamped = clamp(px, 0, Math.max(0, range));
    this.scrollRange = range;
    if (Math.abs(clamped - this.scrollPx) < 0.01) return;
    this.scrollPx = clamped;
    this.updateScrollPan();
    // Scrolling moves the tiles under a still mouse: the focus point picks the tile again.
    this.isHoverMode = false;
    this.wake();
  }

  private updateScrollPan(): void {
    if (this.o.reducedMotion || !this.o.track) return;
    this.scrollPan = scrollDrift(this.layout, this.scrollPx - this.metrics.vh, this.scrollRange - 2 * this.metrics.vh);
  }

  // ── intro ────────────────────────────────────────────────────────────────

  private playIntro(): void {
    if (this.hasIntroPlayed) return;
    this.hasIntroPlayed = true;
    this.o.onIntro?.();
    const flippers = this.o.flippers;
    if (this.o.reducedMotion) return;

    const { vw, focusY } = this.metrics;
    // Start the wall shifted right, then let it glide home: the rows settle
    // at their own speeds, which shows the depth before anyone touches it.
    // The whole wall swings up from a tilted plane while the tiles land; no
    // culling meanwhile, since the tilted plane shows more than the viewport.
    const plane = this.o.stage.querySelector<HTMLElement>('[data-wall-plane]');
    if (plane && this.hasEffects) {
      this.cullMargin = Math.max(vw, this.metrics.vh);
      this.track(
        gsap.delayedCall(T.INTRO_MS / 1000, () => {
          this.cullMargin = T.CULL_MARGIN;
          this.wake();
        })
      );
    }
    if (this.layout.wrapX) {
      const offset = vw * 0.6;
      this.pan.x += offset;
      this.prevTotal.x += offset;
      this.rate = T.INTRO_RATE;
      this.render(true);
    }
    const tiles = this.visible.flatMap(i => {
      const el = flippers[i];
      if (!el) return [];
      if (this.culled[i]) {
        gsap.set(el, { opacity: 1 });
        return [];
      }
      return [{ el, distance: Math.hypot((this.posX[i] ?? 0) - vw / 2, (this.posY[i] ?? 0) - focusY) }];
    });
    introTweens({ plane, tiles, hasEffects: this.hasEffects, seconds: T.INTRO_MS / 1000 }).forEach(tween => this.track(tween));
    this.wake();
  }

  // ── input ────────────────────────────────────────────────────────────────

  private onPointerDown(event: PointerEvent): void {
    if (this.isPaused || this.drag) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.drag = {
      id: event.pointerId,
      type: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    };
    // Catch the wall mid-glide, like a hand stopping a spinning globe.
    this.target = { ...this.pan };
    this.wake();
  }

  private onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) {
      if (event.pointerType === 'mouse' && !this.isPaused && (event.movementX !== 0 || event.movementY !== 0)) {
        this.isHoverMode = true;
        this.hoverAt(event.target);
        this.tiltTowards(event.clientX, event.clientY);
      }
      return;
    }
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;

    if (!drag.moved) {
      const tx = event.clientX - drag.startX;
      const ty = event.clientY - drag.startY;
      if (Math.hypot(tx, ty) < T.DRAG_THRESHOLD) return;
      // Touch: a vertical gesture belongs to the page (touch-action: pan-y).
      if (drag.type !== 'mouse' && Math.abs(ty) > Math.abs(tx)) {
        this.drag = null;
        return;
      }
      drag.moved = true;
      if (this.hoverTimer) clearTimeout(this.hoverTimer);
      this.o.stage.dataset.dragging = 'true';
      try {
        this.o.stage.setPointerCapture(event.pointerId);
      } catch {
        // Capture can fail if the pointer is already gone; the drag still works.
      }
      if (drag.type === 'mouse') this.setActive(null);
    }

    this.target.x += rubberBand(dx, this.target.x + this.scrollPan.x, this.layout.wrapX, this.layout.rangeX);
    this.target.y += rubberBand(dy, this.target.y + this.scrollPan.y, this.layout.wrapY, this.layout.rangeY);
    drag.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
    while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > T.VELOCITY_WINDOW_MS) drag.samples.shift();
    this.wake();
  }

  private onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    this.drag = null;
    delete this.o.stage.dataset.dragging;
    if (this.o.stage.hasPointerCapture(event.pointerId)) this.o.stage.releasePointerCapture(event.pointerId);
    if (!drag.moved) return;

    // After a throw the tile that lands on the focus point plays, until the mouse moves again.
    this.isHoverMode = false;
    this.settledSince = 0;
    this.suppressClickUntil = performance.now() + 80;
    this.rate = T.RELEASE_RATE;
    this.wake();
    if (event.type !== 'pointerup' || this.o.reducedMotion) return;
    const first = drag.samples[0];
    const last = drag.samples[drag.samples.length - 1];
    if (event.timeStamp - last.t > T.STALE_RELEASE_MS) {
      this.snapTarget();
      return;
    }
    const dt = Math.max(16, last.t - first.t);
    const vx = ((last.x - first.x) / dt) * 1000;
    const vy = ((last.y - first.y) / dt) * 1000;
    this.target.x += clamp(vx / T.RELEASE_RATE, -T.MAX_THROW, T.MAX_THROW);
    if (this.layout.wrapY || this.layout.rangeY > 0) this.target.y += clamp(vy / T.RELEASE_RATE, -T.MAX_THROW, T.MAX_THROW);
    this.snapTarget();
  }

  private onPointerLeave(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.drag) return;
    this.isHoverMode = false;
    this.settledSince = 0;
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.wake();
  }

  private onClickCapture(event: MouseEvent): void {
    if (performance.now() < this.suppressClickUntil) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  private onWheel(event: WheelEvent): void {
    if (this.isPaused) return;
    let dx = event.deltaX;
    if (event.shiftKey && Math.abs(dx) < 1) dx = event.deltaY;
    // Vertical wheel scrolls the page (and drifts the wall); only horizontal intent pans it.
    if (Math.abs(dx) <= Math.abs(event.deltaY) && !event.shiftKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : 1;
    this.target.x -= rubberBand(dx * unit, this.target.x + this.scrollPan.x, this.layout.wrapX, this.layout.rangeX);
    this.rate = T.WHEEL_RATE;
    this.isHoverMode = false;
    this.wake();
  }

  private hoverAt(target: EventTarget | null): void {
    if (this.drag?.moved) return;
    const card = target instanceof Element ? target.closest<HTMLElement>('[data-wall-index]') : null;
    // Gaps between tiles keep the current tile playing (no flicker while crossing).
    if (!card) return;
    this.scheduleHover(Number(card.dataset.wallIndex));
  }

  private scheduleHover(index: number | null): void {
    if (this.o.isTouch || this.o.tier === 'low') return;
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    if (index === this.activeIndex) return;
    // A short dwell, so sweeping across the wall does not start ten videos.
    this.hoverTimer = setTimeout(() => {
      if (!this.drag?.moved && !this.isPaused && this.isHoverMode) this.setActive(index);
    }, 110);
  }

  /** The hovered tile leans toward the pointer (CSS transition smooths it). */
  private tiltTowards(x: number, y: number): void {
    if (!this.hasEffects || this.activeIndex === null || this.drag?.moved) return;
    const card = this.o.flippers[this.activeIndex]?.firstElementChild;
    if (!(card instanceof HTMLElement)) return;
    const tilt = tiltToward(card.getBoundingClientRect(), x, y, T.TILT_MAX_DEG);
    card.style.setProperty('--tilt-x', `${tilt.x.toFixed(2)}deg`);
    card.style.setProperty('--tilt-y', `${tilt.y.toFixed(2)}deg`);
    this.tiltedCard = card;
  }

  private resetTilt(): void {
    if (!this.tiltedCard) return;
    this.tiltedCard.style.removeProperty('--tilt-x');
    this.tiltedCard.style.removeProperty('--tilt-y');
    this.tiltedCard = null;
  }

  // ── frame loop ───────────────────────────────────────────────────────────

  /** Something moved (or may move): tick, and promote the tiles to layers while it lasts. */
  private wake(): void {
    this.restSince = 0;
    this.setTicking(true);
  }

  private setTicking(isOn: boolean): void {
    const shouldTick = isOn && this.isInView;
    if (shouldTick) {
      if (this.layerTimer) clearTimeout(this.layerTimer);
      this.layerTimer = null;
      this.o.stage.dataset.moving = 'true';
    }
    if (shouldTick === this.isTicking) return;
    this.isTicking = shouldTick;
    if (shouldTick) {
      this.lastTime = performance.now();
      gsap.ticker.add(this.tick);
      return;
    }
    gsap.ticker.remove(this.tick);
    // Drop the layers a moment after the wall stops: crisp text, no idle GPU memory.
    if (this.layerTimer) clearTimeout(this.layerTimer);
    this.layerTimer = setTimeout(() => {
      this.layerTimer = null;
      if (!this.isTicking) delete this.o.stage.dataset.moving;
    }, T.LAYER_LINGER_MS);
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 20);
    this.lastTime = now;
    if (dt <= 0) return;
    const { layout } = this;

    if (!this.drag) {
      // Non-wrapping axes: keep the pan and the scroll walk together inside the range.
      if (!layout.wrapX) this.target.x = clamp(this.target.x, -layout.rangeX - this.scrollPan.x, layout.rangeX - this.scrollPan.x);
      if (!layout.wrapY) this.target.y = clamp(this.target.y, -layout.rangeY - this.scrollPan.y, layout.rangeY - this.scrollPan.y);
    }

    const rate = this.drag ? T.DRAG_RATE : this.rate;
    const k = this.o.reducedMotion ? 1 : 1 - Math.exp(-rate * dt);
    this.pan.x += (this.target.x - this.pan.x) * k;
    this.pan.y += (this.target.y - this.pan.y) * k;

    // Velocity of everything that moves the wall, drag and scroll drift alike.
    const totalX = this.pan.x + this.scrollPan.x;
    const totalY = this.pan.y + this.scrollPan.y;
    const isJump = Math.hypot(totalX - this.prevTotal.x, totalY - this.prevTotal.y) > T.JUMP_PX;
    const blend = 1 - Math.exp(-14 * dt);
    if (!isJump) {
      this.vel.x += ((totalX - this.prevTotal.x) / dt - this.vel.x) * blend;
      this.vel.y += ((totalY - this.prevTotal.y) / dt - this.vel.y) * blend;
    }
    this.prevTotal = { x: totalX, y: totalY };
    if (Math.hypot(this.vel.x, this.vel.y) < 0.5) this.vel = { x: 0, y: 0 };
    const speed = Math.hypot(this.vel.x, this.vel.y);

    if (this.hasEffects) {
      const lift = this.drag?.moved ? T.DRAG_LIFT : 0;
      const zoomTarget = 1 - Math.min(speed * T.ZOOM_PER_SPEED + lift, T.ZOOM_MAX_DROP);
      const skewTarget = clamp(this.vel.x * T.SKEW_PER_SPEED, -T.SKEW_MAX, T.SKEW_MAX);
      const ease = 1 - Math.exp(-7 * dt);
      this.zoom += (zoomTarget - this.zoom) * ease;
      this.skew += (skewTarget - this.skew) * ease;
      // Land exactly, or the wall would never count as resting.
      if (!this.drag && speed < 1) {
        if (Math.abs(this.zoom - 1) < 0.0005) this.zoom = 1;
        if (Math.abs(this.skew) < 0.02) this.skew = 0;
      }
    }

    this.render(false);
    this.updateFocusActive(now, speed);
    this.sleepIfResting(now, speed);
  };

  private sleepIfResting(now: number, speed: number): void {
    const isResting =
      !this.drag &&
      Math.abs(this.target.x - this.pan.x) < 0.05 &&
      Math.abs(this.target.y - this.pan.y) < 0.05 &&
      speed < 1 &&
      this.zoom === 1 &&
      this.skew === 0 &&
      this.cullMargin === T.CULL_MARGIN;
    if (!isResting) {
      this.restSince = 0;
      return;
    }
    if (this.restSince === 0) this.restSince = now;
    // Stay awake long enough for the focus tile to be picked, then stop writing frames.
    if (now - this.restSince > T.SETTLE_MS + 60) this.setTicking(false);
  }

  private render(force: boolean): void {
    const { layout, metrics } = this;
    const { slots } = this.o;
    const halfW = metrics.vw / 2;
    const halfH = metrics.vh / 2;
    const zoom = this.zoom;
    const panX = this.pan.x + this.scrollPan.x;
    const panY = this.pan.y + this.scrollPan.y;
    const { cardH, captionH } = metrics;
    // The dome follows the lift: flat at rest, bowed while dragged, flung or scrolled fast.
    const bend = this.hasEffects ? clamp((1 - zoom) / T.ZOOM_MAX_DROP, 0, 1) : 0;
    const fold = this.o.getFold?.() ?? 0;

    for (const i of this.visible) {
      const slot = slots[i];
      const spec = layout.slots.get(i);
      if (!slot || !spec) continue;
      const row = layout.rows[spec.row];
      let x = spec.x + panX * row.parallax;
      if (layout.wrapX) x = wrapCentered(x, row.width);
      let y = row.y + panY;
      if (layout.wrapY) y = wrapCentered(y, layout.height);

      const cx = halfW + x * zoom;
      const cy = halfH + y * zoom;
      this.posX[i] = cx;
      this.posY[i] = cy;
      const scale = row.scale * zoom;
      const halfTileW = (spec.w * scale) / 2;
      const halfTileH = (cardH * scale) / 2;
      const isCulled = i !== this.pinnedIndex && isOffscreen(cx, cy, halfTileW, halfTileH, metrics, this.cullMargin);

      if (force || this.culled[i] !== isCulled) {
        slot.style.visibility = isCulled ? 'hidden' : '';
        this.culled[i] = isCulled;
        if (!isCulled) this.loadStill(i);
      }
      if (isCulled && !force) continue;
      const isVeiled =
        !isCulled &&
        isCaptionVeiled(this.veil, fold, { left: cx - halfTileW, top: cy + halfTileH - captionH * scale, bottom: cy + halfTileH });
      if (force || this.veiled[i] !== isVeiled) {
        slot.toggleAttribute('data-veil', isVeiled);
        this.veiled[i] = isVeiled;
      }
      // 2D at rest on purpose: layers come from will-change while moving, not from a resting 3D transform.
      const transform = tileTransform({
        left: cx - spec.w / 2,
        top: cy - cardH / 2,
        scale,
        skew: this.skew * row.parallax,
        bend,
        nx: clamp((cx - halfW) / halfW, -1.3, 1.3),
        ny: clamp((cy - halfH) / halfH, -1.3, 1.3),
      });
      if (force || this.transforms[i] !== transform) {
        slot.style.transform = transform;
        this.transforms[i] = transform;
      }
    }
  }

  /** Stills load the first time their tile comes near the screen (transforms defeat loading='lazy'). */
  private loadStill(index: number): void {
    if (this.hasStill[index]) return;
    const img = this.o.slots[index]?.querySelector<HTMLImageElement>('img[data-src]');
    if (!img?.dataset.src) return;
    img.src = img.dataset.src;
    this.hasStill[index] = true;
  }

  /**
   * No hover (touch, or a mouse that is scrolling or has left the wall):
   * when the wall comes to rest, the tile nearest the focus point plays.
   */
  private updateFocusActive(now: number, speed: number): void {
    if (this.o.tier === 'low' || this.isPaused || !this.hasIntroPlayed) return;
    if (!this.o.isTouch && this.isHoverMode) return;
    if (this.drag || speed > T.SETTLE_SPEED) {
      this.settledSince = 0;
      return;
    }
    if (this.settledSince === 0) this.settledSince = now;
    if (now - this.settledSince < T.SETTLE_MS) return;

    const onScreen = this.visible.filter(i => !this.culled[i]);
    const next = focusPick(onScreen, this.activeIndex, this.metrics, i => [this.posX[i] ?? 1e9, this.posY[i] ?? 1e9]);
    if (next !== this.activeIndex) this.setActive(next);
  }
}
