import type { ReactNode } from 'react';

/** iphone = dynamic island + left volume keys; android = punch-hole camera + right-side keys. */
export type DeviceVariant = 'iphone' | 'android';

type Props = {
  width: number;
  /** Screen height / width. */
  screenAspect: number;
  accent: string;
  variant?: DeviceVariant;
  children: ReactNode;
};

const BEZEL_RATIO = 0.045;
/** Taller than this gets the modern rounded body + dynamic island; shorter looks like a classic 16:9 phone. */
const MODERN_MIN_ASPECT = 1.9;
export const SCREEN_ASPECT_RANGE = { min: 1.6, max: 2.2 } as const;

export const phoneWidthForHeight = (height: number, screenAspect: number): number =>
  height / ((1 - 2 * BEZEL_RATIO) * screenAspect + 2 * BEZEL_RATIO);

export const clampScreenAspect = (aspect: number): number => Math.min(SCREEN_ASPECT_RANGE.max, Math.max(SCREEN_ASPECT_RANGE.min, aspect));

/** Pixel size of the screen area inside a phone of the given outer width. */
export const phoneScreenSize = (width: number, screenAspect: number): { width: number; height: number } => {
  const screenWidth = width * (1 - 2 * BEZEL_RATIO);
  return { width: screenWidth, height: screenWidth * screenAspect };
};

const SideButton = ({ side, top, length, thickness }: { side: 'left' | 'right'; top: number; length: number; thickness: number }) => (
  <div
    style={{
      position: 'absolute',
      [side]: -thickness * 0.6,
      top,
      width: thickness,
      height: length,
      borderRadius: thickness,
      background: '#2c2c31',
    }}
  />
);

/** Dynamic island (iPhone) or a centred punch-hole camera (Android) over the top of the screen. */
const CameraCutout = ({ variant, screenWidth }: { variant: DeviceVariant; screenWidth: number }) => {
  if (variant === 'android') {
    const diameter = screenWidth * 0.042;
    return (
      <div
        style={{
          position: 'absolute',
          top: screenWidth * 0.03,
          left: (screenWidth - diameter) / 2,
          width: diameter,
          height: diameter,
          borderRadius: '50%',
          background: '#000',
          boxShadow: '0 0 0 2px rgba(40, 40, 46, 0.9)',
        }}
      />
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        top: screenWidth * 0.028,
        left: (screenWidth - screenWidth * 0.3) / 2,
        width: screenWidth * 0.3,
        height: screenWidth * 0.088,
        borderRadius: 999,
        background: '#000',
      }}
    />
  );
};

/** CSS-drawn phone body; children fill the screen area. */
export const PhoneFrame = ({ width, screenAspect, accent, variant = 'iphone', children }: Props) => {
  const bezel = width * BEZEL_RATIO;
  const { width: screenWidth, height: screenHeight } = phoneScreenSize(width, screenAspect);
  const isModern = screenAspect >= MODERN_MIN_ASPECT;
  const isAndroid = variant === 'android';
  const outerRadius = width * (isModern && !isAndroid ? 0.165 : 0.11);
  const innerRadius = Math.max(4, outerRadius - bezel);
  const button = width * 0.014;

  return (
    <div style={{ position: 'relative', width, height: screenHeight + bezel * 2 }}>
      {isAndroid ? (
        <>
          <SideButton side='right' top={width * 0.36} length={width * 0.3} thickness={button} />
          <SideButton side='right' top={width * 0.76} length={width * 0.16} thickness={button} />
        </>
      ) : (
        <>
          <SideButton side='left' top={width * 0.42} length={width * 0.16} thickness={button} />
          <SideButton side='left' top={width * 0.64} length={width * 0.16} thickness={button} />
          <SideButton side='right' top={width * 0.5} length={width * 0.26} thickness={button} />
        </>
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: outerRadius,
          background: 'linear-gradient(150deg, #3b3b40 0%, #141416 45%, #26262a 100%)',
          boxShadow: `inset 0 0 0 ${width * 0.006}px #55555c, 0 60px 120px rgba(0, 0, 0, 0.55), 0 0 140px ${accent}2e`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: bezel,
          top: bezel,
          width: screenWidth,
          height: screenHeight,
          borderRadius: innerRadius,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {children}
        {isModern ? <CameraCutout variant={variant} screenWidth={screenWidth} /> : null}
      </div>
    </div>
  );
};
