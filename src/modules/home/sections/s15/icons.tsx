import type { ReactNode } from 'react';
import type { ArtKind } from './data';
import css from './art.module.css';

/** Stroke icons on a 24 grid, drawn in currentColor. Decorative: the buttons carry the labels. */
function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
    >
      {children}
    </svg>
  );
}

export const PinIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z' />
    <circle cx='12' cy='10' r='2.4' />
  </Icon>
);

export const ChevronDownIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M6 9l6 6 6-6' />
  </Icon>
);

export const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M15 5l-7 7 7 7' />
  </Icon>
);

export const SearchIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx='11' cy='11' r='6.5' />
    <path d='M20 20l-4.2-4.2' />
  </Icon>
);

export const BagIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M5 8h14l-1.2 11.2a2 2 0 01-2 1.8H8.2a2 2 0 01-2-1.8z' />
    <path d='M9 10V7a3 3 0 016 0v3' />
  </Icon>
);

export const SunIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx='12' cy='12' r='4' />
    <path d='M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4' />
  </Icon>
);

export const MoonIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z' />
  </Icon>
);

export const PlusIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M12 5v14M5 12h14' />
  </Icon>
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M5 12.5l4.5 4.5L19 7.5' />
  </Icon>
);

export const HomeIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M4 10.5L12 4l8 6.5V19a1.5 1.5 0 01-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 014 19z' />
  </Icon>
);

export const ReceiptIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M6 3.5h12v17l-3-2-3 2-3-2-3 2z' />
    <path d='M9 8.5h6M9 12.5h6' />
  </Icon>
);

export const UserIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx='12' cy='8.5' r='3.8' />
    <path d='M4.5 20.5a7.5 7.5 0 0115 0' />
  </Icon>
);

export const PhoneCallIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M6.5 3.5h3l1.5 4.5-2.2 1.4a11 11 0 005.8 5.8l1.4-2.2 4.5 1.5v3a2 2 0 01-2.2 2A16.5 16.5 0 014.5 5.7a2 2 0 012-2.2z' />
  </Icon>
);

export const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
    <path fill='currentColor' d='M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z' />
  </svg>
);

/** Neutral store glyphs: a phone with a download arrow, and a bag (no store logos). */
export const StoreGlyph = ({ className, kind }: { className?: string; kind: 'ios' | 'android' }) =>
  kind === 'ios' ? (
    <Icon className={className}>
      <rect x='6.5' y='2.5' width='11' height='19' rx='2.5' />
      <path d='M12 7.5v7M9 11.5l3 3 3-3' />
    </Icon>
  ) : (
    <Icon className={className}>
      <path d='M4.5 8.5h15l-1 12h-13z' />
      <path d='M8.5 8.5a3.5 3.5 0 017 0M9.5 14.5l2.5 2.5 2.5-2.5M12 11.5v5.5' />
    </Icon>
  );

export const BikeIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx='6' cy='16.5' r='3.5' />
    <circle cx='18' cy='16.5' r='3.5' />
    <path d='M6 16.5l4-7h5l3 7M9 7.5h3M15 9.5l-2.5 7' />
  </Icon>
);

export const ArrowIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d='M4 12h15M13 6l6 6-6 6' />
  </Icon>
);

/** Status bar glyphs (signal, wifi, battery), filled. */
export function StatusGlyphs({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 66 14' aria-hidden='true' focusable='false'>
      <g fill='currentColor'>
        <rect x='0' y='9' width='3' height='4' rx='0.8' />
        <rect x='5' y='6.5' width='3' height='6.5' rx='0.8' />
        <rect x='10' y='4' width='3' height='9' rx='0.8' />
        <rect x='15' y='1.5' width='3' height='11.5' rx='0.8' />
        <path d='M31 12.6l2.3-2.4a3.3 3.3 0 00-4.6 0zM26.4 7.9l1.4 1.4a5.9 5.9 0 016.4 0l1.4-1.4a7.9 7.9 0 00-9.2 0zM24 5.5l1.4 1.4a9.5 9.5 0 0111.2 0L38 5.5a11.5 11.5 0 00-14 0z' />
        <rect x='44' y='2' width='19' height='10' rx='2.6' fillOpacity='0.4' />
        <rect x='45.6' y='3.6' width='14.6' height='6.8' rx='1.5' />
        <rect x='63.6' y='5' width='1.8' height='4' rx='0.8' fillOpacity='0.4' />
      </g>
    </svg>
  );
}

/** Two-tone dish illustrations (48 grid); colours come from art.module.css. */
export function DishArt({ kind, className }: { kind: ArtKind; className?: string }) {
  return (
    <svg className={`${css.art} ${className ?? ''}`} viewBox='0 0 48 48' aria-hidden='true' focusable='false'>
      {kind === 'croissant' && (
        <g>
          <path className={css.warm} d='M6 30c2-9 10-15 18-15s16 6 18 15c-3 3-7 3-9 1-2 3-6 4-9 4s-7-1-9-4c-2 2-6 2-9-1z' />
          <path className={css.line} d='M17 18.5c1.5 4 2 9 1.5 14.5M31 18.5c-1.5 4-2 9-1.5 14.5M24 15v19' />
        </g>
      )}
      {kind === 'pizza' && (
        <g>
          <path className={css.warm} d='M24 7L40 37c-10 5-22 5-32 0z' />
          <path className={css.crust} d='M8 37c10 5 22 5 32 0l2 3.5c-11 6-25 6-36 0z' />
          <circle className={css.hot} cx='23' cy='22' r='2.6' />
          <circle className={css.hot} cx='19' cy='31' r='2.6' />
          <circle className={css.hot} cx='29' cy='30' r='2.6' />
          <path className={css.leaf} d='M25.5 27.5c1.5-1.8 3.6-2 4.8-1.4-.7 1.5-2.7 2.6-4.8 1.4z' />
        </g>
      )}
      {kind === 'coffee' && (
        <g>
          <path className={css.cup} d='M12 15h21l-2.4 24a3 3 0 01-3 2.7H17.4a3 3 0 01-3-2.7z' />
          <path className={css.warm} d='M13.4 25h18.2l-1 10H14.4z' />
          <rect className={css.lid} x='10' y='11' width='25' height='5' rx='2' />
          <path className={css.line} d='M26 11l3-6h5' />
        </g>
      )}
      {kind === 'salad' && (
        <g>
          <path className={css.leaf} d='M11 26c0-7 5-12 9-12 1 3 0 7-2 9 2-4 7-7 11-6 0 4-3 8-6 9 3-2 8-3 12-1-2 4-7 6-10 6z' />
          <circle className={css.hot} cx='17' cy='25' r='3' />
          <circle className={css.hot} cx='31' cy='24' r='2.4' />
          <path className={css.bowl} d='M6 26h36c-1 9-8 15-18 15S7 35 6 26z' />
        </g>
      )}
    </svg>
  );
}
