import type { CropKey, CropRect } from '../../assets/work-wall/tiles';
import type { ResolvedTile } from './data';

/** Matches the CSS opacity transition of a tile video: fade to the still, seek, fade back. */
const LOOP_FADE_MS = 280;
/** Seconds before the loop end at which the fade starts (frames keep flowing under it). */
const LOOP_LEAD_S = 0.3;

/**
 * Share of a slide change (key to key) where the crop moves. The walkthrough
 * template dips the old slide to black at roughly a quarter to a third of
 * the change, then fades the new one in: moving the crop inside that dip
 * frames the new device as it appears, instead of sweeping across the title
 * block mid-fade.
 */
const MOVE_FROM = 0.15;
const MOVE_SPAN = 0.3;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function rectOf(key: CropKey): CropRect {
  return [key[1], key[2], key[3], key[4]];
}

/** Where the tile looks at video time `t`: holds on each slide, moves during each change's dip to black. */
export function cropAt(keys: readonly CropKey[], t: number): CropRect {
  if (keys.length === 0) return [0, 0, 1, 1];
  if (t <= keys[0][0]) return rectOf(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t > b[0]) continue;
    const a = keys[i - 1];
    const span = b[0] - a[0];
    const u = span > 0 ? (t - a[0]) / span : 1;
    const k = easeInOutCubic(Math.min(1, Math.max(0, (u - MOVE_FROM) / MOVE_SPAN)));
    return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k, a[4] + (b[4] - a[4]) * k];
  }
  return rectOf(keys[keys.length - 1]);
}

/**
 * Transform for a full-width 16:9 <video> (transform-origin 0 0) so that
 * `rect` of its frame fills the tile's media box exactly.
 */
export function cropTransform([x, y, w]: CropRect): string {
  return `scale(${(1 / w).toFixed(4)}) translate(${(-x * 100).toFixed(3)}%, ${(-y * 100).toFixed(3)}%)`;
}

/**
 * Directs a tile's walkthrough: starts at the still's time (so the still
 * turns into motion without a cut), follows the device from slide to slide,
 * and loops the first slides by fading back to the still while it seeks.
 * The `data-playing` attribute on `media` reveals the video. Returns a cleanup.
 */
export function directTileVideo(video: HTMLVideoElement, media: HTMLElement, tile: ResolvedTile): () => void {
  const [start, end] = tile.loop;
  const hasLoop = end - start > 1;
  let raf = 0;
  let fadeTimer = 0;
  let isSeeking = false;
  let isLooping = false;

  const apply = () => {
    video.style.transform = cropTransform(cropAt(tile.keys, video.currentTime));
  };
  const show = () => {
    if (!isSeeking && !isLooping && !video.paused) media.setAttribute('data-playing', '');
  };
  const loopBack = () => {
    isLooping = true;
    media.removeAttribute('data-playing');
    fadeTimer = window.setTimeout(() => {
      isSeeking = true;
      video.currentTime = start;
    }, LOOP_FADE_MS);
  };
  const frame = () => {
    raf = 0;
    if (video.paused) return;
    if (hasLoop && !isLooping && video.currentTime >= end - LOOP_LEAD_S) loopBack();
    if (!isLooping) apply();
    raf = requestAnimationFrame(frame);
  };
  const onMetadata = () => {
    if (video.duration > start + 0.5 && start > 0) {
      isSeeking = true;
      video.currentTime = start;
    }
    apply();
  };
  const onSeeked = () => {
    isSeeking = false;
    isLooping = false;
    apply();
    show();
  };
  const onPlaying = () => {
    show();
    if (!raf) raf = requestAnimationFrame(frame);
  };

  apply();
  video.addEventListener('loadedmetadata', onMetadata);
  video.addEventListener('seeked', onSeeked);
  video.addEventListener('playing', onPlaying);
  if (video.readyState >= 1) onMetadata();
  if (!video.paused) onPlaying();

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(fadeTimer);
    video.removeEventListener('loadedmetadata', onMetadata);
    video.removeEventListener('seeked', onSeeked);
    video.removeEventListener('playing', onPlaying);
    media.removeAttribute('data-playing');
  };
}

/**
 * clip-path inset() (percentages of the element box) that shows only `rect`;
 * `amount` 0..1 scales the insets toward the whole box (0 = no clip).
 */
export function cropInset([x, y, w, h]: CropRect, radius: string, amount = 1): string {
  const pct = (v: number) => `${(Math.max(0, v) * amount * 100).toFixed(3)}%`;
  return `inset(${pct(y)} ${pct(1 - x - w)} ${pct(1 - y - h)} ${pct(x)} round ${radius})`;
}
