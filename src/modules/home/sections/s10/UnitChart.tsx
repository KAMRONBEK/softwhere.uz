'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { NUMBERS_ICONS } from '../../assets/numbers';
import { gsap } from '../../global/gsap';
import { useProjectDescriber } from '../../media/useProjectDescriber';
import { CHART_PROJECTS, type NumberFact } from './facts';
import { BURST_COUNT_DELAY, COUNT_DELAY, courierFlight, reachesAt } from './timing';
import css from './numbers.module.css';
import { useNumbersCopy } from './useNumbersCopy';

/**
 * One dot per product. Each fact re-sorts the same dots into its groups, a
 * unit histogram with ROWS rows, so the big number can be counted dot by dot.
 * Dots glide to their new places on GSAP (transform/opacity only). With
 * `onCount`, every counted dot waits for the spark the numeral sends it and
 * lights as it lands. Hovering, or tapping, a dot shows the product: its real
 * app icon (cropped from the portfolio poster), what it is ("Taxi app": story
 * sections never name projects, founder 2026-10-10; the work wall does),
 * field, client country and its live store listings.
 */

const ROWS = 6;
const GAP_RATIO = 0.6;
const MIN_PITCH = 8;
const MAX_PITCH = 20;
const TOUCH_READOUT_MS = 2600;
/** Finger travel (px) that still counts as a tap on the chart. */
const TAP_SLOP_PX = 12;
const TIP_HALF = 96;
const DIM_SCALE = 0.6;
const DIM_OPACITY = 0.24;
/** Tooltip icon: square app icons, or a wide logo at a lower height. */
const ICON_SIZE = 40;
const LOGO_HEIGHT = 24;
const LOGO_MAX_WIDTH = 104;

/** A spark to send for one counted dot, relative to the dots' host element. */
export interface CourierTarget {
  x: number;
  y: number;
  delay: number;
  flight: number;
  size: number;
}

interface DotPlace {
  x: number;
  y: number;
  isLit: boolean;
  group: number;
}

interface Tick {
  x: number;
  label: string;
  isLit: boolean;
}

interface ChartLayout {
  dots: DotPlace[];
  ticks: Tick[];
  width: number;
}

/** Width of a fact's layout in pitch units (columns plus group gaps). */
function unitsOf(fact: NumberFact): number {
  const cols = fact.groups.reduce((sum, group) => sum + Math.ceil(group.members.length / ROWS), 0);
  return cols + Math.max(0, fact.groups.length - 1) * GAP_RATIO;
}

function maxUnits(facts: readonly NumberFact[]): number {
  return Math.max(...facts.map(unitsOf));
}

function layoutOf(fact: NumberFact, pitch: number): ChartLayout {
  const gap = pitch * GAP_RATIO;
  const dots: DotPlace[] = new Array(CHART_PROJECTS.length);
  const ticks: Tick[] = [];
  let x = 0;
  fact.groups.forEach((group, groupIndex) => {
    const cols = Math.ceil(group.members.length / ROWS);
    // Column by column, bottom-up: a partly filled column reads like a bar.
    group.members.forEach((member, i) => {
      dots[member] = {
        x: x + Math.floor(i / ROWS) * pitch,
        y: (ROWS - 1 - (i % ROWS)) * pitch,
        isLit: group.isLit,
        group: groupIndex,
      };
    });
    ticks.push({ x: x + (cols * pitch) / 2, label: String(group.members.length), isLit: group.isLit });
    x += cols * pitch + gap;
  });
  return { dots, ticks, width: Math.max(pitch, x - gap) };
}

/**
 * Count step at which each dot lights (0 = not counted): lit dots in layout
 * order, or, when the fact counts groups, every dot of the k-th lit group.
 */
function countOrder(fact: NumberFact): Int16Array {
  const order = new Int16Array(CHART_PROJECTS.length);
  let k = 0;
  for (const group of fact.groups) {
    if (!group.isLit) continue;
    if (fact.unit === 'group') k++;
    for (const member of group.members) order[member] = fact.unit === 'group' ? k : ++k;
  }
  return order;
}

interface UnitChartProps {
  facts: readonly NumberFact[];
  active: number;
  isShown: boolean;
  isStatic: boolean;
  /** Bumped by a click/tap recount: re-light the dots without moving them. */
  replay: number;
  /** Each (re)count: the sparks to fly from the numeral; counted dots light as they land. */
  onCount?: (host: HTMLElement, targets: CourierTarget[]) => void;
}

type ChartProject = (typeof CHART_PROJECTS)[number];

/** Store names are brands: never translated. */
function storesOf(project: ChartProject): string[] {
  return [project.appStore ? 'App Store' : null, project.playMarket ? 'Google Play' : null].filter(
    (store): store is string => store !== null
  );
}

export default function UnitChart({ facts, active, isShown, isStatic, replay, onCount }: UnitChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hasPlacedRef = useRef(false);
  const replayRef = useRef(replay);
  const pitchRef = useRef(0);
  const touchTimerRef = useRef(0);
  /** Where the current press started: a tap names a dot, a sideways swipe does not. */
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  // Latest callback without re-running the count effect when its identity changes.
  const onCountRef = useRef(onCount);
  useEffect(() => {
    onCountRef.current = onCount;
  }, [onCount]);
  const t = useTranslations('home.numbers');
  const copy = useNumbersCopy();
  const describer = useProjectDescriber();
  const [pitch, setPitch] = useState(14);
  const [hover, setHover] = useState<number | null>(null);

  // Pitch from the available width: the widest fact must fit.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const units = maxUnits(facts);
    const update = () => {
      const width = wrap.clientWidth;
      const next = Math.max(MIN_PITCH, Math.min(MAX_PITCH, Math.floor(width / units)));
      setPitch(prev => (prev === next ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [facts]);

  const layouts = useMemo(() => facts.map(fact => layoutOf(fact, pitch)), [facts, pitch]);
  const layout = layouts[active];

  // On every (re)count: glide the dots into the fact's arrangement, dim them,
  // then light each counted dot (or group) the moment the numeral reaches it.
  useEffect(() => {
    const host = dotsRef.current;
    if (!host) return;
    const els = Array.from(host.children) as HTMLElement[];
    const fact = facts[active];
    // A resize only re-flows the chart: no recount.
    const isInstant = isStatic || !hasPlacedRef.current || pitchRef.current !== pitch;
    pitchRef.current = pitch;
    const isReplay = replay !== replayRef.current;
    replayRef.current = replay;
    hasPlacedRef.current = true;
    gsap.killTweensOf(els, isReplay ? 'scale,opacity' : 'x,y,scale,opacity');
    const order = countOrder(fact);
    const start = isReplay ? BURST_COUNT_DELAY : COUNT_DELAY;
    const send = isInstant || !isShown ? undefined : onCountRef.current;
    const targets: CourierTarget[] = [];
    els.forEach((el, i) => {
      const place = layout.dots[i];
      if (isInstant) {
        gsap.set(el, {
          x: place.x,
          y: place.y,
          scale: isShown ? (place.isLit ? 1 : DIM_SCALE) : 0,
          opacity: isShown ? (place.isLit ? 1 : DIM_OPACITY) : 0,
        });
        return;
      }
      if (!isShown) {
        gsap.to(el, { scale: 0, opacity: 0, duration: 0.3, ease: 'power2.in' });
        return;
      }
      if (!isReplay) {
        gsap.to(el, { x: place.x, y: place.y, duration: 0.9, ease: 'expo.inOut', delay: (place.x / layout.width) * 0.18 });
      }
      gsap.to(el, { scale: DIM_SCALE, opacity: DIM_OPACITY, duration: 0.25, ease: 'power2.out' });
      const k = order[i];
      if (k > 0) {
        const leaves = start + reachesAt(k, fact.value);
        const flight = send ? courierFlight(i) : 0;
        if (send) targets.push({ x: place.x + pitch / 2, y: place.y + pitch / 2, delay: leaves, flight, size: pitch });
        gsap.to(el, {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: 'back.out(2.6)',
          delay: leaves + flight,
          overwrite: 'auto',
        });
      }
    });
    if (send && targets.length > 0) send(host, targets);
  }, [facts, active, layout, pitch, isShown, isStatic, replay]);

  useEffect(() => {
    const host = dotsRef.current;
    return () => {
      window.clearTimeout(touchTimerRef.current);
      if (host) gsap.killTweensOf(Array.from(host.children));
    };
  }, []);

  const nearest = (event: PointerEvent<HTMLDivElement>): number | null => {
    const host = dotsRef.current;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    const px = event.clientX - rect.left - pitch / 2;
    const py = event.clientY - rect.top - pitch / 2;
    let best: number | null = null;
    let bestD = pitch * pitch * 0.8;
    layout.dots.forEach((place, i) => {
      const d = (place.x - px) ** 2 + (place.y - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || !isShown) return;
    setHover(nearest(event));
  };

  // A click names a dot at once; a tap names it on lift (a swipe that scrolls
  // the page ends in pointercancel instead, so it never pops a name). Without
  // hover, the name clears itself.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pressRef.current = { x: event.clientX, y: event.clientY };
    if (!isShown || event.pointerType !== 'mouse') return;
    window.clearTimeout(touchTimerRef.current);
    setHover(nearest(event));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    pressRef.current = null;
    if (!isShown || event.pointerType === 'mouse' || !press) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP_PX) return;
    window.clearTimeout(touchTimerRef.current);
    setHover(nearest(event));
    touchTimerRef.current = window.setTimeout(() => setHover(null), TOUCH_READOUT_MS);
  };

  // Keep the tooltip inside the chart: centre it on the dot, clamped by its own width.
  const hovered = hover === null ? null : layout.dots[hover];
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!hovered || !tip) return;
    const wrapWidth = wrapRef.current?.clientWidth ?? 0;
    const half = (tip.offsetWidth || TIP_HALF * 2) / 2;
    const center = Math.max(half, Math.min(Math.max(half, wrapWidth - half), hovered.x + pitch / 2));
    tip.style.transform = `translate3d(${center}px, ${hovered.y}px, 0) translate(-50%, -100%)`;
  }, [hovered, pitch]);

  const project = hover === null ? null : CHART_PROJECTS[hover];
  const group = hovered ? facts[active].groups[hovered.group] : null;
  const icon = project ? NUMBERS_ICONS[project.slug] : undefined;
  const isLogo = icon ? icon.width / icon.height > 1.3 : false;
  const iconHeight = isLogo ? LOGO_HEIGHT : ICON_SIZE;
  const iconWidth = icon ? Math.min(isLogo ? LOGO_MAX_WIDTH : ICON_SIZE, Math.round((iconHeight * icon.width) / icon.height)) : 0;
  const storeNames = project ? storesOf(project) : [];
  const stores = storeNames.length > 0 ? t('liveOn', { stores: copy.list(storeNames) }) : null;
  const style = { '--pitch': `${pitch}px`, '--rows': ROWS } as CSSProperties;

  return (
    <div
      ref={wrapRef}
      className={css.chart}
      style={style}
      aria-hidden='true'
      onPointerMove={onPointerMove}
      onPointerLeave={event => {
        // A lifted finger "leaves" too: touch names clear on their own timer.
        if (event.pointerType === 'mouse') setHover(null);
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div ref={dotsRef} className={css.dots}>
        {CHART_PROJECTS.map((item, i) => (
          <span key={item.slug} className={css.dot}>
            <span className={css.dotInk} data-hover={hover === i ? '' : undefined} />
          </span>
        ))}
      </div>
      <div className={css.ticks} key={`${active}-${pitch}`}>
        {layout.ticks.map((tick, i) => (
          <span
            key={i}
            className={css.tick}
            data-dim={tick.isLit ? undefined : ''}
            style={{ transform: `translate3d(${tick.x}px, 0, 0) translateX(-50%)` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {project && hovered && group ? (
        <div ref={tipRef} className={css.tip}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- 1-4 KB pre-cropped WebP, no optimizer round trip
            <img
              key={project.slug}
              className={css.tipIcon}
              data-logo={isLogo ? '' : undefined}
              src={icon.src}
              alt=''
              width={iconWidth}
              height={iconHeight}
              decoding='async'
              draggable={false}
            />
          ) : null}
          <span className={css.tipText}>
            <strong>{describer.title(project)}</strong>
            <span>
              {describer.industry(project)} · {describer.location(project)}
            </span>
            {stores ? <span className={css.tipStores}>{stores}</span> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
