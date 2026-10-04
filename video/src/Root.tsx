import { Composition, Folder } from 'remotion';
import { calculatePromoMetadata } from './prepare';
import { ProjectPromo, type PromoProps } from './ProjectPromo';
import { PROJECT_ENTRIES } from './projects';
import type { ProjectConfig } from './schema';
import { VIDEO } from './theme';

/** Replaced by calculateMetadata once the config is validated. */
const PLACEHOLDER_DURATION = 300;

export const RemotionRoot = () => (
  <Folder name='portfolio'>
    {PROJECT_ENTRIES.map(({ id, raw }) => (
      <Composition
        key={id}
        id={id}
        component={ProjectPromo}
        width={VIDEO.width}
        height={VIDEO.height}
        fps={VIDEO.fps}
        durationInFrames={PLACEHOLDER_DURATION}
        // Validated (and replaced with the parsed config) in calculatePromoMetadata.
        defaultProps={{ config: raw as ProjectConfig, media: {} } satisfies PromoProps}
        calculateMetadata={calculatePromoMetadata}
      />
    ))}
  </Folder>
);
