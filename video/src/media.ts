import type { MediaMap } from './schema';

/** Height / width of a measured image; fails loudly if calculateMetadata did not see it. */
export const aspectOf = (media: MediaMap, src: string): number => {
  const dims = media[src];
  if (!dims || dims.width === 0) {
    throw new Error(`No dimensions for "${src}" — is the file present in video/public?`);
  }
  return dims.height / dims.width;
};
