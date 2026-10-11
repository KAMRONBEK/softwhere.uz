/**
 * Hit testing for the lab cursor (used by CursorLayer.engine.ts): what is
 * under the pointer, and which state the layer should take for it. The same
 * selector lists build the native-cursor rules (CursorLayer.native.ts), so
 * the hardware dot steps aside exactly where the layer draws a cursor of its
 * own.
 */

export type Mode = 'idle' | 'text' | 'frame' | 'ring' | 'label' | 'hidden';
export type Magnetic = HTMLElement | SVGElement;

/** Glyphs the label badge can show (CursorLayer.icons.tsx draws them). */
export const CURSOR_ICONS = ['drag', 'grab', 'open', 'play', 'tap', 'show', 'recount', 'pulse', 'type'] as const;
export type CursorIcon = (typeof CURSOR_ICONS)[number];

export interface Hit {
  mode: Mode;
  /** Element the brackets frame (mode 'frame'). */
  target: Element | null;
  /** Element pulled toward the pointer. */
  magnet: Magnetic | null;
  label: string;
  icon: CursorIcon | null;
  /** Caret height in px (mode 'text'). */
  caret: number;
  /** Text element under the caret: its hardware cursor steps aside while the caret is drawn. */
  textEl: HTMLElement | null;
}

export const IDLE_HIT: Hit = { mode: 'idle', target: null, magnet: null, label: '', icon: null, caret: 0, textEl: null };
const HIDDEN_HIT: Hit = { ...IDLE_HIT, mode: 'hidden' };

export const FIELD_SELECTOR = [
  'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"], [type="color"], [type="file"], [type="image"])',
  'textarea',
  'select',
  'iframe',
  '[contenteditable]:not([contenteditable="false"])',
].join(', ');

export const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'summary',
  'label[for]',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="slider"]',
].join(', ');

const TEXT_TAGS = new Set(
  'P H1 H2 H3 H4 H5 H6 LI SPAN EM STRONG B I Q BLOCKQUOTE FIGCAPTION DT DD TD TH PRE CODE SMALL TIME MARK CITE ABBR KBD LABEL'.split(' ')
);

/**
 * Label words → badge glyph, so sections get a fitting icon from their
 * existing `data-cursor` text. `data-cursor-icon="<icon>|none"` overrides.
 */
const ICON_BY_WORD: Record<string, CursorIcon> = {
  drag: 'drag',
  slide: 'drag',
  swipe: 'drag',
  spin: 'drag',
  rotate: 'drag',
  pull: 'grab',
  grab: 'grab',
  throw: 'grab',
  toss: 'grab',
  open: 'open',
  view: 'open',
  visit: 'open',
  explore: 'open',
  play: 'play',
  watch: 'play',
  tap: 'tap',
  click: 'tap',
  press: 'tap',
  show: 'show',
  look: 'show',
  peek: 'show',
  reveal: 'show',
  recount: 'recount',
  replay: 'recount',
  again: 'recount',
  reset: 'recount',
  pulse: 'pulse',
  beat: 'pulse',
  type: 'type',
  write: 'type',
  ask: 'type',
};

const isCursorIcon = (value: string): value is CursorIcon => (CURSOR_ICONS as readonly string[]).includes(value);

function iconFor(node: Element, label: string): CursorIcon | null {
  const explicit = node.getAttribute('data-cursor-icon')?.trim().toLowerCase();
  if (explicit === 'none') return null;
  if (explicit && isCursorIcon(explicit)) return explicit;
  const word = label.toLowerCase().split(/\s+/)[0] ?? '';
  return ICON_BY_WORD[word] ?? null;
}

/** Interactive elements up to this size get framed; bigger ones (whole cards, walls) get the wide ring. */
const FRAME_MIN = 8;
const FRAME_MAX_W = 560;
const FRAME_MAX_H = 320;
const CARET_LINE = 1.15;
const CARET_MIN = 14;
const CARET_MAX = 72;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function asMagnetic(el: Element | null): Magnetic | null {
  return el instanceof HTMLElement || el instanceof SVGElement ? el : null;
}

function hasOwnText(el: Element): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
  }
  return false;
}

/** Selectable text under the pointer → caret mode sized to its font. */
function textHit(el: Element | null): Hit | null {
  if (!(el instanceof HTMLElement) || !TEXT_TAGS.has(el.tagName) || !hasOwnText(el)) return null;
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.userSelect === 'none' || style.webkitUserSelect === 'none') return null;
  }
  const fontSize = Number.parseFloat(getComputedStyle(el).fontSize) || 16;
  return { ...IDLE_HIT, mode: 'text', caret: clamp(fontSize * CARET_LINE, CARET_MIN, CARET_MAX), textEl: el };
}

function interactiveHit(node: Element): Hit {
  const magnet = asMagnetic(node.closest('[data-magnetic]'));
  if (magnet) return { ...IDLE_HIT, mode: 'frame', target: magnet, magnet };
  const rect = node.getBoundingClientRect();
  const fits = rect.width >= FRAME_MIN && rect.height >= FRAME_MIN && rect.width <= FRAME_MAX_W && rect.height <= FRAME_MAX_H;
  return fits ? { ...IDLE_HIT, mode: 'frame', target: node } : { ...IDLE_HIT, mode: 'ring' };
}

/** Innermost opt-in wins: hide → label → magnetic → interactive; else text or idle. */
export function resolveHit(start: Element | null): Hit {
  for (let node = start; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    if (node.hasAttribute('data-cursor-hide') || node.matches(FIELD_SELECTOR)) return HIDDEN_HIT;
    const label = node.getAttribute('data-cursor')?.trim();
    if (label) {
      return { ...IDLE_HIT, mode: 'label', label, icon: iconFor(node, label), magnet: asMagnetic(node.closest('[data-magnetic]')) };
    }
    if (node.hasAttribute('data-magnetic')) return { ...IDLE_HIT, mode: 'frame', target: node, magnet: asMagnetic(node) };
    if (node.matches(INTERACTIVE_SELECTOR)) return interactiveHit(node);
  }
  return textHit(start) ?? IDLE_HIT;
}

/** Layout size of a framed target for the inspector chip (untransformed CSS px, like a design tool shows). */
export function measureTarget(el: Element): { width: number; height: number } {
  if (el instanceof HTMLElement) return { width: el.offsetWidth, height: el.offsetHeight };
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}
