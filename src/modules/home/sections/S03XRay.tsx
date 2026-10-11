'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import LazyCanvas from '../components/LazyCanvas';
import { SectionHeading } from '../components/LabSection';
import { useLabDevice, useMediaQuery } from '../device/useDeviceTier';
import { gsap, ScrollTrigger, useGSAP } from '../global/gsap';
import { useProjectDescriber } from '../media/useProjectDescriber';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import { createController, markInput, type LensController } from './s03/controller';
import CssLens from './s03/CssLens';
import { paletteFromTheme } from './s03/palette';
import { localizeScenes } from './s03/scenes';
import StillPlane from './s03/StillPlane';
import type { HudElements } from './s03/tour';
import { useLensInput } from './s03/useLensInput';
import css from './s03/XRay.module.css';
import XRayGL from './s03/XRayGL';

/** Inside the lens the blueprint is magnified a touch, like a loupe. */
const MAGNIFICATION = 1.12;
/** Desktop layout: full-bleed stage, copy column on the left. Must match XRay.module.css. */
const WIDE_QUERY = '(min-width: 1024px) and (min-aspect-ratio: 5/4)';

/** LazyCanvas sets `position: relative` inline; the canvas box must fill the stage. */
const CANVAS_BOX: CSSProperties = { position: 'absolute', inset: 0 };

function RevealIcon() {
  return (
    <svg className={css.icon} viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.5' aria-hidden='true'>
      <circle cx='7' cy='7' r='5' />
      <path d='M7 4.5v5M4.5 7h5M10.6 10.6 14 14' strokeLinecap='round' />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg className={css.icon} viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.5' aria-hidden='true'>
      <path d='M2.5 8h10M9 4.5 12.5 8 9 11.5' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 03 · X-Ray — "See through our work". Real app screens, cut out of the
 * project walkthroughs, float on the page; a liquid lens under the cursor or
 * finger reveals the blueprint underneath: grid, an ink drawing of the UI,
 * component boxes with measurements, and the code behind them with a
 * plain-English caption. Idle, the lens tours each project once and the
 * section moves on to the next, then rests (render on demand) until someone
 * touches it or it scrolls back into view.
 * Low tier / no WebGL: a CSS lens over the same data. Reduced motion: a still
 * lens on the first code card that moves only when the visitor moves it.
 */
export default function S03XRay({ meta }: LabSectionProps) {
  // Copy: src/messages/home/xray/{en,ru,uz}.json (the i18n pattern every section follows).
  const t = useTranslations('home.xray');
  const theme = useLabTheme();
  const { tier, reducedMotion, isTouch } = useLabDevice();
  const isWide = useMediaQuery(WIDE_QUERY);
  const palette = useMemo(() => paletteFromTheme(theme), [theme]);
  const describe = useProjectDescriber();
  // Labels, screen names and code captions in the visitor's language (geometry and code stay in scenes.ts).
  const scenes = useMemo(
    () =>
      localizeScenes({
        part: key => t(`parts.${key}`),
        screen: key => t(`screens.${key}`),
        caption: key => t(`captions.${key}`),
        width: (width, unit) => t('screenWidth', { width, unit }),
      }),
    [t]
  );
  const [index, setIndex] = useState(0);
  const [isRevealAll, setIsRevealAll] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isParked, setIsParked] = useState(false);
  const [isGlReady, setIsGlReady] = useState(false);
  const controllerRef = useRef<LensController | null>(null);
  if (controllerRef.current === null) controllerRef.current = createController();
  const parkedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HudElements>({ root: null, label: null, tag: null, meta: null });
  const progressRef = useRef<HTMLSpanElement>(null);
  const helpId = useId();

  useLensInput(stageRef, controllerRef);

  const park = useCallback(() => {
    if (parkedRef.current) return;
    parkedRef.current = true;
    setIsParked(true);
  }, []);
  const wake = useCallback(() => {
    if (!parkedRef.current) return;
    parkedRef.current = false;
    setIsParked(false);
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.wake = wake;
    return () => {
      controller.wake = () => undefined;
    };
  }, [wake]);

  // Each time the stage comes back into view the show starts over (one lap per project).
  useEffect(() => {
    const stage = stageRef.current;
    const controller = controllerRef.current;
    if (!stage || !controller) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      controller.laps = 0;
      wake();
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [wake]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.isRevealAll = isRevealAll;
    controller.wake();
    controller.requestFrame();
  }, [isRevealAll]);

  // The hint retires after the first touch, press or keyboard move on the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || hasInteracted) return;
    const done = () => setHasInteracted(true);
    stage.addEventListener('pointerdown', done, { once: true });
    stage.addEventListener('keydown', done, { once: true });
    return () => {
      stage.removeEventListener('pointerdown', done);
      stage.removeEventListener('keydown', done);
    };
  }, [hasInteracted]);

  // Scroll intro: the stage arrives fully x-rayed and the lens closes in as it settles;
  // the copy rises line by line.
  useGSAP(
    () => {
      const controller = controllerRef.current;
      if (!controller) return;
      if (reducedMotion || !stageRef.current || !rootRef.current) {
        controller.intro = 1;
        return;
      }
      ScrollTrigger.create({
        trigger: stageRef.current,
        start: isWide ? 'top 85%' : 'top 92%',
        end: isWide ? 'top 15%' : 'top 30%',
        onUpdate: self => {
          controller.intro = self.progress;
          controller.wake();
          controller.requestFrame();
        },
        onRefresh: self => {
          controller.intro = self.progress;
        },
      });
      // Each block rises as it reaches the viewport (on desktop the credit sits at the top, the copy at the bottom).
      const lines = rootRef.current.querySelectorAll<HTMLElement>('[data-xray-line]');
      if (lines.length > 0) {
        gsap.from(lines, {
          yPercent: 110,
          duration: 1.05,
          ease: 'expo.out',
          stagger: 0.09,
          scrollTrigger: { trigger: lines[0].parentElement ?? lines[0], start: 'top 92%', once: true },
        });
      }
      rootRef.current.querySelectorAll<HTMLElement>('[data-xray-rise]').forEach(el => {
        gsap.from(el, {
          y: 18,
          autoAlpha: 0,
          duration: 0.8,
          delay: 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 95%', once: true },
        });
      });
    },
    { scope: rootRef, dependencies: [reducedMotion, isWide] }
  );

  const onCycle = useCallback(() => setIndex(current => (current + 1) % scenes.length), [scenes.length]);

  const selectNext = () => {
    const controller = controllerRef.current;
    if (controller) markInput(controller, false);
    setIndex(current => (current + 1) % scenes.length);
  };

  const scene = scenes[index];
  if (!scene) return null;
  const nextScene = scenes[(index + 1) % scenes.length];
  const isWebGL = tier !== 'low';
  const project = scene.project;
  // Story sections name the kind of product, never the client (founder, 2026-10-10).
  const kind = describe.title(project);
  const platforms = describe.platforms(project);
  const stack = project.tech.slice(0, 3).join(' · ');

  const cssLens = (
    <CssLens
      scene={scene}
      palette={palette}
      controllerRef={controllerRef}
      hudRef={hudRef}
      reducedMotion={reducedMotion}
      isRevealAll={isRevealAll}
      isWide={isWide}
    />
  );

  return (
    <div ref={rootRef} className={css.root} data-dark={palette.isDark ? 'true' : 'false'}>
      <div
        ref={stageRef}
        className={css.stage}
        tabIndex={0}
        role='group'
        aria-roledescription={t('roleDescription')}
        aria-label={t('stageLabel', { kind })}
        aria-describedby={helpId}
        data-cursor-hide=''
        data-gl={isGlReady ? 'ready' : 'pending'}
        data-parked={isParked ? 'true' : 'false'}
      >
        {isWebGL ? (
          <>
            <StillPlane className={css.stillPlane} scene={scene} isWide={isWide} />
            <LazyCanvas
              className={css.canvas}
              style={CANVAS_BOX}
              fallback={cssLens}
              loading={null}
              label='xray lens'
              camera={{ position: [0, 0, 1] }}
              activeFrameloop={isParked ? 'demand' : 'always'}
            >
              <XRayGL
                scenes={scenes}
                index={index}
                controllerRef={controllerRef}
                palette={palette}
                isAdditive={theme.blending === 'additive'}
                reducedMotion={reducedMotion}
                magnification={MAGNIFICATION}
                isWide={isWide}
                chroma={isTouch || !isWide ? 2.5 : 6}
                hudRef={hudRef}
                progressRef={progressRef}
                onCycle={onCycle}
                onReady={setIsGlReady}
                onPark={park}
              />
            </LazyCanvas>
          </>
        ) : (
          cssLens
        )}

        <div
          className={css.hud}
          aria-hidden='true'
          ref={el => {
            hudRef.current.root = el;
          }}
        >
          <span
            className={css.hudLabel}
            ref={el => {
              hudRef.current.label = el;
            }}
          />
          <span className={css.hudCode}>
            <span
              className={css.hudTag}
              ref={el => {
                hudRef.current.tag = el;
              }}
            />
            <span
              className={css.hudMeta}
              ref={el => {
                hudRef.current.meta = el;
              }}
            />
          </span>
        </div>

        <p className={css.hint} data-hidden={hasInteracted ? 'true' : 'false'} aria-hidden='true'>
          {isTouch ? t('hintTouch') : t('hintPointer')}
        </p>
        <p id={helpId} className={css.srOnly}>
          {t('keyboardHelp')}
        </p>
      </div>

      <div className={css.copy}>
        <SectionHeading meta={meta} className={css.heading}>
          <span className={css.lineMask}>
            <span className={css.line} data-xray-line=''>
              {t('headingLines.first')}
            </span>
          </span>{' '}
          <span className={css.lineMask}>
            <span className={css.line} data-xray-line=''>
              {t('headingLines.second')}
            </span>
          </span>
        </SectionHeading>
        <p className={css.lede} data-xray-rise=''>
          {isTouch ? t('summaryTouch') : t('summary')}
        </p>
      </div>

      <div className={css.credit} data-xray-rise=''>
        <p className={css.creditKicker}>
          <span className={css.creditCount}>
            {pad2(index + 1)} / {pad2(scenes.length)}
          </span>
          <span className={css.creditIn}>{t('inLens')}</span>
        </p>
        <div key={scene.slug} className={css.creditBody}>
          <p className={css.creditName}>{kind}</p>
          <p className={css.creditMeta}>
            {describe.location(project)} · {platforms}
          </p>
          <p className={css.creditStack}>{stack}</p>
        </div>
      </div>

      <div className={css.tools} data-xray-rise=''>
        <button type='button' className={css.button} aria-pressed={isRevealAll} onClick={() => setIsRevealAll(value => !value)}>
          <RevealIcon />
          {isRevealAll ? t('revealOff') : t('revealOn')}
        </button>
        {nextScene && scenes.length > 1 ? (
          <button
            type='button'
            className={`${css.button} ${css.next}`}
            onClick={selectNext}
            aria-label={t('nextLabel', { description: describe.describe(nextScene.project) })}
          >
            <span>{t('next')}</span>
            <NextIcon />
            <span className={css.nextTrack} aria-hidden='true'>
              <span ref={progressRef} className={css.nextFill} />
            </span>
          </button>
        ) : null}
      </div>

      <p className={css.footnote} data-xray-rise=''>
        {t('footnote')}
      </p>
    </div>
  );
}
