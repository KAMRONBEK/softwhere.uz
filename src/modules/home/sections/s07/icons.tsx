import type { SVGProps } from 'react';
import type { ArtKind } from './data';
import css from './art.module.css';

/** Line icons for the chat UI (24px grid, currentColor). Original drawings, no app logos. */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
      {...props}
    >
      {children}
    </svg>
  );
}

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M15 5l-7 7 7 7' />
  </Icon>
);
export const DotsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx='12' cy='5.5' r='1.2' fill='currentColor' stroke='none' />
    <circle cx='12' cy='12' r='1.2' fill='currentColor' stroke='none' />
    <circle cx='12' cy='18.5' r='1.2' fill='currentColor' stroke='none' />
  </Icon>
);
export const ClipIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M20 11.5l-7.6 7.6a5 5 0 01-7.1-7.1l8-8a3.4 3.4 0 014.8 4.8l-7.9 7.9a1.7 1.7 0 01-2.4-2.4l7.1-7.1' />
  </Icon>
);
export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x='9' y='3' width='6' height='11' rx='3' />
    <path d='M5.5 11a6.5 6.5 0 0013 0M12 17.5V21' />
  </Icon>
);
export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M12 19V5M6 11l6-6 6 6' />
  </Icon>
);
export const SmileIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx='12' cy='12' r='8.5' />
    <path d='M8.5 14a4.5 4.5 0 007 0' />
    <path d='M9.2 9.6h.01M14.8 9.6h.01' strokeWidth={2.6} />
  </Icon>
);
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M5 7h14M5 12h14M5 17h9' />
  </Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M5 12.5l4.5 4.5L19 7.5' />
  </Icon>
);
export const DoubleCheckIcon = (p: IconProps) => (
  <Icon {...p} viewBox='0 0 28 24'>
    <path d='M3 12.5l4.5 4.5L17 7.5M12 16.5l.5.5L22 7.5' />
  </Icon>
);
export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x='5' y='10.5' width='14' height='10' rx='2.5' />
    <path d='M8.5 10.5V8a3.5 3.5 0 017 0v2.5' />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M6 6l12 12M18 6L6 18' />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M12 5v14M5 12h14' />
  </Icon>
);
export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M5 12h14' />
  </Icon>
);
export const AppIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x='4' y='4' width='6.5' height='6.5' rx='1.6' />
    <rect x='13.5' y='4' width='6.5' height='6.5' rx='1.6' />
    <rect x='4' y='13.5' width='6.5' height='6.5' rx='1.6' />
    <rect x='13.5' y='13.5' width='6.5' height='6.5' rx='1.6' />
  </Icon>
);
export const ReplayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M4 12a8 8 0 102.6-5.9' />
    <path d='M4 4v4.5h4.5' />
  </Icon>
);

/** Status bar glyphs, filled. */
export function StatusGlyphs() {
  return (
    <svg viewBox='0 0 66 14' aria-hidden='true' focusable='false' fill='currentColor'>
      <rect x='0' y='9' width='3' height='4' rx='1' />
      <rect x='5' y='6.5' width='3' height='6.5' rx='1' />
      <rect x='10' y='4' width='3' height='9' rx='1' />
      <rect x='15' y='1.5' width='3' height='11.5' rx='1' />
      <path d='M30.5 12.6l-2.3-2.4a3.3 3.3 0 014.6 0zM26.6 8.6a5.6 5.6 0 017.8 0l1.3-1.4a7.6 7.6 0 00-10.4 0zM24 5.9a9.4 9.4 0 0113 0l1.3-1.4a11.4 11.4 0 00-15.6 0z' />
      <rect x='42' y='1.5' width='20' height='11' rx='3' fill='none' stroke='currentColor' strokeOpacity='0.45' />
      <rect x='44' y='3.5' width='14' height='7' rx='1.6' />
      <rect x='63.2' y='5' width='1.6' height='4' rx='0.8' opacity='0.45' />
    </svg>
  );
}

/** The café's avatar: a cup seen from above. */
export function CafeGlyph() {
  return (
    <svg viewBox='0 0 32 32' aria-hidden='true' focusable='false' fill='none' stroke='currentColor' strokeWidth={2.2} strokeLinecap='round'>
      <circle cx='15' cy='17' r='8.5' />
      <path d='M23.5 15h1.8a2.6 2.6 0 010 5.2h-2.1' />
      <path d='M12 11.5c0-2 2-2.2 2-4.2M16.5 11.5c0-2 2-2.2 2-4.2' />
    </svg>
  );
}

/* ---------- food illustrations (64px grid, themed through art.module.css) ---------- */

function Saucer() {
  return (
    <>
      <circle className={css.saucer} cx='31' cy='32' r='29' />
      <rect className={css.cup} x='47' y='28.5' width='13' height='7' rx='3.5' />
      <circle className={css.cup} cx='31' cy='32' r='21' />
    </>
  );
}

function Cup({ kind }: { kind: 'rosetta' | 'cup' | 'flat' | 'matcha' }) {
  const liquid = kind === 'matcha' ? css.matcha : kind === 'flat' ? css.espresso : css.coffee;
  return (
    <svg viewBox='0 0 64 64' aria-hidden='true' focusable='false' className={css.art}>
      <Saucer />
      <circle className={liquid} cx='31' cy='32' r='17' />
      {kind === 'rosetta' && (
        <g className={css.foam}>
          <path d='M31 44c-7-4.5-9.5-9.5-7.6-13.8 1.4-3.1 5-3.4 7.6-.6 2.6-2.8 6.2-2.5 7.6.6C40.5 34.5 38 39.5 31 44z' />
          <ellipse cx='31' cy='24.5' rx='4.2' ry='2.6' />
          <path d='M31 20.5v21' className={css.pour} />
        </g>
      )}
      {kind === 'cup' && (
        <g className={css.foam}>
          <ellipse cx='31' cy='37' rx='7.5' ry='4.6' />
          <ellipse cx='31' cy='30.5' rx='6' ry='3.6' />
          <ellipse cx='31' cy='25.2' rx='4.3' ry='2.6' />
        </g>
      )}
      {kind === 'flat' && (
        <g className={css.foam}>
          <path d='M31 37.5c-4-2.6-5.4-5.4-4.3-7.8.8-1.8 2.9-1.9 4.3-.3 1.4-1.6 3.5-1.5 4.3.3 1.1 2.4-.3 5.2-4.3 7.8z' />
        </g>
      )}
      {kind === 'matcha' && (
        <g className={css.matchaFoam}>
          <path d='M22 33c3-6 13-8 18-2' fill='none' strokeWidth='2.2' strokeLinecap='round' />
          <path d='M25 38c3-3 9-4 12-1' fill='none' strokeWidth='2.2' strokeLinecap='round' />
        </g>
      )}
    </svg>
  );
}

function Croissant() {
  return (
    <svg viewBox='0 0 64 64' aria-hidden='true' focusable='false' className={css.art}>
      <ellipse className={css.plate} cx='32' cy='34' rx='29' ry='25' />
      <g className={css.pastry}>
        <path d='M10 38c2-6 6-9 10-9l3 10c-4 3-9 3-13-1z' />
        <path d='M54 38c-2-6-6-9-10-9l-3 10c4 3 9 3 13-1z' />
        <path d='M20 28c3-5 7-7 11-7l1 15c-4 2-8 3-10 3z' />
        <path d='M44 28c-3-5-7-7-11-7l-1 15c4 2 8 3 10 3z' />
        <path d='M26 22c3-4 9-4 12 0l-2 15c-3 1-5 1-8 0z' />
      </g>
      <g className={css.crumb}>
        <path d='M22 31l2 6M42 31l-2 6M29 24l1 11M35 24l-1 11' fill='none' strokeWidth='1.4' strokeLinecap='round' />
      </g>
    </svg>
  );
}

function Samsa() {
  return (
    <svg viewBox='0 0 64 64' aria-hidden='true' focusable='false' className={css.art}>
      <ellipse className={css.plate} cx='32' cy='34' rx='29' ry='25' />
      <path
        className={css.pastry}
        d='M32 12c2 0 3.4 1 4.4 2.8l14 25c1.8 3.2-.4 7.2-4.1 7.2H17.7c-3.7 0-5.9-4-4.1-7.2l14-25C28.6 13 30 12 32 12z'
      />
      <path className={css.crumb} d='M22 41l10-18 10 18' fill='none' strokeWidth='1.4' strokeLinecap='round' strokeLinejoin='round' />
      <g className={css.sesame}>
        <ellipse cx='27' cy='33' rx='1.1' ry='0.7' transform='rotate(-30 27 33)' />
        <ellipse cx='33' cy='29' rx='1.1' ry='0.7' transform='rotate(20 33 29)' />
        <ellipse cx='36' cy='36' rx='1.1' ry='0.7' transform='rotate(-10 36 36)' />
        <ellipse cx='30' cy='38' rx='1.1' ry='0.7' transform='rotate(40 30 38)' />
        <ellipse cx='39' cy='41' rx='1.1' ry='0.7' />
        <ellipse cx='24' cy='40' rx='1.1' ry='0.7' transform='rotate(15 24 40)' />
      </g>
    </svg>
  );
}

export function FoodArt({ kind }: { kind: ArtKind }) {
  if (kind === 'croissant') return <Croissant />;
  if (kind === 'samsa') return <Samsa />;
  return <Cup kind={kind} />;
}
