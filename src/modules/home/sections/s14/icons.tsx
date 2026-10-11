import type { SVGProps } from 'react';

/** One stroke family: 24px grid, 1.75 stroke, round caps — drawn for this section. */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox='0 0 24 24'
      width={20}
      height={20}
      fill='none'
      stroke='currentColor'
      strokeWidth={1.75}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
      {...props}
    />
  );
}

export function TelegramIcon() {
  return (
    <Icon>
      <path d='M21 4.5 3.6 11.2c-.8.3-.8 1.4 0 1.7l4.3 1.6 1.7 5.1c.2.7 1.1.9 1.6.4l2.5-2.4 4.5 3.3c.6.4 1.4.1 1.6-.6L22.2 5.7c.2-.8-.5-1.5-1.2-1.2Z' />
      <path d='m7.9 14.5 9.6-6.6-6.9 7.6' />
    </Icon>
  );
}

export function PhoneIcon() {
  return (
    <Icon>
      <path d='M5.2 3.5h3.1l1.6 4.2-2.1 1.4a11.6 11.6 0 0 0 7.1 7.1l1.4-2.1 4.2 1.6v3.1a2.2 2.2 0 0 1-2.4 2.2A16.9 16.9 0 0 1 3 5.9a2.2 2.2 0 0 1 2.2-2.4Z' />
    </Icon>
  );
}

export function MailIcon() {
  return (
    <Icon>
      <rect x={3} y={5} width={18} height={14} rx={2.5} />
      <path d='m3.8 6.6 7.4 5.6c.5.4 1.1.4 1.6 0l7.4-5.6' />
    </Icon>
  );
}

/** Drawn on with stroke-dashoffset when the success state appears (pathLength = 1). */
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 48 48' className={className} fill='none' aria-hidden='true' focusable='false'>
      <circle cx={24} cy={24} r={21} stroke='currentColor' strokeWidth={2} pathLength={1} data-draw='' />
      <path
        d='m15 24.5 6.2 6.2L33.5 18'
        stroke='currentColor'
        strokeWidth={2.5}
        strokeLinecap='round'
        strokeLinejoin='round'
        pathLength={1}
        data-draw=''
      />
    </svg>
  );
}
