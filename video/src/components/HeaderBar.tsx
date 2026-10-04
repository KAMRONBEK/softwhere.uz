import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { between } from '../animation';
import { FONTS } from '../fonts';
import type { ProjectConfig } from '../schema';
import { COLORS, TIMING } from '../theme';
import type { Segment } from '../timeline';
import { AppIcon } from './AppIcon';
import { SoftwhereMark } from './SoftwhereMark';

type SceneSegment = Extract<Segment, { kind: 'scene' }>;

const isScene = (segment: Segment): segment is SceneSegment => segment.kind === 'scene';

const ProgressSegment = ({ progress }: { progress: number }) => (
  <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255, 240, 230, 0.12)', overflow: 'hidden' }}>
    <div style={{ width: `${progress * 100}%`, height: '100%', background: COLORS.accent }} />
  </div>
);

/** Project identity (top-left), studio mark (top-right) and per-scene progress (bottom); hidden on intro/outro. */
export const HeaderBar = ({ config, segments }: { config: ProjectConfig; segments: readonly Segment[] }) => {
  const frame = useCurrentFrame();
  const scenes = segments.filter(isScene);
  const outro = segments[segments.length - 1];
  const first = scenes[0];
  if (!first) return null;

  // Fade in during the second half of the intro→scene fade-through, so the intro's own logo is already gone.
  const midIntroFade = first.from + TIMING.transition / 2;
  const visible =
    between(frame, midIntroFade, first.from + TIMING.transition) * (1 - between(frame, outro.from, outro.from + TIMING.transition / 2));

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <div style={{ position: 'absolute', top: 40, left: 60, display: 'flex', alignItems: 'center', gap: 18 }}>
        <AppIcon src={config.icon?.src} shape={config.icon?.shape} name={config.name} size={52} accent={config.accent} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 26, color: COLORS.text }}>{config.name}</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.muted }}>
            {config.category}
          </span>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 50, right: 60 }}>
        <SoftwhereMark size={34} />
      </div>
      <div style={{ position: 'absolute', bottom: 52, left: 60, right: 60, display: 'flex', gap: 10 }}>
        {scenes.map(segment => (
          <ProgressSegment key={segment.from} progress={between(frame, segment.from, segment.from + segment.duration)} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
