import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { enter, holdProgress } from '../animation';
import { Caption, captionSide } from '../components/Caption';
import { clampScreenAspect, type DeviceVariant, PhoneFrame, phoneScreenSize, phoneWidthForHeight } from '../components/PhoneFrame';
import { ScreenImage } from '../components/ScreenImage';
import { aspectOf } from '../media';
import type { MediaMap, MobileScene as MobileSceneConfig } from '../schema';
import { SAFE, STAGE_HEIGHT } from '../theme';
import { DEVICE_HEIGHT, deviceSlots, MOBILE_CAPTION } from './mobileLayout';

type Props = {
  scene: MobileSceneConfig;
  index: number;
  total: number;
  duration: number;
  accent: string;
  deviceVariant: DeviceVariant;
  media: MediaMap;
};

const SCROLL_HOLD = 24;
const CARD_RADIUS = 30;
/** Designed store frames taller than this are cropped (and can scroll) rather than shrunk. */
const CARD_MAX_ASPECT = 2.3;
const DEVICE_STAGGER = 5;

type ShotProps = { src: string; height: number; aspect: number; scroll: number };

const DeviceShot = ({ src, height, aspect, scroll, accent, variant }: ShotProps & { accent: string; variant: DeviceVariant }) => {
  const screenAspect = clampScreenAspect(aspect);
  const width = phoneWidthForHeight(height, screenAspect);
  const screen = phoneScreenSize(width, screenAspect);
  return (
    <PhoneFrame width={width} screenAspect={screenAspect} accent={accent} variant={variant}>
      <ScreenImage src={src} width={screen.width} height={screen.height} aspect={aspect} scrollProgress={scroll} />
    </PhoneFrame>
  );
};

const CardShot = ({ src, height, aspect, scroll, tilt }: ShotProps & { tilt: number }) => {
  const width = height / Math.min(aspect, CARD_MAX_ASPECT);
  return (
    <div
      style={{
        transform: `perspective(1800px) rotateY(${tilt}deg)`,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        boxShadow: '0 50px 110px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06)',
      }}
    >
      <ScreenImage src={src} width={width} height={height} aspect={aspect} scrollProgress={scroll} />
    </div>
  );
};

/** Caption on one side; one to three phones (raw captures) or store frames (cards) on the other. */
export const MobileScene = ({ scene, index, total, duration, accent, deviceVariant, media }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const side = captionSide(index);
  const slots = deviceSlots(scene.shots.length, side);
  const height = scene.shots.length === 1 ? DEVICE_HEIGHT.single : DEVICE_HEIGHT.spread;
  const tiltSign = side === 'left' ? -1 : 1;

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
      {scene.shots.map((shot, i) => {
        const slot = slots[i];
        const appear = enter(frame, fps, 4 + i * DEVICE_STAGGER);
        const float = Math.sin((frame + i * 23) / 46) * 8;
        const scroll = shot.scroll ? holdProgress(frame, duration, SCROLL_HOLD) : 0;
        const aspect = aspectOf(media, shot.src);
        return (
          <div
            key={`${shot.src}-${i}`}
            style={{
              position: 'absolute',
              left: slot.centerX,
              top: SAFE.top + STAGE_HEIGHT / 2,
              zIndex: slot.z,
              opacity: Math.min(1, appear * 1.4),
              transform: `translate(-50%, -50%) translateY(${(1 - appear) * 140 + float}px) rotate(${slot.rotate}deg) scale(${slot.scale})`,
            }}
          >
            {scene.frame === 'device' ? (
              <DeviceShot src={shot.src} height={height} aspect={aspect} scroll={scroll} accent={accent} variant={deviceVariant} />
            ) : (
              <CardShot src={shot.src} height={height} aspect={aspect} scroll={scroll} tilt={tiltSign * (6 + (1 - appear) * 14)} />
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
