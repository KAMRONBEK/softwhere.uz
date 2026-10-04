import { Img, staticFile } from 'remotion';
import { FONTS } from '../fonts';
import { COLORS } from '../theme';

/** viewBox of public/brand/logo.svg (same file as the website's public/icons/logo.svg). */
const LOGO_ASPECT = 1187.42 / 1327.08;

export const SoftwhereMark = ({ size, wordmark = true }: { size: number; wordmark?: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.32 }}>
    <Img src={staticFile('brand/logo.svg')} style={{ height: size, width: size * LOGO_ASPECT }} />
    {wordmark ? (
      <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: size * 0.72, letterSpacing: '-0.02em', color: COLORS.text }}>
        softwhere
      </span>
    ) : null}
  </div>
);
