import type { LabTheme } from '../theme/useLabTheme';
import type { DeviceTier } from '../types';
import { clamp, measureTarget, resolveHit, type CursorIcon, type Hit, type Magnetic, type Mode } from './CursorLayer.hit';
import { nativeCursorCss, nativeDotCursor } from './CursorLayer.native';
import { createTrail, TRAIL_BY_TIER, trailPaint, type Trail, type TrailPaint } from './CursorLayer.trail';
import { gsap } from './gsap';

/**
 * The cursor engine behind CursorLayer.tsx: hit testing → per-mode goals →
 * springs → transforms. One loop on the GSAP ticker that sleeps whenever
 * everything has settled; transforms and opacity only.
 *
 * The precise point is the hardware cursor (a themed dot, see
 * CursorLayer.native.ts), so it never freezes when the main thread stalls.
 * Where the layer draws a cursor of its own — brackets framing a link or
 * button, a labelled badge, a text caret — the CSS hides the hardware dot.
 */

/* ── Springs ─────────────────────────────────────────────────────────────── */

interface Spring {
  x: number;
  v: number;
}

interface SpringConfig {
  k: number;
  c: number;
}

/** Stiffness + damping ratio → semi-implicit Euler spring constants. */
const springConfig = (k: number, zeta: number): SpringConfig => ({ k, c: 2 * zeta * Math.sqrt(k) });
const springAt = (x: number): Spring => ({ x, v: 0 });

function stepSpring(spring: Spring, target: number, config: SpringConfig, dt: number): void {
  spring.v += (config.k * (target - spring.x) - config.c * spring.v) * dt;
  spring.x += spring.v * dt;
}

const isAtRest = (spring: Spring, target: number, epsilon: number) =>
  Math.abs(target - spring.x) < epsilon && Math.abs(spring.v) < epsilon * 10;

/** Corner order TL, TR, BR, BL: side of the box, rotation of the bracket, and stiffness (the jelly). */
const CORNERS = [
  { sx: -1, sy: -1, rotate: 0, stiffness: 1 },
  { sx: 1, sy: -1, rotate: 90, stiffness: 0.93 },
  { sx: 1, sy: 1, rotate: 180, stiffness: 0.86 },
  { sx: -1, sy: 1, rotate: 270, stiffness: 0.94 },
] as const;

const FOLLOW = springConfig(420, 0.76);
const CORNER_FOLLOW = CORNERS.map(corner => springConfig(420 * corner.stiffness, 0.76));
const CORNER_LOCK = CORNERS.map(corner => springConfig(540 * corner.stiffness, 0.64));
const POP = springConfig(520, 0.62);
const MAGNET_SPRING = springConfig(240, 0.38);

const MAX_DT = 1 / 30;
const SUBSTEP = 1 / 120;
const FADE_RATE = 16;
const VELOCITY_RATE = 18;

/* ── Magnetic pull ───────────────────────────────────────────────────────── */

const MAGNET_STRENGTH = 0.24;
const MAGNET_MAX = 10;
const MAGNET_SIZE_RATIO = 0.25;

interface Magnet {
  el: Magnetic;
  ox: Spring;
  oy: Spring;
  tx: number;
  ty: number;
  /** The element's own stylesheet `translate` to add the pull to; null = cannot compose, no pull. */
  base: { x: string; y: string; isZero: boolean } | null;
  previousInline: string;
  active: boolean;
}

function parseTranslate(value: string): Magnet['base'] {
  if (!value || value === 'none') return { x: '0px', y: '0px', isZero: true };
  const parts = value.trim().split(/\s+/);
  if (value.includes('(') || parts.length > 2) return null;
  return { x: parts[0], y: parts[1] ?? '0px', isZero: false };
}

function createMagnet(el: Magnetic): Magnet {
  return {
    el,
    ox: springAt(0),
    oy: springAt(0),
    tx: 0,
    ty: 0,
    base: parseTranslate(getComputedStyle(el).translate),
    previousInline: el.style.translate,
    active: true,
  };
}

function writeMagnet({ el, base, ox, oy }: Magnet): void {
  if (!base) return;
  const x = ox.x.toFixed(2);
  const y = oy.x.toFixed(2);
  el.style.translate = base.isZero ? `${x}px ${y}px` : `calc(${base.x} + ${x}px) calc(${base.y} + ${y}px)`;
}

function restoreMagnet({ el, previousInline }: Magnet): void {
  if (previousInline) el.style.translate = previousInline;
  else el.style.removeProperty('translate');
}

/* ── Engine ──────────────────────────────────────────────────────────────── */

const IDLE_HALF = 15;
const RING_HALF = 22;
const TEXT_HALF = 5;
/** Parked: the reticle folds into the point and fades. */
const PARK_HALF = 3;
const PARK_MS = 2000;
const PRESS_SQUEEZE = 0.72;
/** Brackets sit this far outside a framed target, clear of its label. */
const FRAME_PAD = 7;
const FRAME_PAD_PRESSED = 3;
const BADGE_MIN = 78;
const BADGE_PADDING = 32;
const BADGE_GAP = 7;
/** Drag: room between the disc and the brackets for the chevrons. */
const BADGE_GAP_DRAG = 21;
const BADGE_PRESSED = 0.9;
const BADGE_HIDDEN = 0.6;
const CARET_BASE = 64; // .caret height in CSS
const CARET_HIDDEN = 0.25;
const DOT_SCALE: Partial<Record<Mode, number>> = { idle: 1, ring: 0.85 };
const DOT_HIDDEN = 0.4;
const DOT_PRESSED = 0.7;
const STRETCH_SPEED = 2600;
const STRETCH_MAX = 0.45;
const PULSE_MS = 560;
const PULSE_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** Inspector chip: the framed target's size, like a design tool's selection. */
const CHIP_DELAY_MS = 160;
const CHIP_GAP = 9;
const CHIP_H = 20; // .chip height in CSS
const CHIP_HIDDEN = 0.85;
const EDGE = 8;

export interface CursorEngine {
  setTheme(theme: LabTheme): void;
  setTier(tier: DeviceTier): void;
  destroy(): void;
}

interface Parts {
  dot: HTMLElement;
  caret: HTMLElement;
  badge: HTMLElement;
  badgeText: HTMLElement;
  chip: HTMLElement;
  glyphs: HTMLElement[];
  corners: HTMLElement[];
  pulses: HTMLElement[];
  canvas: HTMLCanvasElement;
}

function queryParts(layer: HTMLElement): Parts | null {
  const one = (name: string) => layer.querySelector<HTMLElement>(`[data-part="${name}"]`);
  const all = (selector: string) => Array.from(layer.querySelectorAll<HTMLElement>(selector));
  const [dot, caret, badge, badgeText, chip, canvas] = ['dot', 'caret', 'badge', 'badge-text', 'chip', 'trail'].map(one);
  if (!dot || !caret || !badge || !badgeText || !chip || !(canvas instanceof HTMLCanvasElement)) return null;
  return {
    dot,
    caret,
    badge,
    badgeText,
    chip,
    canvas,
    glyphs: all('[data-glyph]'),
    corners: all('[data-part="corner"]'),
    pulses: all('[data-part="pulse"]'),
  };
}

interface Goals {
  layer: number;
  dot: number;
  dotScale: number;
  caret: number;
  caretScale: number;
  corner: number;
  badge: number;
  badgeScale: number;
  chip: number;
  chipScale: number;
}

const fmt = (value: number) => value.toFixed(2);

/** @param layer the fixed, pointer-events: none layer (CursorLayer.tsx) */
export function createCursorEngine(layer: HTMLDivElement): CursorEngine | null {
  const parts = queryParts(layer);
  if (!parts) return null;
  const { dot, caret, badge, badgeText, chip, glyphs, corners: cornerEls, pulses, canvas } = parts;
  // Screenshots never include the OS cursor: under automation the layer draws its own stand-in dot.
  const drawsOwnPoint = navigator.webdriver === true;

  const s = {
    running: false,
    lastTime: 0,
    mouseActive: false,
    inside: false,
    isDown: false,
    isParked: false,
    lastMoveAt: 0,
    parkTimer: 0,
    nativeOn: false,
    px: 0,
    py: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    mode: 'idle' as Mode,
    label: '',
    icon: null as CursorIcon | null,
    badgeHalf: BADGE_MIN / 2,
    caretH: 14,
    /** The hardware cursor is hidden over the current target (CSS or the text caret). */
    nativeHidden: false,
    frameTarget: null as Element | null,
    pendingTarget: null as Element | null,
    lastTarget: null as Element | null,
    needsHitTest: false,
    magnet: null as Magnet | null,
    hasChip: false,
    chipW: 0,
    lockedAt: 0,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    layerAlpha: 0,
    dotAlpha: 0,
    caretAlpha: 0,
    cornerAlpha: 1,
    badgeAlpha: 0,
    chipAlpha: 0,
    pulseIndex: 0,
  };
  const corners = CORNERS.map(() => ({ x: springAt(0), y: springAt(0), tx: 0, ty: 0 }));
  const badgePos = { x: springAt(0), y: springAt(0) };
  const dotScale = springAt(DOT_HIDDEN);
  const caretScale = springAt(CARET_HIDDEN);
  const badgeScale = springAt(BADGE_HIDDEN);
  const chipScale = springAt(CHIP_HIDDEN);
  const magnets = new Map<Magnetic, Magnet>();
  let trail: Trail | null = null;
  let paint: TrailPaint | null = null;
  let textCursor: { el: HTMLElement; value: string; priority: string } | null = null;
  const nativeStyle = document.createElement('style');
  nativeStyle.dataset.labCursor = '';

  const setData = (key: string, value: string) => {
    if (layer.dataset[key] !== value) layer.dataset[key] = value;
  };

  /** The hardware cursor becomes the themed dot inside the lab while the style element is in. */
  const setNativeCursor = (on: boolean) => {
    if (s.nativeOn === on) return;
    s.nativeOn = on;
    if (on) document.head.appendChild(nativeStyle);
    else nativeStyle.remove();
  };

  /** Over text the caret is the cursor: hide the hardware dot on that one element only. */
  const setTextCursor = (el: HTMLElement | null) => {
    if (textCursor?.el === el) return;
    if (textCursor) {
      const { el: previous, value, priority } = textCursor;
      if (value) previous.style.setProperty('cursor', value, priority);
      else previous.style.removeProperty('cursor');
    }
    textCursor = el ? { el, value: el.style.getPropertyValue('cursor'), priority: el.style.getPropertyPriority('cursor') } : null;
    el?.style.setProperty('cursor', 'none', 'important');
  };

  const isShown = () => s.mouseActive && s.inside && s.mode !== 'hidden';
  const isParkable = () => s.mode === 'idle' || s.mode === 'ring';
  const isFolded = () => s.isParked && isParkable();
  const dotVisible = () => isParkable() && (s.nativeHidden || drawsOwnPoint);
  const chipDue = (now: number) => s.mode === 'frame' && s.hasChip && now - s.lockedAt >= CHIP_DELAY_MS;

  const freeHalf = () => {
    if (s.mode === 'label') return s.badgeHalf * (s.isDown ? BADGE_PRESSED : 1) + (s.icon === 'drag' ? BADGE_GAP_DRAG : BADGE_GAP);
    if (isFolded()) return PARK_HALF;
    const half = s.mode === 'ring' ? RING_HALF : s.mode === 'text' ? TEXT_HALF : IDLE_HALF;
    return s.isDown ? half * PRESS_SQUEEZE : half;
  };

  const computeGoals = (now: number): Goals => {
    const isLabel = s.mode === 'label';
    const isText = s.mode === 'text';
    const showDot = dotVisible();
    const showChip = chipDue(now);
    return {
      layer: isShown() ? 1 : 0,
      dot: showDot ? 1 : 0,
      dotScale: showDot ? (DOT_SCALE[s.mode] ?? 1) * (s.isDown ? DOT_PRESSED : 1) : DOT_HIDDEN,
      caret: isText ? 1 : 0,
      caretScale: isText ? s.caretH / CARET_BASE : CARET_HIDDEN,
      corner: isText || isFolded() ? 0 : 1,
      badge: isLabel ? 1 : 0,
      badgeScale: isLabel ? (s.isDown ? BADGE_PRESSED : 1) : BADGE_HIDDEN,
      chip: showChip ? 1 : 0,
      chipScale: showChip ? 1 : CHIP_HIDDEN,
    };
  };

  const setLabel = (label: string, icon: CursorIcon | null) => {
    s.label = label;
    s.icon = icon;
    badgeText.textContent = label;
    for (const glyph of glyphs) glyph.hidden = glyph.dataset.glyph !== icon;
    badge.dataset.icon = icon ?? '';
    const size = Math.max(BADGE_MIN, Math.ceil(badgeText.offsetWidth + BADGE_PADDING));
    badge.style.setProperty('--badge-size', `${size}px`);
    s.badgeHalf = size / 2;
  };

  /** Brackets lock onto a new target; the size chip follows (at once if one is already showing). */
  const lockOn = (target: Element) => {
    const wasShowing = s.chipAlpha > 0.5;
    s.hasChip = !target.closest('[data-lab-panel]');
    s.lockedAt = wasShowing ? performance.now() - CHIP_DELAY_MS : performance.now();
    if (!s.hasChip) return;
    const { width, height } = measureTarget(target);
    chip.textContent = `${Math.round(width)} × ${Math.round(height)}`;
    s.chipW = chip.offsetWidth;
  };

  const setMagnet = (el: Magnetic | null) => {
    if (s.magnet?.el === el) return;
    if (s.magnet) s.magnet.active = false;
    s.magnet = null;
    if (!el) return;
    const magnet = magnets.get(el) ?? createMagnet(el);
    magnet.active = true;
    magnets.set(el, magnet);
    s.magnet = magnet;
  };

  const applyHit = (hit: Hit, start: Element | null) => {
    setMagnet(hit.magnet);
    setTextCursor(hit.mode === 'text' ? hit.textEl : null);
    if (hit.mode === 'frame' && hit.target && hit.target !== s.frameTarget) lockOn(hit.target);
    s.mode = hit.mode;
    s.frameTarget = hit.target;
    s.caretH = hit.caret || s.caretH;
    if (hit.mode === 'label' && (hit.label !== s.label || hit.icon !== s.icon)) setLabel(hit.label, hit.icon);
    s.nativeHidden = hit.mode === 'text' || (start !== null && getComputedStyle(start).cursor === 'none');
    setData('mode', hit.mode);
    setData('tone', hit.mode === 'frame' || hit.mode === 'ring' || hit.mode === 'label' ? 'accent' : 'ink');
  };

  const updateHit = () => {
    if (!s.mouseActive || !s.inside) {
      setMagnet(null);
      setTextCursor(null);
      return;
    }
    if (s.needsHitTest) {
      s.needsHitTest = false;
      s.pendingTarget = document.elementFromPoint(s.px, s.py);
    } else if (s.pendingTarget === s.lastTarget) {
      return;
    }
    s.lastTarget = s.pendingTarget;
    applyHit(resolveHit(s.pendingTarget), s.pendingTarget);
  };

  /** Layout reads first (frame rect, magnet rects), writes later in render(). */
  const readFrameRect = (): DOMRect | null => {
    if (s.mode !== 'frame' || !s.frameTarget) return null;
    if (!s.frameTarget.isConnected) {
      s.needsHitTest = true;
      return null;
    }
    return s.frameTarget.getBoundingClientRect();
  };

  const aimMagnets = (frameRect: DOMRect | null) => {
    for (const magnet of magnets.values()) {
      if (!magnet.el.isConnected) {
        magnets.delete(magnet.el);
        if (s.magnet === magnet) s.magnet = null;
        continue;
      }
      if (!magnet.active || !magnet.base) {
        magnet.tx = 0;
        magnet.ty = 0;
        continue;
      }
      const rect = frameRect && s.frameTarget === magnet.el ? frameRect : magnet.el.getBoundingClientRect();
      const reach = Math.min(MAGNET_MAX, Math.min(rect.width, rect.height) * MAGNET_SIZE_RATIO);
      const restCx = rect.left - magnet.ox.x + rect.width / 2;
      const restCy = rect.top - magnet.oy.x + rect.height / 2;
      magnet.tx = clamp((s.px - restCx) * MAGNET_STRENGTH, -reach, reach);
      magnet.ty = clamp((s.py - restCy) * MAGNET_STRENGTH, -reach, reach);
    }
  };

  const aimCorners = (frameRect: DOMRect | null) => {
    const pad = s.isDown ? FRAME_PAD_PRESSED : FRAME_PAD;
    const half = freeHalf();
    CORNERS.forEach((corner, i) => {
      const c = corners[i];
      if (frameRect) {
        c.tx = corner.sx < 0 ? frameRect.left - pad : frameRect.right + pad;
        c.ty = corner.sy < 0 ? frameRect.top - pad : frameRect.bottom + pad;
      } else {
        c.tx = s.px + corner.sx * half;
        c.ty = s.py + corner.sy * half;
      }
    });
  };

  const integrate = (dt: number, isLocked: boolean, goals: Goals) => {
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
    const h = dt / steps;
    for (let step = 0; step < steps; step++) {
      corners.forEach((c, i) => {
        const config = isLocked ? CORNER_LOCK[i] : CORNER_FOLLOW[i];
        stepSpring(c.x, c.tx, config, h);
        stepSpring(c.y, c.ty, config, h);
      });
      stepSpring(badgePos.x, s.px, FOLLOW, h);
      stepSpring(badgePos.y, s.py, FOLLOW, h);
      stepSpring(dotScale, goals.dotScale, POP, h);
      stepSpring(caretScale, goals.caretScale, POP, h);
      stepSpring(badgeScale, goals.badgeScale, POP, h);
      stepSpring(chipScale, goals.chipScale, POP, h);
      for (const magnet of magnets.values()) {
        stepSpring(magnet.ox, magnet.tx, MAGNET_SPRING, h);
        stepSpring(magnet.oy, magnet.ty, MAGNET_SPRING, h);
      }
    }
    const fade = 1 - Math.exp(-FADE_RATE * dt);
    s.layerAlpha += (goals.layer - s.layerAlpha) * fade;
    s.dotAlpha += (goals.dot - s.dotAlpha) * fade;
    s.caretAlpha += (goals.caret - s.caretAlpha) * fade;
    s.cornerAlpha += (goals.corner - s.cornerAlpha) * fade;
    s.badgeAlpha += (goals.badge - s.badgeAlpha) * fade;
    s.chipAlpha += (goals.chip - s.chipAlpha) * fade;
    const follow = 1 - Math.exp(-VELOCITY_RATE * dt);
    if (dt > 0) {
      s.vx += ((s.px - s.prevX) / dt - s.vx) * follow;
      s.vy += ((s.py - s.prevY) / dt - s.vy) * follow;
    }
    s.prevX = s.px;
    s.prevY = s.py;
  };

  /** The chip rides under the bottom brackets (above the top ones near the viewport's foot). */
  const renderChip = () => {
    if (s.chipAlpha < 0.004 && chip.style.opacity === '0.00') return;
    const [tl, tr, br, bl] = corners;
    const bottom = Math.max(br.y.x, bl.y.x);
    const isBelow = bottom + CHIP_GAP + CHIP_H <= s.viewportH - EDGE;
    const y = isBelow ? bottom + CHIP_GAP : Math.min(tl.y.x, tr.y.x) - CHIP_GAP - CHIP_H;
    const half = s.chipW / 2;
    const x = clamp((bl.x.x + br.x.x) / 2, EDGE + half, s.viewportW - EDGE - half);
    const side = isBelow ? 'below' : 'above';
    if (chip.dataset.side !== side) chip.dataset.side = side;
    chip.style.transform = `translate3d(${fmt(x)}px, ${fmt(y)}px, 0) translateX(-50%) scale(${fmt(Math.max(chipScale.x, 0))})`;
    chip.style.opacity = fmt(s.chipAlpha);
  };

  const render = () => {
    layer.style.opacity = fmt(s.layerAlpha);
    const speed = Math.hypot(s.vx, s.vy);
    const stretch = Math.min(speed / STRETCH_SPEED, 1) * STRETCH_MAX;
    const angle = Math.atan2(s.vy, s.vx);
    const scale = Math.max(dotScale.x, 0);
    // Stretch along the motion without turning the shape (Concrete's dot is a square).
    const squash = `rotate(${angle.toFixed(3)}rad) scale(${fmt(scale * (1 + stretch))}, ${fmt(scale * (1 - stretch * 0.45))}) rotate(${(-angle).toFixed(3)}rad)`;
    dot.style.transform = `translate3d(${fmt(s.px)}px, ${fmt(s.py)}px, 0) ${squash}`;
    dot.style.opacity = fmt(s.dotAlpha);
    caret.style.transform = `translate3d(${fmt(s.px)}px, ${fmt(s.py)}px, 0) scale(1, ${fmt(Math.max(caretScale.x, 0))})`;
    caret.style.opacity = fmt(s.caretAlpha);
    cornerEls.forEach((el, i) => {
      const c = corners[i];
      el.style.transform = `translate3d(${fmt(c.x.x)}px, ${fmt(c.y.x)}px, 0) rotate(${CORNERS[i].rotate}deg)`;
      el.style.opacity = fmt(s.cornerAlpha);
    });
    badge.style.transform = `translate3d(${fmt(badgePos.x.x)}px, ${fmt(badgePos.y.x)}px, 0) translate(-50%, -50%) scale(${fmt(Math.max(badgeScale.x, 0))})`;
    badge.style.opacity = fmt(s.badgeAlpha);
    renderChip();
    for (const magnet of magnets.values()) writeMagnet(magnet);
  };

  const releaseSettledMagnets = () => {
    for (const magnet of magnets.values()) {
      if (magnet.active || !isAtRest(magnet.ox, 0, 0.05) || !isAtRest(magnet.oy, 0, 0.05)) continue;
      restoreMagnet(magnet);
      magnets.delete(magnet.el);
    }
  };

  const ALPHA_EPSILON = 0.004;
  const isSettled = (goals: Goals, now: number) => {
    if (s.needsHitTest || s.pendingTarget !== s.lastTarget || Math.hypot(s.vx, s.vy) > 4) return false;
    // A chip is about to show: keep ticking until it does.
    if (s.mode === 'frame' && s.hasChip && now - s.lockedAt < CHIP_DELAY_MS) return false;
    const alphas: [number, number][] = [
      [s.layerAlpha, goals.layer],
      [s.dotAlpha, goals.dot],
      [s.caretAlpha, goals.caret],
      [s.cornerAlpha, goals.corner],
      [s.badgeAlpha, goals.badge],
      [s.chipAlpha, goals.chip],
    ];
    if (alphas.some(([value, goal]) => Math.abs(goal - value) > ALPHA_EPSILON)) return false;
    if (!corners.every(c => isAtRest(c.x, c.tx, 0.05) && isAtRest(c.y, c.ty, 0.05))) return false;
    if (!isAtRest(dotScale, goals.dotScale, 0.002) || !isAtRest(badgeScale, goals.badgeScale, 0.002)) return false;
    if (!isAtRest(caretScale, goals.caretScale, 0.002) || !isAtRest(chipScale, goals.chipScale, 0.002)) return false;
    for (const magnet of magnets.values()) {
      if (!isAtRest(magnet.ox, magnet.tx, 0.05) || !isAtRest(magnet.oy, magnet.ty, 0.05)) return false;
    }
    return true;
  };

  const tick = () => {
    const now = performance.now();
    const dt = Math.min((now - s.lastTime) / 1000, MAX_DT);
    s.lastTime = now;
    updateHit();
    const frameRect = readFrameRect();
    aimMagnets(frameRect);
    aimCorners(frameRect);
    const goals = computeGoals(now);
    integrate(dt, frameRect !== null, goals);
    render();
    releaseSettledMagnets();
    const trailBusy = trail && paint ? trail.draw(now, paint) : false;
    if (!trailBusy && isSettled(goals, now)) sleep();
  };

  function wake() {
    if (s.running) return;
    s.running = true;
    s.lastTime = performance.now();
    gsap.ticker.add(tick);
  }

  function sleep() {
    if (!s.running) return;
    s.running = false;
    gsap.ticker.remove(tick);
  }

  /* Parking: two seconds without mouse movement folds the free reticle into the point. */
  const setParked = (isParked: boolean) => {
    if (s.isParked === isParked) return;
    s.isParked = isParked;
    setData('parked', isParked ? 'true' : 'false');
    wake();
  };

  const onParkTimer = () => {
    const idle = performance.now() - s.lastMoveAt;
    if (idle < PARK_MS) {
      s.parkTimer = window.setTimeout(onParkTimer, PARK_MS - idle);
      return;
    }
    s.parkTimer = 0;
    setParked(true);
  };

  const noteMovement = (now: number) => {
    s.lastMoveAt = now;
    setParked(false);
    if (!s.parkTimer) s.parkTimer = window.setTimeout(onParkTimer, PARK_MS);
  };

  /** First move, or back from outside the window / a touch: appear in place, no fly-in. */
  const snapToPointer = () => {
    const half = freeHalf();
    CORNERS.forEach((corner, i) => {
      corners[i].x = springAt(s.px + corner.sx * half);
      corners[i].y = springAt(s.py + corner.sy * half);
    });
    badgePos.x = springAt(s.px);
    badgePos.y = springAt(s.py);
    s.prevX = s.px;
    s.prevY = s.py;
    s.vx = 0;
    s.vy = 0;
    trail?.clear();
  };

  /** A finger or pen on a hybrid laptop: the layer steps aside and the system cursor returns. */
  const stepAside = () => {
    if (!s.mouseActive) return;
    s.mouseActive = false;
    s.isDown = false;
    setData('down', 'false');
    setNativeCursor(false);
    setTextCursor(null);
    trail?.clear();
    wake();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') {
      stepAside();
      return;
    }
    const now = performance.now();
    const isReturning = !s.mouseActive || !s.inside;
    s.px = event.clientX;
    s.py = event.clientY;
    s.mouseActive = true;
    s.inside = true;
    s.pendingTarget = event.target instanceof Element ? event.target : null;
    noteMovement(now);
    if (isReturning) {
      setNativeCursor(true);
      snapToPointer();
      s.lastTarget = null;
    }
    if (trail) {
      const samples = event.getCoalescedEvents?.() ?? [];
      for (const sample of samples.length > 1 ? samples : [event]) {
        // Event time, so a burst delivered after a long task is already old and fades at once.
        const time = sample.timeStamp > 0 && sample.timeStamp <= now ? sample.timeStamp : now;
        trail.push(sample.clientX, sample.clientY, time);
      }
    }
    wake();
  };

  const spawnPulse = () => {
    const el = pulses[s.pulseIndex % pulses.length];
    s.pulseIndex += 1;
    if (!el || typeof el.animate !== 'function') return;
    const at = `translate3d(${fmt(s.px)}px, ${fmt(s.py)}px, 0)`;
    el.animate(
      [
        { transform: `${at} scale(0.25)`, opacity: 0.8 },
        { transform: `${at} scale(1)`, opacity: 0 },
      ],
      { duration: PULSE_MS, easing: PULSE_EASE }
    );
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') {
      stepAside();
      return;
    }
    if (event.button !== 0) return;
    s.isDown = true;
    setData('down', 'true');
    noteMovement(performance.now());
    if (isShown() && s.mode !== 'text') spawnPulse();
    wake();
  };

  const onPointerUp = () => {
    if (!s.isDown) return;
    s.isDown = false;
    setData('down', 'false');
    // A click often swaps labels or removes the target: look again.
    s.needsHitTest = true;
    wake();
  };

  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget || event.pointerType !== 'mouse') return;
    s.inside = false;
    s.isDown = false;
    setData('down', 'false');
    wake();
  };

  const onScroll = () => {
    if (!s.mouseActive || !s.inside) return;
    s.needsHitTest = true;
    wake();
  };

  const onResize = () => {
    s.viewportW = window.innerWidth;
    s.viewportH = window.innerHeight;
    trail?.resize();
    onScroll();
  };

  const onBlur = () => {
    s.isDown = false;
    setData('down', 'false');
    wake();
  };

  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions][] = [
    [window, 'pointermove', onPointerMove as EventListener, { passive: true }],
    [window, 'pointerdown', onPointerDown as EventListener, { passive: true }],
    [window, 'pointerup', onPointerUp, { passive: true }],
    [window, 'pointercancel', onPointerUp, { passive: true }],
    [window, 'pointerout', onPointerOut as EventListener, { passive: true }],
    [window, 'scroll', onScroll, { passive: true, capture: true }],
    [window, 'resize', onResize, { passive: true }],
    [window, 'blur', onBlur, { passive: true }],
  ];
  for (const [target, type, listener, options] of listeners) target.addEventListener(type, listener, options);
  // Set once for the layer's life (and on a mouse's return after a pen or finger), never per frame.
  setNativeCursor(true);

  return {
    setTheme(theme) {
      paint = trailPaint(theme);
      nativeStyle.textContent = nativeCursorCss(nativeDotCursor(theme));
      // The mono face changes with the style: re-fit the badge and the chip.
      if (s.label) setLabel(s.label, s.icon);
      if (s.hasChip) s.chipW = chip.offsetWidth;
    },
    setTier(tier) {
      const config = TRAIL_BY_TIER[tier];
      if (trail?.config === config) return;
      trail?.clear();
      trail = config ? createTrail(canvas, config) : null;
      canvas.hidden = !trail;
      if (!trail) {
        canvas.width = 0;
        canvas.height = 0;
      }
    },
    destroy() {
      sleep();
      window.clearTimeout(s.parkTimer);
      for (const [target, type, listener, options] of listeners) target.removeEventListener(type, listener, options);
      for (const magnet of magnets.values()) restoreMagnet(magnet);
      magnets.clear();
      setTextCursor(null);
      for (const el of pulses) el.getAnimations().forEach(animation => animation.cancel());
      trail?.clear();
      setNativeCursor(false);
    },
  };
}
