'use client';

import { useTranslations } from 'next-intl';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SectionHeading } from '../../components/LabSection';
import { useInView } from '../../components/useInView';
import { ScrollTrigger, useGSAP } from '../../global/gsap';
import type { SectionMeta } from '../../types';
import { PROCESS_STEPS, useProcessSteps } from './copy';
import { buildVertical, flagId, sameVerticalInput, type VerticalInput } from './geometry';
import { FactFlag, MorphIcon, NameWheel, Odometer, Outro, ProcessTitle, RouteSvg, StageBlock, StageNode } from './parts';
import css from './process.module.css';
import vcss from './vertical.module.css';
import { createRenderer } from './renderer';
import { lengthAtFocus, PenChaser, sampleRoute, type SampledRoute } from './route';

/** Gutter x (px) the line runs down; matches --g in the stylesheet. */
const GUTTER = 20;
/** The pen sits at this share of the viewport height (a stage turns active when its station crosses it)… */
const FOCUS = 0.62;
/** …sliding down to this share as the column's end comes up, so the last figure completes on screen. */
const FOCUS_END = 0.88;
/** Distance (px) over which the focus slides. */
const FOCUS_RAMP = 420;

/** The column's place on the page, measured once per refresh so scrolling never reads layout. */
interface ColumnFrame {
  /** Document y of the column's top edge. */
  top: number;
  height: number;
  /** Viewport height (updated on resize: the phone URL bar). */
  vh: number;
}

function measureFrame(column: HTMLElement): ColumnFrame {
  const rect = column.getBoundingClientRect();
  return { top: rect.top + window.scrollY, height: rect.height, vh: window.innerHeight };
}

/** Pen focus in column coordinates for a scroll position (pure math, no DOM reads). */
function focusAt(frame: ColumnFrame, scroll: number): number {
  const top = frame.top - scroll;
  const bottom = top + frame.height;
  const ramp = Math.min(1, Math.max(0, (frame.vh + FOCUS_RAMP - bottom) / FOCUS_RAMP));
  return frame.vh * (FOCUS + (FOCUS_END - FOCUS) * ramp) - top;
}

/** Offset of `el` inside `ancestor` through the offsetParent chain (ignores transforms). */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

const centreY = (el: HTMLElement, column: HTMLElement) => Math.round(offsetWithin(el, column).y + el.offsetHeight / 2);

function measureColumn(column: HTMLElement): VerticalInput | null {
  const period = column.querySelector<HTMLElement>('[data-period]');
  const lede = column.querySelector<HTMLElement>('[data-turn]');
  const items = Array.from(column.querySelectorAll<HTMLElement>('[data-step-item]'));
  if (!period || !lede || items.length !== PROCESS_STEPS.length) return null;
  const dot = offsetWithin(period, column);
  const steps = items.map(item => {
    const node = item.querySelector<HTMLElement>('[data-node]');
    const zone = item.querySelector<HTMLElement>('[data-zone]');
    const flags = Array.from(item.querySelectorAll<HTMLElement>('[data-flag]'));
    const zoneTop = zone ? Math.round(offsetWithin(zone, column).y) : 0;
    return {
      nodeY: node ? centreY(node, column) : 0,
      flagYs: flags.map(flag => centreY(flag, column)),
      zoneTop,
      zoneBottom: zoneTop + (zone?.offsetHeight ?? 0),
    };
  });
  return {
    width: column.clientWidth,
    height: column.clientHeight,
    gutter: GUTTER,
    start: { x: Math.round(dot.x + period.offsetWidth / 2), y: Math.round(dot.y + period.offsetHeight / 2) },
    turnY: Math.round(offsetWithin(lede, column).y + lede.offsetHeight + 12),
    steps,
  };
}

interface ProcessVerticalProps {
  meta: SectionMeta;
  /** Reduced motion or the low tier: the whole route drawn, everything shown, nothing moves. */
  isStatic: boolean;
}

/**
 * Phones (and every viewport under reduced motion): the line leaves the
 * heading's full stop, runs down a gutter past each stage's facts and swings
 * out into each stage's figure. Natural scroll, no pinning; a small HUD at the
 * bottom rolls the week and the stage name.
 */
export default function ProcessVertical({ meta, isStatic }: ProcessVerticalProps) {
  const t = useTranslations('home.process');
  const steps = useProcessSteps();
  const rootRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const morphRef = useRef<SVGPathElement>(null);
  const tensRef = useRef<HTMLSpanElement>(null);
  const onesRef = useRef<HTMLSpanElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const namesRef = useRef<HTMLSpanElement>(null);
  const hudFillRef = useRef<HTMLSpanElement>(null);
  const [input, setInput] = useState<VerticalInput | null>(null);
  const [route, setRoute] = useState<SampledRoute | null>(null);
  const isInView = useInView(rootRef);

  useLayoutEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    let frame = 0;
    let isAlive = true;
    const measure = () => {
      const next = measureColumn(column);
      if (next) setInput(prev => (sameVerticalInput(prev, next) ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(column);
    document.fonts?.ready.then(() => isAlive && schedule());
    return () => {
      isAlive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const geometry = useMemo(() => (input ? buildVertical(input) : null), [input]);

  useLayoutEffect(() => {
    const column = columnRef.current;
    if (isStatic || !geometry || !column) return;
    const paths = Array.from(column.querySelectorAll<SVGPathElement>('[data-piece]'));
    if (paths.length === geometry.pieces.length) setRoute(sampleRoute(paths, geometry));
  }, [geometry, isStatic]);

  useGSAP(
    () => {
      const root = rootRef.current;
      const column = columnRef.current;
      if (isStatic || !root || !column || !route) return;
      const renderer = createRenderer(
        route,
        {
          root,
          tip: tipRef.current,
          morph: morphRef.current,
          tens: tensRef.current,
          ones: onesRef.current,
          plus: plusRef.current,
          names: namesRef.current,
          hudFill: hudFillRef.current,
        },
        { blockLead: 150, blockSpan: 190, blockFrom: { x: 18, y: 6 } }
      );
      const chaser = new PenChaser(renderer.draw, 11, 1800, renderer.rest);
      let frame = measureFrame(column);
      // Scroll position from the trigger's own progress: no layout read per frame.
      const scrollOf = (self: ScrollTrigger) => self.start + self.progress * (self.end - self.start);
      const update = (scroll: number, isImmediate = false) => {
        const target = lengthAtFocus(route, focusAt(frame, scroll));
        chaser.setTarget(target, isImmediate);
        if (isImmediate) renderer.status(target);
        else renderer.queueStatus(target);
      };
      const trigger = ScrollTrigger.create({
        trigger: column,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: self => update(scrollOf(self)),
        onRefresh: self => {
          frame = measureFrame(column);
          update(scrollOf(self));
        },
      });
      // The phone URL bar changes the viewport height without a refresh.
      const onResize = () => {
        frame = { ...frame, vh: window.innerHeight };
        update(window.scrollY);
      };
      window.addEventListener('resize', onResize, { passive: true });
      renderer.draw(0);
      const scroll = window.scrollY;
      update(scroll, lengthAtFocus(route, focusAt(frame, scroll)) > route.nodeLen[1]);
      return () => {
        window.removeEventListener('resize', onResize);
        trigger.kill();
        chaser.destroy();
        renderer.destroy();
      };
    },
    { scope: rootRef, dependencies: [route, isStatic], revertOnUpdate: true }
  );

  return (
    <div
      ref={rootRef}
      className={`${css.root} ${vcss.vRoot}`}
      data-motion={isStatic ? undefined : ''}
      data-static={isStatic ? '' : undefined}
      data-inview={isInView ? '' : undefined}
      data-step={isStatic ? '4' : '-1'}
      data-drawn={isStatic ? 'true' : 'false'}
    >
      <div ref={columnRef} className={vcss.column}>
        {geometry && <RouteSvg geometry={geometry} isStatic={isStatic} />}

        <header className={vcss.vHeader}>
          <SectionHeading meta={meta} className={vcss.vTitle}>
            <ProcessTitle />
          </SectionHeading>
          <p className={vcss.vLede} data-turn=''>
            {t('summary')}
          </p>
        </header>

        <ol className={vcss.vSteps} aria-label={t('stepsLabel')}>
          {steps.map((step, i) => (
            <li
              key={step.id}
              className={vcss.vStep}
              data-step-item={i}
              data-stage={i}
              data-state={isStatic ? 'done' : 'todo'}
              aria-labelledby={`s12-${step.id}-title`}
            >
              <div className={vcss.vHead}>
                <StageNode step={step} index={i} isDone={isStatic} />
                <StageBlock step={step} index={i} />
              </div>
              <ul className={vcss.vFlags} aria-label={t('factsLabel', { title: step.title })}>
                {step.facts.map((fact, k) => (
                  <FactFlag key={fact.key} id={flagId(i, k)} className={vcss.vFlag} isOn={isStatic}>
                    {fact.text}
                  </FactFlag>
                ))}
              </ul>
              <div className={vcss.vZone} data-zone={i} aria-hidden='true' />
            </li>
          ))}
        </ol>

        <Outro className={vcss.vOutro} />

        {!isStatic && (
          <span ref={tipRef} className={css.tip} data-hidden='true' aria-hidden='true'>
            <span className={css.tipCore} />
          </span>
        )}

        {!isStatic && (
          <div className={vcss.vHud} aria-hidden='true'>
            <div className={vcss.pill}>
              <MorphIcon pathRef={morphRef} className={vcss.pillIcon} />
              <span className={vcss.pillWeek}>
                {t('counterLabel')}
                <Odometer tensRef={tensRef} onesRef={onesRef} plusRef={plusRef} />
              </span>
              <span className={vcss.pillDivider} />
              <NameWheel stripRef={namesRef} className={vcss.pillName} />
              <span ref={hudFillRef} className={vcss.pillFill} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
