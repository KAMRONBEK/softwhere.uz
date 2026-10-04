import { Img, staticFile } from 'remotion';
import { FONTS } from '../fonts';
import { COLORS } from '../theme';

type Shape = 'squircle' | 'circle' | 'wide';

type Props = {
  src?: string;
  name: string;
  shape?: Shape;
  size: number;
  accent: string;
};

const SQUIRCLE_RADIUS = 0.225;
const WIDE_HEIGHT_RATIO = 0.62;

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Drop shadow plus a faint light ring so near-black icons still read on the dark backdrop. */
const shadowFor = (size: number): string =>
  `0 ${size * 0.12}px ${size * 0.3}px rgba(0, 0, 0, 0.45), 0 0 0 ${Math.max(1, size * 0.01)}px rgba(255, 240, 230, 0.16)`;

/** App icon, wordmark logo on a light pill (`wide`), or an initials badge when no image exists. */
export const AppIcon = ({ src, name, shape = 'squircle', size, accent }: Props) => {
  if (!src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * SQUIRCLE_RADIUS,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(140deg, ${accent}, ${COLORS.accent})`,
          boxShadow: shadowFor(size),
          fontFamily: FONTS.display,
          fontWeight: 700,
          fontSize: size * 0.38,
          color: COLORS.text,
        }}
      >
        {initialsOf(name)}
      </div>
    );
  }

  if (shape === 'wide') {
    const height = size * WIDE_HEIGHT_RATIO;
    return (
      <div
        style={{
          height,
          padding: `${height * 0.2}px ${height * 0.4}px`,
          borderRadius: height * 0.3,
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          boxShadow: shadowFor(size),
        }}
      >
        <Img src={staticFile(src)} style={{ height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  return (
    <Img
      src={staticFile(src)}
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: shape === 'circle' ? '50%' : size * SQUIRCLE_RADIUS,
        boxShadow: shadowFor(size),
      }}
    />
  );
};
