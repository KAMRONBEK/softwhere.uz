'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useInView } from '../../components/useInView';
import { gsap, ScrollTrigger, useGSAP } from '../../global/gsap';
import { PHASES, PHASE_IDS, STEP_IDS, formatUsd, type DemoExample } from './data';
import type { AiDemoT } from './examples';
import FlowBand, { paintSteps } from './FlowBand';
import type { FlowHandle } from './FlowField';
import type { FlowSignal } from './flowEngine';
import WirePhone from './Wireframe';
import css from './aiDemo.module.css';
import plan from './plan.module.css';

/** Calm, thinking and settled levels of the network. */
export const INTENSITY = { idle: 0.12, thinking: 1, settled: 0.2 } as const;

const TYPE_SECONDS_FIRST = 0.012;
const TYPE_SECONDS_REPLAY = 0.008;
const STEP_SECONDS = 0.8;
const PRINT_SECONDS = 0.5;
/** The print stops this far below a part, half the gap to the next one. */
const PRINT_MARGIN = 12;
const RETRACT_SECONDS = 0.34;
const PRICE_STEP = 50;
/** Timeline speed when the plan sits below the network (phones, tablets). */
const STACKED_PACE = 1.25;
/** Where each screen starts its deal, in % of its width: tucked behind the middle one. */
const DEAL_FROM = [58, 0, -58] as const;
const PRICE_FROM = 0.55;
/** The plan's parts, in the order the four steps print them. */
const PRINT_ORDER = ['title', 'scope', 'screens', 'figures'] as const;

interface Run {
  index: number;
  /** 0 = not played yet (collapsed, waiting); every play increments it. */
  id: number;
}

interface ScriptedDemoProps {
  /** The section header; it sits in the stage grid above the demo. */
  header: ReactNode;
  examples: readonly DemoExample[];
  /** The real AI brief (/[locale]/ai-estimate). */
  aiHref: string;
  sourceRef: RefObject<HTMLDivElement | null>;
  graphRef: RefObject<HTMLDivElement | null>;
  sinkRef: RefObject<HTMLElement | null>;
  signalRef: RefObject<FlowSignal>;
  fieldRef: RefObject<FlowHandle | null>;
  reducedMotion: boolean;
}

function Spark() {
  return (
    <svg className={css.spark} viewBox='0 0 16 16' aria-hidden='true'>
      <path d='M8 0c.6 4.2 3.8 7.4 8 8-4.2.6-7.4 3.8-8 8-.6-4.2-3.8-7.4-8-8 4.2-.6 7.4-3.8 8-8Z' fill='currentColor' />
    </svg>
  );
}

function Tick() {
  return (
    <svg viewBox='0 0 12 12' aria-hidden='true'>
      <path d='M2.5 6.3 4.9 8.6 9.5 3.5' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

export function Arrow() {
  return (
    <svg className={css.arrow} viewBox='0 0 16 16' aria-hidden='true'>
      <path d='M3 8h10M9 4l4 4-4 4' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

/** The idea split into per-character spans (words stay unbreakable), for typing and the flight into the network. */
function IdeaChars({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, w) => (
        <Fragment key={`${w}-${word}`}>
          <span className={css.word}>
            {Array.from(word, (ch, c) => (
              <span key={c} className={css.char} data-char=''>
                {ch}
              </span>
            ))}
          </span>
          {w < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  );
}

const pct = (share: number) => `${(share * 100).toFixed(2)}%`;

/** Design → Build → Launch on a week grid; the hatched tail is the range (min to max weeks). */
function Gantt({ weeks }: { weeks: DemoExample['weeks'] }) {
  const t = useTranslations('home.ai-demo');
  const scale = weeks.min / weeks.max;
  return (
    <div className={plan.gantt} style={{ ['--weeks' as string]: weeks.max }} aria-hidden='true'>
      {PHASES.map((phase, i) => (
        <div key={PHASE_IDS[i]} className={plan.ganttRow}>
          <span className={plan.ganttName}>{t(`phases.${PHASE_IDS[i]}`)}</span>
          <span className={plan.track}>
            <span
              className={plan.bar}
              data-bar=''
              style={{ left: pct(phase.start * scale), width: pct((phase.end - phase.start) * scale) }}
            />
            {i === PHASES.length - 1 ? (
              <span className={plan.range} data-range='' style={{ left: pct(scale), width: pct(1 - scale) }} />
            ) : null}
          </span>
        </div>
      ))}
      <div className={plan.ganttRow}>
        <span className={plan.ganttName} />
        <span className={plan.axis}>
          <span>{t('weekAxis', { week: 1 })}</span>
          <span>{t('weekAxis', { week: weeks.max })}</span>
        </span>
      </div>
    </div>
  );
}

/** The screen reader's line once an example's plan is printed. */
function liveDone(t: AiDemoT, example: DemoExample): string {
  return t('liveDone', {
    title: example.title,
    min: formatUsd(example.price.min),
    max: formatUsd(example.price.max),
    minWeeks: example.weeks.min,
    maxWeeks: example.weeks.max,
  });
}

/** The hook reports "no preference" for a frame while hydrating; effects read the query directly too. */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Writes into the existing text node, so React keeps owning it. */
function writeText(el: Element | null | undefined, text: string): void {
  const node = el?.firstChild;
  if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = text;
}

/** Bottom of a plan part (plus half a gap), in px from the card's top. */
function printBottom(card: HTMLElement, part: string): number {
  const el = card.querySelector<HTMLElement>(`[data-print="${part}"]`);
  if (!el) return card.offsetHeight;
  return Math.min(card.offsetHeight, el.offsetTop + el.offsetHeight + PRINT_MARGIN);
}

/** The card is printed down to y: clip below it, park the print head on it, feed the wire to it. */
function applyPrint(card: HTMLElement, head: HTMLElement, signal: FlowSignal, y: number): void {
  const radius = card.dataset.radius ?? '0px';
  card.style.clipPath = `inset(0 0 calc(100% - ${y.toFixed(1)}px) 0 round ${radius})`;
  head.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
  signal.printY = y;
}

/** Where the feed wire rests once the plan is printed: level with the brief's header. */
function headAnchor(card: HTMLElement): number {
  const head = card.querySelector<HTMLElement>('[data-print="head"]');
  return head ? head.offsetTop + head.offsetHeight / 2 : 0;
}

/**
 * Where the feed wire rests once the plan is printed: level with the network's
 * output when the plan sits beside it (a straight wire), else with the header.
 */
function restAnchor(card: HTMLElement, band: HTMLElement): number {
  const head = headAnchor(card);
  const plot = band.querySelector('[data-plot]');
  if (!plot) return head;
  const p = plot.getBoundingClientRect();
  const level = p.top + p.height / 2 - card.getBoundingClientRect().top;
  return Math.min(Math.max(level, head), card.offsetHeight - 32);
}

function setStatus(card: HTMLElement, state: 'waiting' | 'busy' | 'done', text: string): void {
  const status = card.querySelector('[data-status]');
  status?.setAttribute('data-state', state);
  writeText(status?.querySelector('[data-status-text]'), text);
}

/**
 * Scripted fallback for the AI brief. The idea types itself, its letters
 * stream into the network, the four columns (Read, Scope, Sketch, Price)
 * light up one by one and each finished step prints its part of the plan:
 * title, first-version scope, three key screens, then the price and the
 * timeline. Clearly labelled as an example, with a link to the real thing.
 *
 * Before it plays, the plan is collapsed to its header ("Waiting for an
 * idea"), so no empty skeleton is ever on screen. The DOM's resting state is
 * the finished plan (reduced motion, SSR, no JS).
 */
export default function ScriptedDemo({
  header,
  examples,
  aiHref,
  sourceRef,
  graphRef,
  sinkRef,
  signalRef,
  fieldRef,
  reducedMotion,
}: ScriptedDemoProps) {
  const t = useTranslations('home.ai-demo');
  const exactPriceLine = useTranslations('home.shared')('exactPriceLine');
  const stageRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const printRef = useRef({ y: 0 });
  const isRetractingRef = useRef(false);
  /** The first run should open on its last frame (see the autoplay effect). */
  const isFinishingRef = useRef(false);
  const [run, setRun] = useState<Run>({ index: 0, id: 0 });
  const isStageInView = useInView(stageRef);
  const example = examples[run.index] ?? examples[0];

  // Autoplay once, as soon as the network band is in the upper three quarters of the viewport.
  // Arriving from below instead (scrolling back up, or a jump into the plan on a phone, where it
  // sits under the network), the collapsed plan would be an empty card on screen: open it finished.
  useEffect(() => {
    const el = graphRef.current;
    if (!el || reducedMotion || prefersReducedMotion()) return;
    const start = (isFinished: boolean) => {
      setRun(prev => {
        if (prev.id !== 0) return prev;
        isFinishingRef.current = isFinished;
        return { index: prev.index, id: 1 };
      });
      observers.forEach(observer => observer.disconnect());
    };
    const observers = [
      new IntersectionObserver(([entry]) => entry.isIntersecting && start(false), { rootMargin: '0px 0px -25% 0px' }),
      new IntersectionObserver(([entry]) => entry.isIntersecting && el.getBoundingClientRect().bottom < 0 && start(true)),
    ];
    observers[0].observe(el);
    if (sinkRef.current) observers[1].observe(sinkRef.current);
    return () => observers.forEach(observer => observer.disconnect());
  }, [graphRef, sinkRef, reducedMotion]);

  // Scrolled past before the story ended: finish it, so it is never found half-built.
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!isStageInView && timeline && timeline.progress() < 1) timeline.progress(1);
  }, [isStageInView]);

  const { contextSafe } = useGSAP(
    () => {
      const stage = stageRef.current;
      const card = sinkRef.current;
      const band = graphRef.current;
      const head = headRef.current;
      const signal = signalRef.current;
      if (!stage || !card || !band || !head) return;
      timelineRef.current = null;
      card.dataset.radius = getComputedStyle(card).borderTopLeftRadius;

      if (reducedMotion || prefersReducedMotion()) {
        Object.assign(signal, { intensity: INTENSITY.settled, step: 4, feed: 0, printY: restAnchor(card, band) });
        paintSteps(band, 4);
        return;
      }

      const q = gsap.utils.selector(stage);
      const chars = q('[data-char]') as HTMLElement[];
      const textLayer = q('[data-text-layer]')[0] as HTMLElement | undefined;
      const prices = q('[data-price]');
      const idleText = q('[data-generate-text]')[0];
      const print = printRef.current;
      const printTo = (y: number) => applyPrint(card, head, signal, y);

      // Collapsed: just the brief's header, waiting for an idea.
      chars.forEach(el => (el.style.opacity = '0'));
      gsap.set(q('[data-placeholder]'), { opacity: 1 });
      gsap.set(head, { opacity: 1 });
      gsap.set(q('[data-in], [data-figure]'), { opacity: 0, y: 14 });
      gsap.set(q('[data-pill]'), { opacity: 0, y: 8, scale: 0.92 });
      gsap.set(q('[data-phone]'), { opacity: 0 });
      gsap.set(q('[data-block]'), { opacity: 0 });
      gsap.set(q('[data-bar]'), { scaleX: 0 });
      gsap.set(q('[data-range], [data-foot]'), { opacity: 0 });
      print.y = printBottom(card, 'head');
      printTo(print.y);
      paintSteps(band, -1);
      setStatus(card, 'waiting', t('waiting'));
      Object.assign(signal, { intensity: INTENSITY.idle, step: -1, feed: 0 });
      fieldRef.current?.wake();

      const restore = () => {
        // Text and attributes written outside GSAP's own bookkeeping.
        chars.forEach(el => {
          el.style.opacity = '';
          el.removeAttribute('data-caret');
        });
        card.style.clipPath = '';
        head.style.transform = '';
        q('[data-generate]')[0]?.removeAttribute('data-busy');
        prices.forEach((el, i) => writeText(el, formatUsd(i === 0 ? example.price.min : example.price.max)));
        paintSteps(band, 4);
        setStatus(card, 'done', t('ready'));
        timelineRef.current = null;
      };
      if (run.id === 0) return restore;

      // 1 · The idea types itself.
      const perChar = run.id === 1 ? TYPE_SECONDS_FIRST : TYPE_SECONDS_REPLAY;
      const typing = { n: 0 };
      let shown = 0;
      const revealTyped = () => {
        const target = Math.min(chars.length, Math.floor(typing.n));
        while (shown < target) {
          chars[shown].style.opacity = '1';
          chars[shown - 1]?.removeAttribute('data-caret');
          chars[shown].setAttribute('data-caret', '');
          shown++;
        }
      };

      // 3 · Its letters, measured where they sit, stream into the network.
      const launchGlyphs = () => {
        chars[chars.length - 1]?.removeAttribute('data-caret');
        const field = fieldRef.current;
        if (!field || !textLayer) return;
        const style = getComputedStyle(textLayer);
        const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const glyphs = chars
          .map(el => {
            const r = el.getBoundingClientRect();
            return { ch: el.textContent ?? '', x: r.left + r.width / 2, y: r.top + r.height / 2 };
          })
          .filter(glyph => glyph.ch.trim() !== '');
        field.launch(glyphs, font);
      };

      const priceProxy = { v: PRICE_FROM };
      const writePrices = () => {
        const bounds = [example.price.min, example.price.max];
        prices.forEach((el, i) => {
          const value = Math.round((bounds[i] * priceProxy.v) / PRICE_STEP) * PRICE_STEP;
          writeText(el, formatUsd(value));
        });
      };

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      timelineRef.current = tl;

      tl.to(q('[data-placeholder]'), { opacity: 0, duration: 0.12 }, 0.1);
      tl.to(typing, { n: chars.length, duration: chars.length * perChar, ease: 'none', onUpdate: revealTyped }, 0.15);

      // 2 · Press.
      tl.addLabel('press', '+=0.25');
      tl.to(q('[data-generate]'), { scale: 0.96, duration: 0.1, ease: 'power2.out' }, 'press');
      tl.to(q('[data-generate]'), { scale: 1, duration: 0.42, ease: 'elastic.out(1, 0.55)', clearProps: 'transform' }, 'press+=0.1');
      tl.call(() => q('[data-generate]')[0]?.setAttribute('data-busy', ''), undefined, 'press');
      tl.to(q('[data-generate-idle]'), { opacity: 0, y: -10, duration: 0.18 }, 'press+=0.06');
      tl.fromTo(
        q('[data-generate-busy]'),
        { opacity: 0, y: 10 },
        { immediateRender: false, opacity: 1, y: 0, duration: 0.26 },
        'press+=0.1'
      );

      // 3 · Send.
      tl.addLabel('send', 'press+=0.16');
      tl.call(launchGlyphs, undefined, 'send');
      // The canvas takes the letters over (lit, then peeling off); the DOM text steps aside so nothing doubles.
      if (textLayer) {
        tl.set(textLayer, { opacity: fieldRef.current ? 0 : 0.22 }, 'send');
        // Once the last letters have landed, the idea settles back in, quieter, while the plan prints.
        tl.to(textLayer, { opacity: 0.45, duration: 0.6, ease: 'power1.out' }, 'send+=1.45');
      }
      tl.to(signal, { intensity: INTENSITY.thinking, duration: 0.6, ease: 'power2.out' }, 'send+=0.2');

      // 4 · Each column works, then prints its part of the plan.
      tl.addLabel('think', 'send+=0.5');
      tl.to(signal, { feed: 1, duration: 0.3, ease: 'none' }, 'think+=0.2');
      PRINT_ORDER.forEach((part, i) => {
        const start = i * STEP_SECONDS;
        tl.call(
          () => {
            signal.step = i;
            paintSteps(band, i);
            setStatus(card, 'busy', t(`steps.${STEP_IDS[i]}.long`));
          },
          undefined,
          `think+=${start}`
        );
        tl.to(
          print,
          // Never back up: side by side, a later part can end above an earlier one.
          {
            y: () => Math.max(print.y, printBottom(card, part)),
            duration: PRINT_SECONDS,
            ease: 'power2.inOut',
            onUpdate: () => printTo(print.y),
          },
          `think+=${start + 0.3}`
        );
        const at = `think+=${start + 0.4}`;
        if (part === 'title') {
          tl.to(q('[data-print="title"] [data-in]'), { opacity: 1, y: 0, duration: 0.5, stagger: 0.07 }, at);
        } else if (part === 'scope') {
          tl.to(q('[data-print="scope"] [data-in]'), { opacity: 1, y: 0, duration: 0.4 }, at);
          tl.to(q('[data-pill]'), { opacity: 1, y: 0, scale: 1, duration: 0.42, stagger: 0.045, ease: 'back.out(1.7)' }, at);
        } else if (part === 'screens') {
          tl.to(q('[data-print="screens"] [data-in]'), { opacity: 1, y: 0, duration: 0.4 }, at);
          // Dealt like cards: the middle screen rises, the other two slide out from behind it into the fan.
          tl.fromTo(
            q('[data-phone]'),
            {
              opacity: 0,
              xPercent: (i: number) => DEAL_FROM[i] ?? 0,
              y: 46,
              rotationX: 24,
              transformPerspective: 800,
              transformOrigin: '50% 100%',
            },
            {
              immediateRender: false,
              opacity: 1,
              xPercent: 0,
              y: 0,
              rotationX: 0,
              duration: 0.95,
              stagger: { each: 0.1, from: 'center' },
              ease: 'expo.out',
            },
            at
          );
          tl.to(q('[data-block]'), { opacity: 1, duration: 0.3, stagger: 0.025, ease: 'power1.out' }, `${at}+=0.18`);
        } else {
          tl.call(writePrices, undefined, at);
          tl.to(q('[data-figure]'), { opacity: 1, y: 0, duration: 0.45, stagger: 0.08 }, at);
          tl.to(priceProxy, { v: 1, duration: 1.1, ease: 'power3.out', onUpdate: writePrices }, at);
          tl.to(q('[data-bar]'), { scaleX: 1, duration: 0.5, stagger: 0.14, ease: 'power3.inOut' }, `${at}+=0.15`);
          tl.to(q('[data-range]'), { opacity: 1, duration: 0.4 }, `${at}+=0.6`);
        }
      });

      // 5 · Done: the plan finishes printing, the network settles.
      tl.addLabel('done', `think+=${PRINT_ORDER.length * STEP_SECONDS}`);
      tl.call(
        () => {
          signal.step = 4;
          paintSteps(band, 4);
          setStatus(card, 'done', t('ready'));
        },
        undefined,
        'done'
      );
      tl.to(print, { y: () => card.offsetHeight, duration: 0.4, ease: 'power2.inOut', onUpdate: () => printTo(print.y) }, 'done');
      tl.to(q('[data-foot]'), { opacity: 1, duration: 0.4 }, 'done+=0.15');
      tl.to(head, { opacity: 0, duration: 0.3 }, 'done+=0.4');
      tl.call(() => void (card.style.clipPath = ''), undefined, 'done+=0.45');
      tl.to(signal, { feed: 0, duration: 0.8, ease: 'power2.out' }, 'done+=0.3');
      tl.to(signal, { printY: () => restAnchor(card, band), duration: 1, ease: 'power3.inOut' }, 'done+=0.5');
      tl.to(signal, { intensity: INTENSITY.settled, duration: 1.2, ease: 'power2.inOut' }, 'done');
      if (textLayer) tl.to(textLayer, { opacity: 1, duration: 0.5 }, 'done');
      tl.to(q('[data-generate-busy]'), { opacity: 0, y: -10, duration: 0.2 }, 'done+=0.1');
      tl.call(
        () => {
          writeText(idleText, t('replay'));
          q('[data-generate]')[0]?.removeAttribute('data-busy');
        },
        undefined,
        'done+=0.3'
      );
      tl.fromTo(
        q('[data-generate-idle]'),
        { opacity: 0, y: 10 },
        { immediateRender: false, opacity: 1, y: 0, duration: 0.3 },
        'done+=0.25'
      );
      tl.call(() => {
        // Drop the finished transforms so nothing stays on its own layer.
        gsap.set(q('[data-phone], [data-pill], [data-in], [data-figure]'), { clearProps: 'transform' });
        head.style.transform = '';
        if (liveRef.current) liveRef.current.textContent = liveDone(t, example);
      });

      // Stacked (phones, tablets): already reading the plan below while the story is still typing? Catch up.
      // Side by side the whole story is on screen at once, so it keeps its pace.
      const isBeside = card.getBoundingClientRect().left >= band.getBoundingClientRect().right - 4;
      if (!isBeside) {
        // The plan prints below the fold while the visitor scrolls: a brisker pace.
        tl.timeScale(STACKED_PACE);
        ScrollTrigger.create({
          trigger: card,
          start: 'top 22%',
          onEnter: () => {
            if (tl.progress() < 1) gsap.to(tl, { timeScale: 2.2, duration: 0.4 });
          },
        });
      }

      if (isFinishingRef.current) {
        isFinishingRef.current = false;
        tl.progress(1);
      }

      return restore;
    },
    { scope: stageRef, dependencies: [run.id, run.index, reducedMotion, t], revertOnUpdate: true }
  );

  /** Retract the plan back to its header, then play `index`. */
  const choose = contextSafe((index: number) => {
    const next = (prev: Run): Run => ({ index, id: prev.id + 1 });
    if (reducedMotion) {
      setRun(next);
      if (liveRef.current) liveRef.current.textContent = liveDone(t, examples[index]);
      return;
    }
    if (isRetractingRef.current) return;
    const card = sinkRef.current;
    const head = headRef.current;
    timelineRef.current?.kill();
    timelineRef.current = null;
    if (!card || !head || run.id === 0) {
      setRun(next);
      return;
    }
    isRetractingRef.current = true;
    const print = printRef.current;
    if (!card.style.clipPath) print.y = card.offsetHeight;
    const signal = signalRef.current;
    paintSteps(graphRef.current, -1);
    gsap.to(signal, { intensity: INTENSITY.idle, feed: 0, duration: 0.3 });
    gsap.set(head, { opacity: 1 });
    gsap.to(stageRef.current?.querySelector('[data-text-layer]') ?? [], { opacity: 0, duration: 0.2 });
    gsap.to(print, {
      y: printBottom(card, 'head'),
      duration: RETRACT_SECONDS,
      ease: 'power2.in',
      onUpdate: () => applyPrint(card, head, signal, print.y),
      onComplete: () => {
        isRetractingRef.current = false;
        setRun(next);
      },
    });
  });
  const generate = () => choose(reducedMotion ? (run.index + 1) % examples.length : run.index);

  return (
    <div ref={stageRef} className={css.stage}>
      {header}

      {/* The idea */}
      <div ref={sourceRef} className={`${css.card} ${css.prompt}`}>
        {/* Honest about what this is: an example, with the real thing one tap away. */}
        <div className={css.promptHead}>
          <p className={css.tag}>{t('exampleTag')}</p>
          <Link href={aiHref} className={css.ownLink}>
            {t('ownIdea')}
            <Arrow />
          </Link>
        </div>
        <div className={css.ideaBox} key={example.id}>
          <p className={css.ideaText} data-text-layer=''>
            <span className={css.srOnly}>{example.idea}</span>
            <span aria-hidden='true'>
              <IdeaChars text={example.idea} />
            </span>
          </p>
          <p className={css.placeholder} data-placeholder='' aria-hidden='true'>
            {t('placeholder')}
          </p>
        </div>

        <ul className={css.chips} aria-label={t('chipsLabel')}>
          {examples.map((item, i) => (
            <li key={item.id}>
              <button type='button' className={css.chip} aria-pressed={i === run.index} onClick={() => choose(i)}>
                {item.chip}
              </button>
            </li>
          ))}
        </ul>

        <button type='button' className={css.generate} data-generate='' onClick={generate}>
          <span className={css.generateLabel} data-generate-idle=''>
            <Spark />
            <span data-generate-text=''>{reducedMotion ? t('next') : run.id <= 1 ? t('generate') : t('replay')}</span>
          </span>
          <span className={`${css.generateLabel} ${css.generateBusy}`} data-generate-busy='' aria-hidden='true'>
            {t('thinking')}
            <span className={css.dots}>
              <i />
              <i />
              <i />
            </span>
          </span>
        </button>
      </div>

      {/* The network */}
      <FlowBand bandRef={graphRef} />

      {/* The plan */}
      <div className={css.planWrap}>
        <article ref={sinkRef} className={`${css.card} ${plan.plan}`} aria-labelledby='ai-demo-result-title'>
          <div className={plan.head} data-print='head'>
            <span className={plan.tag}>{t('resultTag')}</span>
            <p className={plan.status} data-status='' data-state='done' aria-hidden='true'>
              <span className={plan.statusIcon} />
              <span data-status-text=''>{t('ready')}</span>
            </p>
          </div>

          <div className={plan.titleBlock} data-print='title'>
            <p className={plan.kind} data-in=''>
              {example.kind} · {example.platforms}
            </p>
            <h3 className={plan.title} id='ai-demo-result-title' data-in=''>
              {example.title}
            </h3>
          </div>

          {/* Narrow: scope, screens, figures stacked. Wide: scope and figures beside the fanned screens. */}
          <div className={plan.body}>
            <div className={plan.scopePart} data-print='scope'>
              <p className={plan.label} data-in=''>
                {t('scopeLabel')}
              </p>
              <ul className={plan.scope}>
                {example.scope.map(item => (
                  <li key={item} className={plan.pill} data-pill=''>
                    <Tick />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className={plan.screensPart} data-print='screens'>
              <p className={plan.label} data-in=''>
                {t('screensLabel')}
              </p>
              <div className={plan.phones}>
                {example.screens.map(screen => (
                  <WirePhone key={`${example.id}-${screen.name}`} screen={screen} />
                ))}
              </div>
            </div>

            <div className={plan.figures} data-print='figures'>
              <div className={plan.figTop}>
                <div data-figure=''>
                  <p className={plan.label}>{t('priceLabel')}</p>
                  <p className={plan.price}>
                    <span data-price=''>{formatUsd(example.price.min)}</span>
                    <span className={plan.dash}>–</span>
                    <span data-price=''>{formatUsd(example.price.max)}</span>
                  </p>
                  <p className={plan.note}>{t('priceNote')}</p>
                </div>
                <div className={plan.weeksBlock} data-figure=''>
                  <p className={plan.label}>{t('timelineLabel')}</p>
                  <p className={plan.weeks}>
                    {example.weeks.min}–{example.weeks.max}
                    <small>{t('weeksUnit', { count: example.weeks.max })}</small>
                  </p>
                </div>
              </div>
              <div data-figure=''>
                <Gantt weeks={example.weeks} />
              </div>
            </div>
          </div>

          <div className={plan.foot} data-print='foot'>
            <p className={plan.footnote} data-foot=''>
              {t('footnote')} {exactPriceLine}
            </p>
            <Link className={plan.footCta} href={aiHref} data-foot=''>
              {t('footCta')}
              <Arrow />
            </Link>
          </div>
          <p className={css.srOnly} aria-live='polite' ref={liveRef} />
        </article>
        <span ref={headRef} className={css.printHead} aria-hidden='true' />
      </div>
    </div>
  );
}
