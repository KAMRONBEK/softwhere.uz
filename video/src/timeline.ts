import type { ProjectConfig, Scene } from './schema';
import { DEFAULT_SCENE_SECONDS, TIMING, VIDEO } from './theme';

type SegmentPart =
  | { kind: 'intro'; duration: number }
  | { kind: 'scene'; duration: number; scene: Scene; index: number }
  | { kind: 'outro'; duration: number };

/** A segment's `from` accounts for the overlap TransitionSeries adds between neighbours. */
export type Segment = SegmentPart & { from: number };

export type Timeline = { segments: readonly Segment[]; total: number };

export const sceneDuration = (scene: Scene): number => Math.round((scene.seconds ?? DEFAULT_SCENE_SECONDS[scene.type]) * VIDEO.fps);

export const buildTimeline = (config: ProjectConfig): Timeline => {
  const parts: SegmentPart[] = [
    { kind: 'intro', duration: TIMING.intro },
    ...config.scenes.map((scene, index) => ({ kind: 'scene' as const, duration: sceneDuration(scene), scene, index })),
    { kind: 'outro', duration: TIMING.outro },
  ];

  const segments = parts.reduce<Segment[]>((acc, part) => {
    const prev = acc[acc.length - 1];
    const from = prev ? prev.from + prev.duration - TIMING.transition : 0;
    return [...acc, { ...part, from }];
  }, []);

  const last = segments[segments.length - 1];
  return { segments, total: last.from + last.duration };
};
