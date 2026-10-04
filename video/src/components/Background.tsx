import type { CSSProperties } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../theme';

const glow = (color: string, size: number, left: number, top: number, opacity: number): CSSProperties => ({
  position: 'absolute',
  left,
  top,
  width: size,
  height: size,
  borderRadius: '50%',
  background: `radial-gradient(circle, ${color} 0%, transparent 62%)`,
  opacity,
});

const DOT_GRID: CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255, 220, 200, 0.07) 1.5px, transparent 1.5px)',
  backgroundSize: '40px 40px',
  maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 72%)',
  WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 72%)',
};

const VIGNETTE: CSSProperties = {
  background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.6) 100%)',
};

/** Persistent backdrop: Ember base, slowly drifting project-accent glow, dot grid and vignette. */
export const Background = ({ accent }: { accent: string }) => {
  const frame = useCurrentFrame();
  const driftX = Math.sin(frame / 95) * 90;
  const driftY = Math.cos(frame / 120) * 70;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: 'hidden' }}>
      <div style={glow(accent, 1500, 900 + driftX, -500 + driftY, 0.34)} />
      <div style={glow(COLORS.accent, 1200, -500 - driftY, 380 + driftX * 0.6, 0.16)} />
      <AbsoluteFill style={DOT_GRID} />
      <AbsoluteFill style={VIGNETTE} />
    </AbsoluteFill>
  );
};
