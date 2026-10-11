/**
 * The scroll story's geometry. The track is (1 + SCROLL_SCREENS) screens
 * tall with the stage sticky inside it; `p` is the 0→1 progress over the
 * SCROLL_SCREENS of scrolling. The spreadsheet holds, then turns into the
 * admin (the morph), then the five modules take an equal share each.
 */
import { CHAPTER_IDS, type ChapterId, type ModuleId } from './data';

/**
 * Screens of scrolling while the stage is stuck (track = 100svh × (1 + this)).
 * About 0.84 of a screen for the spreadsheet and its morph, 0.43 per module.
 * heights.css reserves the same track (--lab-h-crm-build).
 */
export const SCROLL_SCREENS = 3;

export const MORPH_START = 0.04;
export const MORPH_END = 0.28;

export const CHAPTERS = CHAPTER_IDS;
export const CHAPTER_COUNT = CHAPTERS.length;
const MODULE_SPAN = (1 - MORPH_END) / (CHAPTER_COUNT - 1);

export function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

/** 0→1 as `value` goes from `from` to `to` (linear, clamped). */
export function ramp(value: number, from: number, to: number): number {
  return clamp01((value - from) / (to - from));
}

export function easeInOut(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;
}

export function morphProgress(p: number): number {
  return ramp(p, MORPH_START, MORPH_END);
}

export function chapterRange(index: number): [start: number, end: number] {
  if (index <= 0) return [0, MORPH_END];
  const start = MORPH_END + (index - 1) * MODULE_SPAN;
  return [start, start + MODULE_SPAN];
}

/**
 * The caption turns to "Pipeline" once the cards have visibly started landing (72% into the morph),
 * not at its last frame, so the board is never on screen under the spreadsheet's line.
 */
const PIPELINE_CAPTION_AT = MORPH_START + (MORPH_END - MORPH_START) * 0.72;

export function chapterAt(p: number): number {
  if (p < PIPELINE_CAPTION_AT) return 0;
  return Math.min(CHAPTER_COUNT - 1, 1 + Math.max(0, Math.floor((p - MORPH_END) / MODULE_SPAN)));
}

export function chapterProgress(p: number, index: number): number {
  const [start, end] = chapterRange(index);
  return ramp(p, start, end);
}

/** Where a rail jump lands: the spreadsheet at the very start, a module a little way in. */
export function chapterLanding(index: number): number {
  if (index <= 0) return 0;
  const [start, end] = chapterRange(index);
  return start + (end - start) * 0.18;
}

/** The module the app window shows for a chapter (the board sits under the spreadsheet). */
export function moduleOf(chapter: ChapterId): ModuleId {
  return chapter === 'sheet' ? 'pipeline' : chapter;
}

export function chapterIndexOfModule(module: ModuleId): number {
  return CHAPTERS.indexOf(module);
}
