import type { SectionId } from '../types';
import css from './Skeleton.module.css';

/** The outline a section's stage roughly has, so the placeholder hints at what is coming. */
export type SkeletonShape = 'stage' | 'browser' | 'phone' | 'orb' | 'grid';

/**
 * Per-section hint. Sections not listed get the plain stage; `null` means the
 * stand-in's own content is the whole section (the manifesto is a type
 * poster; the work wall's stand-in shows its real tiles), so it shows no
 * stage at all. The hero has its own stand-in (HeroFallback).
 */
const SHAPES: Partial<Record<SectionId, SkeletonShape | null>> = {
  manifesto: null,
  xray: 'browser',
  'code-to-ui': 'browser',
  devices: 'phone',
  telegram: 'phone',
  'mobile-build': 'phone',
  'web-build': 'browser',
  'crm-build': 'browser',
  // The stand-in shows the wall's first real tiles (standins/WorkStandIn.tsx).
  'work-wall': null,
  numbers: 'grid',
  globe: 'orb',
  'stack-physics': 'grid',
};

const GRID_TILES = 6;
const TILE_KEYS = Array.from({ length: GRID_TILES }, (_, index) => `tile-${index}`);

export function skeletonShapeFor(id: SectionId): SkeletonShape | null {
  const shape = SHAPES[id];
  return shape === undefined ? 'stage' : shape;
}

interface SectionSkeletonProps {
  shape: SkeletonShape;
}

/**
 * The glowing stage a section's stand-in shows while the section's code is
 * on the way (before it mounts, and while its chunk loads). Pure CSS, no
 * state; it unmounts with the stand-in. Hidden without scripts and after a
 * crash (Skeleton.module.css), where nothing is coming.
 */
export default function SectionSkeleton({ shape }: SectionSkeletonProps) {
  return (
    <div className={css.section} aria-hidden='true' data-lab-skeleton=''>
      <div className={css.block} data-shape={shape}>
        {shape === 'grid' ? TILE_KEYS.map(key => <span key={key} className={css.tile} />) : null}
      </div>
    </div>
  );
}
