'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { gsap } from '../../global/gsap';
import { useLenis } from '../../global/scroll';
import LabVideo from '../../media/LabVideo';
import { useProjectDescriber } from '../../media/useProjectDescriber';
import { stillOf, STORE_NAMES, storeLinksOf, tileOf, WALL_PROJECTS } from './data';
import { cropInset } from './tileVideo';
import type { CropRect } from '../../assets/work-wall/tiles';
import css from './lightbox.module.css';
import { useWallLabels } from './useWallCopy';

const TITLE_ID = 'work-wall-lightbox-title';
const PLATFORM_TOKEN = /^(iOS|iPad|Android|Web)$/;
const SWIPE_MIN = 48;

interface LightboxProps {
  /** Project index (into WALL_PROJECTS). */
  index: number;
  /** The filtered order prev/next walks through. */
  order: readonly number[];
  /** Screen rect of the tile that opened it: the media grows out of it. */
  origin: DOMRect | null;
  reducedMotion: boolean;
  /** Where the media should shrink back to on close, if that tile is on screen. */
  getReturnRect: (index: number) => DOMRect | null;
  onNavigate: (index: number) => void;
  onClosed: () => void;
}

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true' focusable='false'>
      <path d={path} fill='none' stroke='currentColor' strokeWidth='1.75' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

const ICONS = {
  close: 'M6 6l12 12M18 6L6 18',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  external: 'M8 16L16 8M9.5 8H16v6.5',
};

/** The first crop key: the part of the frame the tile's still shows. */
function stillCrop(index: number): CropRect {
  const [, x, y, w, h] = tileOf(WALL_PROJECTS[index]).keys[0];
  return [x, y, w, h];
}

/** Tile corner radius in px (wall.module.css: --tile-r is half the style radius). */
function tileRadius(el: HTMLElement): number {
  return (parseFloat(getComputedStyle(el).getPropertyValue('--radius')) || 0) * 0.5;
}

/** The player's own corner radius in px. */
function ownRadius(el: HTMLElement): number {
  return parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
}

/**
 * Pose (transform-origin 0 0) that puts the tile's crop of the frame exactly
 * over the tile's rect on screen. `left`/`top` are the player's untransformed
 * position, `w`/`h` its size; the returned `radius` is the tile's corner
 * radius (`tileR`) in the player's scaled units.
 */
function cropPose(crop: CropRect, tileRect: DOMRect, left: number, top: number, w: number, h: number, tileR: number) {
  const [cx, cy, cw] = crop;
  const scale = tileRect.width / (cw * w);
  return {
    from: { x: tileRect.left - left - cx * w * scale, y: tileRect.top - top - cy * h * scale, scale },
    radius: tileR / scale,
  };
}

/**
 * Drives the player's clip between the tile's crop (k = 0) and the whole
 * frame (k = 1). Tweened as a plain number and written by hand: GSAP's
 * string interpolation does not read inset() percentages reliably.
 */
function clipDriver(media: HTMLElement, crop: CropRect, cropRadius: number, openRadius: number) {
  const state = { k: 0 };
  const apply = () => {
    const k = state.k;
    const r = cropRadius + (openRadius - cropRadius) * k;
    media.style.clipPath = k >= 1 ? '' : cropInset(crop, `${r.toFixed(2)}px`, 1 - k);
  };
  return { state, apply };
}

/**
 * Native <dialog> (focus trap, Esc, top layer) with a shared-element open:
 * the player starts exactly where the tile was, showing only the tile's crop
 * of the frame, then zooms out to the whole walkthrough (transform + a
 * clip-path inset); on close it zooms back into wherever that tile is. Arrow
 * keys and horizontal swipes step through the current filter. Page scroll is
 * locked while open.
 */
export default function Lightbox({ index, order, origin, reducedMotion, getReturnRect, onNavigate, onClosed }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef(false);
  const directionRef = useRef<1 | -1>(1);
  const shownIndexRef = useRef(index);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const lenis = useLenis();
  const [playingSlug, setPlayingSlug] = useState<string | null>(null);
  const t = useTranslations('home.work-wall.lightbox');
  const describer = useProjectDescriber();
  const labels = useWallLabels();

  const project = WALL_PROJECTS[index];
  const tile = tileOf(project);
  const [cropX, cropY, cropW, cropH] = stillCrop(index);
  const position = Math.max(0, order.indexOf(index));
  const platforms = describer.platforms(project, ', ');
  const links = storeLinksOf(project);
  const stack = project.tech.filter(item => !PLATFORM_TOKEN.test(item));

  // The tile's still stays on top until the walkthrough actually plays, and
  // the video starts at that still's moment (past the title card), so the
  // grown tile turns into motion instead of flashing another picture.
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    const slug = project.slug;
    const start = tileOf(project).stillTime;
    let isSeeking = false;
    const reveal = (event: Event) => {
      const video = event.target;
      if (video instanceof HTMLVideoElement && !isSeeking && !video.paused) setPlayingSlug(slug);
    };
    const handleMetadata = (event: Event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement) || start <= 0 || video.duration < start + 0.5) return;
      isSeeking = true;
      video.currentTime = start;
    };
    const handleSeeked = (event: Event) => {
      isSeeking = false;
      reveal(event);
    };
    media.addEventListener('loadedmetadata', handleMetadata, true);
    media.addEventListener('seeked', handleSeeked, true);
    media.addEventListener('playing', reveal, true);
    return () => {
      media.removeEventListener('loadedmetadata', handleMetadata, true);
      media.removeEventListener('seeked', handleSeeked, true);
      media.removeEventListener('playing', reveal, true);
    };
  }, [project]);

  // Lock the page behind the dialog (Lenis and native scroll alike) through
  // <body>, whose overflow propagates to the viewport while <html> stays
  // visible: the viewport remains the scroller, so the pinned wall stays pinned
  // behind the dialog. (A hidden or clipped <html>, Lenis's own stop style
  // included, turns <body> into a scroll box and unsticks everything.)
  useEffect(() => {
    const { body, documentElement: html } = document;
    const previous = { body: body.style.overflow, html: html.style.overflow };
    // Styles first, so the viewport never passes through a clipped state.
    html.style.overflow = 'visible';
    body.style.overflow = 'hidden';
    lenis?.stop();
    return () => {
      lenis?.start();
      body.style.overflow = previous.body;
      html.style.overflow = previous.html;
    };
  }, [lenis]);

  // Open: once per mount. Runs before paint so the media never flashes at its final size.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const media = mediaRef.current;
    if (!dialog || !media) return;
    if (!dialog.open) dialog.showModal();
    // showModal focuses the first link; start on Close instead (Esc and Tab both work from there).
    closeRef.current?.focus({ preventScroll: true });
    const info = infoRef.current ? Array.from(infoRef.current.children) : [];
    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.fromTo(dialog, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out' });
        return;
      }
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
      if (origin && origin.width > 0) {
        const to = media.getBoundingClientRect();
        const crop = stillCrop(index);
        const pose = cropPose(crop, origin, to.left, to.top, media.offsetWidth, media.offsetHeight, tileRadius(media));
        const clip = clipDriver(media, crop, pose.radius, ownRadius(media));
        clip.apply();
        gsap.fromTo(media, { ...pose.from, transformOrigin: '0 0' }, { x: 0, y: 0, scale: 1, duration: 1, ease: 'expo.out' });
        gsap.to(clip.state, { k: 1, duration: 1, ease: 'expo.out', onUpdate: clip.apply });
      } else {
        gsap.fromTo(media, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' });
      }
      gsap.fromTo(info, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07, delay: 0.16 });
      gsap.fromTo(chromeRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.3 });
    });
    return () => ctx.revert();
    // Mount-only by design: later index changes animate as navigation below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate: slide the new project in from the side it came from.
  useLayoutEffect(() => {
    if (shownIndexRef.current === index) return;
    shownIndexRef.current = index;
    if (reducedMotion) return;
    const dir = directionRef.current;
    const info = infoRef.current ? Array.from(infoRef.current.children) : [];
    const tl = gsap.timeline();
    tl.fromTo(mediaRef.current, { x: 70 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }).fromTo(
      info,
      { x: 36 * dir, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.55, ease: 'expo.out', stagger: 0.05 },
      0.04
    );
    return () => {
      tl.kill();
    };
  }, [index, reducedMotion]);

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    const dialog = dialogRef.current;
    const media = mediaRef.current;
    const finish = () => {
      if (dialog?.open) dialog.close();
      onClosed();
    };
    if (reducedMotion || !media || !dialog) {
      gsap.to(dialog, { opacity: 0, duration: 0.15, onComplete: finish });
      return;
    }
    gsap.killTweensOf(media);
    const info = infoRef.current ? Array.from(infoRef.current.children) : [];
    const target = getReturnRect(index);
    const from = media.getBoundingClientRect();
    const tl = gsap.timeline({ onComplete: finish });
    tl.to([...info, chromeRef.current], { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0);
    tl.to(backdropRef.current, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 0.08);
    if (target && from.width > 0) {
      // Untransformed box position: the current rect minus any x/y left by navigation.
      const left = from.left - Number(gsap.getProperty(media, 'x'));
      const top = from.top - Number(gsap.getProperty(media, 'y'));
      const crop = stillCrop(index);
      const pose = cropPose(crop, target, left, top, media.offsetWidth, media.offsetHeight, tileRadius(media));
      const clip = clipDriver(media, crop, pose.radius, ownRadius(media));
      clip.state.k = 1;
      gsap.set(media, { transformOrigin: '0 0' });
      // Back to the still the tile shows, so the crop lands on the same picture.
      const covers = media.querySelectorAll('[data-cover]');
      gsap.set(covers, { transition: 'none' });
      tl.to(covers, { opacity: 1, duration: 0.2, ease: 'power1.out' }, 0);
      tl.to(media, { ...pose.from, opacity: 1, duration: 0.66, ease: 'expo.inOut' }, 0);
      tl.to(clip.state, { k: 0, duration: 0.66, ease: 'expo.inOut', onUpdate: clip.apply }, 0);
    } else {
      tl.to(media, { opacity: 0, scale: 0.94, duration: 0.35, ease: 'power2.in' }, 0);
    }
  }, [getReturnRect, index, onClosed, reducedMotion]);

  const go = useCallback(
    (step: 1 | -1) => {
      if (order.length < 2 || isClosingRef.current) return;
      directionRef.current = step;
      onNavigate(order[(position + step + order.length) % order.length]);
    },
    [onNavigate, order, position]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    }
  };

  const handleScrollerClick = (event: MouseEvent<HTMLDivElement>) => {
    // Clicks on empty space (not on the player or the text) close it.
    if (event.target === event.currentTarget || event.target === event.currentTarget.firstElementChild) requestClose();
  };

  const handleSwipeStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') swipeRef.current = { x: event.clientX, y: event.clientY };
  };
  const handleSwipeEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  };

  return (
    <dialog
      ref={dialogRef}
      className={css.dialog}
      aria-labelledby={TITLE_ID}
      onCancel={event => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={handleKeyDown}
      data-lenis-prevent=''
    >
      <div ref={backdropRef} className={css.backdrop} />
      <div className={css.scroller} onClick={handleScrollerClick} data-lenis-prevent=''>
        <div className={css.inner}>
          <div
            ref={mediaRef}
            className={css.media}
            data-playing={playingSlug === project.slug || undefined}
            onPointerDown={handleSwipeStart}
            onPointerUp={handleSwipeEnd}
            onPointerCancel={() => {
              swipeRef.current = null;
            }}
          >
            <LabVideo key={project.slug} project={project} className={css.video} />
            {/* Stills until the walkthrough plays: the full frame, and over it the tile's own
                (already loaded) crop in its exact place, so the zoom starts on the tile's picture. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- 13 KB pre-sized WebP */}
            <img key={`cover-${project.slug}`} className={css.cover} data-cover='' src={stillOf(project)} alt='' width={640} height={360} />
            {/* eslint-disable-next-line @next/next/no-img-element -- the tile's cached still */}
            <img
              key={`crop-${project.slug}`}
              className={css.coverCrop}
              data-cover=''
              src={tile.src}
              alt=''
              style={{ left: `${cropX * 100}%`, top: `${cropY * 100}%`, width: `${cropW * 100}%`, height: `${cropH * 100}%` }}
            />
          </div>

          <div ref={infoRef} className={css.info}>
            <div className={css.titleBlock}>
              <h3 id={TITLE_ID} className={css.name}>
                {project.name}
              </h3>
              <dl className={css.facts}>
                <div>
                  <dt>{t('category')}</dt>
                  <dd>{labels.category(project)}</dd>
                </div>
                <div>
                  <dt>{t('market')}</dt>
                  <dd>{labels.market(project)}</dd>
                </div>
                {platforms ? (
                  <div>
                    <dt>{t('platforms')}</dt>
                    <dd>{platforms}</dd>
                  </div>
                ) : null}
              </dl>
              {links.length > 0 ? (
                <div className={css.links}>
                  {links.map((link, i) => (
                    <a
                      key={link.kind}
                      className={i === 0 ? css.linkPrimary : css.link}
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {link.kind === 'website' ? t('website') : STORE_NAMES[link.kind]}
                      <Icon path={ICONS.external} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <div className={css.body}>
              <p className={css.description}>{describer.description(project)}</p>
              {stack.length > 0 ? (
                <div className={css.stackBlock}>
                  <p className={css.stackLabel}>{t('stack')}</p>
                  <ul className={css.stack}>
                    {stack.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div ref={chromeRef} className={css.chrome}>
        <button ref={closeRef} type='button' className={css.close} onClick={requestClose} aria-label={t('close')}>
          <Icon path={ICONS.close} />
        </button>
        {order.length > 1 ? (
          <div className={css.nav}>
            <button type='button' className={css.navButton} onClick={() => go(-1)} aria-label={t('previous')}>
              <Icon path={ICONS.prev} />
            </button>
            <span className={css.counter} aria-live='polite'>
              {position + 1} / {order.length}
            </span>
            <button type='button' className={css.navButton} onClick={() => go(1)} aria-label={t('next')}>
              <Icon path={ICONS.next} />
            </button>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
