import type { ReactElement } from 'react';
import { AbsoluteFill } from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fadeThrough } from './fadeThrough';
import { Background } from './components/Background';
import { HeaderBar } from './components/HeaderBar';
import { FONTS } from './fonts';
import { IntroScene } from './scenes/IntroScene';
import { MobileScene } from './scenes/MobileScene';
import { OutroScene } from './scenes/OutroScene';
import { VideoScene } from './scenes/VideoScene';
import { WebScene } from './scenes/WebScene';
import type { MediaMap, ProjectConfig } from './schema';
import { COLORS, TIMING } from './theme';
import { buildTimeline, type Segment } from './timeline';

export type PromoProps = { config: ProjectConfig; media: MediaMap };

const PREMOUNT_FRAMES = 30;

const renderSegment = (segment: Segment, config: ProjectConfig, media: MediaMap): ReactElement => {
  if (segment.kind === 'intro') return <IntroScene config={config} />;
  if (segment.kind === 'outro') return <OutroScene config={config} />;

  const { scene, index, duration } = segment;
  const total = config.scenes.length;
  // Never draw an iPhone around an Android-only product.
  const deviceVariant = config.platforms.includes('iOS') ? 'iphone' : 'android';
  switch (scene.type) {
    case 'mobile':
      return (
        <MobileScene
          scene={scene}
          index={index}
          total={total}
          duration={duration}
          accent={config.accent}
          deviceVariant={deviceVariant}
          media={media}
        />
      );
    case 'web':
      return <WebScene scene={scene} index={index} total={total} duration={duration} media={media} />;
    case 'video':
      return <VideoScene scene={scene} index={index} total={total} accent={config.accent} deviceVariant={deviceVariant} />;
  }
};

/** One portfolio promo: intro → walkthrough scenes → outro over a persistent backdrop and header. */
export const ProjectPromo = ({ config, media }: PromoProps) => {
  const { segments } = buildTimeline(config);
  const children = segments.flatMap((segment, i) => {
    const sequence = (
      <TransitionSeries.Sequence key={`seq-${i}`} durationInFrames={segment.duration} premountFor={PREMOUNT_FRAMES}>
        {renderSegment(segment, config, media)}
      </TransitionSeries.Sequence>
    );
    if (i === 0) return [sequence];
    const transition = (
      <TransitionSeries.Transition
        key={`fade-${i}`}
        presentation={fadeThrough()}
        timing={linearTiming({ durationInFrames: TIMING.transition })}
      />
    );
    return [transition, sequence];
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body, color: COLORS.text }}>
      <Background accent={config.accent} />
      <TransitionSeries>{children}</TransitionSeries>
      <HeaderBar config={config} segments={segments} />
    </AbsoluteFill>
  );
};
