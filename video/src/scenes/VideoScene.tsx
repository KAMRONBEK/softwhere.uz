import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { enter } from '../animation';
import { BrowserFrame } from '../components/BrowserFrame';
import { Caption, captionSide } from '../components/Caption';
import { clampScreenAspect, type DeviceVariant, PhoneFrame, phoneScreenSize, phoneWidthForHeight } from '../components/PhoneFrame';
import type { VideoScene as VideoSceneConfig } from '../schema';
import { SAFE, STAGE_HEIGHT } from '../theme';
import { DEVICE_HEIGHT, deviceRegionCenter, MOBILE_CAPTION } from './mobileLayout';
import { BROWSER_WIDTH, browserContentHeight, browserLeft, browserTop, VIEWPORT_ASPECT, WEB_CAPTION } from './webLayout';

type Props = {
  scene: VideoSceneConfig;
  index: number;
  total: number;
  accent: string;
  deviceVariant: DeviceVariant;
};

const MODERN_PHONE_ASPECT = 2.165;

/** A recorded clip (screen recording / simulator capture) inside a phone or browser frame. */
export const VideoScene = ({ scene, index, total, accent, deviceVariant }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const side = captionSide(index);
  const appear = enter(frame, fps, 3);
  const lift = `translateY(${(1 - appear) * 90}px)`;

  const clip = (width: number, height: number) => (
    <OffthreadVideo
      src={staticFile(scene.src)}
      trimBefore={Math.round(scene.trimStart * fps)}
      playbackRate={scene.playbackRate}
      muted
      style={{ width, height, objectFit: 'cover', objectPosition: 'top' }}
    />
  );

  if (scene.frame === 'browser') {
    const contentHeight = browserContentHeight(scene.aspect ?? VIEWPORT_ASPECT);
    return (
      <AbsoluteFill>
        <Caption
          index={index}
          total={total}
          title={scene.title}
          body={scene.body}
          side={side}
          width={WEB_CAPTION.width}
          gutter={WEB_CAPTION.gutter}
        />
        <div style={{ position: 'absolute', left: browserLeft(side), top: browserTop(contentHeight), opacity: appear, transform: lift }}>
          <BrowserFrame width={BROWSER_WIDTH} contentHeight={contentHeight} url={scene.url ?? ''}>
            {clip(BROWSER_WIDTH, contentHeight)}
          </BrowserFrame>
        </div>
      </AbsoluteFill>
    );
  }

  const screenAspect = clampScreenAspect(scene.aspect ?? MODERN_PHONE_ASPECT);
  const width = phoneWidthForHeight(DEVICE_HEIGHT.single, screenAspect);
  const screen = phoneScreenSize(width, screenAspect);
  return (
    <AbsoluteFill>
      <Caption
        index={index}
        total={total}
        title={scene.title}
        body={scene.body}
        side={side}
        width={MOBILE_CAPTION.width}
        gutter={MOBILE_CAPTION.gutter}
      />
      <div
        style={{
          position: 'absolute',
          left: deviceRegionCenter(side),
          top: SAFE.top + STAGE_HEIGHT / 2,
          opacity: appear,
          transform: `translate(-50%, -50%) ${lift}`,
        }}
      >
        <PhoneFrame width={width} screenAspect={screenAspect} accent={accent} variant={deviceVariant}>
          {clip(screen.width, screen.height)}
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};
