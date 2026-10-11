'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useLabDevice } from '../device/useDeviceTier';
import { ScrollTrigger, useGSAP } from '../global/gsap';
import { getLabLenis, scrollToY } from '../global/scroll';
import { useLabTheme, type LabTheme } from '../theme/useLabTheme';
import type { DeviceTier, LabSectionProps } from '../types';
import { DustField, type DustPalette, type DustQuality } from './s10/dustField';
import { NUMBER_FACTS } from './s10/facts';
import css from './s10/numbers.module.css';
import UnitChart, { type CourierTarget } from './s10/UnitChart';
import { useNumbersCopy } from './s10/useNumbersCopy';

/**
 * 14 · Numbers — "numbers from dust". A sticky stage (300svh of scroll) with
 * one numeral made of thousands of particles. Each scroll step dissolves it
 * into a swirl and re-forms the next true fact while it counts up from zero;
 * the particles the new number does not need hover around it as dust. Beside
 * (or under) it, one dot per product re-sorts into that fact's groups, and as
 * the count passes each unit the numeral fires a spark that lands on its dot
 * and lights it: every number can be counted, and every dot opens the real
 * product (icon, field, country, store listings). The dust parts around the
 * pointer or a finger, a click/tap bursts and recounts it, and the canvas
 * stops drawing a few seconds after everything has settled.
 *
 * Reduced motion and the low tier: still stipples, facts swap with a fade.
 */

const QUALITY: Record<DeviceTier, DustQuality> = {
  high: { spacing: 2.3, maxParticles: 9000, ambient: 560, hasBreathing: true, hasGlow: true, hasGlint: true },
  mid: { spacing: 2.1, maxParticles: 4200, ambient: 240, hasBreathing: true, hasGlow: true, hasGlint: true },
  low: { spacing: 3, maxParticles: 2400, ambient: 140, hasBreathing: false, hasGlow: false, hasGlint: false },
};
/** Canvas DPR caps: a 2D fill-rate budget, lower than the WebGL caps on phones. */
const DPR_MAX: Record<DeviceTier, number> = { high: 2, mid: 1.25, low: 1 };

const VALUES = NUMBER_FACTS.map(fact => fact.value);
const STEPS = NUMBER_FACTS.length;
/** Where a rail jump lands inside a step (fraction of the step). */
const STEP_LANDING = 0.12;
const RAIL_SCROLL_S = 1.1;

function paletteOf(theme: LabTheme): DustPalette {
  const { colors } = theme;
  const isDark = theme.blending === 'additive';
  return {
    isDark,
    // Dark: light in the two accents. Light: brand accent bleeding into ink.
    gradient: isDark ? [colors.accent, colors.accent2] : [colors.accent, colors.fg],
    spark: isDark ? colors.fg : colors.accent2 !== colors.fg ? colors.accent2 : colors.accent,
    dust: colors.muted,
    glow: isDark ? colors.accent : null,
    courier: colors.accent,
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Layout offset of `el` inside `ancestor` (transforms ignored: a mid-entrance chart still reports its resting place). */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): { x: number; y: number } | null {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    // The walk must pass through the ancestor; if it skips it, measure instead.
    if (parent && !ancestor.contains(parent)) return null;
    node = parent;
  }
  return node === ancestor ? { x, y } : null;
}

export default function S10Numbers({ meta }: LabSectionProps) {
  const t = useTranslations('home.numbers');
  const copy = useNumbersCopy();
  const theme = useLabTheme();
  const { tier, reducedMotion, isTouch } = useLabDevice();
  const isStatic = reducedMotion || tier === 'low';
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const figureRef = useRef<HTMLElement | null>(null);
  const fillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const fieldRef = useRef<DustField | null>(null);
  const storyRef = useRef<ScrollTrigger | null>(null);
  const [active, setActive] = useState(0);
  const [isShownState, setIsShown] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [replay, setReplay] = useState(0);
  const isShown = isStatic || isShownState;
  const isOnScreen = useInView(rootRef, '0px');
  // Latest values for the field effect, which must not re-run on every step.
  const live = useRef({ active, isShown, isOnScreen });
  useEffect(() => {
    live.current = { active, isShown, isOnScreen };
  }, [active, isShown, isOnScreen]);

  // The dust field: rebuilt when the style, tier or motion mode changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const figure = figureRef.current;
    if (!canvas || !figure) return;
    const field = new DustField({
      canvas,
      figure,
      values: VALUES,
      fontFamily: theme.fontFamily.display,
      fontWeight: theme.type.displayWeight,
      palette: paletteOf(theme),
      quality: QUALITY[tier],
      dprMax: DPR_MAX[tier],
      isStatic,
      onReady: () => setIsReady(true),
    });
    fieldRef.current = field;
    field.setActive(live.current.isOnScreen);
    if (live.current.isShown) field.show(live.current.active);
    return () => {
      field.destroy();
      fieldRef.current = null;
    };
  }, [theme, tier, isStatic]);

  // Draw only while any part of the section is on screen.
  useEffect(() => {
    fieldRef.current?.setActive(isOnScreen);
  }, [isOnScreen]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    if (isShown) field.show(active);
    else field.hide();
  }, [active, isShown]);

  // Scroll: assemble on entry, back to dust once the stage is below the fold
  // again, and one fact per quarter of the sticky range.
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const onProgress = (progress: number) => {
        const position = progress * STEPS;
        setActive(Math.min(STEPS - 1, Math.floor(position)));
        fillRefs.current.forEach((fill, index) => {
          if (fill) fill.style.transform = `scaleX(${Math.min(1, Math.max(0, position - index))})`;
        });
        fieldRef.current?.wake();
      };
      ScrollTrigger.create({
        trigger: root,
        start: 'top 72%',
        end: 'max',
        onEnter: () => setIsShown(true),
        onRefresh: self => {
          if (self.progress > 0) setIsShown(true);
        },
      });
      ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'max', onLeaveBack: () => setIsShown(false) });
      storyRef.current = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: self => onProgress(self.progress),
        onRefresh: self => onProgress(self.progress),
      });
      return () => {
        storyRef.current = null;
      };
    },
    { scope: rootRef }
  );

  // Pointer = mouse/pen hover; on touch the finger stirs the dust while it
  // scrolls (passive listeners: the page always keeps scrolling).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || isStatic) return;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') fieldRef.current?.setPointer(event.clientX, event.clientY);
    };
    const onTouch = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) fieldRef.current?.setPointer(touch.clientX, touch.clientY);
    };
    const onRelease = () => fieldRef.current?.clearPointer();
    const passive = { passive: true } as const;
    root.addEventListener('pointermove', onPointerMove, passive);
    root.addEventListener('pointerleave', onRelease, passive);
    root.addEventListener('touchstart', onTouch, passive);
    root.addEventListener('touchmove', onTouch, passive);
    root.addEventListener('touchend', onRelease, passive);
    root.addEventListener('touchcancel', onRelease, passive);
    return () => {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onRelease);
      root.removeEventListener('touchstart', onTouch);
      root.removeEventListener('touchmove', onTouch);
      root.removeEventListener('touchend', onRelease);
      root.removeEventListener('touchcancel', onRelease);
    };
  }, [isStatic]);

  // The chart's counted dots, as sparks from the numeral (the canvas fills the stage).
  const onCount = (host: HTMLElement, targets: CourierTarget[]) => {
    const stage = stageRef.current;
    const field = fieldRef.current;
    if (!stage || !field) return;
    let origin = offsetWithin(host, stage);
    if (!origin) {
      const hostRect = host.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      origin = { x: hostRect.left - stageRect.left, y: hostRect.top - stageRect.top };
    }
    const { x, y } = origin;
    field.sendCouriers(targets.map(target => ({ ...target, x: target.x + x, y: target.y + y })));
  };

  const onRecount = (event: MouseEvent<HTMLButtonElement>) => {
    // detail 0 = keyboard activation: burst from the numeral's centre.
    const isKeyboard = event.detail === 0;
    fieldRef.current?.burst(isKeyboard ? null : event.clientX, isKeyboard ? null : event.clientY);
    setReplay(n => n + 1);
  };

  const goTo = (index: number) => {
    const story = storyRef.current;
    if (!story) return;
    const y = story.start + ((index + STEP_LANDING) / STEPS) * (story.end - story.start);
    const lenis = getLabLenis();
    if (lenis && !reducedMotion) lenis.scrollTo(y, { duration: RAIL_SCROLL_S });
    else scrollToY(y);
  };

  const fact = NUMBER_FACTS[active];
  const setFigure = (el: HTMLElement | null) => {
    figureRef.current = el;
  };
  // DOM numeral: shown until the dust takes over (and if it never does).
  const numeral = (
    <span className={css.figureText} aria-hidden='true'>
      {fact.value}
    </span>
  );
  const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={css.root}
      data-shown={isShown ? '' : undefined}
      data-ready={isReady ? '' : undefined}
      data-static={isStatic ? '' : undefined}
    >
      <div ref={stageRef} className={css.stage}>
        <canvas ref={canvasRef} className={css.canvas} aria-hidden='true' />

        <div className={css.frame}>
          <header className={css.head}>
            <p className={css.eyebrow} data-reveal='' style={stagger(0)}>
              {t('eyebrow')}
            </p>
            <div data-reveal='' style={stagger(1)}>
              <SectionHeading meta={meta} className={css.title}>
                {t('heading')}
              </SectionHeading>
            </div>
          </header>
          <p className={css.deck} data-reveal='' style={stagger(2)}>
            {t('summary')}
          </p>

          <div className={css.figureCell}>
            {isStatic ? (
              <div ref={setFigure} className={css.figure} aria-hidden='true'>
                {numeral}
              </div>
            ) : (
              <button
                ref={setFigure}
                type='button'
                className={css.figure}
                aria-label={t('recountLabel', { fact: copy.spoken(fact) })}
                data-cursor={t('recount')}
                onClick={onRecount}
              >
                {numeral}
              </button>
            )}
            {!isStatic && (
              <p className={css.hint} aria-hidden='true' data-reveal='' style={stagger(4)}>
                <span className={css.hintDot} />
                {isTouch ? t('stirTouch') : t('stirPointer')}
              </p>
            )}
          </div>

          <div className={css.copy} data-reveal='' style={stagger(3)}>
            <div className={css.stack}>
              {NUMBER_FACTS.map((item, index) => (
                <div key={item.id} className={css.fact} data-active={index === active ? '' : undefined} aria-hidden={index !== active}>
                  <p className={css.counter}>
                    <span className={css.counterNow}>{pad2(index + 1)}</span> / {pad2(STEPS)}
                  </p>
                  <h3 className={css.label}>
                    <span className={css.srOnly}>{item.value} </span>
                    {copy.label(item)}
                  </h3>
                  <p className={css.caption}>{copy.caption(item)}</p>
                </div>
              ))}
            </div>

            <UnitChart
              facts={NUMBER_FACTS}
              active={active}
              isShown={isShown}
              isStatic={isStatic}
              replay={replay}
              onCount={isStatic ? undefined : onCount}
            />

            <div className={css.stack}>
              {NUMBER_FACTS.map((item, index) => {
                const legend = copy.legend(item);
                return (
                  <p
                    key={item.id}
                    className={css.legend}
                    data-unit={item.unit}
                    data-active={index === active ? '' : undefined}
                    aria-hidden={index !== active}
                  >
                    {legend
                      ? legend.map(entry => (
                          <span key={entry.id} className={css.legendItem} data-dim={entry.isLit ? undefined : ''}>
                            <span className={css.legendSwatch} aria-hidden='true' />
                            {entry.label} <span className={css.legendCount}>{entry.count}</span>
                          </span>
                        ))
                      : isTouch
                        ? t('hintTouch')
                        : t('hintPointer')}
                  </p>
                );
              })}
            </div>
          </div>

          <ol className={css.rail} aria-label={t('railLabel')} data-reveal='' style={stagger(5)}>
            {NUMBER_FACTS.map((item, index) => (
              <li key={item.id}>
                <button
                  type='button'
                  className={css.railItem}
                  data-active={index === active ? '' : undefined}
                  aria-current={index === active ? 'step' : undefined}
                  aria-label={copy.spoken(item)}
                  onClick={() => goTo(index)}
                >
                  <span className={css.railTrack} aria-hidden='true'>
                    <span
                      ref={el => {
                        fillRefs.current[index] = el;
                      }}
                      className={css.railFill}
                    />
                  </span>
                  <span className={css.railValue} aria-hidden='true'>
                    {item.value}
                  </span>
                  <span className={css.railLabel} aria-hidden='true'>
                    {copy.short(item)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
