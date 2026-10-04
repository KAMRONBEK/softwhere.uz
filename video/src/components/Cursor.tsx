import { COLORS } from '../theme';

type Props = {
  x: number;
  y: number;
  /** 0→1 while a click ripple plays; 0 when idle. */
  click: number;
  opacity: number;
};

const RIPPLE_SIZE = 84;

/** Synthetic mouse pointer with a click ripple, positioned in its parent's pixel space. */
export const Cursor = ({ x, y, click, opacity }: Props) => {
  const rippleSize = RIPPLE_SIZE * click;
  const isClicking = click > 0 && click < 1;
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity }}>
      {isClicking ? (
        <div
          style={{
            position: 'absolute',
            left: -rippleSize / 2,
            top: -rippleSize / 2,
            width: rippleSize,
            height: rippleSize,
            borderRadius: '50%',
            border: `3px solid ${COLORS.accent}`,
            opacity: 1 - click,
          }}
        />
      ) : null}
      <svg
        width={34}
        height={34}
        viewBox='0 0 24 24'
        style={{
          filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.45))',
          transform: `scale(${1 - 0.15 * Math.sin(Math.PI * click)})`,
          transformOrigin: '0 0',
        }}
      >
        <path
          d='M4 2.5 L4 19 L8.6 14.6 L11.6 21.5 L14.4 20.3 L11.4 13.5 L17.8 13.5 Z'
          fill='#fff'
          stroke='#111'
          strokeWidth={1.4}
          strokeLinejoin='round'
        />
      </svg>
    </div>
  );
};
