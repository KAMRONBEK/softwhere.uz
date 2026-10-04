import { Easing, interpolate, spring } from 'remotion';

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0→1 spring starting `delay` frames in. Lower damping = more bounce. */
export const enter = (frame: number, fps: number, delay = 0, damping = 200): number =>
  spring({ frame: frame - delay, fps, config: { damping } });

/** 0→1 eased progress that holds still for `hold` frames at both ends. */
export const holdProgress = (frame: number, duration: number, hold: number): number =>
  interpolate(frame, [hold, Math.max(hold + 1, duration - hold)], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });

/** Linear 0→1 between two frames, clamped. */
export const between = (frame: number, start: number, end: number): number => interpolate(frame, [start, end], [0, 1], CLAMP);

export const pad2 = (n: number): string => String(n).padStart(2, '0');
