import type { ReactNode } from 'react';
import { FONTS } from '../fonts';
import { COLORS } from '../theme';

type Props = {
  width: number;
  contentHeight: number;
  url: string;
  children: ReactNode;
};

export const BROWSER_BAR_HEIGHT = 48;
const TRAFFIC_LIGHTS = ['#ff5f57', '#febc2e', '#28c840'];

const LockIcon = () => (
  <svg width={16} height={16} viewBox='0 0 24 24' fill='none' stroke={COLORS.muted} strokeWidth={2.2} strokeLinecap='round'>
    <rect x={5} y={11} width={14} height={10} rx={2} />
    <path d='M8 11V8a4 4 0 0 1 8 0v3' />
  </svg>
);

/** Minimal dark browser window with an address bar; children fill the viewport area. */
export const BrowserFrame = ({ width, contentHeight, url, children }: Props) => (
  <div
    style={{
      width,
      borderRadius: 18,
      overflow: 'hidden',
      background: '#140d09',
      border: '1px solid rgba(255, 255, 255, 0.09)',
      boxShadow: '0 60px 120px rgba(0, 0, 0, 0.55)',
    }}
  >
    <div
      style={{
        height: BROWSER_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 20px',
        background: 'linear-gradient(#21160f, #1a110b)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {TRAFFIC_LIGHTS.map(color => (
        <div key={color} style={{ width: 14, height: 14, borderRadius: 7, background: color }} />
      ))}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            minWidth: '46%',
            padding: '7px 22px',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.06)',
            fontFamily: FONTS.mono,
            fontSize: 18,
            color: COLORS.muted,
          }}
        >
          <LockIcon />
          <span>{url}</span>
        </div>
      </div>
      <div style={{ width: 62 }} />
    </div>
    <div style={{ position: 'relative', width, height: contentHeight, overflow: 'hidden', background: '#ffffff' }}>{children}</div>
  </div>
);
