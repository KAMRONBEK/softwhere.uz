'use client';

import { SplitText } from 'gsap/SplitText';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { SectionHeading } from '../components/LabSection';
import LazyCanvas from '../components/LazyCanvas';
import { useInView } from '../components/useInView';
import { useLabDevice, useMediaQuery } from '../device/useDeviceTier';
import { gsap, ScrollTrigger, useGSAP, SPLIT_KEEP_NBSP } from '../global/gsap';
import { useLabLogo } from '../logos';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import CssDevices from './s06/CssDevices';
import { DEVICE_APPS, SCREENS_PER_APP } from './s06/data';
import GrabLayer from './s06/GrabLayer';
import css from './s06/devices.module.css';
import { useDevicesCopy } from './s06/useDevicesCopy';
import { appStart, createRuntime, nearestStation, stations, STORY_LENGTH, T, type DevicesRuntime } from './s06/story';

gsap.registerPlugin(SplitText);

const DevicesScene = dynamic(() => import('./s06/DevicesScene'), { ssr: false });

const SCRUB_SECONDS = 0.6;
/** Matches DevicesScene's FOV (kept here so the scene chunk stays lazy). */
const CAMERA_FOV = 30;
/** Feature rows that are not on screen stay dimmed to this. */
const ROW_DIM = 0.42;
/** Same switch as the CSS: copy below the devices. */
const PORTRAIT_QUERY = '(max-width: 760px), (max-aspect-ratio: 9 / 10)';

/** Split into masked chars / words (SplitText reverts with the useGSAP context). */
function splitMasked(target: HTMLElement | null, type: 'chars' | 'words'): Element[] {
  if (!target) return [];
  const split = SplitText.create(target, { ...SPLIT_KEEP_NBSP, type: type === 'chars' ? 'words,chars' : 'words', mask: type });
  return type === 'chars' ? split.chars : split.words;
}

interface StoryElements {
  intro: HTMLElement | null;
  glow: HTMLElement | null;
  rail: HTMLElement | null;
  railItems: Array<HTMLElement | null>;
  railFills: Array<HTMLElement | null>;
  apps: Array<HTMLElement | null>;
  appNames: Array<HTMLElement | null>;
  /** [app][row] */
  rows: Array<Array<HTMLElement | null>>;
  fills: Array<Array<HTMLElement | null>>;
  outro: HTMLElement | null;
  outroTitle: HTMLElement | null;
}

/**
 * When app k's copy arrives and leaves (timeline units). Neighbours cross
 * over mid-turn, so the column is never empty while the phone shows its back.
 */
function appWindow(k: number): { enter: number; exit: number } {
  const last = DEVICE_APPS.length - 1;
  return {
    enter: k === 0 ? T.dollyEnd - 4 : appStart(k) - 0.3,
    exit: k === last ? T.outroStart : appStart(k + 1) - 1.5,
  };
}

/** The devices: dolly in, turn to face, one full turn per app, the in-app screen changes, then back out. */
function addDeviceTweens(tl: gsap.core.Timeline, runtime: DevicesRuntime): void {
  const story = runtime.story;
  tl.to(story, { dolly: 1, duration: T.dollyEnd - T.introEnd, ease: 'power2.inOut' }, T.introEnd);
  tl.to(story, { laptop: 0, duration: 9, ease: 'power2.in' }, T.introEnd);
  tl.to(story, { face: 1, duration: T.dollyEnd - T.introEnd - 2, ease: 'power2.inOut' }, T.introEnd + 2);
  DEVICE_APPS.forEach((app, k) => {
    if (k > 0) {
      tl.to(story, { app: k, duration: T.spin, ease: 'power2.inOut' }, appStart(k) - T.spin / 2);
      // The display swaps to the next app's first screen while its back faces the camera.
      tl.to(story, { screen: k * SCREENS_PER_APP, duration: 0.01 }, appStart(k));
    }
    T.screenAt.forEach((at, j) => {
      const change = appStart(k) + at;
      tl.fromTo(story, { tap: 0 }, { tap: 1, duration: T.tapLength, immediateRender: false }, change - T.tapLead);
      tl.to(story, { screen: k * SCREENS_PER_APP + j + 1, duration: T.screenChange, ease: 'power3.inOut' }, change);
    });
  });
  // The apps phase (the phone offers a spin by hand while it rests between turns).
  tl.to(story, { apps: 1, duration: 0.5 }, T.dollyEnd - 1);
  tl.to(story, { apps: 0, duration: 0.5 }, T.outroStart - 0.5);
  tl.to(story, { face: 0, dolly: 0, duration: T.outroEnd - T.outroStart - 1, ease: 'power2.inOut' }, T.outroStart + 1);
  tl.to(story, { laptop: 1, duration: T.outroEnd - T.outroStart - 2, ease: 'power2.out' }, T.outroStart + 2);
  tl.set({}, {}, STORY_LENGTH);
}

/** One app's copy: in, the feature rows lighting up with the phone's screens, out. */
function addAppCopy(tl: gsap.core.Timeline, el: StoryElements, k: number, isReduced: boolean): void {
  const { enter, exit } = appWindow(k);
  tl.fromTo(el.apps[k], { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: k === 0 ? 3 : 1.8, ease: 'power2.out' }, enter);
  tl.to(el.apps[k], { autoAlpha: 0, y: -18, duration: 1.2, ease: 'power1.in' }, exit);
  // The rail above the column keeps its place: only the active app lights up and fills.
  const last = DEVICE_APPS.length - 1;
  const railEnd = k === last ? T.outroStart : appStart(k + 1);
  tl.fromTo(el.railItems[k], { opacity: ROW_DIM }, { opacity: 1, duration: 1, ease: 'power1.out' }, Math.max(enter, appStart(k) - 0.5));
  if (k < last) tl.to(el.railItems[k], { opacity: ROW_DIM, duration: 1, ease: 'power1.in' }, railEnd - 0.5);
  tl.fromTo(el.railFills[k], { scaleX: 0 }, { scaleX: 1, duration: railEnd - appStart(k) }, appStart(k));
  // The name rises letter by letter out of a mask, and leaves the same way.
  const chars = isReduced ? [] : splitMasked(el.appNames[k], 'chars');
  if (chars.length) {
    tl.fromTo(chars, { yPercent: 118 }, { yPercent: 0, duration: 1.6, stagger: { amount: 0.9 }, ease: 'power3.out' }, enter);
    tl.to(chars, { yPercent: -118, duration: 1.1, stagger: { amount: 0.5 }, ease: 'power2.in' }, exit);
  }
  const rows = el.rows[k] ?? [];
  rows.forEach((row, j) => {
    const start = j === 0 ? enter : appStart(k) + T.screenAt[j - 1] + T.screenChange / 2;
    const end = j === rows.length - 1 ? exit : appStart(k) + T.screenAt[j] + T.screenChange / 2;
    tl.fromTo(row, { opacity: ROW_DIM }, { opacity: 1, duration: 0.8, ease: 'power1.out' }, start);
    if (j < rows.length - 1) tl.to(row, { opacity: ROW_DIM, duration: 0.8, ease: 'power1.in' }, end);
    tl.fromTo(el.fills[k]?.[j] ?? null, { scaleX: 0 }, { scaleX: 1, duration: end - start }, start);
  });
}

/**
 * The whole story on one timeline (units: see story.ts › T). The Story
 * object drives WebGL / CSS devices; the DOM copy rides the same playhead.
 */
function buildTimeline(runtime: DevicesRuntime, el: StoryElements, isReduced: boolean, isPortrait: boolean): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: () => runtime.notify() });
  addDeviceTweens(tl, runtime);

  tl.to(el.intro, { autoAlpha: 0, y: -28, duration: 4, ease: 'power1.in' }, T.introEnd);
  tl.fromTo(el.glow, { '--shift': 0 }, { '--shift': 1, duration: T.dollyEnd - T.introEnd, ease: 'power2.inOut' }, T.introEnd);
  tl.to(el.glow, { '--shift': 0, duration: T.outroEnd - T.outroStart - 1, ease: 'power2.inOut' }, T.outroStart + 1);
  tl.fromTo(el.rail, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 3, ease: 'power2.out' }, T.dollyEnd - 4);
  tl.to(el.rail, { autoAlpha: 0, duration: 1.2, ease: 'power1.in' }, T.outroStart);
  DEVICE_APPS.forEach((_, k) => addAppCopy(tl, el, k, isReduced));

  // The closing line lands as soon as the phone has cleared its column (the left one on wide screens, the
  // top on portrait ones, where the phone travels down through it), so the pull-out never plays to an empty page.
  const outroAt = isPortrait ? T.outroEnd - 3.4 : T.outroStart + 4.4;
  tl.fromTo(el.outro, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 3, ease: 'power2.out' }, outroAt);
  const words = isReduced ? [] : splitMasked(el.outroTitle, 'words');
  if (words.length) tl.fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 2.4, stagger: 0.35, ease: 'power3.out' }, outroAt);
  return tl;
}

/** Mouse moves and finger drags tilt the devices; the scene springs them back on release. */
function usePointerTilt(runtime: DevicesRuntime, stageRef: RefObject<HTMLDivElement | null>, isEnabled: boolean): void {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isEnabled) return;
    const setFrom = (clientX: number, clientY: number) =>
      runtime.setPointer((clientX / window.innerWidth) * 2 - 1, (clientY / window.innerHeight) * 2 - 1);
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setFrom(event.clientX, event.clientY);
    };
    const onLeave = () => runtime.releasePointer();
    const onTouch = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) setFrom(touch.clientX, touch.clientY);
    };
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerleave', onLeave);
    stage.addEventListener('touchstart', onTouch, { passive: true });
    stage.addEventListener('touchmove', onTouch, { passive: true });
    stage.addEventListener('touchend', onLeave);
    stage.addEventListener('touchcancel', onLeave);
    return () => {
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('touchstart', onTouch);
      stage.removeEventListener('touchmove', onTouch);
      stage.removeEventListener('touchend', onLeave);
      stage.removeEventListener('touchcancel', onLeave);
      runtime.releasePointer();
    };
  }, [runtime, stageRef, isEnabled]);
}

/**
 * 06 · Devices — a device theatre. A procedural phone and laptop run real
 * products in dark mode (media/showcase.ts): a learning platform's site
 * scrolls on the laptop, the phone runs three apps screen by screen (taps,
 * pushes, tab switches). Scrolling
 * dollies in, the phone turns to face us and makes one full turn per app,
 * then both devices come back together. Visitors can grab the phone (drag,
 * or swipe sideways on touch) and fling it round; it lands facing them. The
 * scene sleeps after a few seconds without input. Low tier, no WebGL or a
 * lost context: the same story with CSS 3D frames.
 */
export default function S06Devices({ meta }: LabSectionProps) {
  const theme = useLabTheme();
  const { id: logoId, Mark } = useLabLogo();
  const { tier, reducedMotion, webgl } = useLabDevice();
  const [runtime] = useState(createRuntime);
  const copy = useDevicesCopy();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLOListElement>(null);
  const railItemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const railFillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const markHostRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLElement>(null);
  const outroRef = useRef<HTMLDivElement>(null);
  const outroTitleRef = useRef<HTMLParagraphElement>(null);
  const appRefs = useRef<Array<HTMLLIElement | null>>([]);
  const appNameRefs = useRef<Array<HTMLHeadingElement | null>>([]);
  const rowRefs = useRef<Array<Array<HTMLLIElement | null>>>(DEVICE_APPS.map(() => []));
  const fillRefs = useRef<Array<Array<HTMLSpanElement | null>>>(DEVICE_APPS.map(() => []));
  const isActive = useInView(rootRef);
  const isPortrait = useMediaQuery(PORTRAIT_QUERY);
  const [isContextLost, setIsContextLost] = useState(false);
  const handleContextLost = useCallback(() => setIsContextLost(true), []);
  const isWebGL = webgl && tier !== 'low' && !isContextLost;

  usePointerTilt(runtime, stageRef, isActive && !reducedMotion);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      runtime.reset();
      const tl = buildTimeline(
        runtime,
        {
          intro: introRef.current,
          glow: glowRef.current,
          rail: railRef.current,
          railItems: railItemRefs.current,
          railFills: railFillRefs.current,
          apps: appRefs.current,
          appNames: appNameRefs.current,
          rows: rowRefs.current,
          fills: fillRefs.current,
          outro: outroRef.current,
          outroTitle: outroTitleRef.current,
        },
        reducedMotion,
        isPortrait
      );

      if (reducedMotion) {
        // No scrubbing: jump between resting points, the copy crossfades (CSS).
        runtime.reset({ boot: 1 });
        const points = stations(DEVICE_APPS.length);
        let current = -1;
        const goTo = (progress: number) => {
          const station = nearestStation(points, progress);
          if (station === current) return;
          current = station;
          tl.seek(station);
          runtime.notify();
        };
        goTo(0);
        ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: self => goTo(self.progress) });
        return;
      }

      tl.progress(0);
      gsap.fromTo(
        runtime.story,
        { boot: 0 },
        {
          boot: 1,
          ease: 'none',
          onUpdate: () => runtime.notify(),
          scrollTrigger: { trigger: root, start: 'top 90%', end: 'top 5%', scrub: SCRUB_SECONDS },
        }
      );
      ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        animation: tl,
        scrub: SCRUB_SECONDS,
        onUpdate: self => runtime.setVelocity(self.getVelocity()),
      });
    },
    { scope: rootRef, dependencies: [reducedMotion, runtime, isPortrait], revertOnUpdate: true }
  );

  const stage = isWebGL ? (
    <LazyCanvas
      className={css.canvas}
      camera={{ fov: CAMERA_FOV, near: 0.5, far: 60, position: [0, 0.5, 8.4] }}
      fallback={<CssDevices runtime={runtime} />}
      activeFrameloop='demand'
      label='devices theatre'
    >
      <DevicesScene
        runtime={runtime}
        theme={theme}
        tier={tier}
        reducedMotion={reducedMotion}
        markHost={markHostRef}
        logoId={logoId}
        onContextLost={handleContextLost}
      />
    </LazyCanvas>
  ) : (
    <CssDevices runtime={runtime} />
  );

  return (
    <div ref={rootRef} className={css.root} data-reduced={reducedMotion ? 'true' : 'false'} data-scheme={theme.scheme}>
      <div ref={stageRef} className={css.stage}>
        <div className={css.backdrop} aria-hidden='true'>
          <span ref={glowRef} className={css.glow} />
        </div>
        <div role='img' aria-label={copy.stageLabel} className={css.canvasBox}>
          {stage}
        </div>
        {reducedMotion ? null : <GrabLayer runtime={runtime} />}
        <div className={css.overlay}>
          <header ref={introRef} className={css.intro}>
            <SectionHeading meta={meta} className={css.heading}>
              {copy.heading}
            </SectionHeading>
            <p className={css.lede}>{copy.intro}</p>
          </header>

          <div className={css.apps}>
            <ol ref={railRef} className={css.rail} aria-hidden='true'>
              {DEVICE_APPS.map((app, i) => (
                <li
                  key={app.id}
                  ref={node => {
                    railItemRefs.current[i] = node;
                  }}
                  className={css.railItem}
                >
                  <span className={css.railNum}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={css.railName}>{copy.apps[i].tag}</span>
                  <span className={css.railBar}>
                    <span
                      ref={node => {
                        railFillRefs.current[i] = node;
                      }}
                      className={css.railFill}
                    />
                  </span>
                </li>
              ))}
            </ol>
            <ol className={css.appList}>
              {DEVICE_APPS.map((app, i) => (
                <li
                  key={app.id}
                  ref={node => {
                    appRefs.current[i] = node;
                  }}
                  className={css.app}
                >
                  <p className={css.kicker}>
                    <span className={css.srOnly}>{copy.position(i)}</span>
                    <span className={css.meta}>{copy.apps[i].kicker}</span>
                  </p>
                  <h3
                    ref={node => {
                      appNameRefs.current[i] = node;
                    }}
                    className={css.appName}
                  >
                    {copy.apps[i].title}
                  </h3>
                  <p className={css.appLine}>{copy.apps[i].oneLiner}</p>
                  <ol className={css.features}>
                    {app.screens.map((screen, j) => (
                      <li
                        key={screen.src}
                        ref={node => {
                          rowRefs.current[i][j] = node;
                        }}
                        className={css.feature}
                      >
                        <span
                          ref={node => {
                            fillRefs.current[i][j] = node;
                          }}
                          className={css.featureFill}
                          aria-hidden='true'
                        />
                        <span className={css.featureNum}>{String(j + 1).padStart(2, '0')}</span>
                        <span className={css.featureText}>{copy.apps[i].captions[j]}</span>
                      </li>
                    ))}
                  </ol>
                  <ul className={css.chips}>
                    {copy.apps[i].platforms.map(platform => (
                      <li key={platform} className={css.chip}>
                        {platform}
                      </li>
                    ))}
                    {app.stores.map(store => (
                      <li key={store} className={`${css.chip} ${css.chipLive}`}>
                        {store}
                      </li>
                    ))}
                  </ul>
                  <p className={css.tech}>{app.tech.join(' · ')}</p>
                </li>
              ))}
            </ol>
          </div>

          <div ref={outroRef} className={css.outro}>
            <p ref={outroTitleRef} className={css.outroTitle}>
              {copy.outroTitle}
            </p>
            <p className={css.outroText}>{copy.outroText}</p>
          </div>
        </div>
      </div>
      <div ref={markHostRef} className={css.markHost} aria-hidden='true'>
        <Mark />
      </div>
    </div>
  );
}
