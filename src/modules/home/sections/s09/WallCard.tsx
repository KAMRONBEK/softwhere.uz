'use client';

import { memo, useEffect, useMemo, useRef, type CSSProperties, type FocusEvent, type MouseEvent, type SyntheticEvent } from 'react';
import LabVideo from '../../media/LabVideo';
import type { LabProject } from '../../media/portfolio';
import { useTranslations } from 'next-intl';
import { stillOf, tileOf } from './data';
import { directTileVideo } from './tileVideo';
import { useWallLabels } from './useWallCopy';
import css from './wall.module.css';

/** A still that failed to load (a dropped connection) is asked for once more after this long. */
const STILL_RETRY_MS = 1600;

interface WallCardProps {
  project: LabProject;
  index: number;
  isActive: boolean;
  isTabStop: boolean;
  /** Walkthrough video allowed (not on the low tier or under reduced motion). */
  canPlay: boolean;
  setSlot: (index: number, el: HTMLDivElement | null) => void;
  setFlipper: (index: number, el: HTMLDivElement | null) => void;
  setButton: (index: number, el: HTMLButtonElement | null) => void;
  onOpen: (index: number, media: HTMLElement | null) => void;
  onKeyboardFocus: (index: number) => void;
}

/** Equalizer bars on the playing tile: drawn, not a glyph. */
function PlayingMark() {
  return (
    <span className={css.playing} aria-hidden='true'>
      <span />
      <span />
      <span />
    </span>
  );
}

/**
 * One wall tile: the product's own screen (the device cropped out of its
 * walkthrough), framed per style. The slot's transform belongs to the
 * engine (never set in JSX), the flipper's to Flip and the enter/leave
 * tweens, the button's scale to CSS states: three owners, three elements.
 */
function WallCardBase({
  project,
  index,
  isActive,
  isTabStop,
  canPlay,
  setSlot,
  setFlipper,
  setButton,
  onOpen,
  onKeyboardFocus,
}: WallCardProps) {
  const t = useTranslations('home.work-wall');
  const labels = useWallLabels();
  const mediaRef = useRef<HTMLSpanElement>(null);
  const retryTimerRef = useRef(0);
  const isPlaying = isActive && canPlay;
  const tile = useMemo(() => tileOf(project), [project]);

  // The lightbox opens on the full still: fetch it while this tile is the one in focus.
  useEffect(() => {
    if (!isActive) return;
    const still = new Image();
    still.src = stillOf(project);
  }, [isActive, project]);

  // The video follows the device across slides and loops back to the still.
  useEffect(() => {
    const media = mediaRef.current;
    const video = media?.querySelector('video');
    if (!media || !video || !isPlaying) return;
    return directTileVideo(video, media, tile);
  }, [isPlaying, tile]);

  useEffect(() => () => window.clearTimeout(retryTimerRef.current), []);

  // One retry, then the still steps aside for the tile's plain plate (never a broken-image icon).
  const handleStillError = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    img.dataset.failed = '';
    if (img.dataset.retried !== undefined || !img.dataset.src) return;
    img.dataset.retried = '';
    retryTimerRef.current = window.setTimeout(() => {
      img.src = `${img.dataset.src}?retry=1`;
    }, STILL_RETRY_MS);
  };
  const handleStillLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    delete event.currentTarget.dataset.failed;
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onOpen(index, event.currentTarget.querySelector<HTMLElement>('[data-media]'));
  };
  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(':focus-visible')) onKeyboardFocus(index);
  };

  return (
    <div
      ref={el => setSlot(index, el)}
      className={css.slot}
      style={{ '--aspect': tile.aspect } as CSSProperties}
      data-wall-index={index}
      data-active={isActive || undefined}
    >
      <div ref={el => setFlipper(index, el)} className={css.flipper}>
        <button
          ref={el => setButton(index, el)}
          type='button'
          className={css.card}
          tabIndex={isTabStop ? 0 : -1}
          aria-label={labels.card(project)}
          data-cursor={t('cursorOpen')}
          onClick={handleClick}
          onFocus={handleFocus}
        >
          <span className={css.frame}>
            <span ref={mediaRef} className={css.media} data-media=''>
              {/* The engine sets src when the tile first nears the screen (see WallEngine.loadStill). */}
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-cropped ~15 KB WebP, no optimizer round trip */}
              <img
                className={css.thumb}
                data-src={tile.src}
                alt=''
                width={Math.round(440 * tile.aspect)}
                height={440}
                decoding='async'
                draggable={false}
                onError={handleStillError}
                onLoad={handleStillLoad}
              />
              {isPlaying ? <LabVideo project={project} className={css.video} /> : null}
              {isPlaying ? <PlayingMark /> : null}
            </span>
          </span>
          <span className={css.caption}>
            <span className={css.name}>{project.name}</span>
            <span className={css.type}>
              {labels.category(project)}
              <span className={css.market}> · {labels.market(project)}</span>
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

export const WallCard = memo(WallCardBase);
