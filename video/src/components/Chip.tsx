import type { CSSProperties, ReactNode } from 'react';
import { FONTS } from '../fonts';
import { COLORS } from '../theme';

type Props = {
  children: ReactNode;
  tone?: 'default' | 'accent';
  size?: number;
  style?: CSSProperties;
};

export const Chip = ({ children, tone = 'default', size = 26, style }: Props) => {
  const isAccent = tone === 'accent';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.4,
        padding: `${size * 0.42}px ${size * 0.85}px`,
        borderRadius: 999,
        fontFamily: FONTS.body,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: isAccent ? COLORS.bg : COLORS.text,
        background: isAccent ? COLORS.accent2 : 'rgba(255, 240, 230, 0.06)',
        border: `1px solid ${isAccent ? 'transparent' : COLORS.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
