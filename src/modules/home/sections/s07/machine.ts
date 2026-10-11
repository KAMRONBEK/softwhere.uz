/**
 * The café-bot conversation as a pure state machine. The component only
 * renders state; a small director (useDirector) dispatches the timed steps,
 * and the visitor's taps dispatch the same actions as the autopilot, so a
 * tap at any point simply takes over.
 *
 * State changes at most once per message or beat: the composer's typing and
 * the SMS-code digits are animated by the components (GSAP / CSS) inside one
 * phase each, never tick by tick through React.
 */
import {
  MENU,
  SMS_CODE_LENGTH,
  itemPrice,
  type Currency,
  type ItemId,
  type MiniItemId,
  type PartId,
  type SizeId,
  type TimeId,
} from './data';

export const PHASES = [
  'idle',
  'compose',
  'hello-sent',
  'greet-typing',
  'await-item',
  'size-typing',
  'await-size',
  'time-typing',
  'await-time',
  'cart-typing',
  'await-pay',
  'pay-card',
  'pay-code',
  'pay-processing',
  'pay-done',
  'receipt-typing',
  'receipt-shown',
  'kitchen-new',
  'await-ready',
  'ready-typing',
  'menu-typing',
  'await-menu',
  'mini',
  'done',
] as const;
export type Phase = (typeof PHASES)[number];

export function phaseAt(phase: Phase): number {
  return PHASES.indexOf(phase);
}

export type MessageKind =
  | 'hello'
  | 'greet'
  | 'echo-item'
  | 'ask-size'
  | 'echo-size'
  | 'ask-time'
  | 'echo-time'
  | 'cart'
  | 'receipt'
  | 'ready'
  | 'menu';

export interface ChatMessage {
  id: number;
  kind: MessageKind;
  /** Chosen button id, for messages that carry an inline keyboard. */
  chosen?: string;
}

export type MiniStatus = 'idle' | 'sending' | 'sent';
export type Source = 'user' | 'auto';
export type ChoiceStep = 'item' | 'size' | 'time';
export type Counts = Readonly<Record<MiniItemId, number>>;

export interface ChatState {
  phase: Phase;
  messages: readonly ChatMessage[];
  nextId: number;
  item: ItemId;
  size: SizeId;
  time: TimeId;
  /** Target currently being "tapped" by the autopilot (a touch ripple). */
  ghost: string | null;
  isAutopilot: boolean;
  hasInteracted: boolean;
  counts: Counts;
  miniStatus: MiniStatus;
  /** The Mini App order sent to the café (shown on the admin screen). */
  placed: Counts | null;
  /** Bumps on every restart so one-shot effects can replay. */
  run: number;
}

export type ChatAction =
  | { type: 'START'; isInstant: boolean }
  | { type: 'TICK' }
  | { type: 'CHOOSE'; step: ChoiceStep; value: string; source: Source }
  | { type: 'PAY'; source: Source }
  | { type: 'CONFIRM_PAY'; needsCode: boolean; source: Source }
  | { type: 'MARK_READY'; source: Source }
  | { type: 'OPEN_MINI'; source: Source }
  | { type: 'CLOSE_MINI'; source: Source }
  | { type: 'MINI_ADD'; id: MiniItemId; delta: 1 | -1; source: Source }
  | { type: 'MINI_CHECKOUT'; source: Source }
  | { type: 'GHOST'; target: string }
  | { type: 'RESTART'; isAutopilot: boolean; isInstant: boolean }
  | { type: 'JUMP'; to: PartId | 'final'; needsCode: boolean; isAutopilot: boolean };

const EMPTY_COUNTS = Object.fromEntries(MENU.map(item => [item.id, 0])) as Record<MiniItemId, number>;

export const INITIAL_STATE: ChatState = {
  phase: 'idle',
  messages: [],
  nextId: 1,
  item: 'cappuccino',
  size: 'm',
  time: 't20',
  ghost: null,
  isAutopilot: true,
  hasInteracted: false,
  counts: EMPTY_COUNTS,
  miniStatus: 'idle',
  placed: null,
  run: 0,
};

/**
 * Keystrokes the composer takes to type the opening line, in every locale
 * (the English line's length): the composer spreads the localized line over
 * the same beat, so the script's timing never depends on the language.
 */
export const HELLO_LENGTH = 25;

/** Composer typing: a pause before the first key, then one key per step. */
export const TYPE_START_MS = 380;
export const TYPE_KEY_MS = 42;
const COMPOSE_MS = TYPE_START_MS + HELLO_LENGTH * TYPE_KEY_MS + 260;

/** SMS-code autofill: a pause, then one digit per step (CSS-animated). */
export const CODE_START_MS = 650;
export const CODE_DIGIT_MS = 150;
const CODE_MS = CODE_START_MS + SMS_CODE_LENGTH * CODE_DIGIT_MS + 250;

/* ---------- helpers (all return new objects) ---------- */

function push(state: ChatState, kind: MessageKind, phase: Phase): ChatState {
  return { ...state, phase, messages: [...state.messages, { id: state.nextId, kind }], nextId: state.nextId + 1 };
}

function choose(state: ChatState, kind: MessageKind, chosen: string): ChatState {
  // Newest message of that kind gets the choice (a restart can repeat kinds).
  const index = state.messages.map(m => m.kind).lastIndexOf(kind);
  if (index < 0) return state;
  const messages = state.messages.map((m, i) => (i === index ? { ...m, chosen } : m));
  return { ...state, messages };
}

function bySource(state: ChatState, source: Source): ChatState {
  return source === 'user' ? { ...state, ghost: null, isAutopilot: false, hasInteracted: true } : { ...state, ghost: null };
}

/** Timed steps: what TICK does in each automatic phase. */
function tick(state: ChatState): ChatState {
  switch (state.phase) {
    case 'compose':
      return push(state, 'hello', 'hello-sent');
    case 'hello-sent':
      return { ...state, phase: 'greet-typing' };
    case 'greet-typing':
      return push(state, 'greet', 'await-item');
    case 'size-typing':
      return push(state, 'ask-size', 'await-size');
    case 'time-typing':
      return push(state, 'ask-time', 'await-time');
    case 'cart-typing':
      return push(state, 'cart', 'await-pay');
    case 'pay-code':
      return { ...state, phase: 'pay-processing' };
    case 'pay-processing':
      return { ...state, phase: 'pay-done' };
    case 'pay-done':
      return { ...state, phase: 'receipt-typing' };
    case 'receipt-typing':
      return push(state, 'receipt', 'receipt-shown');
    case 'receipt-shown':
      return { ...state, phase: 'kitchen-new' };
    case 'kitchen-new':
      return { ...state, phase: 'await-ready' };
    case 'ready-typing':
      return push(state, 'ready', 'menu-typing');
    case 'menu-typing':
      return push(state, 'menu', 'await-menu');
    case 'mini':
      if (state.miniStatus === 'sending') return { ...state, miniStatus: 'sent' };
      if (state.miniStatus === 'sent') return { ...state, miniStatus: 'idle', counts: EMPTY_COUNTS };
      return state;
    default:
      return state;
  }
}

const CHOICE_FLOW: Record<ChoiceStep, { from: Phase; ask: MessageKind; echo: MessageKind; next: Phase }> = {
  item: { from: 'await-item', ask: 'greet', echo: 'echo-item', next: 'size-typing' },
  size: { from: 'await-size', ask: 'ask-size', echo: 'echo-size', next: 'time-typing' },
  time: { from: 'await-time', ask: 'ask-time', echo: 'echo-time', next: 'cart-typing' },
};

function applyChoice(state: ChatState, step: ChoiceStep, value: string): ChatState {
  const flow = CHOICE_FLOW[step];
  if (state.phase !== flow.from) return state;
  const withValue =
    step === 'item'
      ? { ...state, item: value as ItemId }
      : step === 'size'
        ? { ...state, size: value as SizeId }
        : { ...state, time: value as TimeId };
  return push(choose(withValue, flow.ask, value), flow.echo, flow.next);
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'START':
      if (state.phase !== 'idle') return state;
      return action.isInstant ? push(state, 'hello', 'hello-sent') : { ...state, phase: 'compose' };
    case 'TICK':
      return tick(state);
    case 'GHOST':
      return { ...state, ghost: action.target };
    case 'CHOOSE':
      return applyChoice(bySource(state, action.source), action.step, action.value);
    case 'PAY':
      if (state.phase !== 'await-pay') return state;
      return { ...choose(bySource(state, action.source), 'cart', 'pay'), phase: 'pay-card' };
    case 'CONFIRM_PAY':
      if (state.phase !== 'pay-card') return state;
      return { ...bySource(state, action.source), phase: action.needsCode ? 'pay-code' : 'pay-processing' };
    case 'MARK_READY':
      if (state.phase !== 'await-ready') return state;
      return { ...bySource(state, action.source), phase: 'ready-typing' };
    case 'OPEN_MINI':
      if (state.phase !== 'await-menu' && state.phase !== 'done') return state;
      return { ...choose(bySource(state, action.source), 'menu', 'open'), phase: 'mini' };
    case 'CLOSE_MINI':
      if (state.phase !== 'mini') return state;
      return { ...bySource(state, action.source), phase: 'done', miniStatus: 'idle' };
    case 'MINI_ADD': {
      if (state.phase !== 'mini' || state.miniStatus !== 'idle') return state;
      const next = Math.max(0, Math.min(9, state.counts[action.id] + action.delta));
      return { ...bySource(state, action.source), counts: { ...state.counts, [action.id]: next } };
    }
    case 'MINI_CHECKOUT': {
      const hasItems = Object.values(state.counts).some(count => count > 0);
      if (state.phase !== 'mini' || state.miniStatus !== 'idle' || !hasItems) return state;
      // The autopilot's last move: after its checkout the demo is the visitor's.
      return { ...bySource(state, action.source), miniStatus: 'sending', placed: state.counts, isAutopilot: false };
    }
    case 'RESTART': {
      const fresh = {
        ...INITIAL_STATE,
        isAutopilot: action.isAutopilot,
        hasInteracted: state.hasInteracted,
        run: state.run + 1,
      };
      return chatReducer(fresh, { type: 'START', isInstant: action.isInstant });
    }
    case 'JUMP':
      return jumpTo(state, action.to, action.needsCode, action.isAutopilot);
    default:
      return state;
  }
}

/* ---------- fast-forward (legend jumps and the reduced-motion end state) ---------- */

const AUTO_PHASES = new Set<Phase>([
  'compose',
  'hello-sent',
  'greet-typing',
  'size-typing',
  'time-typing',
  'cart-typing',
  'pay-code',
  'pay-processing',
  'pay-done',
  'receipt-typing',
  'receipt-shown',
  'ready-typing',
  'menu-typing',
]);

function settle(state: ChatState, stopAt?: Phase): ChatState {
  let current = state;
  for (let guard = 0; guard < 200 && AUTO_PHASES.has(current.phase) && current.phase !== stopAt; guard++) {
    current = tick(current);
  }
  return current;
}

/** The state at the start of a demo part, with the default order. */
export function fastForward(to: PartId | 'final', needsCode: boolean): ChatState {
  const auto = 'auto' as const;
  let state = settle(chatReducer(INITIAL_STATE, { type: 'START', isInstant: true }));
  if (to === 'bot') return state;
  state = settle(chatReducer(state, { type: 'CHOOSE', step: 'item', value: 'cappuccino', source: auto }));
  state = settle(chatReducer(state, { type: 'CHOOSE', step: 'size', value: 'm', source: auto }));
  state = settle(chatReducer(state, { type: 'CHOOSE', step: 'time', value: 't20', source: auto }));
  state = chatReducer(state, { type: 'PAY', source: auto });
  state = settle(chatReducer(state, { type: 'CONFIRM_PAY', needsCode, source: auto }), 'kitchen-new');
  if (to === 'admin') return { ...state, phase: 'kitchen-new' };
  state = settle(chatReducer({ ...state, phase: 'await-ready' }, { type: 'MARK_READY', source: auto }));
  if (to === 'final') return { ...state, isAutopilot: false };
  return chatReducer(state, { type: 'OPEN_MINI', source: auto });
}

function jumpTo(state: ChatState, to: PartId | 'final', needsCode: boolean, isAutopilot: boolean): ChatState {
  return { ...fastForward(to, needsCode), isAutopilot, hasInteracted: state.hasInteracted, run: state.run + 1 };
}

/* ---------- director plan ---------- */

export interface DirectorContext {
  isReduced: boolean;
  needsCode: boolean;
  /** Scroll story: the scroll asked for the next beat, so the autopilot presses almost at once. */
  isQuick?: boolean;
}

export interface PlannedStep {
  delay: number;
  action: ChatAction;
}

const AUTO_DELAY: Partial<Record<Phase, number>> = {
  compose: COMPOSE_MS,
  'hello-sent': 450,
  'greet-typing': 1300,
  'size-typing': 950,
  'time-typing': 950,
  'cart-typing': 1100,
  'pay-code': CODE_MS,
  'pay-processing': 1200,
  'pay-done': 1100,
  'receipt-typing': 1000,
  // The receipt and the confirmation pulse get the screen to themselves…
  'receipt-shown': 1500,
  // …then the order travels to the café's screen.
  'kitchen-new': 1700,
  // The "ready" signal travels back before the bot speaks.
  'ready-typing': 1700,
  'menu-typing': 1400,
};

/** How long the autopilot "thinks" before tapping, per waiting phase. */
const AUTOPILOT_WAIT: Partial<Record<Phase, number>> = {
  'await-item': 2600,
  'await-size': 2000,
  'await-time': 2000,
  'await-pay': 2200,
  'pay-card': 1500,
  'await-ready': 1900,
  'await-menu': 2000,
};

const GHOST_PRESS_MS = 460;
/** Scroll story: the pause before the autopilot's press once the scroll reached its beat. */
const QUICK_WAIT_MS = 160;

/** The button the autopilot will tap next (also gets the pulsing hint). */
export function autopilotTarget(state: ChatState): string | null {
  if (!state.isAutopilot) return null;
  switch (state.phase) {
    case 'await-item':
      return 'item:cappuccino';
    case 'await-size':
      return 'size:m';
    case 'await-time':
      return 'time:t20';
    case 'await-pay':
      return 'pay';
    case 'pay-card':
      return 'confirm';
    case 'await-ready':
      return 'ready';
    case 'await-menu':
      return 'open-mini';
    case 'mini':
      if (state.miniStatus !== 'idle') return null;
      if (state.counts.croissant === 0) return 'add:croissant';
      if (state.counts.cappuccino === 0) return 'add:cappuccino';
      return 'checkout';
    default:
      return null;
  }
}

/** The action a target stands for, used by both the autopilot and the buttons. */
export function actionFor(target: string, source: Source, needsCode: boolean): ChatAction | null {
  const [kind, value] = target.split(':');
  switch (kind) {
    case 'item':
    case 'size':
    case 'time':
      return { type: 'CHOOSE', step: kind, value, source };
    case 'pay':
      return { type: 'PAY', source };
    case 'confirm':
      return { type: 'CONFIRM_PAY', needsCode, source };
    case 'ready':
      return { type: 'MARK_READY', source };
    case 'open-mini':
      return { type: 'OPEN_MINI', source };
    case 'add':
      return { type: 'MINI_ADD', id: value as MiniItemId, delta: 1, source };
    case 'checkout':
      return { type: 'MINI_CHECKOUT', source };
    default:
      return null;
  }
}

function autopilotWait(state: ChatState, isQuick: boolean): number {
  if (isQuick) return QUICK_WAIT_MS;
  if (state.phase === 'mini') return state.counts.croissant === 0 ? 1500 : 1100;
  return AUTOPILOT_WAIT[state.phase] ?? 2000;
}

/** The next timed step for the current state, or null to wait for the visitor. */
export function planNext(state: ChatState, ctx: DirectorContext): PlannedStep | null {
  const scale = ctx.isReduced ? 0 : 1;
  const tick: ChatAction = { type: 'TICK' };
  if (state.phase === 'mini' && state.miniStatus !== 'idle') {
    return { delay: (state.miniStatus === 'sending' ? 1100 : 2200) * scale, action: tick };
  }
  const autoDelay = AUTO_DELAY[state.phase];
  if (autoDelay !== undefined) return { delay: autoDelay * scale, action: tick };

  const target = autopilotTarget(state);
  if (!target || ctx.isReduced) return null;
  if (state.ghost !== target) {
    return { delay: autopilotWait(state, ctx.isQuick === true), action: { type: 'GHOST', target } };
  }
  const action = actionFor(target, 'auto', ctx.needsCode);
  return action ? { delay: GHOST_PRESS_MS, action } : null;
}

/* ---------- derived views ---------- */

/** Which part of the legend the demo is showing. */
export function activePart(phase: Phase): PartId {
  const index = phaseAt(phase);
  if (index >= phaseAt('menu-typing')) return 'mini';
  if (index >= phaseAt('kitchen-new')) return 'admin';
  return 'bot';
}

const PART_SPAN: Record<PartId, [from: Phase, to: Phase]> = {
  bot: ['compose', 'kitchen-new'],
  admin: ['kitchen-new', 'menu-typing'],
  mini: ['menu-typing', 'done'],
};

/** 0…1 progress of the demo through one part (drives the legend's bars). */
export function partProgress(state: ChatState, part: PartId): number {
  if (state.phase === 'idle') return 0;
  const [from, to] = PART_SPAN[part];
  const index = phaseAt(state.phase);
  if (part === 'mini' && state.phase === 'mini') return state.placed ? 1 : 0.7;
  if (index >= phaseAt(to)) return 1;
  if (index < phaseAt(from)) return 0;
  return Math.min(1, (index - phaseAt(from) + 1) / (phaseAt(to) - phaseAt(from) + 1));
}

export type AdminStatus = 'hidden' | 'new' | 'preparing' | 'ready';

export function adminStatus(phase: Phase): AdminStatus {
  const index = phaseAt(phase);
  if (index < phaseAt('kitchen-new')) return 'hidden';
  if (index === phaseAt('kitchen-new')) return 'new';
  if (index === phaseAt('await-ready')) return 'preparing';
  return 'ready';
}

/**
 * Where the stage's "camera" looks. `split`: the café's screen has joined the
 * phone (desktop keeps that two-up framing). `admin`: the order is on the
 * café's side right now (phones pull back to show the screen below).
 */
export function stageFocus(phase: Phase): { isSplit: boolean; isAdmin: boolean } {
  const index = phaseAt(phase);
  return {
    isSplit: index >= phaseAt('kitchen-new'),
    isAdmin: phase === 'kitchen-new' || phase === 'await-ready',
  };
}

/** The two beats after payment: the receipt lands, then the order leaves for the café. */
export function isConfirmBeat(phase: Phase): boolean {
  return phase === 'receipt-shown' || phase === 'kitchen-new';
}

export function isTyping(phase: Phase): boolean {
  return phase.endsWith('-typing');
}

/** A Mini App basket as one line ("Croissant ×1, Latte ×1") and its total, in the copy's words and currency. */
export function summarize(
  counts: Counts,
  currency: Currency,
  copy: { item: (id: MiniItemId) => string; price: (amount: number) => string }
): { items: string; total: string } {
  const lines = MENU.filter(item => counts[item.id] > 0);
  const items = lines.map(item => `${copy.item(item.id)} ×${counts[item.id]}`).join(', ');
  const total = lines.reduce((sum, item) => sum + counts[item.id] * itemPrice(item.id, currency), 0);
  return { items, total: copy.price(total) };
}
