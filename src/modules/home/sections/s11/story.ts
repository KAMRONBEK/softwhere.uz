import { clamp01, damp, DEG, nearestTurn, smoothstep } from './geo';
import { BEATS, DESTINATION_KM, DESTINATIONS, type Pin, type RegionId } from './markets';

/**
 * The scroll story: one westward turn of the globe across the sticky range,
 * stopping at each beat. Pure functions of the story progress `p` (0..1),
 * shared by the WebGL scene, the 2D still and the DOM copy.
 */

/** Story progress at which each beat is centred; the tail after the last one is a hold. */
export const BEAT_CENTERS: readonly number[] = [0, 0.24, 0.48, 0.72, 0.96];
/** Section height (CSS: globe.module.css .root) — the registry reserves the same. */
export const STORY_HEIGHT = '280svh';

/** Plateau around each beat so the copy has time to be read. */
const TURN_START = 0.16;
const TURN_END = 0.84;
/** Part of the incoming segment during which a destination's arc draws. */
const DRAW_START = 0.22;
const DRAW_LENGTH = 0.56;
/** Extra delay per later pin of the same region, as a fraction of the segment. */
const DRAW_STAGGER = 0.07;
/** How much of each beat's latitude the camera tilts towards. */
const PITCH_SHARE = 0.75;

export interface Pose {
  /** Radians, about y. */
  yaw: number;
  /** Radians, about x. */
  pitch: number;
}

function beatPose(index: number): Pose {
  const beat = BEATS[index];
  return { yaw: -beat.focusLon * DEG, pitch: beat.focusLat * PITCH_SHARE * DEG };
}

const POSES = BEATS.map((_, index) => beatPose(index));

/** Segment index and local progress for a story progress. */
function segmentAt(p: number): { index: number; u: number } {
  const last = BEAT_CENTERS.length - 1;
  if (p <= BEAT_CENTERS[0]) return { index: 0, u: 0 };
  if (p >= BEAT_CENTERS[last]) return { index: last - 1, u: 1 };
  let index = 0;
  while (index < last - 1 && p >= BEAT_CENTERS[index + 1]) index++;
  const u = (p - BEAT_CENTERS[index]) / (BEAT_CENTERS[index + 1] - BEAT_CENTERS[index]);
  return { index, u };
}

export function storyPose(p: number): Pose {
  const { index, u } = segmentAt(p);
  const e = smoothstep(TURN_START, TURN_END, u);
  const a = POSES[index];
  const b = POSES[index + 1];
  return { yaw: a.yaw + (b.yaw - a.yaw) * e, pitch: a.pitch + (b.pitch - a.pitch) * e };
}

/** The nearest beat centre (static mode snaps the globe to it). */
export function beatAt(p: number): number {
  let best = 0;
  for (let i = 1; i < BEAT_CENTERS.length; i++) {
    if (Math.abs(p - BEAT_CENTERS[i]) < Math.abs(p - BEAT_CENTERS[best])) best = i;
  }
  return best;
}

/** Great-circle angle (degrees) between the points facing the camera at two poses. */
function poseAngle(a: Pose, b: Pose): number {
  const cos = Math.sin(a.pitch) * Math.sin(b.pitch) + Math.cos(a.pitch) * Math.cos(b.pitch) * Math.cos(a.yaw - b.yaw);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / DEG;
}

const SEGMENT_DEG = POSES.slice(1).map((pose, index) => poseAngle(POSES[index], pose));
/** The next beat's copy arrives once the globe is this close to facing it (degrees). */
const ARRIVE_DEG = 20;

/**
 * The beat whose copy shows for a globe at story progress p: the previous
 * market stays until the turn is within ARRIVE_DEG of the next one, so the
 * words never run ahead of the planet. Fed the scene's displayed (damped)
 * progress, it follows the actual rotation.
 */
export function beatShownAt(p: number): number {
  const last = BEAT_CENTERS.length - 1;
  if (p >= BEAT_CENTERS[last]) return last;
  const { index, u } = segmentAt(p);
  const remaining = (1 - smoothstep(TURN_START, TURN_END, u)) * SEGMENT_DEG[index];
  return remaining < ARRIVE_DEG ? index + 1 : index;
}

const REGION_BEAT: Readonly<Record<RegionId, number>> = { home: 0, europe: 1, 'north-america': 2, oceania: 3 };

/** Order of each destination within its region (for the launch stagger). */
const ORDER_IN_REGION = DESTINATIONS.map(pin => DESTINATIONS.filter(other => other.region === pin.region).indexOf(pin));

/** 0..1: how much of a destination's arc is drawn at story progress p. */
export function arcDraw(pinIndex: number, p: number): number {
  const pin: Pin = DESTINATIONS[pinIndex];
  const beat = REGION_BEAT[pin.region];
  if (beat === 0) return 1;
  const from = BEAT_CENTERS[beat - 1];
  const to = BEAT_CENTERS[beat];
  const u = (p - from) / (to - from);
  return clamp01((u - DRAW_START - ORDER_IN_REGION[pinIndex] * DRAW_STAGGER) / DRAW_LENGTH);
}

/** Past this the finale hold starts and the globe spins freely. */
export const SPIN_FROM = BEAT_CENTERS[BEAT_CENTERS.length - 1] - 0.02;

// ── Runtime shared between DOM, scene and still ─────────────────────────

export interface DragState {
  isActive: boolean;
  /** Radians added on top of the story pose. */
  yaw: number;
  pitch: number;
  velYaw: number;
  velPitch: number;
  /** performance.now() of the last release (ms). */
  releasedAt: number;
}

export interface GlobeRuntime {
  /** Story progress from ScrollTrigger (snapped to beat centres when static). */
  target: number;
  /** 0..1 while the section scrolls into view. */
  enter: number;
  /** Beat whose copy is showing (see beatShownAt). */
  beat: number;
  /** Beat centre the static globe is snapped to. */
  snap: number;
  /** True while the WebGL scene renders: it then drives `beat` from the globe's actual rotation. */
  isSceneLive: boolean;
  /** The section's copy switcher. */
  onBeat: ((beat: number) => void) | null;
  drag: DragState;
  /** Label anchors, in ALL_PINS order; the active renderer positions them. */
  labels: Array<HTMLElement | null>;
  /** Distance readout riding the arc being drawn (WebGL only). */
  readout: HTMLElement | null;
  /** Asks the active renderer for a frame (R3F invalidate, or a 2D redraw). */
  listeners: Set<() => void>;
}

export function createRuntime(): GlobeRuntime {
  return {
    target: 0,
    enter: 1,
    beat: 0,
    snap: 0,
    isSceneLive: false,
    onBeat: null,
    drag: { isActive: false, yaw: 0, pitch: 0, velYaw: 0, velPitch: 0, releasedAt: 0 },
    labels: [],
    readout: null,
    listeners: new Set(),
  };
}

/** The WebGL scene announces itself while it renders (it then owns the copy beat). */
export function setSceneLive(runtime: GlobeRuntime, isLive: boolean): void {
  runtime.isSceneLive = isLive;
}

export function setBeatListener(runtime: GlobeRuntime, listener: ((beat: number) => void) | null): void {
  runtime.onBeat = listener;
}

export function setBeat(runtime: GlobeRuntime, beat: number): void {
  if (beat === runtime.beat) return;
  runtime.beat = beat;
  runtime.onBeat?.(beat);
}

export function requestFrame(runtime: GlobeRuntime): void {
  runtime.listeners.forEach(listener => listener());
}

// ── Drag inertia (shared by the scene; the still is direct-manipulation only) ──

/** Finale spin speed (radians/s). */
export const SPIN_SPEED = 0.16;
/** Below this speed (radians/s) a flung globe starts settling back onto the story. */
const SETTLE_SPEED = 0.35;
const SETTLE_DELAY_MS = 350;

/**
 * Advances a released drag: inertia decays, then the globe settles on the
 * nearest whole turn so the story's market is facing again. In the finale it
 * eases into a slow spin instead.
 */
export function stepDrag(drag: DragState, dt: number, nowMs: number, isSpinning: boolean): void {
  if (drag.isActive) return;
  drag.velYaw = isSpinning ? damp(drag.velYaw, SPIN_SPEED, 0.8, dt) : drag.velYaw * Math.exp(-2.4 * dt);
  drag.yaw += drag.velYaw * dt;
  drag.velPitch *= Math.exp(-5 * dt);
  drag.pitch += drag.velPitch * dt;
  const sinceRelease = nowMs - drag.releasedAt;
  if (!isSpinning && Math.abs(drag.velYaw) < SETTLE_SPEED && sinceRelease > SETTLE_DELAY_MS) {
    drag.yaw = damp(drag.yaw, nearestTurn(drag.yaw), 1.5, dt);
  }
  if (sinceRelease > SETTLE_DELAY_MS * 0.6) drag.pitch = damp(drag.pitch, 0, 2.2, dt);
}

// ── Labels ─────────────────────────────────────────────────────────────

/** 0..1: a pin's label shows once its arc has landed (home always). `index` is in ALL_PINS order. */
export function pinShown(index: number, p: number): number {
  if (index === 0) return 1;
  return smoothstep(0.9, 1, arcDraw(index - 1, p));
}

const SEGMENT = BEAT_CENTERS[1] - BEAT_CENTERS[0];

/**
 * 0..1: a pin's label is shown while the story is at its region (home
 * always), and every landed label shows in the finale. Keeps one region's
 * names on screen at a time instead of a cloud of chips at the limb.
 */
export function labelShown(index: number, p: number): number {
  const shown = pinShown(index, p);
  if (index === 0) return shown;
  const beat = REGION_BEAT[DESTINATIONS[index - 1].region];
  const distance = Math.abs(p - BEAT_CENTERS[beat]) / SEGMENT;
  const focus = 1 - smoothstep(0.5, 0.9, distance);
  const finale = smoothstep(BEAT_CENTERS[BEAT_CENTERS.length - 2] + SEGMENT * 0.55, SPIN_FROM, p);
  return shown * Math.max(focus, finale);
}

/** Hides labels as their pin turns towards the limb. `facing` = cos(normal, view). */
export function facingVisibility(facing: number): number {
  return smoothstep(0.14, 0.34, facing);
}

/**
 * Labels are positioned every frame but shown/hidden as a whole: CSS fades
 * and pops the chip (data-shown), so a pill never lingers half-transparent
 * at the limb with its text washed out.
 */
const SHOW_AT = 0.5;
/** Pin → chip gap, pin → leader start, and the stage gutter the chips stay inside (px). */
const LABEL_GAP = 14;
const LEADER_START = 4;
const GUTTER = 16;
/**
 * Near an edge a chip first slides inward (shortening its leader) by up to
 * this much; past it a flippable label swaps sides and a pinned one hides (px).
 */
const CLAMP_SLACK = 10;
/** A flipped label returns to its preferred side once that side has this much spare room (px). */
const FLIP_HYSTERESIS = 12;

interface LabelState {
  chipEl: HTMLElement | null;
  leaderEl: HTMLElement | null;
  width: number;
  /** Stage width the chip was measured at (phone widths swap in short labels). */
  stageWidth: number;
  side: 'left' | 'right';
  isShown: boolean;
  transform: string;
  chip: string;
  leader: string;
}

let labelStates = new WeakMap<HTMLElement, LabelState>();

/** Fonts change with the style: measure the chips again. */
export function forgetLabelSizes(): void {
  labelStates = new WeakMap();
}

function labelState(el: HTMLElement, stageWidth: number): LabelState {
  let state = labelStates.get(el);
  if (!state) {
    state = {
      chipEl: el.querySelector<HTMLElement>('[data-chip]'),
      leaderEl: el.querySelector<HTMLElement>('[data-leader]'),
      width: 0,
      stageWidth: 0,
      side: el.dataset.prefer === 'left' ? 'left' : 'right',
      isShown: el.hasAttribute('data-shown'),
      transform: '',
      chip: '',
      leader: '',
    };
    labelStates.set(el, state);
  }
  if (state.width === 0 || state.stageWidth !== stageWidth) {
    state.width = state.chipEl?.offsetWidth ?? 0;
    state.stageWidth = stageWidth;
  }
  return state;
}

function setShown(el: HTMLElement, state: LabelState, isShown: boolean): void {
  if (state.isShown === isShown) return;
  state.isShown = isShown;
  el.toggleAttribute('data-shown', isShown);
}

function chooseSide(state: LabelState, x: number, stageWidth: number, canFlip: boolean, prefer: 'left' | 'right'): 'left' | 'right' {
  if (!canFlip) return prefer;
  const roomRight = stageWidth - GUTTER - (x + LABEL_GAP + state.width);
  const roomLeft = x - LABEL_GAP - state.width - GUTTER;
  const roomPrefer = prefer === 'right' ? roomRight : roomLeft;
  const roomOther = prefer === 'right' ? roomLeft : roomRight;
  const other = prefer === 'right' ? 'left' : 'right';
  if (state.side === prefer) return roomPrefer < -CLAMP_SLACK && roomOther > roomPrefer ? other : prefer;
  // Flipped: return once the preferred side fits again, with margin so it does not flicker.
  return roomPrefer > -CLAMP_SLACK + FLIP_HYSTERESIS || roomOther < roomPrefer ? prefer : other;
}

/**
 * Moves a label anchor to (x, y) in stage px and shows/hides it. The chip
 * stays inside the stage gutters: near an edge it slides inward a little,
 * then a flippable label swaps to the pin's other side and a label pinned to
 * its side (a close neighbour on the other) hides rather than cover its pin.
 * Transforms only: no layout writes per frame.
 */
export function writeLabel(el: HTMLElement | null | undefined, x: number, y: number, visibility: number, stageWidth: number): void {
  if (!el) return;
  const state = labelState(el, stageWidth);
  const prefer = el.dataset.prefer === 'left' ? 'left' : 'right';
  const canFlip = el.dataset.flip !== undefined;
  const side = chooseSide(state, x, stageWidth, canFlip, prefer);
  if (side !== state.side) {
    state.side = side;
    el.dataset.side = side;
  }

  const width = state.width;
  const natural = side === 'right' ? LABEL_GAP : -LABEL_GAP - width;
  const dx = Math.min(stageWidth - GUTTER - width - x, Math.max(GUTTER - x, natural));
  const isPinnedOut = Math.abs(dx - natural) > CLAMP_SLACK;
  setShown(el, state, visibility >= SHOW_AT && !isPinnedOut);

  const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  if (transform !== state.transform) {
    state.transform = transform;
    el.style.transform = transform;
  }
  const chip = `${dx.toFixed(1)}px -50%`;
  if (state.chipEl && chip !== state.chip) {
    state.chip = chip;
    state.chipEl.style.translate = chip;
  }
  // Leader from just off the pin to the chip's near edge; gone when the chip sits on the pin.
  const from = side === 'right' ? LEADER_START : dx + width;
  const length = side === 'right' ? dx - LEADER_START : -LEADER_START - (dx + width);
  const leader = `translate3d(${from.toFixed(1)}px, 0, 0) scaleX(${Math.max(0, length >= 3 ? length : 0).toFixed(1)})`;
  if (state.leaderEl && leader !== state.leader) {
    state.leader = leader;
    state.leaderEl.style.transform = leader;
  }
}

// ── Flight readout ─────────────────────────────────────────────────────

/** Per region with arcs: the farthest destination, whose flight carries the km readout. */
const READOUT_PIN: ReadonlySet<number> = new Set(
  (['europe', 'north-america', 'oceania'] as const).map(region => {
    let best = -1;
    DESTINATIONS.forEach((pin, index) => {
      if (pin.region === region && (best < 0 || DESTINATION_KM[index] > DESTINATION_KM[best])) best = index;
    });
    return best;
  })
);

export function carriesReadout(pinIndex: number): boolean {
  return READOUT_PIN.has(pinIndex);
}

const readoutTexts = new WeakMap<HTMLElement, string>();
const kmFormats = new Map<string, Intl.NumberFormat>();

/** "4,960 km" / "4 960 км": the readout element carries its locale and unit (data-locale, data-unit). */
function readoutText(el: HTMLElement, km: number): string {
  const locale = el.dataset.locale ?? 'en';
  let format = kmFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale);
    kmFormats.set(locale, format);
  }
  return `${format.format(Math.round(km / 10) * 10)} ${el.dataset.unit ?? 'km'}`;
}

/** A small "4,960 km" counter riding the comet head while the arc draws; hidden otherwise. */
export function writeReadout(el: HTMLElement | null, x: number, y: number, km: number | null, stageWidth: number): void {
  if (!el) return;
  const isShown = km !== null;
  if (el.hasAttribute('data-shown') !== isShown) el.toggleAttribute('data-shown', isShown);
  if (km === null) return;
  const text = readoutText(el, km);
  const value = el.firstElementChild as HTMLElement | null;
  if (value && text !== readoutTexts.get(el)) {
    readoutTexts.set(el, text);
    value.textContent = text;
  }
  const left = Math.min(stageWidth - GUTTER - 86, Math.max(GUTTER, x + 12));
  el.style.transform = `translate3d(${left.toFixed(1)}px, ${(y - 26).toFixed(1)}px, 0)`;
}
