import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { enter } from '../animation';
import { Chip } from '../components/Chip';
import { SoftwhereMark } from '../components/SoftwhereMark';
import { FONTS } from '../fonts';
import type { ProjectConfig } from '../schema';
import { COLORS } from '../theme';

const TECH_DELAY = 10;
const TECH_STAGGER = 3;

const rise = (progress: number, distance: number) => ({ opacity: progress, transform: `translateY(${(1 - progress) * distance}px)` });

const Kicker = ({ children }: { children: string }) => (
  <div style={{ fontFamily: FONTS.mono, fontSize: 22, letterSpacing: '0.18em', textTransform: 'uppercase', color: COLORS.accent2 }}>
    {children}
  </div>
);

/** Where the product can be found today — or an honest "archived" / "launching soon" note. */
const availabilityChips = (config: ProjectConfig): string[] => {
  if (config.status !== 'live' && config.statusLabel) return [config.statusLabel];
  if (config.status === 'archived') return [`Shipped ${config.years}`, 'Archived'];
  if (config.status === 'pre-launch') return ['Launching soon'];
  return [
    ...(config.links.appStore ? ['App Store'] : []),
    ...(config.links.googlePlay ? ['Google Play'] : []),
    ...(config.links.web ? [config.links.web] : []),
  ];
};

/** Recap (tech, role, availability) on the left; studio sign-off on the right. */
export const OutroScene = ({ config }: { config: ProjectConfig }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const availability = availabilityChips(config);
  const availabilityLabel = config.status === 'live' ? 'Available on' : 'Status';
  const brandIn = enter(frame, fps, 18);
  // Lands after the last tech chip has risen in.
  const availabilityDelay = TECH_DELAY + config.tech.length * TECH_STAGGER + 2;

  return (
    <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', padding: '0 140px' }}>
      <div style={{ flex: 1, paddingRight: 90 }}>
        <div style={rise(enter(frame, fps, 0), 16)}>
          <Kicker>Case study</Kicker>
        </div>
        <h2
          style={{
            margin: '20px 0 0',
            fontFamily: FONTS.display,
            fontWeight: 700,
            fontSize: 76,
            lineHeight: 1.04,
            letterSpacing: '-0.03em',
            color: COLORS.text,
            ...rise(enter(frame, fps, 4), 30),
          }}
        >
          {config.name}
        </h2>
        {config.role ? (
          <p
            style={{
              margin: '18px 0 0',
              fontFamily: FONTS.body,
              fontWeight: 500,
              fontSize: 30,
              color: COLORS.muted,
              ...rise(enter(frame, fps, 8), 20),
            }}
          >
            {config.role}
          </p>
        ) : null}
        <div style={{ marginTop: 38, ...rise(enter(frame, fps, 9), 14) }}>
          <Kicker>Tech stack</Kicker>
        </div>
        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 12, maxWidth: 980 }}>
          {config.tech.map((tech, i) => (
            <div key={tech} style={rise(enter(frame, fps, TECH_DELAY + i * TECH_STAGGER), 18)}>
              <Chip size={24}>{tech}</Chip>
            </div>
          ))}
        </div>
        {availability.length > 0 ? (
          <div style={{ marginTop: 44, display: 'flex', alignItems: 'center', gap: 14, ...rise(enter(frame, fps, availabilityDelay), 18) }}>
            <span style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 24, color: COLORS.muted, marginRight: 6 }}>
              {availabilityLabel}
            </span>
            {availability.map(label => (
              <Chip key={label} tone='accent' size={24}>
                {label}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
      <div
        style={{
          width: 2,
          alignSelf: 'stretch',
          margin: '240px 0',
          background: `linear-gradient(transparent, ${COLORS.border}, transparent)`,
        }}
      />
      <div style={{ width: 620, paddingLeft: 90, ...rise(brandIn, 30) }}>
        <SoftwhereMark size={84} />
        <p
          style={{
            margin: '40px 0 0',
            fontFamily: FONTS.display,
            fontWeight: 600,
            fontSize: 52,
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            color: COLORS.text,
          }}
        >
          Let&apos;s build your next product.
        </p>
        <p style={{ margin: '26px 0 0', fontFamily: FONTS.mono, fontSize: 30, color: COLORS.accent2 }}>softwhere.uz</p>
      </div>
    </AbsoluteFill>
  );
};
