'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { SectionHeading } from '../../components/LabSection';
import { useInView } from '../../components/useInView';
import { ScrollTrigger, useGSAP } from '../../global/gsap';
import { getLabLenis } from '../../global/scroll';
import type { SectionMeta } from '../../types';
import { PROCESS_STEPS, useProcessSteps } from './copy';
import { buildHorizontal, flagId, horizontalBaseline, type HorizontalInput } from './geometry';
import { FactFlag, MorphIcon, Odometer, Outro, pad2, ProcessTitle, RouteSvg, StageBlock, StageNode } from './parts';
import css from './process.module.css';
import hcss from './horizontal.module.css';
import { createRenderer, PARALLAX } from './renderer';
import { keyAtLength, lengthAtKey, PenChaser, sampleRoute, type SampledRoute } from './route';

/** The lead-in (full stop → first station) draws while the section's top travels from here to the viewport top. */
const LEAD_START = 0.22;
/** Share of the pinned range before the pen leaves the first station, and the share it uses. */
const LEAD_IN = 0.015;
const SPAN = 0.92;
const HUD_HEIGHT = 112;
const JUMP_DURATION = 1.4;
const FACT_COUNTS = PROCESS_STEPS.map(step => step.facts.length);
/** Gap between a title block's bottom and the line (the station sits in it). */
const BLOCK_GAP = 46;
/** Camera travel (px) after which the heading, now cut by the screen edge, steps back. */
const INTRO_OUT_AT = 110;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface Measured {
  input: HorizontalInput;
  introTop: number;
}

function sameMeasure(a: Measured | null, b: Measured): boolean {
  if (!a || a.introTop !== b.introTop) return false;
  const x = a.input;
  const y = b.input;
  return x.vw === y.vw && x.vh === y.vh && x.startX === y.startX && x.hudHeight === y.hudHeight;
}

/**
 * Desktop: a sticky stage. The route leaves the heading's full stop as the
 * section arrives; then vertical scroll drives the pen along one line and the
 * camera follows it, so the track slides left as the line draws itself.
 */
export default function ProcessHorizontal({ meta }: { meta: SectionMeta }) {
  const t = useTranslations('home.process');
  const steps = useProcessSteps();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const morphRef = useRef<SVGPathElement>(null);
  const tensRef = useRef<HTMLSpanElement>(null);
  const onesRef = useRef<HTMLSpanElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const jumpRef = useRef<((index: number) => void) | null>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [route, setRoute] = useState<SampledRoute | null>(null);
  const isInView = useInView(rootRef);

  // Measure the stage and where the heading's full stop lands; the intro is
  // then placed so that the full stop sits exactly on the baseline.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const intro = introRef.current;
    if (!stage || !intro) return;
    let frame = 0;
    let isAlive = true;
    const measure = () => {
      const period = intro.querySelector<HTMLElement>('[data-period]');
      if (!period) return;
      const vw = stage.clientWidth;
      const vh = stage.clientHeight;
      const introBox = intro.getBoundingClientRect();
      const dot = period.getBoundingClientRect();
      const next: Measured = {
        input: {
          vw,
          vh,
          hudHeight: HUD_HEIGHT,
          startX: Math.round(intro.offsetLeft + dot.left + dot.width / 2 - introBox.left),
          factCounts: FACT_COUNTS,
        },
        introTop: Math.round(horizontalBaseline(vh, HUD_HEIGHT) - (dot.top + dot.height / 2 - introBox.top)),
      };
      setMeasured(prev => (sameMeasure(prev, next) ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    observer.observe(intro);
    document.fonts?.ready.then(() => isAlive && schedule());
    return () => {
      isAlive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const input = measured?.input ?? null;
  const geometry = useMemo(() => (input ? buildHorizontal(input) : null), [input]);

  // Sample the rendered paths once per layout.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!geometry || !root) return;
    const paths = Array.from(root.querySelectorAll<SVGPathElement>('[data-piece]'));
    if (paths.length === geometry.pieces.length) setRoute(sampleRoute(paths, geometry));
  }, [geometry]);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || !route || !geometry) return;
      const renderer = createRenderer(
        route,
        {
          root,
          track: trackRef.current,
          parallax: gridRef.current,
          tip: tipRef.current,
          morph: morphRef.current,
          tens: tensRef.current,
          ones: onesRef.current,
          plus: plusRef.current,
        },
        {
          camera: { focusX: geometry.focusX, minCam: geometry.minCam, introOutAt: INTRO_OUT_AT },
          blockLead: 170,
          blockSpan: 270,
          blockFrom: { x: 0, y: 26 },
        }
      );
      const chaser = new PenChaser(renderer.draw, 9, 7000, renderer.rest);
      const leadLen = route.nodeLen[0];
      const k0 = keyAtLength(route, leadLen);
      let leadShare = 0.1;

      const targetFor = (progress: number) => {
        if (progress <= leadShare) return (progress / leadShare) * leadLen;
        const q = (progress - leadShare) / (1 - leadShare);
        return Math.max(leadLen, lengthAtKey(route, k0 + (1 - k0) * clamp01((q - LEAD_IN) / SPAN)));
      };
      const update = (progress: number, isImmediate = false) => {
        const target = targetFor(progress);
        chaser.setTarget(target, isImmediate);
        if (isImmediate) renderer.status(target);
        else renderer.queueStatus(target);
      };
      const trigger = ScrollTrigger.create({
        trigger: root,
        start: `top ${LEAD_START * 100}%`,
        end: 'bottom bottom',
        onUpdate: self => update(self.progress),
        onRefresh: self => {
          leadShare = Math.min(0.5, (window.innerHeight * LEAD_START) / Math.max(1, self.end - self.start));
          update(self.progress);
        },
      });
      leadShare = Math.min(0.5, (window.innerHeight * LEAD_START) / Math.max(1, trigger.end - trigger.start));
      // Arriving near the start, the line draws itself in; deep inside, it is just there.
      const initial = targetFor(trigger.progress);
      renderer.draw(0);
      update(trigger.progress, initial > route.nodeLen[1]);

      jumpRef.current = (index: number) => {
        const k = keyAtLength(route, route.nodeLen[index] + 6);
        const q = LEAD_IN + ((k - k0) / Math.max(1e-6, 1 - k0)) * SPAN;
        const progress = leadShare + q * (1 - leadShare);
        const y = trigger.start + progress * (trigger.end - trigger.start);
        const lenis = getLabLenis();
        if (lenis) lenis.scrollTo(y, { duration: JUMP_DURATION });
        else window.scrollTo({ top: y, behavior: 'smooth' });
      };

      return () => {
        jumpRef.current = null;
        chaser.destroy();
        renderer.destroy();
      };
    },
    { scope: rootRef, dependencies: [route, geometry], revertOnUpdate: true }
  );

  const onJump = useCallback((index: number) => jumpRef.current?.(index), []);

  const parallaxWidth = geometry && input ? input.vw + Math.abs(geometry.minCam) * PARALLAX + 160 : null;

  return (
    <div
      ref={rootRef}
      className={`${css.root} ${hcss.hRoot}`}
      data-motion=''
      data-inview={isInView ? '' : undefined}
      data-step='-1'
      data-drawn='false'
    >
      <div ref={stageRef} className={hcss.stage}>
        <div ref={gridRef} className={hcss.parallax} aria-hidden='true' style={{ width: parallaxWidth ?? '100%' }}>
          <div className={hcss.grid} />
        </div>
        <div ref={trackRef} className={hcss.track} style={{ width: geometry ? geometry.width : '100%' }}>
          <header ref={introRef} className={hcss.intro} style={{ top: measured?.introTop, visibility: measured ? undefined : 'hidden' }}>
            <SectionHeading meta={meta} className={hcss.title}>
              <ProcessTitle />
            </SectionHeading>
            <p className={hcss.lede}>{t('summary')}</p>
            <p className={hcss.hint}>
              <svg className={hcss.hintArrow} viewBox='0 0 12 16' aria-hidden='true'>
                <path d='M6 1.5V14M1.5 9.5L6 14L10.5 9.5' />
              </svg>
              {t('hint')}
            </p>
          </header>

          {geometry && (
            <>
              <RouteSvg geometry={geometry} isStatic={false} />
              <span ref={tipRef} className={css.tip} data-hidden='true' aria-hidden='true'>
                <span className={css.tipCore} />
              </span>
              <Outro className={hcss.outro} style={{ left: geometry.outro.x, top: geometry.outro.y, width: geometry.outroW }} />
            </>
          )}

          <ol className={hcss.steps} aria-label={t('stepsLabel')}>
            {steps.map((step, i) => {
              const node = geometry?.nodes[i];
              return (
                <li key={step.id} className={hcss.stageItem} data-stage={i} data-state='todo' aria-labelledby={`s12-${step.id}-title`}>
                  {node && <StageNode step={step} index={i} style={{ left: node.x, top: node.y }} />}
                  <StageBlock
                    step={step}
                    index={i}
                    className={hcss.block}
                    style={{
                      left: node ? node.x - 28 : 0,
                      height: geometry ? geometry.baseline - BLOCK_GAP : undefined,
                      width: geometry?.blockW,
                      visibility: geometry ? undefined : 'hidden',
                    }}
                  />
                  <ul className={hcss.flags} aria-label={t('factsLabel', { title: step.title })}>
                    {step.facts.map((fact, k) => {
                      const id = flagId(i, k);
                      const mark = geometry?.flags.find(flag => flag.id === id);
                      const style = {
                        left: mark?.at.x ?? 0,
                        top: mark?.at.y ?? 0,
                        visibility: mark ? undefined : 'hidden',
                        '--depth': `${mark?.depth ?? 60}px`,
                        '--flag-w': `${geometry?.flagW ?? 220}px`,
                      } as CSSProperties;
                      return (
                        <FactFlag key={id} id={id} className={hcss.flag} style={style}>
                          {fact.text}
                        </FactFlag>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={hcss.hud}>
          <div className={hcss.counter}>
            <MorphIcon pathRef={morphRef} className={hcss.counterIcon} />
            <div className={hcss.counterText}>
              <span className={hcss.counterLabel}>{t('counterLabel')}</span>
              <Odometer className={hcss.counterDigits} tensRef={tensRef} onesRef={onesRef} plusRef={plusRef} />
            </div>
            <span className={hcss.counterCaption}>{t('counterCaption')}</span>
          </div>
          <nav className={hcss.progress} aria-label={t('progressLabel')}>
            {steps.map((step, i) => (
              <button
                key={step.id}
                type='button'
                className={hcss.progressBtn}
                data-progress={i}
                data-state='todo'
                aria-label={t('jumpTo', { number: i + 1, title: step.title })}
                onClick={() => onJump(i)}
              >
                <span>
                  <span className={hcss.pNum}>{pad2(i + 1)}</span>
                  {step.title}
                </span>
                <span className={hcss.pTrack}>
                  <span className={hcss.pFill} data-fill='' />
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
