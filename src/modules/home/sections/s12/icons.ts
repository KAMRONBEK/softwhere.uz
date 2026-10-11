import type { StepId } from './copy';

/**
 * Stage icons on a 24px grid, drawn as strokes. `parts` are drawn on one by
 * one when a stage becomes active; `morph` is the same glyph as a single path
 * for the HUD icon that morphs from stage to stage (MorphSVGPlugin).
 */
export interface StageIcon {
  parts: readonly string[];
  morph: string;
}

export const STAGE_ICONS: Record<StepId, StageIcon> = {
  discover: {
    parts: ['M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13', 'M15.3 15.3L20.5 20.5', 'M7.6 9.4a3.2 3.2 0 0 1 2.4-2.3'],
    morph: 'M20.5 20.5L15.1 15.1A6.5 6.5 0 1 1 15.1 5.9A6.5 6.5 0 0 1 15.1 15.1',
  },
  design: {
    parts: ['M12 3L18.5 12.5L15 20.5H9L5.5 12.5Z', 'M12 3V10.6', 'M12 10.6a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2'],
    morph: 'M12 3L18.5 12.5L15 20.5H9L5.5 12.5Z',
  },
  build: {
    parts: ['M8 7L3 12L8 17', 'M16 7L21 12L16 17', 'M13.5 5L10.5 19'],
    morph: 'M8 7L3 12L8 17M13.5 5L10.5 19M16 7L21 12L16 17',
  },
  launch: {
    parts: [
      'M12 2.5C15.4 4.6 16.9 8.6 16 13.6H8C7.1 8.6 8.6 4.6 12 2.5Z',
      'M12 7.1a1.7 1.7 0 1 1 0 3.4a1.7 1.7 0 1 1 0-3.4',
      'M8 13.6L5.5 17L8.6 16.6M16 13.6L18.5 17L15.4 16.6',
      'M10.6 17.6L12 21L13.4 17.6',
    ],
    morph: 'M12 2.5C15.4 4.6 16.9 8.6 16 13.6L18.5 17L15.4 16.6H8.6L5.5 17L8 13.6C7.1 8.6 8.6 4.6 12 2.5Z',
  },
  grow: {
    parts: ['M3 17.5L9 11.5L13 15.5L21 7.5', 'M15.5 7.5H21V13'],
    morph: 'M3 17.5L9 11.5L13 15.5L21 7.5M15.5 7.5H21V13',
  },
};

/** A small check drawn in front of every deliverable. */
export const CHECK_PATH = 'M3.5 8.5L6.6 11.5L12.5 4.8';
