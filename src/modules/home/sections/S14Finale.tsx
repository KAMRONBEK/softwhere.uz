'use client';

import { SplitText } from 'gsap/SplitText';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import LazyCanvas from '../components/LazyCanvas';
import { useInView } from '../components/useInView';
import { useLabState } from '../context/LabContext';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, ScrollTrigger, useGSAP, SPLIT_KEEP_NBSP } from '../global/gsap';
import { getLabLenis, scrollToY } from '../global/scroll';
import { useProjectDescriber } from '../media/useProjectDescriber';
import { useLabTheme } from '../theme/useLabTheme';
import type { DeviceTier, LabSectionProps } from '../types';
import ContactPanel from './s14/ContactPanel';
import { INTRO_PROJECTS, WARP_PROJECTS } from './s14/copy';
import {
  CALM_FROM,
  createEngine,
  freezeStill,
  introPresence,
  kickFrom,
  levelAt,
  NameStream,
  smoothstep,
  startBoost,
  stepEngine,
  vanishingPoint,
  type WarpEngine,
} from './s14/engine';
import css from './s14/finale.module.css';
import {
  ARRIVE_RANGE,
  buildArrival,
  buildScatter,
  measureLayout,
  panelTopAt,
  placeScene,
  rangeProgress,
  SCATTER_RANGE,
  type FinaleLayout,
} from './s14/layout';
import WarpScene from './s14/WarpScene';

if (typeof window !== 'undefined') gsap.registerPlugin(SplitText);

/** Star budget per device tier (phones are 'mid'); low gets the CSS still. */
const STARS: Record<DeviceTier, number> = { high: 6500, mid: 2000, low: 0 };
/** DPR ceiling: additive full-screen streaks are fill-rate bound on phone GPUs. */
const MAX_DPR: Record<DeviceTier, number> = { high: 1.75, mid: 1.25, low: 1 };
/** Product kinds in flight at once. */
const NAME_SLOTS: Record<DeviceTier, number> = { high: 10, mid: 7, low: 5 };
/** Once the panel has landed, the drift renders every Nth display frame. */
const CALM_STRIDE: Record<DeviceTier, number> = { high: 1, mid: 2, low: 2 };
const MAX_DT = 1 / 30;
/** "Book a call" landing: ride the warp down to the form. */
const RIDE_SECONDS = 2.2;
const RIDE_DELAY = 0.35;

/** LazyCanvas forces position: relative on its box, so fill the stage inline. */
const FILL: CSSProperties = { position: 'absolute', inset: 0 };

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));

function paintGlow(glow: HTMLElement | null, e: WarpEngine): void {
  if (!glow) return;
  const [x, y] = vanishingPoint(e);
  glow.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(0.62 + 0.8 * e.warp).toFixed(3)})`;
  glow.style.opacity = (0.3 + 0.7 * e.warp).toFixed(3);
}

interface Timelines {
  scatter: gsap.core.Timeline | null;
  arrival: gsap.core.Timeline | null;
}

/**
 * 18 · Finale "Warp": the starfield behind the page spools up while the
 * section scrolls in — streaks lengthen, ink turns to the style's accent,
 * gates in the style's own geometry and the kinds of product we have built
 * rush past — under a lead-in of three shipped products, by kind (no names:
 * founder, 2026-10-10). The lead-in's letters are
 * pulled into the tunnel, the drive drops out with a ring, and "Let's build
 * yours." decelerates out of the vanishing point onto a calm contact panel.
 * The light always keeps clear of the text. A "Book a call" jump rides the
 * warp down to the form; sending the form (a real lead) fires one last jump.
 */
export default function S14Finale({ meta }: LabSectionProps) {
  const t = useTranslations('home.finale');
  const describer = useProjectDescriber();
  /** "A ride-hailing app. An AI learning platform. A messenger app." in the page's language. */
  const introNames = INTRO_PROJECTS.map(project => `${describer.describe(project, { isCapitalized: true })}.`).join(' ');
  const warpKinds = useMemo(() => WARP_PROJECTS.map(project => describer.title(project)), [describer]);
  const theme = useLabTheme();
  const { tier, reducedMotion } = useLabDevice();
  const { state } = useLabState();
  const isSolo = state.only === meta.id;

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const namesRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const introRailRef = useRef<HTMLDivElement>(null);
  const introStickyRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLParagraphElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<WarpEngine>(createEngine());
  const layoutRef = useRef<FinaleLayout | null>(null);
  const timelinesRef = useRef<Timelines>({ scatter: null, arrival: null });
  const isTypingRef = useRef(false);
  const isCalmRef = useRef(false);

  const [isCalm, setIsCalm] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const isInView = useInView(rootRef);
  const hasCanvas = STARS[tier] > 0;
  const nameSlots = reducedMotion ? 0 : NAME_SLOTS[tier];

  /** Re-measures the layout and re-aims the scroll timelines at it. */
  const measure = useCallback(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const track = trackRef.current;
    const introRail = introRailRef.current;
    const introSticky = introStickyRef.current;
    const intro = introRef.current;
    const heading = panelRef.current?.querySelector<HTMLElement>('h2');
    const deck = panelRef.current?.querySelector<HTMLElement>('[data-deck]');
    if (!root || !stage || !track || !introRail || !introSticky || !intro || !heading || !deck) return;
    layoutRef.current = measureLayout({ root, stage, track, introRail, introSticky, intro, heading, deck });
    const e = engineRef.current;
    placeScene(e, layoutRef.current, window.scrollY, reducedMotion);
    for (const timeline of Object.values(timelinesRef.current) as Array<gsap.core.Timeline | null>) {
      if (!timeline) continue;
      // Re-read the function-based offsets: render the far end, then come back.
      const progress = timeline.progress();
      timeline
        .invalidate()
        .progress(progress > 0.5 ? 0 : 1, true)
        .progress(progress, true);
    }
    if (reducedMotion) {
      freezeStill(e);
      paintGlow(glowRef.current, e);
      e.requestFrame?.();
    }
  }, [reducedMotion]);

  // Layout probes: section resize, font swaps and ScrollTrigger refreshes.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    measure();
    // The text boxes change size on a style switch even when the section does not.
    const observer = new ResizeObserver(() => measure());
    const watched = [root, introRef.current, panelRef.current?.querySelector('h2'), panelRef.current?.querySelector('[data-deck]')];
    watched.forEach(node => node && observer.observe(node));
    let isLive = true;
    document.fonts?.ready.then(() => isLive && measure());
    ScrollTrigger.addEventListener('refresh', measure);
    return () => {
      isLive = false;
      observer.disconnect();
      ScrollTrigger.removeEventListener('refresh', measure);
    };
  }, [measure]);

  // The drive: one ticker step per frame while the section is on screen.
  useEffect(() => {
    if (reducedMotion || !isInView) return;
    const e = engineRef.current;
    const nodes = Array.from(namesRef.current?.children ?? []).filter((node): node is HTMLElement => node instanceof HTMLElement);
    const stream = new NameStream(nodes, warpKinds);
    const glow = glowRef.current;
    const floor = floorRef.current;
    const cue = cueRef.current;
    const stride = CALM_STRIDE[tier];
    let frame = 0;
    let lastS = Number.NaN;

    const tick = (_time: number, deltaMs: number) => {
      const layout = layoutRef.current;
      if (!layout) return;
      placeScene(e, layout, window.scrollY, false);
      e.target = levelAt(e.s);

      if (e.s !== lastS) {
        lastS = e.s;
        const { scatter, arrival } = timelinesRef.current;
        scatter?.progress(rangeProgress(e.s, SCATTER_RANGE));
        arrival?.progress(rangeProgress(e.s, ARRIVE_RANGE));
        if (floor) floor.style.opacity = smoothstep(0.15, 0.85, e.s).toFixed(3);
        if (cue) cue.style.opacity = (introPresence(e.s) * (1 - smoothstep(0, 0.12, e.s))).toFixed(3);
        const calm = e.s >= CALM_FROM;
        if (calm !== isCalmRef.current) {
          isCalmRef.current = calm;
          setIsCalm(calm);
        }
      }

      // Keyboard up: the warp holds still (the send flourish still plays).
      if (isTypingRef.current && e.boostT < 0) return;
      stepEngine(e, Math.min(deltaMs / 1000, MAX_DT));
      stream.update(e);
      paintGlow(glow, e);
      // Landed: the drift renders on demand, at half rate on phones.
      if (isCalmRef.current || isTypingRef.current) {
        frame += 1;
        if (e.boostT >= 0 || e.ringT >= 0 || frame % stride === 0) e.requestFrame?.();
      }
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [isInView, reducedMotion, nameSlots, tier, warpKinds]);

  // Reduced motion: no loop; the still frame re-renders only as the text over it moves.
  useEffect(() => {
    if (!reducedMotion) return;
    const e = engineRef.current;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const layout = layoutRef.current;
        if (!layout) return;
        placeScene(e, layout, window.scrollY, true);
        e.requestFrame?.();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [reducedMotion]);

  // Letters: the lead-in scatters into the warp, the heading arrives out of it,
  // and the rest of the panel rises in. Scroll flicks nudge the throttle.
  useGSAP(
    () => {
      const root = rootRef.current;
      const intro = introRef.current;
      const panel = panelRef.current;
      if (!root || !intro || !panel || reducedMotion) return;
      const e = engineRef.current;

      ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: self => kickFrom(e, self.getVelocity()),
      });

      const introSplit = SplitText.create(intro, { ...SPLIT_KEEP_NBSP, type: 'words,chars', charsClass: 'finale-intro-char' });
      const scatter = buildScatter(introSplit.chars as HTMLElement[], intro);

      const heading = panel.querySelector('h2');
      const headingSplit = heading
        ? SplitText.create(heading, { ...SPLIT_KEEP_NBSP, type: 'words,chars', charsClass: 'finale-char' })
        : null;
      const arrival = headingSplit
        ? buildArrival(headingSplit.chars as HTMLElement[], panel, () => {
            const layout = layoutRef.current;
            const width = layout?.stageW ?? window.innerWidth;
            const height = layout?.stageH ?? window.innerHeight;
            return {
              cx: width / 2,
              cy: height / 2,
              panelTop: layout ? panelTopAt(layout, ARRIVE_RANGE[0]) : height,
            };
          })
        : null;
      timelinesRef.current = { scatter, arrival };
      scatter.progress(rangeProgress(e.s, SCATTER_RANGE));
      arrival?.progress(rangeProgress(e.s, ARRIVE_RANGE));

      // The deck, the direct links and the card surface just behind the heading.
      const risers = [panel.querySelector('[data-deck]'), panel.querySelector('[data-card]'), panel.querySelector('[data-rise]')];
      risers.forEach(target => {
        if (!target) return;
        gsap.fromTo(
          target,
          { y: 48, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            ease: 'power3.out',
            scrollTrigger: { trigger: target, start: 'top 100%', end: 'top 72%', scrub: 0.4 },
          }
        );
      });

      return () => {
        timelinesRef.current = { scatter: null, arrival: null };
      };
    },
    { scope: rootRef, dependencies: [reducedMotion], revertOnUpdate: true }
  );

  // Steering (mouse): the pointer pulls the vanishing point. Touch steers with
  // the scroll itself (flicks kick the throttle), so a scrolling thumb never yanks it.
  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage || reducedMotion) return;
    const e = engineRef.current;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const rect = stage.getBoundingClientRect();
      e.steerX = clampUnit(((event.clientX - rect.left) / rect.width) * 2 - 1);
      e.steerY = clampUnit(-(((event.clientY - rect.top) / rect.height) * 2 - 1));
    };
    const release = () => {
      e.steerX = 0;
      e.steerY = 0;
    };
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', release);
    return () => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', release);
    };
  }, [reducedMotion]);

  const rideToPanel = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const y = panel.getBoundingClientRect().top + window.scrollY;
    const lenis = getLabLenis();
    if (!lenis || reducedMotion) {
      scrollToY(y);
      return;
    }
    // Engage at once: the jump to warp leads, the scroll position takes over from it.
    startBoost(engineRef.current);
    lenis.scrollTo(y, { duration: RIDE_SECONDS, easing: easeInOutCubic, force: true });
  }, [reducedMotion]);

  // "Book a call" jumps land on the section top, one screen above the form.
  // Detect the landing (mounting at the top, or an instant jump while mounted)
  // and ride the warp down to the panel. Any wheel/touch input interrupts it.
  // Solo mode has no CTAs, and its scroll-to-top on entering would look like a jump.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || isSolo) return;
    const isAtTop = () => Math.abs(root.getBoundingClientRect().top) < window.innerHeight * 0.2;
    let pending: gsap.core.Tween | null = null;
    const schedule = () => {
      pending?.kill();
      // Only a real landing rides: someone still scrolling through has moved on by then.
      // Compare the section's own top, not scrollY: while the sections above mount after a
      // jump, the shell moves scrollY to keep this section pinned (global/scroll.ts settleOn).
      const landedTop = root.getBoundingClientRect().top;
      pending = gsap.delayedCall(RIDE_DELAY, () => {
        if (isAtTop() && Math.abs(root.getBoundingClientRect().top - landedTop) < 4) rideToPanel();
      });
    };
    if (isAtTop()) schedule();
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const hasJumped = Math.abs(y - lastY) > window.innerHeight * 1.5;
      lastY = y;
      if (hasJumped && isAtTop()) schedule();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      pending?.kill();
      window.removeEventListener('scroll', onScroll);
    };
  }, [isSolo, rideToPanel]);

  const launch = useCallback(() => {
    if (!reducedMotion) startBoost(engineRef.current);
  }, [reducedMotion]);

  const handleTyping = useCallback((value: boolean) => {
    isTypingRef.current = value;
    setIsTyping(value);
  }, []);

  return (
    <div ref={rootRef} className={css.root} data-scheme={theme.scheme} data-motion={reducedMotion ? 'still' : 'live'}>
      <div className={css.backdrop} aria-hidden='true'>
        <div ref={stageRef} className={css.stage}>
          <div ref={glowRef} className={css.glow} />
          {hasCanvas ? (
            <LazyCanvas
              style={FILL}
              label='finale warp'
              fallback={<div className={css.still} />}
              loading={<div className={css.still} />}
              maxDpr={MAX_DPR[tier]}
              activeFrameloop={isCalm || isTyping ? 'demand' : 'always'}
            >
              <WarpScene engine={engineRef} theme={theme} count={STARS[tier]} isStill={reducedMotion} />
            </LazyCanvas>
          ) : (
            <div className={css.still} />
          )}
          <div ref={namesRef} className={css.names}>
            {Array.from({ length: nameSlots }, (_, index) => (
              <span key={index} className={css.name} />
            ))}
          </div>
          <div ref={floorRef} className={css.floor} />
        </div>
      </div>

      <div ref={introRailRef} className={css.introRail}>
        <div ref={introStickyRef} className={css.introSticky}>
          <p ref={introRef} className={css.intro}>
            <span className={css.introNames}>{introNames}</span>
            <span className={css.introLine}>{t('introLine')}</span>
          </p>
          {!reducedMotion && <div ref={cueRef} className={css.cue} aria-hidden='true' />}
        </div>
      </div>

      <div ref={trackRef} className={css.track} />

      <ContactPanel ref={panelRef} meta={meta} onLaunch={launch} onTypingChange={handleTyping} isReducedMotion={reducedMotion} />
    </div>
  );
}
