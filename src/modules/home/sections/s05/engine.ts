/**
 * Imperative DOM driver for the Code → UI section. React renders the markup
 * once; scroll progress flows in through `render(p)` and only the nodes whose
 * value changed are written, straight onto the elements that use them
 * (transform/opacity; never a custom property on a shared ancestor, which
 * would restyle the whole stage every frame). A gsap.ticker callback (only
 * while visible) eases the inspector frame, the editor's auto-scroll and the
 * wire between the caret and the preview.
 */
import { gsap } from '../../global/gsap';
import { FX_KEYS, fxAt, type FxKey, type FxStyle } from './fx';
import {
  CAPTION_STEP,
  ELEMENT_TAG,
  STEP_COUNT,
  buildAnchors,
  storyAt,
  type CaptionId,
  type ElementKey,
  type StoryAnchors,
  type StoryState,
} from './story';
import { frameAt, staticFrame, type CodeModel } from './timeline';
import type { UiText } from './source';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Styled = HTMLElement | SVGElement;
type StyleProp = 'transform' | 'opacity' | 'visibility';

const ZERO: Box = { x: 0, y: 0, w: 0, h: 0 };
/** Code font: phones never go below 11px (legibility), desktops top out at 15px. */
const MIN_FONT = 11;
const MAX_FONT = 15;
const LINE_HEIGHT = 1.72;
const STATIC_LINE_HEIGHT = 1.55;
const CARET_ZONE = 0.78;
/** Inspector label: height + gap to the frame edge. */
const TAG_H = 15;
const TAG_GAP = 2;
const TYPING_IDLE_MS = 520;
const EASE_RATE = 14;
/** px per ms the wire's dots travel while the caret is typing. */
const WIRE_FLOW_SPEED = 0.03;
/** The product's step forward at the end: how much the finished screen grows (wide layouts). */
const SHIP_MAX_SCALE = 1.16;
/** Inspector frames sit this far outside their element. */
const FRAME_PAD = 4;
const PING_MS = 720;
const MAX_PING_STEP = 0.08;
const HMR_MS = 900;

/** Offset of `el` inside `ancestor`, from layout (transforms ignored). */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): Box {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

const q = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => root.querySelector<T>(selector);
const qa = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => Array.from(root.querySelectorAll<T>(selector));

type ElBoxKey = ElementKey | 'media' | 'switch' | 'knob';

interface Nodes {
  editor: HTMLElement;
  scan: HTMLElement | null;
  editorSlot: HTMLElement;
  viewport: HTMLElement;
  lines: HTMLElement;
  rows: HTMLElement[];
  codes: HTMLElement[];
  caret: HTMLElement;
  lnCol: HTMLElement;
  probe: HTMLElement;
  slot: HTMLElement;
  lift: HTMLElement;
  pane: HTMLElement;
  reveal: HTMLElement;
  revealInner: HTMLElement;
  els: Record<ElBoxKey, HTMLElement>;
  fx: Record<FxKey, Styled[]>;
  /** The rendered screen in both layers (it grows at the end). */
  mains: HTMLElement[];
  bars: HTMLElement[];
  counts: HTMLElement[];
  hmr: HTMLElement[];
  media: HTMLElement;
  mediaInner: HTMLElement;
  badge: HTMLElement;
  pointer: HTMLElement;
  ripple: HTMLElement | null;
  tap: Styled | null;
  insp: HTMLElement;
  inspName: HTMLElement;
  inspSize: HTMLElement;
  edges: HTMLElement[];
  handles: HTMLElement[];
  inspTag: HTMLElement;
  ping: HTMLElement;
  caption: HTMLElement | null;
  capLines: HTMLElement[];
  capStep: HTMLElement | null;
  capSegs: HTMLElement[];
  wire: SVGPathElement | null;
  wireDots: SVGElement[];
}

function collect(stage: HTMLElement): Nodes | null {
  const layerA = q(stage, '[data-layer="a"]');
  if (!layerA) return null;
  const el = (key: string) => q(layerA, `[data-el="${key}"]`);
  const required = {
    editor: q(stage, '[data-editor]'),
    editorSlot: q(stage, '[data-editor-slot]'),
    viewport: q(stage, '[data-viewport]'),
    lines: q(stage, '[data-lines]'),
    caret: q(stage, '[data-caret]'),
    lnCol: q(stage, '[data-lncol]'),
    probe: q(stage, '[data-probe]'),
    slot: q(stage, '[data-slot]'),
    lift: q(stage, '[data-lift]'),
    pane: q(stage, '[data-pane]'),
    reveal: q(stage, '[data-reveal]'),
    revealInner: q(stage, '[data-reveal-inner]'),
    media: q(stage, '[data-media]'),
    mediaInner: q(stage, '[data-media-inner]'),
    badge: q(stage, '[data-badge]'),
    pointer: q(stage, '[data-pointer]'),
    insp: q(stage, '[data-insp]'),
    inspName: q(stage, '[data-insp-name]'),
    inspSize: q(stage, '[data-insp-size]'),
    inspTag: q(stage, '[data-insp-tag]'),
    ping: q(stage, '[data-ping]'),
    main: el('main'),
    card: el('card'),
    btn: el('btn'),
    chart: el('chart'),
    toggle: el('toggle'),
    mediaSlot: el('media'),
    switch: el('switch'),
    knob: el('knob'),
  };
  if (Object.values(required).some(node => !node)) return null;
  const r = required as { [K in keyof typeof required]: HTMLElement };
  const rows = qa(stage, '[data-row]');
  const fx = Object.fromEntries(FX_KEYS.map(key => [key, qa<HTMLElement>(stage, `[data-fx="${key}"]`)])) as Record<FxKey, Styled[]>;
  const caption = q(stage, '[data-caption]');
  return {
    editor: r.editor,
    scan: q(stage, '[data-scan]'),
    editorSlot: r.editorSlot,
    viewport: r.viewport,
    lines: r.lines,
    rows,
    codes: rows.map(row => q(row, '[data-code]') ?? row),
    caret: r.caret,
    lnCol: r.lnCol,
    probe: r.probe,
    slot: r.slot,
    lift: r.lift,
    pane: r.pane,
    reveal: r.reveal,
    revealInner: r.revealInner,
    els: { main: r.main, card: r.card, btn: r.btn, chart: r.chart, toggle: r.toggle, media: r.mediaSlot, switch: r.switch, knob: r.knob },
    fx,
    mains: qa(stage, '[data-el="main"]'),
    bars: qa(stage, '[data-bar]'),
    counts: qa(stage, '[data-count]'),
    hmr: qa(stage, '[data-hmr]'),
    media: r.media,
    mediaInner: r.mediaInner,
    badge: r.badge,
    pointer: r.pointer,
    ripple: q(r.pointer, '[data-ripple]'),
    tap: q<SVGElement>(r.pointer, '[data-tap]'),
    insp: r.insp,
    inspName: r.inspName,
    inspSize: r.inspSize,
    edges: qa(r.insp, '[data-edge]'),
    handles: qa(r.insp, '[data-handle]'),
    inspTag: r.inspTag,
    ping: r.ping,
    caption,
    capLines: caption ? qa(caption, '[data-cap-line]') : [],
    capStep: caption ? q(caption, '[data-cap-step]') : null,
    capSegs: caption ? qa(caption, '[data-cap-seg]') : [],
    wire: q<SVGPathElement>(stage, '[data-wire-path]'),
    wireDots: qa<SVGElement>(stage, '[data-wire-dot]'),
  };
}

export interface EngineOptions {
  model: CodeModel;
  /** The UI strings the code types (the anchors find them in the model). */
  uiText: UiText;
  startsDark: boolean;
  /** Bar values (count / max) in display order. */
  barRatios: readonly number[];
  barCounts: readonly number[];
  /** Reduced motion: the finished file and screen, nothing performed. */
  isStatic: boolean;
  /** Plain-English line for each caption id (the static one is used under reduced motion). */
  captions: Record<CaptionId, string>;
  staticCaptions: { row: string; stack: string };
  onPlayingChange: (isPlaying: boolean) => void;
  /** The preview's theme crossed the halfway point of the flip. */
  onFlipChange: (isFlipped: boolean) => void;
}

interface Layout {
  fontSize: number;
  lineHeight: number;
  chPx: number;
  gutterCols: number;
  viewH: number;
  viewW: number;
  padTop: number;
  isRow: boolean;
  stage: Box;
  editor: Box;
  viewportBox: Box;
  pane: Box;
  els: Record<ElBoxKey, Box>;
  /** Wipe circle: center (pane coords), full radius, starting scale (the knob). */
  flip: { x: number; y: number; r: number; s0: number };
  knobTravel: number;
  /** Where the product travels at the end, and how the editor steps back. */
  ship: { dx: number; dy: number; k: number; ex: number; ey: number; fade: number; shrink: number };
  /** Inspector label goes under the frame where the space above holds content. */
  tagBelow: Record<ElementKey, boolean>;
}

export class CodeToUIEngine {
  private nodes: Nodes | null;
  private readonly anchors: StoryAnchors;
  private layout: Layout | null = null;
  private progress = 0;
  private story: StoryState | null = null;
  private rowState: number[] = [];
  private activeLine = -1;
  private isFlipped = false;
  private lastN = -1;
  private lastLnCol = '';
  private lastCount: number[] = [];
  private lastFx: Partial<Record<FxKey, FxStyle>> = {};
  private readonly styleCache = new WeakMap<Styled, Partial<Record<StyleProp, string>>>();
  private typingTimer: ReturnType<typeof setTimeout> | undefined;
  private isPlaying = false;
  private userPlay = false;
  private readonly user = { knob: 0, flip: 0, hover: 0 };
  private scroll = { x: 0, y: 0, tx: 0, ty: 0 };
  private insp = { ...ZERO, o: 0, tx: 0, ty: 0, tw: 0, th: 0, to: 0 };
  private inspKey: ElementKey | null = null;
  private isTagAbove = true;
  private caretPos = { line: 0, col: 0 };
  private isTicking = false;
  private isTyping = false;
  private isDirty = true;
  /** Wire dash offset: the dots flow from the code to the preview while typing. */
  private wireFlow = 0;
  private caption: CaptionId | null = null;
  private capIndex = 0;
  /** Which blocks have landed (to ping them once when they do). */
  private landed: Record<ElementKey, boolean> = { main: false, card: false, btn: false, toggle: false, chart: false };
  private isFlipping = false;
  private isShipping = false;

  constructor(
    private readonly stage: HTMLElement,
    private readonly options: EngineOptions
  ) {
    this.nodes = collect(stage);
    this.anchors = buildAnchors(options.model, options.uiText);
  }

  get isReady(): boolean {
    return this.nodes !== null;
  }

  // ── Layout ──────────────────────────────────────────────────────────────

  /** Reads layout. Call on mount, resize, font load and style change. */
  measure(): void {
    const nodes = this.nodes;
    if (!nodes) return;
    const { model, isStatic } = this.options;
    // (Boxes come from offsetLeft/Top: layout, so the ship transforms don't skew them.)
    const ratio = nodes.probe.offsetWidth / 1000 || 0.6;
    const gutterCols = parseFloat(getComputedStyle(nodes.lines).getPropertyValue('--gw')) || 4.5;
    const viewW = nodes.viewport.clientWidth;
    const viewH = nodes.viewport.clientHeight;
    const cols = model.maxCols + gutterCols + 1.2;
    const fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, viewW / (cols * ratio)));
    const lineHeight = Math.round(fontSize * (isStatic ? STATIC_LINE_HEIGHT : LINE_HEIGHT));
    nodes.editor.style.setProperty('--fs', `${fontSize.toFixed(2)}px`);
    nodes.editor.style.setProperty('--lh', `${lineHeight}px`);

    const stage = { x: 0, y: 0, w: this.stage.clientWidth, h: this.stage.clientHeight };
    const pane = offsetWithin(nodes.pane, this.stage);
    const slot = offsetWithin(nodes.slot, this.stage);
    const editor = offsetWithin(nodes.editor, this.stage);
    const viewportBox = offsetWithin(nodes.viewport, this.stage);
    const els = Object.fromEntries(
      (Object.keys(nodes.els) as ElBoxKey[]).map(key => [key, offsetWithin(nodes.els[key], nodes.pane)])
    ) as Layout['els'];

    // Wipe circle from the switch's center, big enough for the far corner.
    const sw = els.switch;
    const cx = sw.x + sw.w / 2;
    const cy = sw.y + sw.h / 2;
    const r = Math.hypot(Math.max(cx, pane.w - cx), Math.max(cy, pane.h - cy)) + 2;
    Object.assign(nodes.reveal.style, { width: `${2 * r}px`, height: `${2 * r}px`, left: `${cx - r}px`, top: `${cy - r}px` });
    Object.assign(nodes.revealInner.style, {
      width: `${pane.w - 2}px`,
      height: `${pane.h - 2}px`,
      left: `${r - cx}px`,
      top: `${r - cy}px`,
      transformOrigin: `${cx}px ${cy}px`,
    });

    // The walkthrough overlay: sized here, placed per frame (it follows the screen's growth).
    Object.assign(nodes.media.style, { width: `${els.media.w}px`, height: `${els.media.h}px` });

    const isRow = pane.x >= editor.x + editor.w - 1;
    const caption = nodes.caption ? offsetWithin(nodes.caption, this.stage) : null;
    const main = els.main;
    const ship = isRow
      ? {
          // The preview glides to the middle and the screen inside it grows.
          dx: stage.w / 2 - (slot.x + slot.w / 2),
          dy: 0,
          k: Math.max(1, Math.min(SHIP_MAX_SCALE, (pane.w - 56) / main.w, (pane.h - 96) / main.h)),
          // The code steps back (shrinks toward its top-left) behind the product.
          ex: -Math.min(48, stage.w * 0.03),
          ey: 0,
          fade: 0.7,
          shrink: 0.1,
        }
      : {
          // Phones: the preview and its caption settle in the middle; the code drops away.
          dx: 0,
          dy: Math.max(0, (stage.h - (caption ? caption.y + caption.h - slot.y : slot.h)) / 2 - slot.y),
          k: 1,
          ex: 0,
          ey: 40,
          fade: 0.97,
          shrink: 0.04,
        };

    // Inspector label: above the frame (Figma-style) unless content sits right above it.
    const need = TAG_H + TAG_GAP + FRAME_PAD;
    const bottomOf = (box: Box) => box.y + box.h;
    const controlsBottom = Math.max(bottomOf(els.btn), bottomOf(els.toggle));
    const freeAbove: Record<ElementKey, number> = {
      main: main.y,
      card: Number.POSITIVE_INFINITY,
      btn: els.btn.y - bottomOf(els.card),
      toggle: els.toggle.y - bottomOf(els.card),
      chart: els.chart.y - controlsBottom,
    };
    const tagBelow = Object.fromEntries((Object.keys(freeAbove) as ElementKey[]).map(key => [key, freeAbove[key] < need])) as Record<
      ElementKey,
      boolean
    >;

    this.layout = {
      fontSize,
      lineHeight,
      chPx: fontSize * ratio,
      gutterCols,
      viewH,
      viewW,
      padTop: parseFloat(getComputedStyle(nodes.lines).paddingTop) || 0,
      isRow,
      stage,
      editor,
      viewportBox,
      pane,
      els,
      flip: { x: cx, y: cy, r, s0: Math.max(0.004, sw.h / 2 / r) },
      knobTravel: Math.max(0, sw.w - els.knob.w - 6),
      ship,
      tagBelow,
    };
    this.stage.dataset.layout = isRow ? 'row' : 'stack';
    this.rowState = [];
    this.activeLine = -1;
    this.lastFx = {};
    nodes.rows.forEach(row => row.removeAttribute('data-active'));
    this.render(this.progress);
    this.snap();
    if (isStatic) {
      // The finished file scrolls by hand; open it at the JSX.
      nodes.lines.style.transform = '';
      nodes.viewport.scrollTop = Math.round(Math.max(0, model.firstTypedLine - 1) * lineHeight);
    }
  }

  // ── Render (one scroll position) ───────────────────────────────────────

  /** Scroll progress 0..1 → DOM. */
  render(progress: number): void {
    const nodes = this.nodes;
    if (!nodes) return;
    const prev = this.progress;
    this.progress = progress;
    const { model, isStatic } = this.options;
    const frame = isStatic ? staticFrame(model) : frameAt(model, progress);
    const story = storyAt(model, this.anchors, frame);
    this.story = story;

    this.renderCode(nodes, frame.n, frame.line, frame.col);
    if (!story.hasToggle && (this.user.flip || this.user.knob)) this.resetUser();
    if (!story.hasButton) this.userPlay = false;
    this.renderPreview();
    this.renderBars(nodes, story.bars);
    this.renderCaption(nodes, story);
    this.renderShip(nodes, story);
    this.setPlaying(!isStatic && (story.isPlaying || this.userPlay));
    this.stage.dataset.done = story.isDone ? '1' : '0';

    if (isStatic) {
      this.insp.to = 0;
      this.writeStyle(nodes.pointer, 'opacity', '0');
    } else {
      this.renderPointer(nodes, story);
      this.targetInspector(story.ship > 0.01 ? null : story.active);
      // Ping only on a continuous forward scroll (not when mounting mid-story).
      if (progress > prev && progress - prev < MAX_PING_STEP) this.pingLanded(nodes, story);
      else this.syncLanded(story);
    }
    this.isDirty = true;
  }

  private renderCode(nodes: Nodes, n: number, line: number, col: number): void {
    const layout = this.layout;
    const { model, isStatic } = this.options;
    nodes.rows.forEach((row, i) => {
      // state: -1 hidden, -2 full, >= 0 partial column
      const state = i < line ? -2 : i > line ? -1 : col >= model.lines[i].length ? -2 : col;
      if (this.rowState[i] === state) return;
      this.rowState[i] = state;
      row.style.visibility = state === -1 ? 'hidden' : 'visible';
      nodes.codes[i].style.clipPath = state >= 0 ? `inset(-4px calc(100% - ${state}ch) -4px 0)` : '';
    });
    if (line !== this.activeLine) {
      if (this.activeLine >= 0) nodes.rows[this.activeLine]?.removeAttribute('data-active');
      nodes.rows[line]?.setAttribute('data-active', '');
      this.activeLine = line;
    }
    this.writeStyle(nodes.caret, 'transform', `translate3d(calc(var(--gw) + ${col}ch), ${line * (layout?.lineHeight ?? 0)}px, 0)`);
    this.caretPos = { line, col };

    const lnCol = `Ln ${line + 1}, Col ${col + 1}`;
    if (lnCol !== this.lastLnCol) {
      nodes.lnCol.textContent = lnCol;
      this.lastLnCol = lnCol;
    }
    if (n !== this.lastN && this.lastN !== -1 && !isStatic) {
      nodes.editor.dataset.typing = '1';
      this.isTyping = true;
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => {
        if (this.nodes) this.nodes.editor.dataset.typing = '0';
        this.isTyping = false;
      }, TYPING_IDLE_MS);
    }
    this.lastN = n;

    if (layout && !isStatic) {
      const caretBottom = layout.padTop + (line + 1) * layout.lineHeight;
      const contentH = layout.padTop * 2 + model.lines.length * layout.lineHeight;
      // Rest on whole lines, so the top row is never cut in half.
      const wanted = Math.ceil((caretBottom - layout.viewH * CARET_ZONE) / layout.lineHeight) * layout.lineHeight;
      this.scroll.ty = Math.max(0, Math.min(wanted, contentH - layout.viewH));
      const caretX = (layout.gutterCols + col + 1.5) * layout.chPx;
      this.scroll.tx = Math.max(0, caretX - layout.viewW);
    }
  }

  /** Everything inside the two preview layers plus the shared media and the wipe. */
  private renderPreview(): void {
    const nodes = this.nodes;
    const layout = this.layout;
    const story = this.story;
    if (!nodes || !story) return;
    const { isStatic, startsDark } = this.options;
    const a = story.amounts;

    // Theme flip: scripted (scroll) and the visitor's clicks combine.
    const scripted = isStatic ? { knob: 0, flip: 0 } : story;
    const knob = Math.abs(scripted.knob - this.user.knob);
    const flip = Math.abs(scripted.flip - this.user.flip);
    const chk = startsDark ? 1 - knob : knob;

    const fx = fxAt({
      amounts: a,
      hover: Math.max(a.hover, this.user.hover),
      press: a.press,
      chk,
      knobTravel: layout?.knobTravel ?? 0,
      sheen: isStatic ? 0 : story.sheen,
    });
    for (const key of FX_KEYS) {
      const next = fx[key];
      const last = this.lastFx[key];
      if (last && last.opacity === next.opacity && last.transform === next.transform) continue;
      this.lastFx[key] = next;
      for (const el of nodes.fx[key]) {
        if (next.opacity !== undefined) this.writeStyle(el, 'opacity', next.opacity);
        if (next.transform !== undefined) this.writeStyle(el, 'transform', next.transform);
      }
    }

    // Shared overlays: the walkthrough and its play badge.
    const badge = isStatic ? 1 : a.badge;
    this.writeStyle(nodes.media, 'opacity', a.media.toFixed(3));
    this.writeStyle(nodes.mediaInner, 'transform', `scale(${(1.08 - a.media * 0.08).toFixed(4)})`);
    this.writeStyle(nodes.badge, 'opacity', badge.toFixed(3));
    this.writeStyle(nodes.badge, 'transform', `scale(${(0.7 + badge * 0.3).toFixed(4)})`);

    this.applyFlip(nodes, flip);
  }

  private applyFlip(nodes: Nodes, flip: number): void {
    const layout = this.layout;
    if (!layout) return;
    const isVisible = flip > 0.001;
    const isFlipping = isVisible && flip < 0.999;
    if (isFlipping !== this.isFlipping) {
      this.isFlipping = isFlipping;
      nodes.pane.dataset.flipping = isFlipping ? '1' : '0';
    }
    this.writeStyle(nodes.reveal, 'visibility', isVisible ? 'visible' : 'hidden');
    if (isVisible) {
      const { s0 } = layout.flip;
      const s = s0 + (1 - s0) * flip;
      this.writeStyle(nodes.reveal, 'transform', `scale(${s.toFixed(5)})`);
      this.writeStyle(nodes.revealInner, 'transform', `scale(${(1 / s).toFixed(5)})`);
    }
    const isFlipped = flip > 0.5;
    if (isFlipped !== this.isFlipped) {
      this.isFlipped = isFlipped;
      this.options.onFlipChange(isFlipped);
    }
  }

  private renderBars(nodes: Nodes, bars: readonly number[]): void {
    const { barRatios, barCounts } = this.options;
    nodes.bars.forEach(bar => {
      const i = Number(bar.dataset.bar);
      this.writeStyle(bar, 'transform', `scaleX(${(barRatios[i] * bars[i]).toFixed(4)})`);
    });
    nodes.counts.forEach((el, k) => {
      const i = Number(el.dataset.count);
      const value = Math.round(barCounts[i] * bars[i]);
      if (this.lastCount[k] === value) return;
      this.lastCount[k] = value;
      el.textContent = String(value);
    });
  }

  private renderCaption(nodes: Nodes, story: StoryState): void {
    const { isStatic, captions, staticCaptions } = this.options;
    const id: CaptionId = isStatic ? 'ship' : story.caption;
    const step = isStatic ? STEP_COUNT : CAPTION_STEP[id];
    nodes.capSegs.forEach((seg, i) => {
      const fill = isStatic ? 1 : Math.max(0, Math.min(1, story.steps[i] ?? 0));
      this.writeStyle(seg, 'transform', `scaleX(${fill.toFixed(3)})`);
    });
    const staticText = this.layout?.isRow === false ? staticCaptions.stack : staticCaptions.row;
    const text = isStatic ? staticText : captions[id];
    if (id === this.caption && !isStatic) return;
    this.caption = id;
    if (nodes.capStep) nodes.capStep.textContent = String(step).padStart(2, '0');
    const [lineA, lineB] = nodes.capLines;
    if (!lineA || !lineB) return;
    if ((this.capIndex === 0 ? lineA : lineB).textContent === text) return;
    // Two lines cross-fade (CSS transitions on transform/opacity).
    const incoming = this.capIndex === 0 ? lineB : lineA;
    const outgoing = this.capIndex === 0 ? lineA : lineB;
    this.capIndex = 1 - this.capIndex;
    incoming.textContent = text;
    incoming.dataset.on = '1';
    outgoing.dataset.on = '0';
  }

  private renderShip(nodes: Nodes, story: StoryState): void {
    const layout = this.layout;
    if (!layout) return;
    const e = this.options.isStatic ? 0 : story.ship;
    const isShipping = e > 0.001 && e < 0.999;
    if (isShipping !== this.isShipping) {
      this.isShipping = isShipping;
      this.stage.dataset.shipping = isShipping ? '1' : '0';
    }
    // Compile pass: a line sweeps down the editor as the file is done.
    if (nodes.scan) {
      const s = this.options.isStatic ? 0 : story.scan;
      this.writeStyle(nodes.scan, 'opacity', Math.min(1, Math.sin(Math.PI * s) * 1.4).toFixed(3));
      this.writeStyle(nodes.scan, 'transform', `translate3d(0, ${(s * (layout.viewH + 64)).toFixed(1)}px, 0)`);
    }
    const { dx, dy, k: kMax, ex, ey, fade, shrink } = layout.ship;
    const isAtRest = e <= 0.001;
    const move = isAtRest ? 'none' : `translate3d(${(dx * e).toFixed(1)}px, ${(dy * e).toFixed(1)}px, 0)`;
    const editor = isAtRest
      ? 'none'
      : `translate3d(${(ex * e).toFixed(1)}px, ${(ey * e).toFixed(1)}px, 0) scale(${(1 - shrink * e).toFixed(4)})`;
    this.writeStyle(nodes.slot, 'transform', move);
    this.writeStyle(nodes.editorSlot, 'transform', editor);
    this.writeStyle(nodes.editorSlot, 'opacity', (1 - fade * e).toFixed(3));
    this.writeStyle(nodes.lift, 'opacity', e.toFixed(3));
    if (nodes.caption) this.writeStyle(nodes.caption, 'transform', move);

    // The finished screen grows about its center; the shared walkthrough overlay follows it.
    const k = 1 + (kMax - 1) * e;
    const grow = isAtRest ? 'none' : `scale(${k.toFixed(4)})`;
    for (const main of nodes.mains) this.writeStyle(main, 'transform', grow);
    const { main, media } = layout.els;
    const cx = main.x + main.w / 2;
    const cy = main.y + main.h / 2;
    const mx = cx + k * (media.x - cx);
    const my = cy + k * (media.y - cy);
    this.writeStyle(nodes.media, 'transform', `translate3d(${mx.toFixed(2)}px, ${my.toFixed(2)}px, 0) scale(${k.toFixed(4)})`);
  }

  private renderPointer(nodes: Nodes, story: StoryState): void {
    const layout = this.layout;
    if (!layout) return;
    const { pointer } = story;
    this.writeStyle(nodes.pointer, 'opacity', pointer.opacity.toFixed(3));
    if (pointer.opacity === 0) return;
    const btn = layout.els.btn;
    const sw = layout.els.switch;
    const isBtn = pointer.target === 'btn';
    const btnPoint = { x: btn.x + btn.w * 0.62, y: btn.y + btn.h * 0.6 };
    const swPoint = { x: sw.x + sw.w * 0.5, y: sw.y + sw.h * 0.62 };
    const rest = { x: btnPoint.x + 36, y: btnPoint.y + 44 };
    const from = isBtn ? { x: layout.pane.w - 36, y: layout.pane.h - 28 } : rest;
    const to = isBtn ? btnPoint : swPoint;
    const away = isBtn ? rest : { x: swPoint.x - 30, y: swPoint.y + 40 };
    const t = pointer.travel;
    const arc = Math.sin(Math.PI * t) * 26;
    const x = from.x + (to.x - from.x) * t + (away.x - to.x) * pointer.leave;
    const y = from.y + (to.y - from.y) * t - arc + (away.y - to.y) * pointer.leave;
    this.writeStyle(nodes.pointer, 'transform', `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`);
    const tap = pointer.press;
    if (nodes.ripple) {
      this.writeStyle(nodes.ripple, 'opacity', (tap * 0.9).toFixed(3));
      this.writeStyle(nodes.ripple, 'transform', `scale(${(0.3 + tap).toFixed(3)})`);
    }
    if (nodes.tap) this.writeStyle(nodes.tap, 'transform', `scale(${(1 - tap * 0.16).toFixed(3)})`);
  }

  /** Writes an inline style only when it changed (scrub calls render every frame). */
  private writeStyle(el: Styled, prop: StyleProp, value: string): void {
    const cache = this.styleCache.get(el);
    if (cache?.[prop] === value) return;
    if (cache) cache[prop] = value;
    else this.styleCache.set(el, { [prop]: value });
    el.style[prop] = value;
  }

  // ── Inspector, landing pings ───────────────────────────────────────────

  private targetInspector(key: ElementKey | null): void {
    const layout = this.layout;
    const nodes = this.nodes;
    if (!layout || !nodes) return;
    if (!key) {
      this.insp.to = 0;
      return;
    }
    const box = layout.els[key];
    const pad = key === 'main' ? 0 : FRAME_PAD;
    const ty = box.y - pad;
    this.isTagAbove = !layout.tagBelow[key];
    Object.assign(this.insp, { tx: box.x - pad, ty, tw: box.w + pad * 2, th: box.h + pad * 2, to: 1 });
    if (key !== this.inspKey) {
      this.inspKey = key;
      nodes.inspName.textContent = ELEMENT_TAG[key];
      nodes.inspSize.textContent = `${Math.round(box.w)} × ${Math.round(box.h)}`;
      if (this.insp.o < 0.05) Object.assign(this.insp, { x: this.insp.tx, y: this.insp.ty, w: this.insp.tw, h: this.insp.th });
    }
  }

  private landedAmount(story: StoryState, key: ElementKey): number {
    const a = story.amounts;
    switch (key) {
      case 'main':
        return a.main;
      case 'card':
        return a.card;
      case 'btn':
        return a.btnLabel;
      case 'toggle':
        return a.toggleLabel;
      case 'chart':
        return a.chartData;
    }
  }

  /** A block just finished: ring it once and flash the preview's "Updated" chip. */
  private pingLanded(nodes: Nodes, story: StoryState): void {
    const layout = this.layout;
    if (!layout) return;
    for (const key of Object.keys(this.landed) as ElementKey[]) {
      const isLanded = this.landedAmount(story, key) >= 1;
      if (isLanded === this.landed[key]) continue;
      this.landed[key] = isLanded;
      if (!isLanded || typeof nodes.ping.animate !== 'function') continue;
      const box = layout.els[key];
      const pad = key === 'main' ? 0 : 6;
      Object.assign(nodes.ping.style, {
        width: `${box.w + pad * 2}px`,
        height: `${box.h + pad * 2}px`,
        left: `${box.x - pad}px`,
        top: `${box.y - pad}px`,
      });
      nodes.ping.animate(
        [
          { opacity: 0.9, transform: 'scale(0.985)' },
          { opacity: 0, transform: 'scale(1.035)' },
        ],
        { duration: PING_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
      );
      for (const chip of nodes.hmr) {
        chip.animate(
          [
            { opacity: 0, transform: 'translate3d(0, 4px, 0)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0)', offset: 0.15 },
            { opacity: 1, transform: 'translate3d(0, 0, 0)', offset: 0.7 },
            { opacity: 0, transform: 'translate3d(0, -2px, 0)' },
          ],
          { duration: HMR_MS, easing: 'ease-out' }
        );
      }
    }
  }

  /** Scrolling back (or a jump) updates the landed set quietly; blocks ping again on the way down. */
  private syncLanded(story: StoryState): void {
    for (const key of Object.keys(this.landed) as ElementKey[]) {
      this.landed[key] = this.landedAmount(story, key) >= 1;
    }
  }

  // ── Theme flip and user input ──────────────────────────────────────────

  private resetUser(): void {
    gsap.killTweensOf(this.user);
    Object.assign(this.user, { knob: 0, flip: 0 });
  }

  /** The visitor clicked the dark-mode switch. */
  toggleTheme(): void {
    const isOn = this.user.flip > 0.5;
    const instant = this.options.isStatic;
    gsap.killTweensOf(this.user, 'knob,flip');
    const update = () => this.renderPreview();
    gsap.to(this.user, { knob: isOn ? 0 : 1, duration: instant ? 0 : 0.22, ease: 'power2.out', onUpdate: update });
    gsap.to(this.user, {
      flip: isOn ? 0 : 1,
      duration: instant ? 0 : 0.7,
      delay: instant ? 0 : 0.06,
      ease: 'power2.inOut',
      onUpdate: update,
    });
  }

  /** The visitor hovered (or left) the preview button. */
  setUserHover(isHovered: boolean): void {
    gsap.to(this.user, {
      hover: isHovered ? 1 : 0,
      duration: 0.2,
      ease: 'power2.out',
      overwrite: 'auto',
      onUpdate: () => this.renderPreview(),
    });
  }

  /** The visitor clicked "Watch it run". */
  playByUser(): void {
    this.userPlay = true;
    this.setPlaying(true);
  }

  private setPlaying(isPlaying: boolean): void {
    if (isPlaying === this.isPlaying) return;
    this.isPlaying = isPlaying;
    this.options.onPlayingChange(isPlaying);
  }

  // ── Per-frame easing (inspector, auto-scroll, wire) ────────────────────

  private readonly tick = (_time: number, deltaMs: number): void => {
    const nodes = this.nodes;
    const layout = this.layout;
    if (!nodes || !layout) return;
    const dt = Math.min(deltaMs, 50);
    const k = 1 - Math.exp((-EASE_RATE * dt) / 1000);
    const s = this.scroll;
    const i = this.insp;
    const isMoving =
      Math.abs(s.ty - s.y) > 0.3 ||
      Math.abs(s.tx - s.x) > 0.3 ||
      Math.abs(i.tx - i.x) > 0.3 ||
      Math.abs(i.ty - i.y) > 0.3 ||
      Math.abs(i.tw - i.w) > 0.3 ||
      Math.abs(i.th - i.h) > 0.3 ||
      Math.abs(i.to - i.o) > 0.005;
    if (this.isTyping && nodes.wire && i.o > 0.01) {
      this.wireFlow -= dt * WIRE_FLOW_SPEED;
      nodes.wire.style.strokeDashoffset = this.wireFlow.toFixed(1);
    }
    if (!isMoving && !this.isDirty) return;
    s.y += (s.ty - s.y) * k;
    s.x += (s.tx - s.x) * k;
    i.x += (i.tx - i.x) * k;
    i.y += (i.ty - i.y) * k;
    i.w += (i.tw - i.w) * k;
    i.h += (i.th - i.h) * k;
    i.o += (i.to - i.o) * Math.min(1, k * 1.4);
    this.paint(nodes, layout);
    this.isDirty = false;
  };

  private paint(nodes: Nodes, layout: Layout): void {
    const { o } = this.insp;
    const x = Math.round(this.insp.x);
    const y = Math.round(this.insp.y);
    const w = Math.round(this.insp.w);
    const h = Math.round(this.insp.h);
    if (!this.options.isStatic) {
      this.writeStyle(nodes.lines, 'transform', `translate3d(${(-this.scroll.x).toFixed(1)}px, ${(-this.scroll.y).toFixed(1)}px, 0)`);
    }
    this.writeStyle(nodes.insp, 'opacity', o.toFixed(3));
    this.writeStyle(nodes.insp, 'visibility', o < 0.01 ? 'hidden' : 'visible');
    if (o < 0.01) {
      this.paintWire(nodes, layout);
      return;
    }
    for (const edge of nodes.edges) {
      const side = edge.dataset.edge;
      const transform =
        side === 't'
          ? `translate3d(${x}px, ${y}px, 0) scaleX(${w})`
          : side === 'b'
            ? `translate3d(${x}px, ${y + h}px, 0) scaleX(${w})`
            : side === 'l'
              ? `translate3d(${x}px, ${y}px, 0) scaleY(${h})`
              : `translate3d(${x + w}px, ${y}px, 0) scaleY(${h})`;
      this.writeStyle(edge, 'transform', transform);
    }
    for (const handle of nodes.handles) {
      const corner = handle.dataset.handle ?? 'tl';
      const hx = corner.includes('r') ? x + w : x;
      const hy = corner.includes('b') ? y + h : y;
      this.writeStyle(handle, 'transform', `translate3d(${hx}px, ${hy}px, 0)`);
    }
    const tagY = this.isTagAbove ? y - TAG_H - TAG_GAP : y + h + TAG_GAP;
    this.writeStyle(nodes.inspTag, 'transform', `translate3d(${x}px, ${tagY}px, 0)`);
    this.paintWire(nodes, layout);
  }

  private paintWire(nodes: Nodes, layout: Layout): void {
    if (!nodes.wire) return;
    const svg = nodes.wire.ownerSVGElement;
    const { o } = this.insp;
    if (svg) this.writeStyle(svg, 'opacity', o.toFixed(3));
    if (o < 0.01) return;
    const { line, col } = this.caretPos;
    const { x, y, w, h } = this.insp;
    const v = layout.viewportBox;
    const caretY = v.y + layout.padTop + (line + 0.5) * layout.lineHeight - this.scroll.y;
    const caretX = v.x + (layout.gutterCols + col) * layout.chPx - this.scroll.x;
    const pane = layout.pane;
    let d: string;
    let a: { x: number; y: number };
    let b: { x: number; y: number };
    if (layout.isRow) {
      a = { x: layout.editor.x + layout.editor.w, y: Math.max(v.y + 8, Math.min(v.y + v.h - 8, caretY)) };
      b = { x: pane.x + x, y: pane.y + y + Math.min(h / 2, 40) };
      const dx = Math.max(24, (b.x - a.x) * 0.55);
      d = `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
    } else {
      a = { x: Math.max(v.x + 16, Math.min(v.x + v.w - 16, caretX)), y: layout.editor.y };
      b = { x: pane.x + x + w / 2, y: pane.y + y + h };
      const dy = Math.max(16, (a.y - b.y) * 0.5);
      d = `M${a.x},${a.y} C${a.x},${a.y - dy} ${b.x},${b.y + dy} ${b.x},${b.y}`;
    }
    nodes.wire.setAttribute('d', d);
    const [dotA, dotB] = nodes.wireDots;
    dotA?.setAttribute('transform', `translate(${a.x} ${a.y})`);
    dotB?.setAttribute('transform', `translate(${b.x} ${b.y})`);
  }

  /** Jump eased values to their targets (after measure / static render). */
  private snap(): void {
    Object.assign(this.scroll, { x: this.scroll.tx, y: this.scroll.ty });
    Object.assign(this.insp, { x: this.insp.tx, y: this.insp.ty, w: this.insp.tw, h: this.insp.th, o: this.insp.to });
    this.isDirty = true;
    if (this.nodes && this.layout) this.paint(this.nodes, this.layout);
  }

  /** Start/stop the per-frame easing (call with the section's visibility). */
  setActive(isActive: boolean): void {
    if (isActive === this.isTicking) return;
    this.isTicking = isActive;
    if (isActive) gsap.ticker.add(this.tick);
    else gsap.ticker.remove(this.tick);
    this.stage.dataset.inview = isActive ? '1' : '0';
  }

  destroy(): void {
    this.setActive(false);
    clearTimeout(this.typingTimer);
    gsap.killTweensOf(this.user);
    this.nodes?.ping.getAnimations?.().forEach(animation => animation.cancel());
    this.nodes = null;
  }
}
