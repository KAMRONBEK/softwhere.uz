/**
 * The scroll story on top of the chat machine: the pinned track is cut into
 * beats (one chat message, one payment step, one move on the café's board,
 * one tap in the Mini App) and the scroll picks the beat. The machine stays
 * the source of truth; this module only says which beat a state shows and
 * moves the state to the beat the scroll asks for:
 *
 * - forward: everything before the beat is settled at once, then the beat
 *   itself plays on time (its typing dots, the autopilot's press, the order
 *   flying), driven by the director with `ceilingBlocks` as its limit;
 * - back: the state at the end of that beat, rebuilt with the visitor's
 *   picks (drink, size, pickup time);
 * - a visitor who tapped ahead is never pulled back by a forward scroll.
 */
import { PART_IDS, type PartId } from './data';
import {
  INITIAL_STATE,
  actionFor,
  chatReducer,
  phaseAt,
  planNext,
  type ChatAction,
  type ChatState,
  type ChoiceStep,
  type DirectorContext,
  type Phase,
} from './machine';

/** Where each chat beat starts (the Mini App's beats follow its basket, below). */
const CHAT_BEATS: readonly { part: PartId; from: Phase }[] = [
  { part: 'bot', from: 'idle' }, // the hello, the greeting and the drinks
  { part: 'bot', from: 'size-typing' }, // a drink picked, sizes offered
  { part: 'bot', from: 'time-typing' }, // a size picked, pickup times offered
  { part: 'bot', from: 'cart-typing' }, // a time picked, the cart and its pay button
  { part: 'bot', from: 'pay-card' }, // the pay sheet
  { part: 'bot', from: 'pay-code' }, // the SMS code (uz/ru) and the payment going through
  { part: 'bot', from: 'receipt-typing' }, // the receipt
  { part: 'admin', from: 'kitchen-new' }, // the order flies onto the café's board
  { part: 'admin', from: 'await-ready' }, // in progress
  // Marked ready: the signal rides back, the bot says so and offers the Mini App (one beat, so the
  // story never rests on a typing indicator).
  { part: 'admin', from: 'ready-typing' },
];

/** Mini App beats: opened, one item in the basket, two, the order sent. */
const MINI_BEATS = 4;
const MINI_FIRST = CHAT_BEATS.length;

const BEAT_COUNT = CHAT_BEATS.length + MINI_BEATS;

/** The part each beat belongs to. */
const BEAT_PARTS: readonly PartId[] = [...CHAT_BEATS.map(beat => beat.part), ...Array<PartId>(MINI_BEATS).fill('mini')];

/**
 * The track's equal scroll slices, each naming its beat. A beat with more to
 * show gets two slices, so the parts take about 45% (Bot), 30% (Admin) and
 * 25% (Mini App) of the pinned scroll.
 */
export const SLICE_BEATS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 9, 10, 11, 12, 13];

/** The part each slice belongs to (the legend's current part). */
export const SLICE_PARTS: readonly PartId[] = SLICE_BEATS.map(beat => BEAT_PARTS[beat]);

/** Each part's first slice and its number of slices (the legend's rails and glides). */
export const PART_SLICES: Readonly<Record<PartId, { first: number; count: number }>> = Object.fromEntries(
  PART_IDS.map(part => [part, { first: SLICE_PARTS.indexOf(part), count: SLICE_PARTS.filter(p => p === part).length }])
) as Record<PartId, { first: number; count: number }>;

/** The beat a state shows. */
export function storyBeat(state: ChatState): number {
  if (state.phase === 'done') return BEAT_COUNT - 1;
  if (state.phase === 'mini') {
    if (state.placed) return BEAT_COUNT - 1;
    const items = Object.values(state.counts).reduce((sum, count) => sum + count, 0);
    return MINI_FIRST + Math.min(items, MINI_BEATS - 2);
  }
  const at = phaseAt(state.phase);
  let beat = 0;
  CHAT_BEATS.forEach((entry, index) => {
    if (phaseAt(entry.from) <= at) beat = index;
  });
  return beat;
}

/** The action a planned step stands for (an autopilot ripple announces its press). */
function effectiveAction(action: ChatAction, needsCode: boolean): ChatAction | null {
  return action.type === 'GHOST' ? actionFor(action.target, 'auto', needsCode) : action;
}

/**
 * True when a timed step would carry the demo past `beat` (the scroll's):
 * the director then waits. A step inside a beat the visitor tapped into is fine.
 */
export function ceilingBlocks(state: ChatState, action: ChatAction, beat: number, needsCode: boolean): boolean {
  const effective = effectiveAction(action, needsCode);
  if (!effective) return false;
  return storyBeat(chatReducer(state, effective)) > Math.max(beat, storyBeat(state));
}

type Choices = Readonly<Record<ChoiceStep, string>>;

/** Plays the autopilot instantly up to the end of `beat` (with the given picks), never into the next. */
function settleTo(state: ChatState, beat: number, needsCode: boolean, choices?: Choices): ChatState {
  const ctx: DirectorContext = { isReduced: false, needsCode };
  let current: ChatState = { ...state, isAutopilot: true };
  for (let guard = 0; guard < 300; guard++) {
    const step = planNext(current, ctx);
    if (!step) break;
    const action = choices && step.action.type === 'CHOOSE' ? { ...step.action, value: choices[step.action.step] } : step.action;
    const effective = effectiveAction(action, needsCode);
    if (effective && storyBeat(chatReducer(current, effective)) > beat) break;
    current = { ...chatReducer(current, action), isAutopilot: true };
  }
  return { ...current, ghost: null, isAutopilot: true };
}

/** The state at the end of `beat`, rebuilt from the start with the visitor's picks. */
function rewind(state: ChatState, beat: number, needsCode: boolean): ChatState {
  const fresh = { ...INITIAL_STATE, hasInteracted: state.hasInteracted, run: state.run + 1 };
  const started = chatReducer(fresh, { type: 'START', isInstant: true });
  return settleTo(started, beat, needsCode, { item: state.item, size: state.size, time: state.time });
}

export interface SeekAction {
  type: 'SEEK';
  beat: number;
  needsCode: boolean;
  /** The scroll moved up (only then may it take the demo back). */
  isBack: boolean;
}

/** Moves the demo to the beat the scroll picked (see the module comment). */
export function seek(state: ChatState, { beat, needsCode, isBack }: SeekAction): ChatState {
  // Before the first view, beat 0 waits for START (the hello is typed on time).
  if (state.phase === 'idle' && beat === 0) return state;
  const from = state.phase === 'idle' ? chatReducer(state, { type: 'START', isInstant: true }) : state;
  const current = storyBeat(from);
  if (beat === current) return from;
  if (beat < current) return isBack ? rewind(from, beat, needsCode) : from;
  // Forward: settle everything before the beat; the director plays the beat itself.
  return settleTo(from, beat - 1, needsCode);
}

export type StoryAction = ChatAction | SeekAction;

/** The chat reducer plus the scroll's SEEK. */
export function storyReducer(state: ChatState, action: StoryAction): ChatState {
  return action.type === 'SEEK' ? seek(state, action) : chatReducer(state, action);
}
