'use client';

import { SplitText } from 'gsap/SplitText';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import { logWarn } from '@/core/logger';
import { SectionHeading } from '../components/LabSection';
import LazyCanvas from '../components/LazyCanvas';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, ScrollTrigger, useGSAP, SPLIT_KEEP_NBSP } from '../global/gsap';
import { scrollToSection } from '../global/scroll';
import { useLabLogo, useLogoInk } from '../logos';
import { useHomeFacts } from '../context/HomeFactsContext';
import { useLabTheme } from '../theme/useLabTheme';
import type { DeviceTier, LabSectionProps, SectionId } from '../types';
import { shouldPlayHeroEntrance } from './s01/heroBoot';
import { createHeroInput, needsTiltPermission, requestTiltPermission, useHeroPointer, useHeroTilt, type HeroPulse } from './s01/input';
import { knockLetters } from './s01/knock';
import { markPixels } from './s01/layout';
import { sampleMark, type MarkSample } from './s01/sampleMark';
import { RIPPLE_SPEED } from './s01/shaders';
import SignalScene, { CAMERA_FOV, CAMERA_Z, DUST_FRACTION } from './s01/SignalScene';
import css from './S01Hero.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(SplitText);

/** Particle budget per device tier (phones are 'mid'). */
const PARTICLES: Record<DeviceTier, number> = { high: 30000, mid: 16000, low: 8000 };

/** Scroll distances, in stage heights: the copy fades over 0.8 of a screen, the hint is gone after a nudge. */
const COPY_FADE = 0.8;
const HINT_FADE = 0.05;
/** The "Pulse" cursor target over the mark goes once the wind has taken most of it. */
const ZONE_FADE = 0.2;
const GLOW_FADE = 0.5;
const EDGE_FADE = 0.3;
/**
 * On the way out the wind takes the headline too: how far each word travels
 * (share of the stage height), mostly sideways so a word never climbs into
 * the line above it.
 */
const DRIFT_REACH = 0.07;
const DRIFT_RISE = 0.3;
/** The hint has done its job after a charged release, or after this many taps. */
const HINT_PULSES = 3;
const CHARGED = 1.5;

const noSubscribe = () => () => undefined;
/** LazyCanvas forces position: relative on its box, so fill the stage inline. */
const FILL: CSSProperties = { position: 'absolute', inset: 0 };

/** Every index once, in a random order: the headline's characters lock on out of sequence. */
function shuffledDelays(count: number, spread: number): number[] {
  const order = gsap.utils.shuffle(Array.from({ length: count }, (_, i) => i));
  const delays = new Array<number>(count);
  order.forEach((charIndex, rank) => {
    delays[charIndex] = (rank / Math.max(1, count - 1)) * spread;
  });
  return delays;
}

/**
 * 01 · Hero "Signal": a living cloud of glowing particles that forms the
 * active logo mark. Cursor = wind; press and hold = a gravity well that
 * spins the mark into a white-hot core; release = a shockwave whose ring runs
 * out across the stage and makes the headline's letters hop as it passes
 * (the first idle moment plays this once by itself). Sideways swipe and tilt
 * on phones. Scrolling strips the mark away on the wind, takes the headline
 * word by word, and hands over to the manifesto. The headline is real DOM
 * text that resolves out of a dot-matrix in the particles' accent.
 */
export default function S01Hero({ meta }: LabSectionProps) {
  // Copy: src/messages/home/hero/{en,ru,uz}.json; the call CTA is the page-wide home.shared.callCta.
  const t = useTranslations('home.hero');
  const facts = useHomeFacts();
  const tShared = useTranslations('home.shared');
  const theme = useLabTheme();
  const logo = useLabLogo();
  const { Mark } = logo;
  // The mark's particles, rings and glow take the logo's ink (brand orange unless the panel says accent).
  const markInk = useLogoInk();
  const sceneTheme = useMemo(
    () => (markInk === theme.colors.accent ? theme : { ...theme, colors: { ...theme.colors, accent: markInk } }),
    [theme, markInk]
  );
  const { tier, reducedMotion, isTouch } = useLabDevice();

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const markHostRef = useRef<HTMLDivElement>(null);
  const markZoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef(createHeroInput());

  const count = PARTICLES[tier];
  const markCount = Math.round(count * (1 - DUST_FRACTION));
  const [sample, setSample] = useState<MarkSample | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasLearned, setHasLearned] = useState(false);
  const [isTiltGranted, setIsTiltGranted] = useState(false);
  const canAskTilt = useSyncExternalStore(noSubscribe, needsTiltPermission, () => false);

  const isInteractive = !reducedMotion;
  const markReady = useCallback(() => setIsReady(true), []);
  // Set inside the GSAP context (so its tweens are reverted with it); null while there is no headline to knock.
  const knockRef = useRef<((pulse: HeroPulse) => void) | null>(null);
  const pulseCountRef = useRef(0);
  const onPulse = useCallback((pulse: HeroPulse) => {
    knockRef.current?.(pulse);
    pulseCountRef.current += 1;
    if (pulse.strength >= CHARGED || pulseCountRef.current >= HINT_PULSES) setHasLearned(true);
  }, []);

  // The scene's own demo pulse (NDC) reaches the headline the same way.
  const onScenePulse = useCallback((pulse: { x: number; y: number; strength: number }) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    knockRef.current?.({
      clientX: rect.left + ((pulse.x + 1) / 2) * rect.width,
      clientY: rect.top + ((1 - pulse.y) / 2) * rect.height,
      strength: pulse.strength,
    });
  }, []);

  useHeroPointer({ rootRef, stageRef, input: inputRef, isEnabled: isInteractive, onPulse });
  useHeroTilt(inputRef, isInteractive && isTouch && (!canAskTilt || isTiltGranted));

  // Sample the active logo's mark into particle targets (re-runs on logo change).
  useEffect(() => {
    const svg = markHostRef.current?.querySelector('svg');
    if (!svg) return;
    let isCancelled = false;
    // After the mount's own work: reading the mark's ink is a raster pass of its own.
    const frame = requestAnimationFrame(() => {
      sampleMark(svg.outerHTML, markCount)
        .then(next => {
          if (!isCancelled) setSample(next);
        })
        .catch((error: unknown) => logWarn('hero: could not sample the logo mark', error, 'lab/hero'));
    });
    return () => {
      isCancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [logo.id, markCount]);

  useGSAP(
    (context, contextSafe) => {
      const root = rootRef.current;
      const stage = stageRef.current;
      const title = root?.querySelector('h1');
      const ghost = root?.querySelector<HTMLElement>('[data-hero-ghost]');
      if (!root || !stage || !title || !ghost || reducedMotion) return;
      const io = inputRef.current;
      const unit = () => stage.offsetHeight || window.innerHeight;
      const after = (share: number) => () => `+=${unit() * share}`;

      // Scroll depth (in stage heights) drives the dissolve; the sticky span sets how far the mark follows the page.
      const measure = (self: ScrollTrigger) => {
        io.sticky = Math.max(0, root.offsetHeight / unit() - 1);
        io.scroll = Math.max(0, (self.scroll() - self.start) / unit());
        io.wake?.();
      };
      ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom top', onUpdate: measure, onRefresh: measure });

      const scrub = (share: number) => ({ trigger: root, start: 'top top', end: after(share), scrub: true });
      gsap.to(copyRef.current, { autoAlpha: 0, ease: 'power1.in', scrollTrigger: scrub(COPY_FADE) });
      gsap.to(hintRef.current, { autoAlpha: 0, ease: 'none', scrollTrigger: scrub(HINT_FADE) });
      if (markZoneRef.current) gsap.to(markZoneRef.current, { autoAlpha: 0, ease: 'steps(1)', scrollTrigger: scrub(ZONE_FADE) });
      gsap.to(backdropRef.current, { autoAlpha: 0, ease: 'none', scrollTrigger: scrub(GLOW_FADE) });
      // The stage's lower edge melts into the page colour before the stage starts to scroll away.
      gsap.fromTo(edgeRef.current, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', scrollTrigger: scrub(EDGE_FADE) });

      // The letter split runs a frame after mount, inside this context, so the
      // mount itself stays one short task (the split touches every character).
      const splitHeadline = () => {
        // Entrance: the headline is legible from the first frame as an accent
        // dot-matrix (the particles' colour and grain); each character then
        // locks on to solid ink, out of order, like a signal resolving. Only
        // when the live hero arrived early (s01/heroBoot.ts): after a late boot
        // the static headline has been read already, so it stays as it is.
        const split = SplitText.create(title, { ...SPLIT_KEEP_NBSP, type: 'words,chars', wordsClass: css.word });
        const letters = split.chars as HTMLElement[];
        if (shouldPlayHeroEntrance()) {
          const ghostSplit = SplitText.create(ghost, { ...SPLIT_KEEP_NBSP, type: 'words,chars', wordsClass: css.word });
          const delays = shuffledDelays(letters.length, 1.1);
          const at = (index: number) => 0.2 + (delays[index] ?? 0);
          gsap.set(ghost, { autoAlpha: 1 });
          gsap.fromTo(letters, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.inOut', delay: at });
          gsap.to(ghostSplit.chars, { opacity: 0, duration: 0.7, ease: 'power2.in', delay: (index: number) => at(index) + 0.12 });
          gsap.from('[data-hero-rise]', { y: 14, autoAlpha: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08, delay: 0.55 });
        }

        // The same wind that strips the mark takes the headline, word by word,
        // last word first: each one slides off downwind and fades.
        // Words, not letters: the entrance owns the letters' opacity and the
        // shockwave their transforms, so nothing here fights either of them.
        const reach = () => stage.offsetHeight * DRIFT_REACH;
        gsap.to(split.words, {
          x: reach,
          y: () => -reach() * DRIFT_RISE,
          rotation: 'random(-4, 4)',
          opacity: 0,
          ease: 'power1.in',
          stagger: { amount: 0.45, from: 'end' },
          scrollTrigger: { ...scrub(COPY_FADE * 0.8), invalidateOnRefresh: true },
        });

        // Every released pulse reaches the headline as a shockwave, on the ring's own clock.
        knockRef.current = contextSafe
          ? contextSafe((pulse: HeroPulse) => {
              const speed = RIPPLE_SPEED * markPixels(stage.offsetWidth, stage.offsetHeight);
              knockLetters(letters, pulse, speed);
            })
          : null;
      };
      const frame = requestAnimationFrame(() => context.add(splitHeadline));
      return () => {
        cancelAnimationFrame(frame);
        knockRef.current = null;
      };
    },
    { scope: rootRef, dependencies: [reducedMotion], revertOnUpdate: true }
  );

  const jumpTo = (id: SectionId) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!document.getElementById(id)) return;
    event.preventDefault();
    scrollToSection(id);
  };

  const enableTilt = async () => {
    setIsTiltGranted(await requestTiltPermission());
  };

  const showTiltButton = isInteractive && isTouch && canAskTilt && !isTiltGranted;

  return (
    <div ref={rootRef} className={css.root} data-scheme={theme.scheme}>
      <div ref={stageRef} className={css.stage}>
        <div ref={backdropRef} className={css.backdrop} aria-hidden='true' />
        <div className={css.still} data-hidden={isReady} aria-hidden='true'>
          <Mark className={css.stillMark} />
        </div>
        <div className={css.canvasWrap} data-ready={isReady}>
          <LazyCanvas
            style={FILL}
            camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV, near: 0.1, far: 80 }}
            label='hero signal'
            fallback={null}
            activeFrameloop='demand'
          >
            <SignalScene
              count={count}
              tier={tier}
              sample={sample}
              theme={sceneTheme}
              input={inputRef}
              isStill={reducedMotion}
              onReady={markReady}
              onScenePulse={onScenePulse}
            />
          </LazyCanvas>
        </div>
        <div ref={edgeRef} className={css.edge} aria-hidden='true' />
        {isInteractive && !isTouch && <div ref={markZoneRef} className={css.markZone} data-cursor={t('cursorLabel')} aria-hidden='true' />}
        <div ref={markHostRef} className={css.markHost} aria-hidden='true'>
          <Mark key={logo.id} />
        </div>
      </div>

      <div className={css.content}>
        {/* The logo lives in the visitor header (global/LabHeader), not here. */}
        <div ref={copyRef} className={css.copy}>
          <div className={css.titleWrap}>
            <SectionHeading meta={meta} as='h1' className={css.title}>
              {t('heading')}
            </SectionHeading>
            {isInteractive && (
              <div className={`${css.title} ${css.ghost}`} data-hero-ghost='' aria-hidden='true'>
                {t('heading')}
              </div>
            )}
          </div>
          <p className={css.subline} data-hero-rise=''>
            {t('summary', facts)}
          </p>
          <div className={css.actions} data-hero-rise=''>
            <a href='#finale' className={`${css.cta} ${css.primary}`} onClick={jumpTo('finale')} data-magnetic=''>
              {tShared('callCta')}
            </a>
            <a href='#work-wall' className={`${css.cta} ${css.secondary}`} onClick={jumpTo('work-wall')} data-magnetic=''>
              {t('secondaryCta')}
            </a>
          </div>
        </div>

        {isInteractive && (
          <div ref={hintRef} className={css.hintAnchor}>
            <div className={css.hint} data-done={hasLearned} data-ready={isReady}>
              <span className={css.hintDot} aria-hidden='true' />
              <span>{isTouch ? t('hintTouch') : t('hintPointer')}</span>
              {showTiltButton && (
                <button type='button' className={css.tilt} onClick={enableTilt}>
                  {t('tilt')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
