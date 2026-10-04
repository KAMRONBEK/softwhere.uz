import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { between, enter, holdProgress } from '../animation';
import { BrowserFrame } from '../components/BrowserFrame';
import { Caption, captionSide } from '../components/Caption';
import { Cursor } from '../components/Cursor';
import { ScreenImage } from '../components/ScreenImage';
import { aspectOf } from '../media';
import type { MediaMap, WebScene as WebSceneConfig } from '../schema';
import { cursorAt } from './cursorPath';
import { BROWSER_WIDTH, browserContentHeight, browserLeft, browserTop, WEB_CAPTION } from './webLayout';

type Props = {
  scene: WebSceneConfig;
  index: number;
  total: number;
  duration: number;
  media: MediaMap;
};

const CROSSFADE = 12;
const SCROLL_HOLD = 20;
const SLOW_ZOOM = 0.015;

/** Browser walkthrough: shots cross-fade in order, tall shots scroll, an optional cursor clicks between them. */
export const WebScene = ({ scene, index, total, duration, media }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const side = captionSide(index);
  const contentHeight = browserContentHeight();
  const slot = duration / scene.shots.length;
  const appear = enter(frame, fps, 3);
  const zoom = 1 + SLOW_ZOOM * (frame / duration);
  const cursor = cursorAt(scene.shots, slot, frame);

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
      <div
        style={{
          position: 'absolute',
          left: browserLeft(side),
          top: browserTop(contentHeight),
          opacity: appear,
          transform: `translateY(${(1 - appear) * 80}px) scale(${(0.95 + 0.05 * appear) * zoom})`,
        }}
      >
        <BrowserFrame width={BROWSER_WIDTH} contentHeight={contentHeight} url={scene.url}>
          {scene.shots.map((shot, i) => {
            const start = i * slot;
            const opacity = i === 0 ? 1 : between(frame, start - CROSSFADE, start);
            const scroll = shot.scroll ? holdProgress(frame - start, slot, SCROLL_HOLD) : 0;
            return (
              <div key={`${shot.src}-${i}`} style={{ position: 'absolute', inset: 0, opacity }}>
                <ScreenImage
                  src={shot.src}
                  width={BROWSER_WIDTH}
                  height={contentHeight}
                  aspect={aspectOf(media, shot.src)}
                  scrollProgress={scroll}
                />
              </div>
            );
          })}
          {cursor ? (
            <Cursor x={cursor.x * BROWSER_WIDTH} y={cursor.y * contentHeight} click={cursor.click} opacity={between(frame, 6, 16)} />
          ) : null}
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};
