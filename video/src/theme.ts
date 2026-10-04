/** softwhere.uz "Ember" dark palette (src/app/globals.css, .dark). */
export const COLORS = {
  bg: '#0a0705',
  bg2: '#120b07',
  surface: '#181009',
  surface2: '#20140b',
  text: '#fbeee6',
  muted: '#c2a693',
  accent: '#ff5b1e',
  accent2: '#ffb057',
  border: 'rgba(255, 150, 90, 0.15)',
} as const;

export const VIDEO = { width: 1920, height: 1080, fps: 30 } as const;

/** Durations in frames. */
export const TIMING = {
  intro: 84,
  outro: 120,
  transition: 18,
  wordStagger: 2,
} as const;

export const DEFAULT_SCENE_SECONDS = { mobile: 3.8, web: 5, video: 5 } as const;

/** Vertical band kept clear for the header (top) and progress bar (bottom). */
export const SAFE = { top: 120, bottom: 110 } as const;
export const STAGE_HEIGHT = VIDEO.height - SAFE.top - SAFE.bottom;
