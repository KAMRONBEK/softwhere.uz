'use client';

import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectionHeading } from '../components/LabSection';
import LazyCanvas from '../components/LazyCanvas';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, ScrollTrigger, useGSAP } from '../global/gsap';
import { getLabLenis } from '../global/scroll';
import { revealOnFocus } from '../global/revealOnFocus';
import { HOME_FACTS } from '../media/facts';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import { CAMERA_FOV, CAMERA_Z } from './s11/geo';
import css from './s11/globe.module.css';
import GlobeStill from './s11/GlobeStill';
import { getGlobeLook } from './s11/look';
import { ALL_PINS, BEATS } from './s11/markets';
import {
  BEAT_CENTERS,
  beatAt,
  beatShownAt,
  createRuntime,
  forgetLabelSizes,
  requestFrame,
  setBeat,
  setBeatListener,
  type GlobeRuntime,
} from './s11/story';
import { numberLocale, useGlobeCopy } from './s11/useGlobeCopy';
import { useGlobeDrag } from './s11/useGlobeDrag';

const GlobeScene = dynamic(() => import('./s11/GlobeScene'), { ssr: false });

const LAST_CENTER = BEAT_CENTERS[BEAT_CENTERS.length - 1];
/** LazyCanvas debug label (developer-facing, not copy). */
const CANVAS_LABEL = 'globe';
const ROUTE_SECONDS = 1.5;
/** Count-up of a beat's numeral as it arrives (s): a touch longer for bigger numbers. */
const COUNT_BASE_S = 0.55;
const COUNT_PER_UNIT_S = 0.012;
const COUNT_MAX_S = 1.2;
/** Local time on the Tashkent pill, refreshed often enough to roll over on the minute. */
const CLOCK_REFRESH_MS = 15_000;
/** English pages read a US clock ("1:35 AM"); uz/ru keep the 24-hour one ("01:35"). */
const TASHKENT_TIME_12H = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tashkent',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const TASHKENT_TIME_24H = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface StoryDom {
  captions: Array<HTMLElement | null>;
  counts: Array<HTMLElement | null>;
  stops: Array<HTMLButtonElement | null>;
  fill: HTMLElement | null;
}

/** Writes into React's own text node (never replaces it), so a later render still owns it. */
function writeNumeral(el: HTMLElement, value: number): void {
  const text = String(value);
  if (el.firstChild) el.firstChild.nodeValue = text;
  else el.textContent = text;
}

/**
 * Rolls a numeral up from zero to its value (instant under reduced motion).
 * The box is held at the final value's measured width (right-aligned), so the
 * words after it never move while it counts, whatever the style's tracking.
 */
function countUp(el: HTMLElement | null, isInstant: boolean): gsap.core.Tween | null {
  if (!el) return null;
  const to = Number(el.dataset.count ?? 0);
  el.style.minWidth = '';
  writeNumeral(el, to);
  if (isInstant || to <= 1) return null;
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  const counter = { value: 0 };
  writeNumeral(el, 0);
  return gsap.to(counter, {
    value: to,
    duration: Math.min(COUNT_MAX_S, COUNT_BASE_S + to * COUNT_PER_UNIT_S),
    ease: 'power3.out',
    onUpdate: () => writeNumeral(el, Math.round(counter.value)),
    onInterrupt: () => writeNumeral(el, to),
  });
}

/** Shows one beat's copy and route stop; everything else steps back. */
function showBeat(dom: StoryDom, beat: number): void {
  dom.captions.forEach((caption, index) => {
    if (!caption) return;
    caption.toggleAttribute('data-active', index === beat);
    caption.setAttribute('aria-hidden', String(index !== beat));
  });
  dom.stops.forEach((stop, index) => {
    if (!stop) return;
    if (index === beat) stop.setAttribute('aria-current', 'step');
    else stop.removeAttribute('aria-current');
  });
}

function setRouteFill(fill: HTMLElement | null, p: number): void {
  if (fill) fill.style.transform = `scaleX(${Math.min(1, p / LAST_CENTER).toFixed(4)})`;
}

/**
 * ScrollTrigger progress → runtime target (snapped to beats when static) and
 * route. The copy follows the globe: the live WebGL scene switches it from
 * its displayed rotation; without it (2D still) it is derived here.
 */
function applyProgress(runtime: GlobeRuntime, dom: StoryDom, p: number, isStatic: boolean): void {
  const snap = beatAt(p);
  const target = isStatic ? BEAT_CENTERS[snap] : p;
  if (snap !== runtime.snap) {
    runtime.snap = snap;
    // Static mode has no inertia to settle a drag: re-centre on the new market.
    if (isStatic) {
      runtime.drag.yaw = 0;
      runtime.drag.pitch = 0;
    }
  }
  if (!runtime.isSceneLive) setBeat(runtime, isStatic ? snap : beatShownAt(p));
  setRouteFill(dom.fill, target);
  if (target !== runtime.target) {
    runtime.target = target;
    if (isStatic) requestFrame(runtime);
  }
}

function setEntrance(runtime: GlobeRuntime, progress: number): void {
  runtime.enter = progress;
}

function bindLabel(runtime: GlobeRuntime, index: number, el: HTMLElement | null): void {
  runtime.labels[index] = el;
}

function bindReadout(runtime: GlobeRuntime, el: HTMLElement | null): void {
  runtime.readout = el;
}

/** Drag-arrows glyph for the hint. */
function DragIcon() {
  return (
    <svg className={css.hintIcon} viewBox='0 0 22 10' aria-hidden='true'>
      <path
        d='M1 5h20M5 1 1 5l4 4M17 1l4 4-4 4'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

/**
 * 15 · Globe — "Built in Tashkent. Shipped to four continents." A dotted
 * Earth makes one westward turn across the scroll: Tashkent, Europe, North
 * America, over the Pacific to Australia and home again. Each market's arc
 * launches from Tashkent as the globe turns to it, a km counter riding its
 * head, then lands with a ripple through the dots and lights that country
 * up. The caption arrives with the planet (driven by its actual rotation)
 * and rolls its count up. Drag (or swipe sideways) to spin it; a fling has
 * inertia and settles back on the story. Every count comes from the
 * portfolio data (s11/markets.ts).
 */
export default function S11Globe({ meta }: LabSectionProps) {
  const theme = useLabTheme();
  const { tier, reducedMotion, isTouch, webgl } = useLabDevice();
  const look = useMemo(() => getGlobeLook(theme), [theme]);
  const [runtime] = useState<GlobeRuntime>(createRuntime);
  const [hasDragged, setHasDragged] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const globeBoxRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const captionRefs = useRef<Array<HTMLElement | null>>([]);
  const countRefs = useRef<Array<HTMLElement | null>>([]);
  const stopRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const storyRef = useRef<ScrollTrigger | null>(null);
  const homeTimeRef = useRef<HTMLSpanElement>(null);
  const locale = useLocale();
  const t = useTranslations('home.globe');
  const beatCopy = useGlobeCopy();
  const isWebGL = webgl && tier !== 'low';
  // Reduced motion and low tier: the globe jumps between beats (one frame each), no loops.
  const isStatic = reducedMotion || tier === 'low';

  // A style flip changes fonts: re-measure the chips and release the numerals' held widths.
  useEffect(() => {
    forgetLabelSizes();
    countRefs.current.forEach(el => el?.style.removeProperty('min-width'));
    requestFrame(runtime);
  }, [theme, runtime]);

  // Tashkent's live local time on the home pill (the chip is re-measured once it has text).
  useEffect(() => {
    const el = homeTimeRef.current;
    if (!el) return;
    const clock = locale === 'en' ? TASHKENT_TIME_12H : TASHKENT_TIME_24H;
    const write = () => {
      el.textContent = clock.format(new Date());
    };
    write();
    forgetLabelSizes();
    requestFrame(runtime);
    const timer = window.setInterval(write, CLOCK_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [runtime, locale]);

  const onDrag = useCallback(() => setHasDragged(true), []);
  useGlobeDrag(runtime, globeBoxRef, { isStatic, onDrag });

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const dom: StoryDom = {
        captions: captionRefs.current,
        counts: countRefs.current,
        stops: stopRefs.current,
        fill: fillRef.current,
      };
      let count: gsap.core.Tween | null = null;
      const rollCount = (beat: number) => {
        count?.kill();
        count = countUp(dom.counts[beat], reducedMotion);
      };
      setBeatListener(runtime, beat => {
        showBeat(dom, beat);
        rollCount(beat);
      });

      const apply = (p: number) => applyProgress(runtime, dom, p, isStatic);

      const story = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: self => apply(self.progress),
        onRefresh: self => apply(self.progress),
      });
      storyRef.current = story;
      const entrance = ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'top top',
        onUpdate: self => setEntrance(runtime, isStatic ? 1 : self.progress),
        onRefresh: self => setEntrance(runtime, isStatic ? 1 : self.progress),
      });
      showBeat(dom, runtime.beat);
      apply(story.progress);
      setEntrance(runtime, isStatic ? 1 : entrance.progress);

      // The copy arrives once, as the section comes in, and the first count rolls.
      // Opacity, not autoAlpha: the route's stop buttons must stay in the Tab order.
      let unreveal: (() => void) | undefined;
      if (!reducedMotion) {
        const revealed = root.querySelectorAll('[data-reveal]');
        const rise = gsap.from(revealed, {
          y: 34,
          opacity: 0,
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.09,
          scrollTrigger: { trigger: root, start: 'top 70%', once: true },
          onStart: () => rollCount(runtime.beat),
        });
        unreveal = revealOnFocus(root, rise, revealed);
      }
      return () => {
        unreveal?.();
        storyRef.current = null;
        setBeatListener(runtime, null);
        count?.kill();
      };
    },
    { scope: rootRef, dependencies: [runtime, isStatic, reducedMotion], revertOnUpdate: true }
  );

  const goToBeat = (index: number) => {
    const story = storyRef.current;
    if (!story) return;
    const y = story.start + BEAT_CENTERS[index] * (story.end - story.start) + 1;
    const lenis = getLabLenis();
    if (lenis) lenis.scrollTo(y, { duration: ROUTE_SECONDS });
    else window.scrollTo({ top: y, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const still = <GlobeStill runtime={runtime} look={look} className={css.still} />;

  return (
    <div ref={rootRef} className={css.root} data-scheme={theme.scheme}>
      <div className={css.stage}>
        <div className={css.backdrop} aria-hidden='true' />
        <div ref={globeBoxRef} className={css.globeBox}>
          {isWebGL ? (
            <LazyCanvas
              className={css.canvas}
              camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV, near: 0.1, far: 60 }}
              fallback={still}
              label={CANVAS_LABEL}
            >
              <GlobeScene runtime={runtime} look={look} tier={tier} isStatic={isStatic} />
            </LazyCanvas>
          ) : (
            still
          )}
          {/* Mouse drags start on the planet only; the cursor badge shows there until the first drag. */}
          <div className={css.globeHit} data-globe-hit='' data-cursor={isTouch || hasDragged ? undefined : t('cursor')} />
        </div>

        <div className={css.labels} aria-hidden='true'>
          {ALL_PINS.map((pin, index) => (
            <div
              key={pin.id}
              ref={el => bindLabel(runtime, index, el)}
              className={css.label}
              data-side={pin.side}
              data-prefer={pin.side}
              data-flip={pin.canFlip ? '' : undefined}
              data-home={index === 0 ? '' : undefined}
            >
              <span className={css.leader} data-leader='' />
              <span className={css.chip} data-chip=''>
                <span className={pin.hasShort ? css.chipLong : undefined}>{t(`pins.${pin.id}`)}</span>
                {pin.id === 'gb' ? <span className={css.chipShort}>{t('pinsShort.gb')}</span> : null}
                {index === 0 ? <span ref={homeTimeRef} className={css.chipTime} /> : null}
              </span>
            </div>
          ))}
          <div ref={el => bindReadout(runtime, el)} className={css.readout} data-locale={numberLocale(locale)} data-unit={t('km')}>
            <span className={css.readoutValue} />
          </div>
        </div>

        <div className={css.copy}>
          <div className={css.intro}>
            <SectionHeading meta={meta} className={css.heading}>
              <span className={css.headingLine} data-reveal>
                {t('headingLines.first')}
              </span>{' '}
              <span className={css.headingLine} data-reveal>
                {t('headingLines.second', HOME_FACTS)}
              </span>
            </SectionHeading>
            <p className={css.hint} data-hidden={hasDragged ? '' : undefined} aria-hidden='true'>
              <DragIcon />
              {isTouch ? t('hintTouch') : t('hintMouse')}
            </p>
          </div>

          <div className={css.dock}>
            <div className={css.captions} data-reveal>
              {BEATS.map((beat, index) => (
                <article
                  key={beat.id}
                  ref={el => {
                    captionRefs.current[index] = el;
                  }}
                  className={css.caption}
                  data-active={index === 0 ? '' : undefined}
                  aria-hidden={index !== 0}
                >
                  <h3 className={css.captionTitle}>
                    <span
                      ref={el => {
                        countRefs.current[index] = el;
                      }}
                      className={css.captionCount}
                      data-count={beat.count}
                    >
                      {beat.count}
                    </span>{' '}
                    {beatCopy[index].title}
                  </h3>
                  <p className={css.captionBody}>{beatCopy[index].body}</p>
                  <p className={css.captionDetail}>{beatCopy[index].detail}</p>
                </article>
              ))}
            </div>

            <nav className={css.route} aria-label={t('routeLabel')} data-reveal>
              <div className={css.track}>
                <span ref={fillRef} className={css.fill} />
              </div>
              <ol className={css.stops}>
                {BEATS.map((beat, index) => (
                  <li key={beat.id} className={css.stop} style={{ left: `${(index / (BEATS.length - 1)) * 100}%` }}>
                    <button
                      ref={el => {
                        stopRefs.current[index] = el;
                      }}
                      type='button'
                      className={css.stopButton}
                      aria-current={index === 0 ? 'step' : undefined}
                      aria-label={beatCopy[index].stopLabel}
                      onClick={() => goToBeat(index)}
                    >
                      <span className={css.stopDot} />
                      <span className={css.stopName} aria-hidden='true'>
                        {beatCopy[index].stop}
                        <span className={css.stopCount}>{beat.count}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
