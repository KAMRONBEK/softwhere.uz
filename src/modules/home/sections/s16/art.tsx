import type { ReactNode } from 'react';

/**
 * Browser and toolbar icons for `web-build` (the bakery's own pictures live in
 * bakery.tsx). Stroked with currentColor; decorative, aria-hidden.
 */

// ---------- UI icons (stage scale) ----------

interface IconProps {
  className?: string;
}

function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      {children}
    </svg>
  );
}

export function DesktopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x='3' y='4' width='18' height='12' rx='1.5' />
      <path d='M9 20h6M12 16v4' />
    </Icon>
  );
}

export function TabletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x='5' y='3' width='14' height='18' rx='2' />
      <path d='M11 18h2' />
    </Icon>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x='7' y='3' width='10' height='18' rx='2' />
      <path d='M11 18h2' />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d='M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z' />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx='12' cy='12' r='4' />
      <path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x='5' y='11' width='14' height='10' rx='2' />
      <path d='M8 11V8a4 4 0 0 1 8 0v3' />
    </Icon>
  );
}

export function PenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d='M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z' />
    </Icon>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d='M8 7l-5 5 5 5M16 7l5 5-5 5' />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d='M5 12.5l4.5 4.5L19 7.5' />
    </Icon>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d='M5 12h14M13 6l6 6-6 6' />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d='M4 7h16M4 12h16M4 17h16' />
    </Icon>
  );
}
