'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useLabSlot } from '../context/LabContext';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, ScrollTrigger, useGSAP } from '../global/gsap';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import BuildRail from './s08/BuildRail';
import { AI_BRIEF_STAGE_EVENT, marketForLocale, type BriefStage } from './s08/data';
import { getExamples } from './s08/examples';
import FlowField, { type FlowHandle } from './s08/FlowField';
import type { FlowSignal } from './s08/flowEngine';
import ScriptedDemo, { Arrow, INTENSITY } from './s08/ScriptedDemo';
import css from './s08/aiDemo.module.css';

const DECODE_GLYPHS = 'abcdefghijklmnopqrstuvwxyz';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const BRIEF_STAGES: readonly BriefStage[] = ['idle', 'reading', 'scoped', 'sketched', 'done'];

/**
 * "Get a plan in a minute." resolves left to right out of noise, once, as the
 * heading arrives. The noise is written into an overlay (`noiseRef`) laid over
 * the real line, which stays in the flow with its final text (only hidden
 * meanwhile): noise glyphs are wider or narrower than the real ones, and
 * written into the line itself they moved the caret and the line box every
 * frame.
 */
function useHeadlineDecode(
  lineRef: RefObject<HTMLSpanElement | null>,
  noiseRef: RefObject<HTMLSpanElement | null>,
  final: string,
  isEnabled: boolean
): void {
  useGSAP(
    () => {
      const line = lineRef.current;
      const el = noiseRef.current;
      // Read the query directly too: while hydrating, the hook reports "no preference" for a frame.
      if (!line || !el || !isEnabled || window.matchMedia(REDUCED_MOTION).matches) return;
      const writeLine = (text: string) => {
        const isDone = text === final;
        el.textContent = isDone ? '' : text;
        line.toggleAttribute('data-decoding', !isDone);
      };
      const progress = { p: 0 };
      const render = () => {
        const resolved = Math.floor(progress.p * final.length);
        let out = '';
        for (let i = 0; i < final.length; i++) {
          const ch = final[i];
          out += i < resolved || !/\p{L}/u.test(ch) ? ch : DECODE_GLYPHS[Math.floor(Math.random() * DECODE_GLYPHS.length)];
        }
        writeLine(out);
      };
      // The real line keeps its final width and height, so the noise never moves anything.
      const tween = gsap.to(progress, {
        p: 1,
        duration: 1.1,
        ease: 'power2.inOut',
        paused: true,
        onUpdate: render,
        onComplete: () => writeLine(final),
      });
      const trigger = ScrollTrigger.create({ trigger: line, start: 'top 88%', once: true, onEnter: () => tween.play(0) });
      return () => {
        trigger.kill();
        tween.kill();
        writeLine(final);
      };
    },
    { dependencies: [isEnabled, final], revertOnUpdate: true }
  );
}

/**
 * The heading's lines never wrap (the decode must not rewrap them), so a
 * language whose line runs longer than the English one would overflow. Scale
 * the heading down until its longest line fits (--title-fit), on resize and
 * once the display font arrives.
 */
function useTitleFit(headerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const title = headerRef.current?.querySelector<HTMLElement>(`.${css.title}`);
    if (!title) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        title.style.setProperty('--title-fit', '1');
        const lines = Array.from(title.querySelectorAll<HTMLElement>(`.${css.titleLine}`));
        const ratio = Math.min(1, ...lines.map(line => (line.scrollWidth > 0 ? line.clientWidth / line.scrollWidth : 1)));
        title.style.setProperty('--title-fit', ratio < 1 ? (Math.floor(ratio * 1000) / 1000).toString() : '1');
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(title);
    document.fonts?.addEventListener('loadingdone', fit);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts?.removeEventListener('loadingdone', fit);
    };
  }, [headerRef]);
}

/** How far the injected real brief has got: it reports its milestones with a bubbling event. */
function useBriefStage(slotRef: RefObject<HTMLDivElement | null>): BriefStage {
  const [stage, setStage] = useState<BriefStage>('idle');
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const onStage = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setStage(BRIEF_STAGES.find(known => known === detail) ?? 'idle');
    };
    el.addEventListener(AI_BRIEF_STAGE_EVENT, onStage);
    return () => el.removeEventListener(AI_BRIEF_STAGE_EVENT, onStage);
  }, [slotRef]);
  return stage;
}

/** The other way to a price: pick features yourself in the step-by-step estimator (a real link, for crawlers too). */
function EstimatorLink() {
  const t = useTranslations('home.ai-demo');
  const locale = useLocale();
  return (
    <p className={css.altRoute}>
      <span>{t('estimator.lead')}</span>{' '}
      <Link href={`/${locale}/estimator`} className={css.altLink}>
        {t('estimator.link')}
        <Arrow />
      </Link>
    </p>
  );
}

/** The real AI brief (the app layer's 'ai-demo' slot) under the build rail, which follows its milestones. */
function SlotStage({ header, slot, isStill }: { header: ReactNode; slot: ReactNode; isStill: boolean }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const stage = useBriefStage(slotRef);
  return (
    <div className={css.slotStage}>
      {header}
      <BuildRail stage={stage} isStill={isStill} />
      <div ref={slotRef} className={css.slotFrame}>
        {slot}
      </div>
      <EstimatorLink />
    </div>
  );
}

/** Without the real brief: a scripted example whose letters stream into a network and whose plan prints part by part. */
function ScriptedStage({ header, aiHref, isStill }: { header: ReactNode; aiHref: string; isStill: boolean }) {
  const t = useTranslations('home.ai-demo');
  const theme = useLabTheme();
  const { tier } = useLabDevice();
  const locale = useLocale();
  const examples = useMemo(() => getExamples(marketForLocale(locale), t), [locale, t]);
  const rootRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const sinkRef = useRef<HTMLElement>(null);
  const fieldRef = useRef<FlowHandle | null>(null);
  const signalRef = useRef<FlowSignal>({ intensity: INTENSITY.idle, step: 4, feed: 0, printY: 0 });
  return (
    <div ref={rootRef} className={css.scripted}>
      <FlowField
        rootRef={rootRef}
        graphRef={graphRef}
        sourceRef={sourceRef}
        sinkRef={sinkRef}
        signalRef={signalRef}
        handleRef={fieldRef}
        theme={theme}
        tier={tier}
        isStill={isStill}
      />
      <ScriptedDemo
        header={header}
        examples={examples}
        aiHref={aiHref}
        sourceRef={sourceRef}
        graphRef={graphRef}
        sinkRef={sinkRef}
        signalRef={signalRef}
        fieldRef={fieldRef}
        reducedMotion={isStill}
      />
      <EstimatorLink />
    </div>
  );
}

/**
 * 12 · ai-demo — "Describe your idea. Get a plan in a minute."
 *
 * The real AI brief, injected by the app layer as the 'ai-demo' slot, under a
 * build rail that shows what a plan is made of (your words → features →
 * price range and weeks → key screens) and lights up with the brief's real
 * milestones. On the homepage the brief is a summary that links to the full
 * plan, so the section keeps its length. Without the slot, a scripted example
 * of the brief plays instead, with a "Write your own" link to the real tool.
 */
export default function S08AIDemo({ meta }: LabSectionProps) {
  const t = useTranslations('home.ai-demo');
  const slot = useLabSlot('ai-demo');
  const { reducedMotion } = useLabDevice();
  const locale = useLocale();
  const lineRef = useRef<HTMLSpanElement>(null);
  const noiseRef = useRef<HTMLSpanElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const hasSlot = slot !== null && slot !== undefined && slot !== false;
  const aiHref = `/${locale}/ai-estimate`;

  useHeadlineDecode(lineRef, noiseRef, t('headingLines.second'), !reducedMotion);
  useTitleFit(headerRef);

  const header = (
    <header ref={headerRef} className={css.header}>
      <p className={css.eyebrow}>
        <span className={css.live} aria-hidden='true' />
        {t('eyebrow')}
      </p>
      <SectionHeading meta={meta} className={css.title}>
        <span className={css.titleLine}>{t('headingLines.first')}</span>{' '}
        <span className={`${css.titleLine} ${css.titleLast}`}>
          <span ref={lineRef} className={css.titleText}>
            {t('headingLines.second')}
          </span>
          <span ref={noiseRef} className={css.titleNoise} aria-hidden='true' />
          <span className={css.caret} aria-hidden='true' />
        </span>
      </SectionHeading>
      <div className={css.aside}>
        <p className={css.lede}>{t('summary')}</p>
        {hasSlot ? null : (
          <Link href={aiHref} className={css.cta}>
            {t('tryIt')}
            <Arrow />
          </Link>
        )}
      </div>
    </header>
  );

  return (
    <div className={css.root}>
      {hasSlot ? (
        <SlotStage header={header} slot={slot} isStill={reducedMotion} />
      ) : (
        <ScriptedStage header={header} aiHref={aiHref} isStill={reducedMotion} />
      )}
    </div>
  );
}
