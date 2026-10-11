'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, ScrollTrigger, useGSAP } from '../global/gsap';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import { SHOWS_PRODUCT_BRAND, STAGE_IDS, useProductKind } from './s04/data';
import { createStageFit, type StageFit } from './s04/geometry';
import { NARROW, stageAt, T, WIDE, zoomAt } from './s04/layout';
import MiniSite from './s04/MiniSite';
import css from './s04/stage.module.css';
import { buildAssemblyTimeline, type AssemblyFx } from './s04/timeline';
import { createVideoGate } from './s04/videoGate';

/**
 * 04 · Assembly — "The site builds itself". A sticky scroll chapter: a real
 * client product's landing page (Talim AI), made of DOM pieces, starts
 * exploded in CSS 3D and assembles through four stages (Design → Frontend →
 * Backend & AI → Launch). At launch the copy steps aside and the finished
 * site zooms flat to nearly full screen; the URL types itself and resolves
 * with 200 OK. Scrolling back reverses it; the mouse tilts the stack and
 * scroll speed leans it (touch too).
 *
 * Reduced motion: no movement at all — the finished layout stays put and the
 * stages crossfade over it as you scroll (wireframe → styled → data → live).
 */

const WIDE_QUERY = '(min-width: 720px)';
// gsap.matchMedia only runs a handler when at least one condition matches, so
// the narrow layout needs its own query too.
const NARROW_QUERY = '(max-width: 719.98px)';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
/** The story starts while the section scrolls in, so the first screen already moves. */
const STORY_START = 'top 25%';
const MAX_BUILD_FIT = 1.25;
const MAX_LAUNCH_FIT = 1.6;
const TILT_X = 6;
const TILT_Y = 9;
const LEAN_MAX = 5;
const LEAN_PER_VELOCITY = 1 / 380;

export default function S04Assembly({ meta }: LabSectionProps) {
  const t = useTranslations('home.assembly');
  const kind = useProductKind();
  const { scheme } = useLabTheme();
  const { tier, isTouch } = useLabDevice();
  const rootRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const buildRef = useRef<HTMLDivElement>(null);
  const launchRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  // The timeline opens it at launch; only the <video> re-renders.
  const [videoGate] = useState(createVideoGate);
  // Low tier: no slots, posts or sweep, no pointer tilt, poster instead of video.
  const isRich = tier !== 'low';
  // The 3D leader lines cost two layers per piece: desktop-class devices only.
  const hasPosts = tier === 'high' && !isTouch;

  useGSAP(
    () => {
      const root = rootRef.current;
      const sticky = stickyRef.current;
      const fit = fitRef.current;
      const buildBox = buildRef.current;
      const launchBox = launchRef.current;
      if (!root || !sticky || !fit || !buildBox || !launchBox) return;
      const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
      const captions = Array.from(root.querySelectorAll<HTMLElement>('[data-caption]'));
      const stageFit: StageFit = createStageFit({ sticky, fit, buildBox, launchBox, maxBuild: MAX_BUILD_FIT, maxLaunch: MAX_LAUNCH_FIT });
      const stopFit = stageFit.observe();
      const fx: AssemblyFx = { hasSlots: isRich, hasPosts, hasSweep: isRich };
      let stage = -1;
      let isFlat = false;
      let isZooming = false;
      let canZoom = false;

      const onTime = (time: number) => {
        railRef.current?.style.setProperty('--p', (time / T.total).toFixed(4));
        const zoom = canZoom ? zoomAt(time) : 0;
        stageFit.setZoom(zoom);
        // Hold the raster scale while zooming (no re-raster per frame); crisp again once it settles.
        const shouldHoldRaster = zoom > 0 && zoom < 1;
        if (shouldHoldRaster !== isZooming) {
          isZooming = shouldHoldRaster;
          root.toggleAttribute('data-asm-zooming', shouldHoldRaster);
        }
        const next = stageAt(time);
        if (next !== stage) {
          stage = next;
          root.dataset.asmStage = String(next);
          [steps, captions].forEach(list =>
            list.forEach((el, index) => {
              el.dataset.state = index < next ? 'done' : index === next ? 'active' : 'todo';
              if (el.dataset.step === undefined) return;
              if (index === next) el.setAttribute('aria-current', 'step');
              else el.removeAttribute('aria-current');
            })
          );
        }
        const shouldFlatten = canZoom && time >= T.flat;
        if (shouldFlatten !== isFlat) {
          isFlat = shouldFlatten;
          root.toggleAttribute('data-asm-flat', shouldFlatten);
        }
        videoGate.set(isRich && time >= T.videoOn);
      };

      const mm = gsap.matchMedia();
      mm.add({ isWide: WIDE_QUERY, isNarrow: NARROW_QUERY, reduce: REDUCE_QUERY }, context => {
        const { isWide, reduce } = context.conditions ?? {};

        if (reduce) {
          // No timeline and no zoom: the stage index alone drives CSS crossfades.
          canZoom = false;
          ScrollTrigger.create({
            trigger: root,
            start: STORY_START,
            end: 'bottom bottom',
            onUpdate: self => onTime(self.progress * T.total),
            onRefresh: self => onTime(self.progress * T.total),
          });
          onTime(0);
          return;
        }

        canZoom = true;
        const built = buildAssemblyTimeline({ root, layout: isWide ? WIDE : NARROW, fx, start: STORY_START, onTime });

        // Scroll speed leans the stack (touch too); damped once it has launched flat.
        const lean = root.querySelector<HTMLElement>('[data-lean]');
        const leanTo = lean ? gsap.quickTo(lean, 'rotationX', { duration: 0.5, ease: 'power2.out' }) : null;
        const settle = gsap.delayedCall(0.14, () => leanTo?.(0)).pause();
        ScrollTrigger.create({
          trigger: root,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: self => {
            if (!leanTo) return;
            const damp = 1 - stageFit.zoom;
            leanTo(gsap.utils.clamp(-LEAN_MAX, LEAN_MAX, -self.getVelocity() * LEAN_PER_VELOCITY) * damp);
            settle.restart(true);
          },
        });

        // A mouse tilts the stack toward the pointer (not once it is a flat site).
        const tilt = root.querySelector<HTMLElement>('[data-tilt]');
        let removePointer: () => void = () => undefined;
        if (isRich && tilt) {
          const tiltX = gsap.quickTo(tilt, 'rotationX', { duration: 0.9, ease: 'power3.out' });
          const tiltY = gsap.quickTo(tilt, 'rotationY', { duration: 0.9, ease: 'power3.out' });
          const onMove = (event: PointerEvent) => {
            if (event.pointerType !== 'mouse') return;
            const damp = 1 - stageFit.zoom;
            tiltY((event.clientX / window.innerWidth - 0.5) * TILT_Y * 2 * damp);
            tiltX((0.5 - event.clientY / window.innerHeight) * TILT_X * 2 * damp);
          };
          const onLeave = () => {
            tiltX(0);
            tiltY(0);
          };
          sticky.addEventListener('pointermove', onMove);
          sticky.addEventListener('pointerleave', onLeave);
          removePointer = () => {
            sticky.removeEventListener('pointermove', onMove);
            sticky.removeEventListener('pointerleave', onLeave);
          };
        }

        return () => {
          removePointer();
          built?.restore();
          root.removeAttribute('data-asm-flat');
          root.removeAttribute('data-asm-zooming');
          isFlat = false;
          isZooming = false;
        };
      });

      root.dataset.ready = '';
      return () => {
        mm.revert();
        stopFit();
      };
    },
    { scope: rootRef, dependencies: [isRich, hasPosts], revertOnUpdate: true }
  );

  const stages = STAGE_IDS.map(id => ({
    id,
    label: t(`stages.${id}.label`),
    text: id === 'launch' && SHOWS_PRODUCT_BRAND ? t('launchBranded') : t(`stages.${id}.text`),
  }));

  return (
    <div ref={rootRef} className={css.root} data-scheme={scheme} data-asm-stage='0'>
      <div ref={stickyRef} className={css.sticky}>
        <div className={css.copyCol} data-copycol=''>
          <SectionHeading meta={meta} className={css.title}>
            {t('heading')}
          </SectionHeading>
          <p className={css.intro}>{SHOWS_PRODUCT_BRAND ? t('introBranded', { kind }) : t('intro', { kind })}</p>
          <div className={css.steps}>
            <span className={css.rail} aria-hidden='true'>
              <span ref={railRef} className={css.railFill} />
            </span>
            <ol className={css.stepList} aria-label={t('stagesLabel')}>
              {stages.map((stage, index) => (
                <li key={stage.id} className={css.step} data-step='' data-state={index === 0 ? 'active' : 'todo'}>
                  <span className={css.stepNum} aria-hidden='true'>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={css.stepLabel}>{stage.label}</span>
                  <span className={css.stepText}>{stage.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div ref={buildRef} className={css.buildBox} aria-hidden='true' />
        <div ref={launchRef} className={css.launchBox} aria-hidden='true' />
        <div className={css.stage} role='img' aria-label={t('illustration', { kind })}>
          <div ref={fitRef} className={css.fit} aria-hidden='true'>
            <div className={css.floor} data-floor='' />
            <div className={css.persp}>
              <div className={css.lean} data-lean=''>
                <div className={css.tilt} data-tilt=''>
                  <div className={css.camera} data-camera=''>
                    <MiniSite videoGate={videoGate} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={css.captions} aria-hidden='true'>
          {stages.map((stage, index) => (
            <p key={stage.id} className={css.caption} data-caption='' data-state={index === 0 ? 'active' : 'todo'}>
              <span className={css.captionNum}>{String(index + 1).padStart(2, '0')}</span>
              {stage.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
