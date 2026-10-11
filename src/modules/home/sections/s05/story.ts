/**
 * What the preview shows for a given frame: how far each element is filled
 * in (0 = wireframe, 1 = real), the scripted pointer, which element the
 * inspector frames, the caption and the closing "ship" move. Pure; the
 * engine writes the result to the DOM.
 */
import type { UiText } from './source';
import { anchorRange, phase, rangeProgress, type CodeModel, type Frame } from './timeline';

export type ElementKey = 'main' | 'card' | 'btn' | 'toggle' | 'chart';

/** Tag shown on the inspector for each element (what the code calls it). */
export const ELEMENT_TAG: Record<ElementKey, string> = {
  main: '<main>',
  card: '<Card>',
  btn: '<Button>',
  toggle: '<Toggle>',
  chart: '<Bars>',
};

type Range = readonly [number, number];

export interface StoryAnchors {
  main: Range;
  title: Range;
  media: Range;
  badge: Range;
  btn: Range;
  btnLabel: Range;
  toggle: Range;
  toggleLabel: Range;
  chartTitle: Range;
  chartData: Range;
  /** Line spans [first, last] the inspector frames each element for. */
  lines: Record<ElementKey, readonly [number, number]>;
}

function lineIndex(model: CodeModel, needle: string, from = 0): number {
  for (let i = from; i < model.lines.length; i++) if (model.lines[i].includes(needle)) return i;
  return -1;
}

export function buildAnchors(model: CodeModel, uiText: UiText): StoryAnchors {
  const a = (needle: string) => anchorRange(model, needle, model.firstTypedLine);
  const at = {
    main: lineIndex(model, '<main'),
    card: lineIndex(model, '<Card'),
    btn: lineIndex(model, '<Button'),
    toggle: lineIndex(model, '<Toggle'),
    chart: lineIndex(model, '<Bars'),
    end: lineIndex(model, '</main>'),
  };
  return {
    main: a('<main data-dark={dark}>'),
    title: a('title={app.kind}'),
    media: a('video={app.video}'),
    badge: a('playing={playing}'),
    btn: a('onClick={() => play(true)}>'),
    btnLabel: a(uiText.button),
    toggle: a('on={dark} onChange={setDark}>'),
    toggleLabel: a(uiText.toggle),
    chartTitle: a(`title="${uiText.chartTitle}"`),
    chartData: a('data={platforms}'),
    lines: {
      main: [at.main, at.card - 1],
      card: [at.card, at.btn - 1],
      btn: [at.btn, at.toggle - 1],
      toggle: [at.toggle, at.chart - 1],
      chart: [at.chart, at.end - 1],
    },
  };
}

/** How real each part of the preview is, 0..1. */
export interface Amounts {
  main: number;
  title: number;
  media: number;
  /** The play badge on the card (typed, then gone once it plays). */
  badge: number;
  /** The card's last prop is in: its wireframe can go. */
  card: number;
  btn: number;
  btnLabel: number;
  hover: number;
  press: number;
  toggle: number;
  toggleLabel: number;
  chartTitle: number;
  chartData: number;
}

export type CaptionId = 'ready' | 'main' | 'card' | 'btn' | 'press' | 'toggle' | 'flip' | 'chart' | 'ship';

/** Caption → the numbered step it belongs to (0 = before the first step). */
export const CAPTION_STEP: Record<CaptionId, number> = {
  ready: 0,
  main: 1,
  card: 2,
  btn: 3,
  press: 3,
  toggle: 4,
  flip: 4,
  chart: 5,
  ship: 6,
};
export const STEP_COUNT = 6;

export interface StoryState {
  amounts: Amounts;
  /** Per-bar growth 0..1 (staggered). */
  bars: [number, number, number];
  /** Fill of each numbered step's progress segment, 0..1. */
  steps: number[];
  caption: CaptionId;
  /** Element the inspector frames, or null. */
  active: ElementKey | null;
  /** Scripted pointer: which target, travel 0..1, drift away after the click, visibility, press. */
  pointer: { target: 'btn' | 'toggle'; travel: number; leave: number; opacity: number; press: number };
  /** Scripted part of the theme flip: knob 0..1, reveal 0..1. */
  knob: number;
  flip: number;
  /** The closing move: the editor steps back and the product comes forward, 0..1. */
  ship: number;
  /** A light sweep across the finished product, 0..1. */
  sheen: number;
  /** The compile pass down the editor, 0..1. */
  scan: number;
  /** The scripted click on "Watch it run" has happened. */
  isPlaying: boolean;
  /** Toggle / button exist on screen (user input allowed). */
  hasToggle: boolean;
  hasButton: boolean;
  isDone: boolean;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function captionAt(model: CodeModel, anchors: StoryAnchors, frame: Frame, isDone: boolean): CaptionId {
  const { n, pause } = frame;
  if (isDone || pause.ship > 0) return 'ship';
  if (n > anchors.chartTitle[0] - 4 || pause.flip >= 1) return 'chart';
  if (pause.flip > 0.12) return 'flip';
  if (n > anchors.toggle[0] - 10) return 'toggle';
  if (pause.press > 0.1) return 'press';
  if (n > anchors.btn[0] - 10) return 'btn';
  if (n > anchors.main[1] + 1) return 'card';
  if (n > model.prefilled) return 'main';
  return 'ready';
}

export function storyAt(model: CodeModel, anchors: StoryAnchors, frame: Frame): StoryState {
  const { n, line, pause } = frame;
  const r = (range: Range) => rangeProgress(n, range);

  const press = pause.press;
  const flipT = pause.flip;
  const barsT = 0.55 * r(anchors.chartData) + 0.45 * pause.bars;
  const bars: [number, number, number] = [phase(barsT, 0, 0.7), phase(barsT, 0.15, 0.85), phase(barsT, 0.3, 1)];
  const isDone = n >= model.total;

  const badgeTyped = r(anchors.badge);
  const amounts: Amounts = {
    main: r(anchors.main),
    title: r(anchors.title),
    media: r(anchors.media),
    badge: badgeTyped * (1 - phase(press, 0.58, 0.7)),
    card: badgeTyped,
    btn: r(anchors.btn),
    btnLabel: r(anchors.btnLabel),
    hover: phase(press, 0.24, 0.4) * (1 - phase(press, 0.84, 1)),
    press: phase(press, 0.5, 0.57) * (1 - phase(press, 0.6, 0.7)),
    toggle: r(anchors.toggle),
    toggleLabel: r(anchors.toggleLabel),
    chartTitle: r(anchors.chartTitle),
    chartData: r(anchors.chartData),
  };

  const ship = easeInOutCubic(phase(pause.ship, 0, 0.62));
  const steps = [
    amounts.main,
    rangeProgress(n, [anchors.main[1], anchors.badge[1]]),
    0.5 * rangeProgress(n, [anchors.btn[0], anchors.btnLabel[1]]) + 0.5 * press,
    0.4 * rangeProgress(n, [anchors.toggle[0], anchors.toggleLabel[1]]) + 0.6 * flipT,
    0.6 * rangeProgress(n, [anchors.chartTitle[0], anchors.chartData[1]]) + 0.4 * pause.bars,
    isDone ? phase(pause.ship, 0, 0.62) * 0.8 + 0.2 : 0,
  ];

  let active: ElementKey | null = null;
  for (const key of Object.keys(anchors.lines) as ElementKey[]) {
    const [first, last] = anchors.lines[key];
    if (line >= first && line <= last) active = key;
  }
  if (active === 'toggle' && flipT > 0.3) active = null;
  if (isDone) active = null;

  const isFlipLeg = flipT > 0;
  const pointer = isFlipLeg
    ? {
        target: 'toggle' as const,
        travel: phase(flipT, 0, 0.3),
        leave: phase(flipT, 0.5, 0.9),
        opacity: phase(flipT, 0, 0.08) * (1 - phase(flipT, 0.84, 0.98)),
        press: phase(flipT, 0.31, 0.36) * (1 - phase(flipT, 0.39, 0.48)),
      }
    : {
        target: 'btn' as const,
        travel: phase(press, 0, 0.36),
        leave: phase(press, 0.72, 0.96),
        opacity: phase(press, 0, 0.1) * (1 - phase(press, 0.86, 1)),
        press: amounts.press,
      };

  return {
    amounts,
    bars,
    steps,
    caption: captionAt(model, anchors, frame, isDone),
    active,
    pointer,
    knob: phase(flipT, 0.34, 0.46),
    flip: phase(flipT, 0.4, 0.9),
    ship,
    sheen: phase(pause.ship, 0.45, 0.95),
    scan: phase(pause.ship, 0, 0.38),
    isPlaying: press >= 0.6,
    hasToggle: amounts.toggle >= 1,
    hasButton: amounts.btn >= 1,
    isDone,
  };
}
