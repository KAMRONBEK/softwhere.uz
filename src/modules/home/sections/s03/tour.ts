import {
  describeAt,
  imageToStage,
  stageToImage,
  stopPoint,
  wideCopyRight,
  type CodeCardLayout,
  type MeasureText,
  type StageWindow,
} from './geometry';
import type { Point, XRayScene } from './scenes';

/**
 * Idle autopilot: the lens glides between the scene's stops (code cards and
 * key components) that are visible in the current stage crop, dwelling on
 * each. Also the HUD readout that names the component under the lens.
 */

export const DWELL_SECONDS = 2.8;
const HUD_TOP = 12;

export interface Tour {
  stops: Point[];
  index: number;
  /** Seconds (controller clock) when the current stop started. */
  since: number;
}

/** Stops of the scene that sit comfortably inside the stage (narrow stages crop the side devices). */
export function buildTour(
  scene: XRayScene,
  win: StageWindow,
  radius: number,
  sizes: { code: number; caption: number },
  cards: CodeCardLayout[][] | null,
  measure?: MeasureText
): Point[] {
  const marginX = Math.min(radius * 0.8, win.width * 0.3);
  const marginY = Math.min(radius * 0.6, win.height * 0.3);
  const stops: Point[] = [];
  for (const stop of scene.tour) {
    const card = stop.code !== undefined ? cards?.[stop.screen]?.[stop.code] : undefined;
    const image = card ? card.center : stopPoint(scene, stop, sizes, measure);
    if (!image) continue;
    const p = imageToStage(win, scene.size, image);
    if (p[0] < marginX || p[0] > win.width - marginX || p[1] < marginY || p[1] > win.height - marginY) continue;
    stops.push(p);
  }
  if (stops.length === 0) {
    const center = imageToStage(win, scene.size, [(scene.focus[0] + scene.focus[2]) / 2, (scene.focus[1] + scene.focus[3]) / 2]);
    stops.push(center);
  }
  return stops;
}

/** Advance the tour; returns true when it wrapped around (a full cycle ended). */
export function stepTour(tour: Tour, now: number): boolean {
  if (now - tour.since < DWELL_SECONDS) return false;
  tour.index = (tour.index + 1) % tour.stops.length;
  tour.since = now;
  return tour.index === 0;
}

export function tourProgress(tour: Tour, now: number): number {
  const within = Math.min(1, (now - tour.since) / DWELL_SECONDS);
  return (tour.index + within) / tour.stops.length;
}

export interface HudElements {
  root: HTMLElement | null;
  label: HTMLElement | null;
  tag: HTMLElement | null;
  meta: HTMLElement | null;
}

interface HudState {
  key: string;
  x: number;
  y: number;
  isVisible: boolean;
  width: number;
  height: number;
}

export function createHudState(): HudState {
  return { key: '', x: -1, y: -1, isVisible: false, width: 0, height: 0 };
}

/** Where the readout may go, stage px (keeps it off the copy column on wide stages). */
export interface HudBounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The readout stays on the stage, and right of the copy column on wide stages. */
export function hudBounds(width: number, height: number, isWide: boolean): HudBounds {
  if (!isWide) return { x0: 8, x1: width - 8, y0: 8, y1: height - 8 };
  return { x0: wideCopyRight(width) - 16, x1: width - 16, y0: 56, y1: height - 16 };
}

/**
 * Readout position: beside the lens at 45° (right, then left, above before
 * below), else centered above or below it — never over the lens itself, and
 * inside `bounds`.
 */
function placeHud(lens: Point, radius: number, w: number, h: number, bounds: HudBounds): Point {
  const reach = radius * 0.72 + 10;
  const fitsX = (x: number) => x >= bounds.x0 && x + w <= bounds.x1;
  const fitsY = (y: number) => y >= bounds.y0 && y + h <= bounds.y1;
  const candidates: Point[] = [
    [lens[0] + reach, lens[1] - reach - h],
    [lens[0] - reach - w, lens[1] - reach - h],
    [lens[0] + reach, lens[1] + reach],
    [lens[0] - reach - w, lens[1] + reach],
  ];
  const beside = candidates.find(([x, y]) => fitsX(x) && fitsY(y));
  if (beside) return beside;
  const x = Math.min(Math.max(lens[0] - w / 2, bounds.x0), Math.max(bounds.x1 - w, bounds.x0));
  const above = lens[1] - radius - 10 - h;
  if (above >= bounds.y0) return [x, above];
  return [x, Math.min(lens[1] + radius + 10, bounds.y1 - h)];
}

/** Writes the readout next to the lens. Only touches the DOM when something changed. */
export function updateHud(
  hud: HudElements,
  state: HudState,
  scene: XRayScene,
  win: StageWindow,
  lens: Point,
  radius: number,
  shouldShow: boolean,
  /** 0..1 share of the way to the new spot this update (1 = jump). */
  follow = 1,
  bounds?: HudBounds
): void {
  const { root, label, tag, meta } = hud;
  if (!root || !label || !tag || !meta) return;
  const hit = shouldShow ? describeAt(scene, stageToImage(win, scene.size, lens)) : null;
  const isVisible = Boolean(hit);
  if (isVisible !== state.isVisible) {
    root.dataset.visible = isVisible ? 'true' : 'false';
    state.isVisible = isVisible;
    state.x = -1;
  }
  if (!hit) return;
  if (hit.key !== state.key) {
    label.textContent = hit.label;
    tag.textContent = hit.tag;
    meta.textContent = hit.meta;
    state.key = hit.key;
    state.width = root.offsetWidth;
    state.height = root.offsetHeight;
  }
  const area = bounds ?? { x0: 8, x1: win.width - 8, y0: HUD_TOP, y1: win.height - 8 };
  const [targetX, targetY] = placeHud(lens, radius, state.width, state.height, area);
  const isFirst = state.x < 0;
  const x = isFirst ? targetX : state.x + (targetX - state.x) * follow;
  const y = isFirst ? targetY : state.y + (targetY - state.y) * follow;
  if (Math.abs(x - state.x) < 0.3 && Math.abs(y - state.y) < 0.3) return;
  state.x = x;
  state.y = y;
  root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
}
