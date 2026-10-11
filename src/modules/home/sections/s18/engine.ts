/**
 * The spreadsheet → admin morph, and the pipeline cards' positions.
 *
 * One imperative owner for every card transform, so the scrubbed morph, the
 * board's own moves (a CSS transition) and a drag never fight:
 *   t < 1  the morph places each card between its spreadsheet row and its
 *          board slot (no transitions, no input);
 *   t = 1  the board places cards in their slots; changing a slot animates
 *          through the card's CSS transition; a dragged card follows the
 *          pointer instead.
 *
 * Every write goes through a per-element cache, so a frame touches only the
 * styles that changed; during the morph the moving parts are promoted
 * ([data-morphing] on the sheet and the card layer, see the CSS).
 *
 * DOM contract (data attributes inside the window body):
 *   [data-sheet]          the spreadsheet layer
 *   [data-mess]           a highlighter fill (drains 1→0)
 *   [data-line]           every grid row below the header (closes up when
 *                         the duplicates above it merge away)
 *   [data-row=<deal>]     a deal's row, [data-dup] on a typed-twice row;
 *                         its [data-anchor] cell is where the card lifts off
 *   [data-flag]           a problem callout on the sheet
 *   [data-chrome]         admin chrome that fades in (nav, top bar, headers)
 *   [data-title=sheet|app] the window title for each state
 *   [data-frame]          the window (tilts like paper on a desk while messy)
 *   [data-cards]          the board's card layer; [data-card=<deal>] cards
 */
import type { Slot } from './board';
import type { DealId } from './data';
import { SHEET_ORDER } from './demo';
import { easeInOut, ramp } from './story';

interface Point {
  x: number;
  y: number;
}

interface RowInfo {
  el: HTMLElement;
  deal: DealId;
  isDuplicate: boolean;
  anchor: Point;
  /** Duplicates: how far the row slides to sit on its twin. */
  mergeDy: number;
}

interface LineInfo {
  el: HTMLElement;
  isDuplicate: boolean;
  /** Height of the duplicate rows above it: how far it moves up once they merge. */
  gapAbove: number;
}

/** Morph beats, as fractions of the morph (t 0→1). */
const FLAG_IN: [number, number] = [0, 0.1];
const FLAG_OUT: [number, number] = [0.4, 0.5];
const MERGE: [number, number] = [0.22, 0.38];
const MERGE_FADE: [number, number] = [0.32, 0.4];
const MESS_OUT: [number, number] = [0.2, 0.44];
const SHEET_OUT: [number, number] = [0.6, 0.84];
const CHROME_IN: [number, number] = [0.55, 0.9];
const TITLE_OUT: [number, number] = [0.5, 0.62];
const TITLE_IN: [number, number] = [0.6, 0.74];
const TILT_OUT: [number, number] = [0.04, 0.6];
/** Cards lift off once the duplicates have merged (MERGE ends before CARD_START). */
const CARD_START = 0.4;
const CARD_STAGGER = 0.05;
const CARD_FLIGHT = 0.28;
const ROW_FADE = 0.06;
/** px the card arcs up mid-flight, and its tilt as it leaves the row. */
const CARD_LIFT = 26;
const CARD_TILT = [-3, 2.5, -2, 3, -2.5, 2];
/** The card's own padding: its client line lands on the row's client cell. */
const CARD_INSET: Point = { x: 10, y: 8 };
const TILT = { x: 7, z: -1.4, scale: 0.035 };

/** Unique rows in sheet order: the order the cards lift off. */
const LIFT_ORDER: readonly DealId[] = SHEET_ORDER.filter(row => !row.isDuplicate).map(row => row.deal);

type StyleKey = 'transform' | 'opacity' | 'visibility';

/** Layout offset of `el` inside `ancestor` (ignores transforms). */
export function offsetWithin(el: HTMLElement, ancestor: HTMLElement): Point {
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

export interface CrmEngineOptions {
  isTiltEnabled: boolean;
  /** Fired when the admin becomes usable (t reaches 1) or stops being so. */
  onLiveChange: (isLive: boolean) => void;
}

export class CrmEngine {
  private t = -1;
  private isLive = false;
  private sheet: HTMLElement | null = null;
  private frame: HTMLElement | null = null;
  private cardLayer: HTMLElement | null = null;
  private flags: HTMLElement[] = [];
  private fills: HTMLElement[] = [];
  private chrome: HTMLElement[] = [];
  private titles: { sheet: HTMLElement | null; app: HTMLElement | null } = { sheet: null, app: null };
  private rows: RowInfo[] = [];
  private lines: LineInfo[] = [];
  private cards = new Map<DealId, HTMLElement>();
  private slots = new Map<DealId, Slot>();
  private layerOffset: Point = { x: 0, y: 0 };
  /** Where each card lifts off (its row's client cell, in card-layer coordinates). */
  private liftFrom = new Map<DealId, Point>();
  private drag: { id: DealId; dx: number; dy: number } | null = null;
  private written = new WeakMap<HTMLElement, Partial<Record<StyleKey, string>>>();

  constructor(
    private readonly body: HTMLElement,
    private readonly options: CrmEngineOptions
  ) {
    this.collect();
  }

  /** Re-reads the DOM (after React re-renders the board or the sheet). */
  collect(): void {
    const body = this.body;
    this.sheet = body.querySelector<HTMLElement>('[data-sheet]');
    this.frame = body.closest<HTMLElement>('[data-frame]');
    this.cardLayer = body.querySelector<HTMLElement>('[data-cards]');
    this.flags = Array.from(body.querySelectorAll<HTMLElement>('[data-flag]'));
    this.fills = Array.from(body.querySelectorAll<HTMLElement>('[data-mess]'));
    this.chrome = Array.from(body.querySelectorAll<HTMLElement>('[data-chrome]'));
    this.titles = {
      sheet: this.frame?.querySelector<HTMLElement>('[data-title="sheet"]') ?? null,
      app: this.frame?.querySelector<HTMLElement>('[data-title="app"]') ?? null,
    };
    this.cards = new Map(Array.from(body.querySelectorAll<HTMLElement>('[data-card]')).map(el => [el.dataset.card as DealId, el]));
    this.rows = Array.from(body.querySelectorAll<HTMLElement>('[data-row]')).map(el => ({
      el,
      deal: el.dataset.row as DealId,
      isDuplicate: el.hasAttribute('data-dup'),
      anchor: { x: 0, y: 0 },
      mergeDy: 0,
    }));
    this.lines = Array.from(body.querySelectorAll<HTMLElement>('[data-line]')).map(el => ({
      el,
      isDuplicate: el.hasAttribute('data-dup'),
      gapAbove: 0,
    }));
  }

  /** Layout reads: rows' lift-off points and the card layer's offset. */
  measure(): void {
    const body = this.body;
    this.rows.forEach(row => {
      const anchor = row.el.querySelector<HTMLElement>('[data-anchor]') ?? row.el;
      row.anchor = offsetWithin(anchor, body);
    });
    let gap = 0;
    this.lines.forEach(line => {
      line.gapAbove = gap;
      if (line.isDuplicate) gap += line.el.offsetHeight;
    });
    if (this.cardLayer) this.layerOffset = offsetWithin(this.cardLayer, body);
    this.liftFrom = new Map();
    this.rows.forEach(row => {
      const twin = this.rows.find(other => other.deal === row.deal && !other.isDuplicate);
      row.mergeDy = row.isDuplicate && twin ? twin.anchor.y - row.anchor.y : 0;
      if (row.isDuplicate) return;
      const gapAbove = this.lines.find(line => line.el === row.el)?.gapAbove ?? 0;
      this.liftFrom.set(row.deal, {
        x: row.anchor.x - this.layerOffset.x - CARD_INSET.x,
        y: row.anchor.y - gapAbove - this.layerOffset.y - CARD_INSET.y,
      });
    });
    this.render(this.t, true);
  }

  setSlots(slots: Map<DealId, Slot>): void {
    this.slots = slots;
    this.placeCards();
  }

  get live(): boolean {
    return this.isLive;
  }

  /** t = morph progress, 0 (messy sheet) → 1 (the admin). */
  render(t: number, isForced = false): void {
    if (t < 0) return;
    if (t === this.t && !isForced) return;
    this.t = t;
    this.renderSheet(t);
    this.renderChrome(t);
    this.placeCards();
    this.cardLayer?.setAttribute('data-ready', '');
    const isMorphing = t > 0 && t < 1;
    this.sheet?.toggleAttribute('data-morphing', isMorphing);
    const isLive = t >= 1;
    if (isLive !== this.isLive) {
      this.isLive = isLive;
      this.cardLayer?.toggleAttribute('data-morphing', !isLive);
      this.options.onLiveChange(isLive);
    } else if (!isLive) {
      this.cardLayer?.setAttribute('data-morphing', '');
    }
  }

  dragTo(id: DealId, dx: number, dy: number): void {
    this.drag = { id, dx, dy };
    this.placeCard(id);
  }

  /** Ends a drag; the card then transitions to whatever slot it has next. */
  endDrag(): void {
    const id = this.drag?.id;
    this.drag = null;
    if (id) this.placeCard(id);
  }

  destroy(): void {
    this.cards.forEach(el => {
      el.style.transform = '';
      el.style.opacity = '';
    });
    if (this.frame) this.frame.style.transform = '';
    this.written = new WeakMap();
  }

  /* ------------------------------------------------------------------ private */

  /** Writes a style only when its value changed since the last frame. */
  private set(el: HTMLElement, key: StyleKey, value: string): void {
    const cache = this.written.get(el) ?? {};
    if (cache[key] === value) return;
    cache[key] = value;
    this.written.set(el, cache);
    el.style[key] = value;
  }

  private renderSheet(t: number): void {
    const sheet = this.sheet;
    if (!sheet) return;
    const mess = (1 - ramp(t, ...MESS_OUT)).toFixed(3);
    this.fills.forEach(el => this.set(el, 'opacity', mess));
    this.set(sheet, 'opacity', (1 - ramp(t, ...SHEET_OUT)).toFixed(3));
    this.set(sheet, 'visibility', t >= SHEET_OUT[1] ? 'hidden' : '');

    const flag = ramp(t, ...FLAG_IN) * (1 - ramp(t, ...FLAG_OUT));
    const flagOpacity = flag.toFixed(3);
    const flagTransform = `translate3d(0, ${((1 - flag) * 6).toFixed(2)}px, 0) scale(${(0.94 + flag * 0.06).toFixed(3)})`;
    this.flags.forEach(el => {
      this.set(el, 'opacity', flagOpacity);
      this.set(el, 'transform', flagTransform);
    });

    const merge = easeInOut(ramp(t, ...MERGE));
    const mergeFade = (1 - ramp(t, ...MERGE_FADE)).toFixed(3);
    // Rows below a duplicate close the gap it leaves.
    this.lines.forEach(line => {
      if (line.isDuplicate) return;
      this.set(line.el, 'transform', line.gapAbove ? `translate3d(0, ${(-line.gapAbove * merge).toFixed(2)}px, 0)` : '');
    });
    this.rows.forEach(row => {
      if (row.isDuplicate) {
        this.set(row.el, 'transform', `translate3d(0, ${(row.mergeDy * merge).toFixed(2)}px, 0)`);
        this.set(row.el, 'opacity', mergeFade);
        return;
      }
      const start = CARD_START + LIFT_ORDER.indexOf(row.deal) * CARD_STAGGER;
      this.set(row.el, 'opacity', (1 - ramp(t, start + 0.01, start + ROW_FADE)).toFixed(3));
    });

    const frame = this.frame;
    if (frame && this.options.isTiltEnabled) {
      // Flat, the frame keeps an identity 3D transform: its layer stays put instead of
      // being promoted and dropped each time the scrub crosses the end of the tilt.
      const r = 1 - ramp(t, ...TILT_OUT);
      this.set(
        frame,
        'transform',
        `perspective(1800px) rotateX(${(TILT.x * r).toFixed(3)}deg) rotateZ(${(TILT.z * r).toFixed(3)}deg) scale(${(1 - TILT.scale * r).toFixed(4)})`
      );
    }
  }

  private renderChrome(t: number): void {
    const chrome = ramp(t, ...CHROME_IN);
    const opacity = chrome.toFixed(3);
    const transform = chrome >= 1 ? '' : `translate3d(0, ${((1 - chrome) * 10).toFixed(2)}px, 0)`;
    this.chrome.forEach(el => {
      this.set(el, 'opacity', opacity);
      this.set(el, 'transform', transform);
    });
    const { sheet, app } = this.titles;
    if (sheet) this.set(sheet, 'opacity', (1 - ramp(t, ...TITLE_OUT)).toFixed(3));
    if (app) this.set(app, 'opacity', ramp(t, ...TITLE_IN).toFixed(3));
  }

  private placeCards(): void {
    this.cards.forEach((_, id) => this.placeCard(id));
  }

  private placeCard(id: DealId): void {
    const el = this.cards.get(id);
    const slot = this.slots.get(id);
    if (!el || !slot) return;
    el.style.width = `${slot.width}px`;
    if (this.drag?.id === id) {
      this.set(el, 'transform', `translate3d(${slot.x + this.drag.dx}px, ${slot.y + this.drag.dy}px, 0)`);
      return;
    }
    const t = this.t;
    if (t >= 1 || t < 0) {
      this.set(el, 'transform', `translate3d(${slot.x}px, ${slot.y}px, 0)`);
      this.set(el, 'opacity', '');
      return;
    }
    const order = Math.max(0, LIFT_ORDER.indexOf(id));
    const start = CARD_START + order * CARD_STAGGER;
    const k = easeInOut(ramp(t, start, start + CARD_FLIGHT));
    const from = this.liftFrom.get(id) ?? { x: slot.x, y: slot.y };
    const x = from.x + (slot.x - from.x) * k;
    const y = from.y + (slot.y - from.y) * k - Math.sin(k * Math.PI) * CARD_LIFT;
    const scale = 0.84 + 0.16 * k;
    const tilt = (CARD_TILT[order] ?? 0) * (1 - k);
    this.set(
      el,
      'transform',
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(3)})`
    );
    this.set(el, 'opacity', ramp(t, start, start + ROW_FADE).toFixed(3));
  }
}
