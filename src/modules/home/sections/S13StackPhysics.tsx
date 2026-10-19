'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, useGSAP } from '../global/gsap';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import KitPicker from './s13/KitPicker';
import { getRememberedKit, rememberKit, requestToolboxOpen, subscribeKitRequests } from './s13/kitStore';
import { layoutTower, PROBE_FS, type LayoutRegion, type TowerLayout } from './s13/layout';
import { COUNT_FLOOR, PROJECT_TOTAL, type StackLayer, type StackTool } from './s13/stack';
import { marketForLocale, type Kit, type KitId, type Toolbox as ToolboxData, type ToolboxTool } from './s13/stack-data';
import { REBUILD_DELAY_MS, StackStage, type StageState } from './s13/stage';
import { useScrollSpeed } from './s13/useScrollSpeed';
import { useStackWords } from './s13/useStackWords';
import { useTilt } from './s13/useTilt';
import Toolbox from './s13/Toolbox';
import css from './s13/stack.module.css';

/**
 * 17 · Stack Physics: "Your stack, or ours." One headline, one toy.
 *
 * "What are you building?" picks a kit (Telegram bot, mobile app, website,
 * AI on your documents, CRM): the tower is that product's core, real tools
 * in the four layers every product is built in, data at the bottom and
 * delivery on top. Picking another kit pulls the foundation, the tower falls,
 * the heap clears and the new one drops in, layer by layer. "Pull the
 * foundation" is the same fall on its own: the spec plate turns it into the
 * point (take one layer out and everything above it falls), then the tower
 * rebuilds itself. Blocks can be dragged, thrown, flicked with the cursor or
 * tipped by tilting the phone.
 *
 * Wide screens: the copy and the picker on the left, the tower fenced into
 * the right column (a heap never slides under the copy). Phones: the copy,
 * then the picker, plate and tower in one screen.
 *
 * Under the floor, the full toolbox is a drawer (s13/Toolbox.tsx): closed by
 * default, every tool in eight areas when opened, the same kit lit up.
 *
 * Blocks are DOM text moved by transforms; the engine sleeps when everything
 * rests and pauses offscreen. Reduced motion: the finished tower, read-only,
 * kits swap instantly. Low tier: the tower appears built (no drop, no fall on
 * a kit swap).
 */

const FLOOR_INSET = 18; // = --floor in stack.module.css
const SEED = 1313;
const WIDE = 900;
const FAST_SCROLL = 3; // px per ms: faster than this, the tower is simply there
/** The drop starts once about a third of the arena is on screen. */
const ARENA_TRIGGER = '0px 0px -32% 0px';
const LABEL_WIDTH = { wide: 168, narrow: 22 };
const LABEL_GAP = { wide: 20, narrow: 8 };
const RIPPLE_COUNT = 6;
const LAYER_LIT_MS = 1100;
/** A kit pick pulls the foundation; the tower falls this long before the heap clears. */
const SWITCH_FALL_MS = 620;
/** The heap fades out (CSS, = .list[data-clearing] in stack.module.css). */
const CLEAR_MS = 200;
/** Phones write a layer's name up its label column when the band is tall enough. */
const VERTICAL_CHAR_PX = 6.6;
const VERTICAL_PAD_PX = 10;
/** Tool names the bridge to the toolbox lists before "and N more". */
const EXTRAS_SHOWN = 6;

type Story = 'idle' | 'fall' | 'rebuild';

interface Frame {
  width: number;
  height: number;
}

interface PlacedLayout extends TowerLayout {
  key: string;
  isWide: boolean;
  floor: number;
  /** Knocks never throw a block above this line. */
  ceiling: number;
  fenceLeft: number;
  labelWidth: number;
  labelGap: number;
}

function toolsKey(tools: readonly StackTool[]): string {
  return tools.map(tool => tool.id).join('|');
}

function waitForFonts(display: string, mono: string, weight: number): Promise<void> {
  // Only the primary family: a metric fallback face that is missing on the
  // device makes the whole load() reject.
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return Promise.resolve();
  const primary = (family: string) => family.split(',')[0].trim();
  return Promise.allSettled([fonts.load(`${weight} 40px ${primary(display)}`), fonts.load(`500 12px ${primary(mono)}`)]).then(
    () => undefined
  );
}

/** The box the tower may stand in: the arena, less the layer labels on its left. */
function regionOf(root: HTMLElement, arena: HTMLElement, isWide: boolean): { region: LayoutRegion; floor: number; fenceLeft: number } {
  const rootBox = root.getBoundingClientRect();
  const box = arena.getBoundingClientRect();
  const left = box.left - rootBox.left;
  const floor = root.clientHeight - FLOOR_INSET;
  const labels = isWide ? LABEL_WIDTH.wide + LABEL_GAP.wide : LABEL_WIDTH.narrow + LABEL_GAP.narrow;
  return {
    floor,
    // Wide: the copy column is off limits to every block, thrown ones included.
    fenceLeft: isWide ? Math.max(0, left - 12) : 0,
    region: {
      left: left + labels,
      right: box.right - rootBox.left,
      top: box.top - rootBox.top + 8,
      floor,
      align: isWide ? 'end' : 'center',
    },
  };
}

export default function S13StackPhysics({ meta }: LabSectionProps) {
  const locale = useLocale();
  const market = marketForLocale(locale);
  const t = useTranslations('home.stack-physics');
  const { toolbox, layers, towerFor } = useStackWords(market);
  const theme = useLabTheme();
  const { tier, reducedMotion, isTouch } = useLabDevice();
  const rootRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const extrasRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const tileRefs = useRef<Array<HTMLLIElement | null>>([]);
  const faceRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const nameRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const flashRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const shakerRef = useRef<HTMLDivElement>(null);
  const rippleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stageRef = useRef<StackStage | null>(null);
  const hasBuiltRef = useRef(false);
  // Live inputs a freshly built stage must start from (it is rebuilt on a
  // kit pick, a style flip or a relayout).
  const gravityRef = useRef({ x: 0, y: 1 });
  const isTiltOnRef = useRef(false);
  const isVisibleRef = useRef(false);
  const stageStateRef = useRef<StageState>('tower');
  /** The next stage's entrance: 'build' after a kit pick, else decided on the spot. */
  const entranceRef = useRef<'auto' | 'build' | 'placed'>('auto');
  const switchTimerRef = useRef(0);
  const isSwitchingRef = useRef(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [layout, setLayout] = useState<PlacedLayout | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stageState, setStageState] = useState<StageState>('tower');
  const [story, setStory] = useState<Story>('idle');
  const storyRef = useRef<Story>('idle');
  const [hasEntered, setHasEntered] = useState(false);
  const accentRef = useRef(theme.colors.accent);
  // The chips show the pick at once; the tower follows when the old one has fallen.
  const [pickedKit, setPickedKit] = useState<KitId>(getRememberedKit);
  const pickedKitRef = useRef(pickedKit);
  const [towerKit, setTowerKit] = useState<KitId>(pickedKit);
  /** Bumped on every re-stack, so picking back the kit that stands still re-stacks it. */
  const [run, setRun] = useState(0);
  const [isSwitching, setIsSwitching] = useState(false);

  const isVisible = useInView(rootRef);
  const isArenaInView = useInView(arenaRef, ARENA_TRIGGER);
  if (isArenaInView && !hasEntered) setHasEntered(true);
  const scrollSpeed = useScrollSpeed();

  const isInteractive = !reducedMotion;
  const hasFlourish = isInteractive && tier !== 'low';
  const isArmed = reducedMotion || tier === 'low' || hasEntered;

  const kit: Kit = toolbox.kits.find(candidate => candidate.id === pickedKit) ?? toolbox.kits[0];
  const shownKit: Kit = toolbox.kits.find(candidate => candidate.id === towerKit) ?? kit;
  const tools = towerFor(towerKit);
  const pickedCount = towerFor(pickedKit).length;
  const key = toolsKey(tools);
  const placed = layout && layout.key === key ? layout : null;

  const onGravity = useCallback((x: number, y: number) => {
    gravityRef.current = { x, y };
    stageRef.current?.setGravity(x, y);
  }, []);
  const onShake = useCallback(() => stageRef.current?.shake(), []);
  const tilt = useTilt({ onGravity, onShake });
  const { turnOff: turnTiltOff } = tilt;

  useEffect(() => {
    accentRef.current = theme.colors.accent;
  }, [theme]);

  // The plate tells the story of a fall: what it means while the tower is
  // down, then "foundation first" while it rebuilds. A kit pick is not a
  // stress test: the plate stays on the new kit until its tower stands.
  const onStageState = useCallback((state: StageState) => {
    stageStateRef.current = state;
    setStageState(state);
    let next = storyRef.current;
    if (isSwitchingRef.current) {
      next = 'idle';
      if (state === 'tower') {
        isSwitchingRef.current = false;
        setIsSwitching(false);
      }
    } else if (state === 'falling' || state === 'resting') next = 'fall';
    else if (state === 'tower') next = 'idle';
    else if (next === 'fall') {
      // The rebuild takes the plate back from whatever block was last touched.
      next = 'rebuild';
      setActiveId(null);
    }
    storyRef.current = next;
    setStory(next);
  }, []);

  // A layer whose last block just landed: its guide lights up from the label to the tower's edge.
  const onLayerBuilt = useCallback((layerIndex: number) => {
    const root = rootRef.current;
    if (!root) return;
    const lit = root.querySelector<HTMLElement>(`[data-guide-lit='${layerIndex}']`);
    lit?.animate?.(
      [
        { transform: 'scaleX(0)', opacity: 1 },
        { transform: 'scaleX(1)', opacity: 1, offset: 0.45 },
        { transform: 'scaleX(1)', opacity: 0 },
      ],
      { duration: LAYER_LIT_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
    );
    const number = root.querySelector<HTMLElement>(`[data-layer-number='${layerIndex}']`);
    if (number?.animate) {
      const rest = getComputedStyle(number).color;
      number.animate([{ color: accentRef.current }, { color: accentRef.current, offset: 0.55 }, { color: rest }], {
        duration: LAYER_LIT_MS,
        easing: 'ease-out',
      });
    }
  }, []);

  /** Re-stack the tower for `next`: knocked down, cleared and dropped in again (or simply swapped). */
  const pickKit = useCallback(
    (next: KitId) => {
      if (next === pickedKitRef.current) return;
      pickedKitRef.current = next;
      rememberKit(next);
      setPickedKit(next);
      setActiveId(null);
      const stage = stageRef.current;
      const list = listRef.current;
      const canPlay = stage !== null && list !== null && isInteractive && tier !== 'low' && isVisibleRef.current;
      if (!canPlay) {
        // Nothing to watch (offscreen, reduced motion, low tier): the next tower simply stands there.
        window.clearTimeout(switchTimerRef.current);
        switchTimerRef.current = 0;
        list?.removeAttribute('data-clearing');
        isSwitchingRef.current = false;
        setIsSwitching(false);
        entranceRef.current = 'placed';
        setTowerKit(next);
        setRun(value => value + 1);
        return;
      }
      // A re-stack is already on its way: it picks up the latest kit when it lands.
      if (switchTimerRef.current) return;
      isSwitchingRef.current = true;
      setIsSwitching(true);
      const isStandingNow = stageStateRef.current === 'tower' || stageStateRef.current === 'building';
      if (isStandingNow) stage.knock();
      switchTimerRef.current = window.setTimeout(
        () => {
          list.dataset.clearing = 'true';
          switchTimerRef.current = window.setTimeout(() => {
            switchTimerRef.current = 0;
            entranceRef.current = 'build';
            setTowerKit(pickedKitRef.current);
            setRun(value => value + 1);
          }, CLEAR_MS);
        },
        isStandingNow ? SWITCH_FALL_MS : 0
      );
    },
    [isInteractive, tier]
  );

  useEffect(() => () => window.clearTimeout(switchTimerRef.current), []);

  // Another section asked for a kit ("Tools for this →").
  useEffect(() => subscribeKitRequests(pickKit), [pickKit]);

  useEffect(() => {
    isTiltOnRef.current = tilt.state === 'on';
    stageRef.current?.setAutoRebuild(tilt.state !== 'on');
  }, [tilt.state]);

  // Section size: any change lays the tower out again (the slots hang off
  // the floor line, so even a few pixels of height matter).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      const next = { width: root.clientWidth, height: root.clientHeight };
      setFrame(previous => (previous && previous.width === next.width && previous.height === next.height ? previous : next));
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Measure the names once fonts are in, then fit the tower to the arena.
  useEffect(() => {
    const root = rootRef.current;
    const arena = arenaRef.current;
    const list = listRef.current;
    if (!frame || !root || !arena || !list || tools.length === 0) return;
    let isCancelled = false;
    void waitForFonts(theme.fontFamily.display, theme.fontFamily.mono, theme.type.displayWeight).then(() => {
      if (isCancelled) return;
      list.style.setProperty('--fs', `${PROBE_FS}px`);
      const textWidths = tools.map((_, index) => nameRefs.current[index]?.offsetWidth ?? 0);
      if (textWidths.some(width => width === 0)) return;
      const isWide = root.clientWidth >= WIDE;
      const { region, floor, fenceLeft } = regionOf(root, arena, isWide);
      const benchHeight = floor - region.top;
      const next = layoutTower({
        region,
        layerOf: tools.map(tool => tool.layerIndex),
        textWidths,
        // Phones: as big as the width allows (14px is the floor).
        fontRange: isWide ? [18, 46] : [14, Math.round(Math.min(34, Math.max(22, root.clientWidth * 0.068)))],
        // The collapsed heap must fit the fenced column beside the copy.
        // Boxed in (phones) it collapses onto its own footprint and is never taller than it stood.
        areaBudget: isWide ? (region.right - fenceLeft) * benchHeight * 0.46 : Infinity,
        maxHeightShare: isWide ? 0.86 : 0.96,
        maxStretch: isWide ? 1.12 : 1.3,
      });
      if (!next) return;
      list.style.setProperty('--fs', `${next.fs}px`);
      setLayout({
        ...next,
        key: toolsKey(tools),
        isWide,
        floor,
        ceiling: region.top,
        fenceLeft,
        labelWidth: isWide ? LABEL_WIDTH.wide : LABEL_WIDTH.narrow,
        labelGap: isWide ? LABEL_GAP.wide : LABEL_GAP.narrow,
      });
    });
    return () => {
      isCancelled = true;
    };
  }, [frame, tools, theme]);

  // The bridge to the toolbox only shows where the copy column has room for it (never under the floor).
  useLayoutEffect(() => {
    const copy = copyRef.current;
    const extras = extrasRef.current;
    if (!frame || !copy || !extras) return;
    let isCancelled = false;
    const measure = () => {
      if (isCancelled) return;
      delete extras.dataset.fits;
      if (getComputedStyle(extras).display === 'none') return;
      extras.dataset.fits = copy.scrollHeight <= copy.clientHeight + 1 ? 'true' : 'false';
    };
    measure();
    // A style flip swaps the faces: measure again once they are in.
    void document.fonts?.ready.then(measure);
    return () => {
      isCancelled = true;
    };
  }, [frame, pickedKit, theme]);

  // The physics stage: built once the layout is known and, for the animated
  // drop, once the arena is actually on screen. A kit pick (run) builds a new one.
  useEffect(() => {
    const root = rootRef.current;
    const list = listRef.current;
    if (!placed || !root || !list || !isArmed) return;
    const count = placed.slots.length;
    const tiles = tileRefs.current.slice(0, count).filter((tile): tile is HTMLLIElement => tile !== null);
    const faces = faceRefs.current.slice(0, count).filter((face): face is HTMLSpanElement => face !== null);
    if (tiles.length !== count || faces.length !== count) return;
    const canDrop = isInteractive && tier !== 'low';
    const wanted = entranceRef.current;
    entranceRef.current = 'auto';
    const isFirstShow = !hasBuiltRef.current && scrollSpeed() < FAST_SCROLL;
    const entrance = canDrop && (wanted === 'build' || (wanted === 'auto' && isFirstShow)) ? 'build' : 'placed';
    let stage: StackStage | null = null;
    const build = () => {
      stage = new StackStage({
        root,
        list,
        tiles,
        faces,
        flashes: flashRefs.current.slice(0, count),
        ripples: rippleRefs.current.filter((ripple): ripple is HTMLSpanElement => ripple !== null),
        shaker: shakerRef.current,
        layout: placed,
        floor: placed.floor,
        ceiling: placed.ceiling,
        fenceLeft: placed.fenceLeft,
        entrance,
        timing: placed.isWide ? { maxDrop: 260, rowDelayMs: 150, colDelayMs: 50 } : { maxDrop: 190, rowDelayMs: 130, colDelayMs: 45 },
        seed: SEED + run,
        isInteractive,
        hasFlourish,
        onActive: index => setActiveId(placed.key.split('|')[index] ?? null),
        onState: onStageState,
        onLayerBuilt,
      });
      hasBuiltRef.current = true;
      stageRef.current = stage;
      stage.setGravity(gravityRef.current.x, gravityRef.current.y);
      stage.setAutoRebuild(!isTiltOnRef.current);
      stage.setVisible(isVisibleRef.current);
      // The new tower is placed (or parked above its slots): the cleared heap may show again.
      list.removeAttribute('data-clearing');
    };
    // Placed a frame after the tiles took their slot sizes, never in the same frame: sized and
    // moved on screen at once, the blocks' text counted as a layout shift (CLS) when the section
    // mounted mid-scroll. Sized while still parked off screen, then moved by transform only, it does not.
    let frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(build);
    });
    return () => {
      cancelAnimationFrame(frameId);
      const built = stage as StackStage | null;
      built?.dispose();
      if (built && stageRef.current === built) stageRef.current = null;
      tiles.forEach(tile => {
        tile.style.transform = '';
        tile.style.opacity = '';
      });
    };
  }, [placed, run, isArmed, isInteractive, hasFlourish, tier, scrollSpeed, onStageState, onLayerBuilt]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
    stageRef.current?.setVisible(isVisible);
    // Sensors off once the section is gone: a phone in a pocket never keeps the engine awake.
    if (!isVisible) turnTiltOff();
  }, [isVisible, turnTiltOff]);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || reducedMotion) return;
      // Separate tweens on one trigger config (never a `once` timeline: see the lab README).
      const trigger = { trigger: root, start: 'top 72%', once: true };
      gsap.from(root.querySelectorAll('[data-line]'), {
        yPercent: 105,
        duration: 1.15,
        ease: 'expo.out',
        stagger: 0.09,
        scrollTrigger: trigger,
      });
      gsap.from(root.querySelectorAll('[data-reveal]'), {
        y: 22,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.07,
        delay: 0.2,
        scrollTrigger: trigger,
      });
    },
    { scope: rootRef, dependencies: [reducedMotion] }
  );

  const activeTool = tools.find(tool => tool.id === activeId);
  const activeLayer = activeTool ? layers[activeTool.layerIndex] : undefined;
  const isStanding = isSwitching || stageState === 'tower' || stageState === 'building';
  const tiltLabel = tilt.state === 'on' ? t('tiltOn') : tilt.state === 'blocked' ? t('tiltBlocked') : t('tilt');
  const plateInput: Omit<PlateInput, 'tool' | 'layer' | 'story'> = {
    kit,
    tag: t('plateTag', { kit: kit.label, layers: layers.length, tools: pickedCount }),
    blurb: isInteractive ? t('plateIdle', { top: kit.top }) : t('plateIdleStatic', { top: kit.top }),
    words: {
      stat: (count, total) => t('plateStat', { count, total }),
      fall: { tag: t('story.fallTag'), name: t('story.fallName'), blurb: t('story.fallBlurb') },
      rebuild: { tag: t('story.rebuildTag'), name: t('story.rebuildName'), blurb: t('story.rebuildBlurb') },
    },
  };
  const plate = plateContent({ ...plateInput, tool: activeTool, layer: activeLayer, story });
  const plateGhosts = isInteractive
    ? PLATE_STORIES.map(ghostStory => plateContent({ ...plateInput, tool: undefined, layer: undefined, story: ghostStory }))
    : [];
  const kitsLabelId = `${meta.id}-kits`;
  const extras = kitExtras(toolbox, kit, towerFor(pickedKit));
  const titleLines = [t('titleLines.first'), t('titleLines.second')];

  const onPrimary = () => {
    const stage = stageRef.current;
    if (!stage || isSwitchingRef.current) return;
    setActiveId(null);
    if (isStanding) stage.knock();
    else stage.rebuild();
  };

  return (
    <>
      <div ref={rootRef} className={css.root} data-static={isInteractive ? undefined : 'true'}>
        <div className={css.grid} aria-hidden='true' />

        <div ref={copyRef} className={css.copy}>
          <header className={css.head}>
            <p className={css.kicker} data-reveal=''>
              {t('kicker')}
            </p>
            <SectionHeading meta={meta} className={css.title}>
              {titleLines.map((line, index) => (
                <span key={line} className={css.titleLine}>
                  <span data-line='' className={index === titleLines.length - 1 ? css.titleAccent : undefined}>
                    {line}
                  </span>
                </span>
              ))}
            </SectionHeading>
            <p className={css.lead} data-reveal=''>
              {t('summary')}
            </p>
          </header>

          <div className={css.panel}>
            <p id={kitsLabelId} className={css.kitsLabel} data-reveal=''>
              {t('kitsLabel')}
            </p>
            <div className={css.kits} data-reveal=''>
              <KitPicker
                kits={toolbox.kits}
                value={pickedKit}
                onPick={pickKit}
                labelledBy={kitsLabelId}
                name='stack-kits'
                reducedMotion={reducedMotion}
                cursorLabel={isInteractive ? t('kitCursor') : undefined}
              />
            </div>

            <div className={css.plate} aria-hidden='true' data-story={activeTool ? undefined : story} data-reveal=''>
              <PlateBody key={plate.key} plate={plate} className={css.plateBody} />
              {/* Phones: every story's text in the same cell, unseen, so the plate is as tall as its
                  longest story and a knock never changes the stage's height (a height change
                  re-lays the tower out and would stand it up again mid-fall). */}
              {plateGhosts.map(ghost => (
                <PlateBody key={`ghost-${ghost.key}`} plate={ghost} className={css.plateGhost} />
              ))}
            </div>

            {isInteractive && (
              <div className={css.controls} data-reveal=''>
                <button
                  type='button'
                  className={`${css.button} ${css.primary}`}
                  onClick={onPrimary}
                  aria-disabled={isSwitching || undefined}
                  data-magnetic=''
                >
                  {isStanding ? <KnockIcon /> : <RebuildIcon />}
                  <span className={css.swap}>
                    <span data-shown={isStanding}>{t('knock')}</span>
                    <span data-shown={!isStanding}>{t('rebuild')}</span>
                  </span>
                  {stageState === 'resting' && !isSwitching && (
                    <span
                      className={css.countdown}
                      style={{ '--rebuild-ms': `${REBUILD_DELAY_MS}ms` } as CSSProperties}
                      aria-hidden='true'
                    />
                  )}
                </button>
                {isTouch && tilt.isSupported && (
                  <button
                    type='button'
                    className={css.button}
                    aria-pressed={tilt.state === 'on'}
                    disabled={tilt.state === 'blocked'}
                    onClick={tilt.toggle}
                  >
                    <TiltIcon />
                    {tiltLabel}
                  </button>
                )}
              </div>
            )}
            <div ref={extrasRef} className={css.extras} data-reveal=''>
              <p className={css.extrasLabel}>{t('extrasLabel', { forSubject: kit.forSubject })}</p>
              <p key={kit.id} className={css.extrasList}>
                {extras.slice(0, EXTRAS_SHOWN).map(tool => (
                  <span key={tool.id}>{tool.label}</span>
                ))}
                {extras.length > EXTRAS_SHOWN && (
                  <span className={css.extrasMore}>{t('extrasMore', { count: extras.length - EXTRAS_SHOWN })}</span>
                )}
              </p>
              <button type='button' className={css.extrasOpen} onClick={requestToolboxOpen}>
                {t('extrasOpen', { total: toolbox.total })}
                <span aria-hidden='true'>↓</span>
              </button>
            </div>
            <p className={css.srOnly} aria-live='polite'>
              {t('status', { subject: kit.subject, tools: pickedCount, layers: layers.length })}
            </p>
          </div>
        </div>

        <div ref={arenaRef} className={css.arena} aria-hidden='true' />

        {/* Everything that moves with the blocks (and thuds when they land); the copy never does. */}
        <div ref={shakerRef} className={css.stage}>
          <div className={css.floor} aria-hidden='true' />
          <div className={css.ripples} aria-hidden='true'>
            {Array.from({ length: RIPPLE_COUNT }, (_, index) => (
              <span
                key={index}
                ref={element => {
                  rippleRefs.current[index] = element;
                }}
                className={css.ripple}
              />
            ))}
          </div>

          {placed && <Blueprint layout={placed} layers={layers} activeLayer={activeTool?.layerIndex ?? null} />}

          <ul ref={listRef} className={css.list} aria-label={t('listLabel', { subject: shownKit.subject })}>
            {tools.map((tool, index) => {
              const slot = placed?.slots[index];
              return (
                <li
                  key={tool.id}
                  ref={element => {
                    tileRefs.current[index] = element;
                  }}
                  className={css.tile}
                  data-tile={index}
                  data-layer={tool.layerIndex}
                  data-active={activeId === tool.id ? 'true' : undefined}
                  data-cursor={isInteractive ? t('pullCursor') : undefined}
                  style={slot ? { width: slot.width, height: slot.height } : undefined}
                >
                  <span
                    ref={element => {
                      faceRefs.current[index] = element;
                    }}
                    className={css.face}
                  >
                    <span
                      ref={element => {
                        nameRefs.current[index] = element;
                      }}
                      className={css.name}
                    >
                      {tool.label}
                    </span>
                    <span className={css.srOnly}>
                      {' — '}
                      {t('toolDescription', { layer: layers[tool.layerIndex].name, blurb: tool.blurb })}
                    </span>
                  </span>
                  <span
                    ref={element => {
                      flashRefs.current[index] = element;
                    }}
                    className={css.flash}
                    aria-hidden='true'
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <Toolbox
        headingId={`${meta.id}-toolbox-heading`}
        toolbox={toolbox}
        kitId={pickedKit}
        onPickKit={pickKit}
        tier={tier}
        reducedMotion={reducedMotion}
        isTouch={isTouch}
      />
    </>
  );
}

/** The kit's tools the tower has no room for, in toolbox order (the tower's own names left out). */
function kitExtras(toolbox: ToolboxData, kit: Kit, tower: readonly StackTool[]): readonly ToolboxTool[] {
  const inTower = new Set(tower.map(tool => tool.label.toLowerCase()));
  // "Tailwind CSS" and "Anthropic Claude" are the tower's "Tailwind" and "Claude" by another name.
  const isInTower = (label: string) => {
    const name = label.toLowerCase();
    return inTower.has(name) || name.split(/\s+/).some(word => inTower.has(word));
  };
  return toolbox.trades.flatMap(trade => trade.tools).filter(tool => kit.tools.has(tool.id) && !isInTower(tool.label));
}

interface StoryWords {
  tag: string;
  name: string;
  blurb: string;
}

interface PlateInput {
  tool: StackTool | undefined;
  layer: StackLayer | undefined;
  story: Story;
  kit: Kit;
  tag: string;
  blurb: string;
  words: { stat: (count: number, total: number) => string; fall: StoryWords; rebuild: StoryWords };
}

interface PlateContent {
  key: string;
  tag: string;
  stat: string | null;
  name: string;
  blurb: string;
}

/** Every story the plate can tell without a selected block (its reserved height on phones). */
const PLATE_STORIES: readonly Story[] = ['idle', 'fall', 'rebuild'];

function PlateBody({ plate, className }: { plate: PlateContent; className: string }) {
  return (
    <div className={className}>
      <div className={css.plateTag}>
        <span>{plate.tag}</span>
        {plate.stat && <span className={css.plateStat}>{plate.stat}</span>}
      </div>
      <div className={css.plateName}>{plate.name}</div>
      <p className={css.plateBlurb}>{plate.blurb}</p>
    </div>
  );
}

/** What the spec plate says: the selected block, else the story of a fall, else what the kit is for. */
function plateContent({ tool, layer, story, kit, tag, blurb, words }: PlateInput): PlateContent {
  if (tool && layer) {
    return {
      key: tool.id,
      tag: `${layer.number} · ${layer.name}`,
      // Small counts say less about a tool than its job does: they stay off screen.
      stat: tool.count >= COUNT_FLOOR ? words.stat(tool.count, PROJECT_TOTAL) : null,
      name: tool.label,
      blurb: tool.blurb,
    };
  }
  if (story === 'fall') {
    return { key: 'fall', stat: null, ...words.fall };
  }
  if (story === 'rebuild') {
    return { key: 'rebuild', stat: null, ...words.rebuild };
  }
  return { key: `idle-${kit.id}`, tag, stat: null, name: kit.headline, blurb };
}

interface BlueprintProps {
  layout: PlacedLayout;
  layers: readonly StackLayer[];
  activeLayer: number | null;
}

/** The dashed plan under the tower: one outline per slot, one label per layer. */
function Blueprint({ layout, layers, activeLayer }: BlueprintProps) {
  const { tower, labelWidth, labelGap, isWide } = layout;
  const labelLeft = tower.left - labelGap - labelWidth;
  return (
    <div className={css.blueprint} aria-hidden='true'>
      {layout.layers.map(band => (
        <span
          key={`guide-${band.layerIndex}`}
          className={css.guide}
          style={{ left: labelLeft, top: band.top, width: tower.left + tower.width - labelLeft }}
        >
          <span className={css.guideLit} data-guide-lit={band.layerIndex} />
        </span>
      ))}
      {layout.layers.map(band => {
        const layer = layers[band.layerIndex];
        const height = band.bottom - band.top;
        // Phones: the name runs up the narrow column when the band is tall enough, else the number.
        const isNameUp = !isWide && height >= layer.name.length * VERTICAL_CHAR_PX + VERTICAL_PAD_PX;
        return (
          <span
            key={`label-${band.layerIndex}`}
            className={css.layerLabel}
            data-active={activeLayer === band.layerIndex ? 'true' : undefined}
            data-up={isNameUp ? 'true' : undefined}
            style={{ left: labelLeft, top: band.top, width: labelWidth, height }}
          >
            {isWide ? (
              <>
                <span>
                  <span className={css.layerNumber} data-layer-number={band.layerIndex}>
                    {layer.number}
                  </span>
                  {` · ${layer.name}`}
                </span>
                <span className={css.layerRole}>{layer.role}</span>
              </>
            ) : (
              <span className={css.layerNumber} data-layer-number={band.layerIndex}>
                {isNameUp ? layer.name : layer.number}
              </span>
            )}
          </span>
        );
      })}
      {layout.slots.map(slot => (
        <span
          key={`slot-${slot.index}`}
          className={css.slot}
          style={{
            left: slot.x - slot.width / 2 + 1.5,
            top: slot.y - slot.height / 2 + 1.5,
            width: slot.width - 3,
            height: slot.height - 3,
          }}
        />
      ))}
    </div>
  );
}

function KnockIcon() {
  return (
    <svg
      className={css.icon}
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <rect x='2' y='10' width='6' height='4' />
      <rect x='8.6' y='10' width='5.4' height='4' />
      <rect x='6.2' y='3.4' width='6' height='4' transform='rotate(24 9.2 5.4)' />
    </svg>
  );
}

function RebuildIcon() {
  return (
    <svg
      className={css.icon}
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d='M13.2 6.2A5.4 5.4 0 1 0 13.6 9.8' />
      <path d='M13.6 2.8v3.6H10' />
    </svg>
  );
}

function TiltIcon() {
  return (
    <svg
      className={css.icon}
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      aria-hidden='true'
    >
      <rect x='4.5' y='2' width='7' height='12' rx='1.4' transform='rotate(18 8 8)' />
      <path d='M1.5 12.5a7 7 0 0 1 2-6' />
    </svg>
  );
}
