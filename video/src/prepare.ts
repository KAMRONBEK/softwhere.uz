import { staticFile, type CalculateMetadataFunction } from 'remotion';
import { z } from 'zod';
import type { PromoProps } from './ProjectPromo';
import { projectSchema, type Dimensions, type MediaMap, type ProjectConfig } from './schema';
import { buildTimeline } from './timeline';

/** Every screenshot a config shows (icons are drawn at fixed sizes and need no measuring). */
const shotSources = (config: ProjectConfig): string[] => {
  const sources = config.scenes.flatMap(scene => (scene.type === 'video' ? [] : scene.shots.map(shot => shot.src)));
  return [...new Set(sources)];
};

const measure = (src: string): Promise<Dimensions> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error(`Image missing or unreadable: video/public/${src}`));
    img.src = staticFile(src);
  });

/** Validates the JSON config, measures its images and derives the duration. Errors stay scoped to one composition. */
export const calculatePromoMetadata: CalculateMetadataFunction<PromoProps> = async ({ props, compositionId }) => {
  const parsed = projectSchema.safeParse(props.config);
  if (!parsed.success) {
    throw new Error(`Invalid src/projects/${compositionId}.json:\n${z.prettifyError(parsed.error)}`);
  }
  const config = parsed.data;
  if (config.slug !== compositionId) {
    throw new Error(`slug "${config.slug}" must match its file name (${compositionId}.json)`);
  }

  const sources = shotSources(config);
  const sizes = await Promise.all(sources.map(measure));
  const media: MediaMap = Object.fromEntries(sources.map((src, i) => [src, sizes[i]]));

  return { durationInFrames: buildTimeline(config).total, props: { config, media } };
};
