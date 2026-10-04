import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { enter } from '../animation';
import { AppIcon } from '../components/AppIcon';
import { Chip } from '../components/Chip';
import { SoftwhereMark } from '../components/SoftwhereMark';
import { FONTS } from '../fonts';
import type { ProjectConfig } from '../schema';
import { COLORS } from '../theme';

const ICON_SIZE = 176;
const NAME_SIZE = { min: 76, max: 140 } as const;

/** Shrinks long names so they stay on one line. */
const nameFontSize = (name: string): number => Math.max(NAME_SIZE.min, Math.min(NAME_SIZE.max, 1700 / (name.length * 0.62)));

const rise = (progress: number, distance: number) => ({ opacity: progress, transform: `translateY(${(1 - progress) * distance}px)` });

/** Title card: icon, name, tagline, then category / location / years / platform chips. */
export const IntroScene = ({ config }: { config: ProjectConfig }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const iconIn = enter(frame, fps, 0, 13);
  const nameIn = enter(frame, fps, 7);
  const taglineIn = enter(frame, fps, 14);
  const chipsIn = enter(frame, fps, 22);

  return (
    <AbsoluteFill
      style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', padding: '0 160px' }}
    >
      <div style={{ position: 'absolute', top: 64, ...rise(nameIn, 12) }}>
        <SoftwhereMark size={36} />
      </div>
      <div style={{ opacity: Math.min(1, iconIn * 1.5), transform: `scale(${0.5 + 0.5 * iconIn}) rotate(${(1 - iconIn) * -12}deg)` }}>
        <AppIcon src={config.icon?.src} shape={config.icon?.shape} name={config.name} size={ICON_SIZE} accent={config.accent} />
      </div>
      <h1
        style={{
          margin: '44px 0 0',
          fontFamily: FONTS.display,
          fontWeight: 700,
          fontSize: nameFontSize(config.name),
          lineHeight: 1,
          letterSpacing: '-0.035em',
          color: COLORS.text,
          ...rise(nameIn, 40),
        }}
      >
        {config.name}
      </h1>
      <p
        style={{
          margin: '26px 0 0',
          maxWidth: 1300,
          fontFamily: FONTS.body,
          fontWeight: 500,
          fontSize: 40,
          lineHeight: 1.35,
          color: COLORS.muted,
          ...rise(taglineIn, 30),
        }}
      >
        {config.tagline}
      </p>
      <div style={{ marginTop: 44, display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', ...rise(chipsIn, 24) }}>
        <Chip>{config.category}</Chip>
        <Chip>{config.location}</Chip>
        <Chip>{config.years}</Chip>
        {config.platforms.map(platform => (
          <Chip key={platform} tone='accent'>
            {platform}
          </Chip>
        ))}
      </div>
    </AbsoluteFill>
  );
};
