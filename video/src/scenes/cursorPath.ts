import { Easing, interpolate } from 'remotion';
import { between } from '../animation';
import type { Shot } from '../schema';

type Point = { x: number; y: number };
export type CursorState = Point & { click: number };

const DEFAULT_CURSOR: Point = { x: 0.62, y: 0.72 };
/** Fractions of a shot's slot: glide to the target, then click just before the next shot fades in. */
const MOVE = { start: 0.25, end: 0.68 } as const;
const CLICK = { start: 0.7, end: 0.92 } as const;

const lastCursorBefore = (shots: readonly Shot[], index: number): Point =>
  shots
    .slice(0, index)
    .reverse()
    .find(shot => shot.cursor)?.cursor ?? DEFAULT_CURSOR;

/** Cursor position (0–1 of the viewport) and click phase at `frame`, or null when no shot defines a cursor. */
export const cursorAt = (shots: readonly Shot[], slot: number, frame: number): CursorState | null => {
  if (!shots.some(shot => shot.cursor)) return null;

  const index = Math.min(shots.length - 1, Math.max(0, Math.floor(frame / slot)));
  const local = frame - index * slot;
  const from = lastCursorBefore(shots, index);
  const target = shots[index].cursor;
  if (!target) return { ...from, click: 0 };

  const t = interpolate(local, [slot * MOVE.start, slot * MOVE.end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  return {
    x: from.x + (target.x - from.x) * t,
    y: from.y + (target.y - from.y) * t,
    click: between(local, slot * CLICK.start, slot * CLICK.end),
  };
};
