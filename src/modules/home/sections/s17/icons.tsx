import type { SVGProps } from 'react';

/** Line icons for the RAG demo (24px grid, currentColor). Original drawings, no app logos. */
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

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x='5' y='10.5' width='14' height='10' rx='2' />
    <path d='M8.5 10.5V8a3.5 3.5 0 017 0v2.5' />
  </Icon>
);

export const UnlockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x='5' y='10.5' width='14' height='10' rx='2' />
    <path d='M8.5 10.5V8a3.5 3.5 0 016.7-1.4' />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx='11' cy='11' r='6.5' />
    <path d='M20 20l-4.2-4.2' />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M12 19V5M6 11l6-6 6 6' />
  </Icon>
);

export const ReplayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M4 12a8 8 0 1 0 2.4-5.7' />
    <path d='M4 4v4.5h4.5' />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M5 12.5l4.2 4.2L19 7' />
  </Icon>
);

export const AskIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx='12' cy='12' r='8.5' />
    <path d='M9.6 9.4a2.5 2.5 0 014.8.9c0 1.7-2.4 2.1-2.4 3.6' />
    <path d='M12 17h.01' strokeWidth={2.6} />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z' />
    <path d='M9 12l2.2 2.2L15.5 10' />
  </Icon>
);

/** The assistant's avatar: a page with a spark (reads your files). */
export const AssistantIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M13.5 3.5H7a2 2 0 00-2 2v13a2 2 0 002 2h10a2 2 0 002-2V9z' />
    <path d='M13.5 3.5V9H19' />
    <path d='M12 12.2v4.6M9.7 14.5h4.6' />
  </Icon>
);

/** A study-platform glyph for the proof line (an open book), no product logo. */
export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M12 6.5C10.3 5.2 8 4.5 4 4.5v13c4 0 6.3.7 8 2 1.7-1.3 4-2 8-2v-13c-4 0-6.3.7-8 2z' />
    <path d='M12 6.5v13' />
  </Icon>
);

/** Down the page, to the AI brief. */
export const ArrowIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d='M12 5v14M6 13l6 6 6-6' />
  </Icon>
);
