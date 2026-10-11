import type { JSX } from 'react';
import type { ArtId } from './data';

/**
 * The example bakery's pictures: a sourdough boule, a croissant and a
 * cinnamon bun, painted with soft crust gradients and a contact shadow, so
 * they read as product shots on the site's tinted backdrop (bread keeps its
 * own golden colours in every lab style and in the site's dark mode). The
 * gradients live once in <BakeDefs/> (fixed ids, shared by every copy of the
 * site). Decorative: aria-hidden everywhere.
 */

interface ArtProps {
  className?: string;
}

const CRUST = 'url(#s16-crust)';
const LOBE = 'url(#s16-lobe)';
const SHADE = 'url(#s16-shade)';
const BUN = 'url(#s16-bun)';

/** Gradient definitions for every bakery picture. Render once per section. */
export function BakeDefs() {
  return (
    <svg width='0' height='0' style={{ position: 'absolute' }} aria-hidden='true' focusable='false'>
      <defs>
        <radialGradient id='s16-crust' cx='0.42' cy='0.28' r='0.8'>
          <stop offset='0' stopColor='#f4cd88' />
          <stop offset='0.45' stopColor='#d9963f' />
          <stop offset='1' stopColor='#9a531c' />
        </radialGradient>
        <radialGradient id='s16-lobe' cx='0.45' cy='0.25' r='0.85'>
          <stop offset='0' stopColor='#f8d793' />
          <stop offset='0.5' stopColor='#dc9841' />
          <stop offset='1' stopColor='#a35a20' />
        </radialGradient>
        <linearGradient id='s16-shade' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0.55' stopColor='#5a2a0c' stopOpacity='0' />
          <stop offset='1' stopColor='#5a2a0c' stopOpacity='0.42' />
        </linearGradient>
        <radialGradient id='s16-bun' cx='0.46' cy='0.4' r='0.62'>
          <stop offset='0' stopColor='#f1c47c' />
          <stop offset='0.6' stopColor='#d38a3a' />
          <stop offset='1' stopColor='#97501b' />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** The bakery's mark: an ear of wheat. */
export function WheatMark({ className }: ArtProps) {
  return (
    <svg
      className={className}
      viewBox='0 0 32 32'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.2'
      strokeLinecap='round'
      aria-hidden='true'
    >
      <path d='M16 29V9' />
      <path d='M16 12c-3.4-.4-5.6-2.6-6-6 3.4.4 5.6 2.6 6 6Zm0 0c3.4-.4 5.6-2.6 6-6-3.4.4-5.6 2.6-6 6Z' />
      <path d='M16 18.5c-3.4-.4-5.6-2.6-6-6 3.4.4 5.6 2.6 6 6Zm0 0c3.4-.4 5.6-2.6 6-6-3.4.4-5.6 2.6-6 6Z' />
      <path d='M16 25c-3.4-.4-5.6-2.6-6-6 3.4.4 5.6 2.6 6 6Zm0 0c3.4-.4 5.6-2.6 6-6-3.4.4-5.6 2.6-6 6Z' />
      <path d='M16 9V3' />
    </svg>
  );
}

const SHADOW = <ellipse cx='70' cy='85' rx='52' ry='5.5' fill='#1d0e04' opacity='0.22' />;

const LOAF_BODY = 'M14 70C10 43 37 21 70 21s60 22 56 49c-1.4 8-8 12-16 12H30c-8 0-14.6-4-16-12Z';
/** The baker's cuts: a lighter, open crumb with a dark lip on one side. */
const LOAF_CUTS = [
  'M41 35c10 9 13 21 9 35-3-12-6-23-9-35Z',
  'M64 29c10 11 12 25 7 41-3-14-5-27-7-41Z',
  'M88 34c9 10 10 22 5 36-2-12-3-24-5-36Z',
];

function Loaf() {
  return (
    <>
      {SHADOW}
      <path d={LOAF_BODY} fill={CRUST} />
      <path d={LOAF_BODY} fill={SHADE} />
      {LOAF_CUTS.map(d => (
        <path key={d} d={d} fill='#f7ddb0' stroke='#9b551f' strokeWidth='1.3' strokeLinejoin='round' />
      ))}
      <g fill='#fff' opacity='0.6'>
        <circle cx='52' cy='28' r='1.3' />
        <circle cx='58' cy='25' r='1' />
        <circle cx='79' cy='26' r='1.2' />
        <circle cx='96' cy='31' r='0.9' />
        <circle cx='46' cy='33' r='0.8' />
      </g>
    </>
  );
}

/** Croissant lobes, tips first so the middle one sits on top: cx, cy, rx, ry, rotation. */
const LOBES: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [19, 71, 7, 10, -55],
  [121, 71, 7, 10, 55],
  [32, 63, 11, 16, -38],
  [108, 63, 11, 16, 38],
  [50, 55, 14, 21, -18],
  [90, 55, 14, 21, 18],
  [70, 51, 17, 26, 0],
];

function Croissant() {
  return (
    <>
      {SHADOW}
      {LOBES.map(([cx, cy, rx, ry, rotate]) => (
        <ellipse
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          transform={`rotate(${rotate} ${cx} ${cy})`}
          fill={LOBE}
          stroke='#8f4a17'
          strokeWidth='1.2'
        />
      ))}
      <path d='M60 34c6-3 14-3 20 0' fill='none' stroke='#fff' strokeOpacity='0.45' strokeWidth='2.4' strokeLinecap='round' />
    </>
  );
}

/** An Archimedean spiral (the bun's roll), computed once. */
const SPIRAL = (() => {
  const points: string[] = [];
  const turns = 3.4;
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * turns * Math.PI * 2;
    const radius = 2.5 + (theta / (Math.PI * 2)) * 7.4;
    points.push(`${(70 + radius * Math.cos(theta)).toFixed(1)},${(52 + radius * 0.9 * Math.sin(theta)).toFixed(1)}`);
  }
  return `M${points.join('L')}`;
})();

function Bun() {
  return (
    <>
      {SHADOW}
      <ellipse cx='70' cy='54' rx='38' ry='32' fill={BUN} />
      <ellipse cx='70' cy='54' rx='38' ry='32' fill={SHADE} />
      <path d={SPIRAL} fill='none' stroke='#7c3b10' strokeOpacity='0.75' strokeWidth='3.2' strokeLinecap='round' strokeLinejoin='round' />
      <path
        d='M42 44c9-6 15 14 24 6s14-14 22-4 10 12 14 4M46 64c8-5 14 9 22 3s13-11 21-3'
        fill='none'
        stroke='#fffaf1'
        strokeOpacity='0.95'
        strokeWidth='2.6'
        strokeLinecap='round'
      />
    </>
  );
}

const ART: Record<ArtId, () => JSX.Element> = { loaf: Loaf, croissant: Croissant, bun: Bun };

export function BakeArt({ id, className }: ArtProps & { id: ArtId }) {
  const Shape = ART[id];
  return (
    <svg className={className} viewBox='0 0 140 96' aria-hidden='true'>
      <Shape />
    </svg>
  );
}

/** Steam over the hero loaf (three soft wisps). */
export function Steam({ className }: ArtProps) {
  return (
    <svg
      className={className}
      viewBox='0 0 140 40'
      fill='none'
      stroke='currentColor'
      strokeWidth='3'
      strokeLinecap='round'
      aria-hidden='true'
    >
      <path d='M48 36c-6-8 6-12 0-20s4-10 2-14' />
      <path d='M70 36c-6-8 6-12 0-20s4-10 2-14' />
      <path d='M92 36c-6-8 6-12 0-20s4-10 2-14' />
    </svg>
  );
}
