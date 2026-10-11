/**
 * The RAG demo as a pure state machine. Components only render state; a
 * small director (useDirector) dispatches the timed beats, and a visitor's
 * tap dispatches the same actions as the autopilot, so any tap takes over.
 *
 * Beats: the files are read and split (reading), the passages fly into the
 * index (indexing), then each question is typed, searched, found and
 * streamed. The answer's words and the map's lines animate in CSS/GSAP
 * inside one beat each, never tick by tick through React.
 */
import { question, type Outcome, type PartId, type QuestionId, type RoleId, type TabId } from './data';

export type Pipeline = 'idle' | 'reading' | 'indexing' | 'ready';
export type TurnStatus = 'typing' | 'searching' | 'found' | 'streaming' | 'done';
type Actor = 'user' | 'auto' | 'jump';

export interface Turn {
  kind: 'turn';
  key: number;
  question: QuestionId;
  /** Who asked: the answer (and the access rule) depends on it. */
  role: RoleId;
  status: TurnStatus;
}

export interface RoleNote {
  kind: 'role';
  key: number;
  role: RoleId;
}

export type Entry = Turn | RoleNote;

export interface CiteFocus {
  turn: number;
  cite: number;
}

export interface RagState {
  /** Bumped on every restart: keys for one-shot animations. */
  run: number;
  pipeline: Pipeline;
  log: readonly Entry[];
  nextKey: number;
  role: RoleId;
  tab: TabId;
  hasSeenInsights: boolean;
  /** A citation the visitor points at: its card, dot and line light up. */
  focus: CiteFocus | null;
  isAutopilot: boolean;
  /** Next step of AUTOPILOT. */
  autoStep: number;
  /** The chip the autopilot just pressed (touch ripple). */
  ghost: QuestionId | null;
  hasInteracted: boolean;
}

export type RagAction =
  | { type: 'START' }
  | { type: 'PIPELINE'; to: Pipeline }
  | { type: 'ASK'; question: QuestionId; by: Actor; isInstant: boolean }
  | { type: 'ADVANCE'; key: number; to: TurnStatus }
  | { type: 'ROLE'; role: RoleId; by: Actor }
  | { type: 'TAB'; tab: TabId; by: Actor }
  | { type: 'FOCUS'; focus: CiteFocus | null }
  | { type: 'RESTART'; isAutopilot: boolean; isInstant: boolean }
  | { type: 'JUMP'; to: PartId; isInstant: boolean };

type AutoStep = { kind: 'ask'; question: QuestionId } | { kind: 'tab'; tab: TabId };

/** What the demo does by itself: an answer, a refusal by role, an honest "not found", the insights. */
const AUTOPILOT: readonly AutoStep[] = [
  { kind: 'ask', question: 'surcharge' },
  { kind: 'ask', question: 'salary' },
  { kind: 'ask', question: 'charity' },
  { kind: 'tab', tab: 'insights' },
];

const STATUS_ORDER: readonly TurnStatus[] = ['typing', 'searching', 'found', 'streaming', 'done'];

export const TIMING = {
  read: 1600,
  index: 2300,
  type: 950,
  search: 1150,
  found: 550,
  /** Per answer token (word or citation chip); the CSS stagger uses the same value. */
  word: 34,
  streamTail: 320,
  firstAsk: 1000,
  /** Time to read an answer before the autopilot asks the next question. */
  readAnswer: 3800,
} as const;

/**
 * Phones: a visitor scrolling at reading speed reaches the chat about 2.5s
 * after the files, so reading and indexing are compressed to land the first
 * answer as the chat scrolls in.
 */
export const TOUCH_TIMING = { read: 1000, index: 1500, firstAsk: 700 } as const;

export interface PipelineTiming {
  read: number;
  index: number;
  firstAsk: number;
}

export function pipelineTiming(isTouch: boolean): PipelineTiming {
  return isTouch ? TOUCH_TIMING : TIMING;
}

export const INITIAL_STATE: RagState = {
  run: 0,
  pipeline: 'idle',
  log: [],
  nextKey: 1,
  role: 'dispatcher',
  tab: 'chat',
  hasSeenInsights: false,
  focus: null,
  isAutopilot: true,
  autoStep: 0,
  ghost: null,
  hasInteracted: false,
};

/** Reduced motion opens here: everything indexed, one question already answered with sources. */
export function finalState(run = 0): RagState {
  return {
    ...INITIAL_STATE,
    run,
    pipeline: 'ready',
    log: [{ kind: 'turn', key: 1, question: 'surcharge', role: 'dispatcher', status: 'done' }],
    nextKey: 2,
    isAutopilot: false,
    autoStep: 1,
  };
}

export function turns(state: RagState): Turn[] {
  return state.log.filter((entry): entry is Turn => entry.kind === 'turn');
}

export function lastTurn(state: RagState): Turn | null {
  const all = turns(state);
  return all.length ? all[all.length - 1] : null;
}

export function isBusy(state: RagState): boolean {
  const turn = lastTurn(state);
  return Boolean(turn && turn.status !== 'done');
}

export function statusAtLeast(status: TurnStatus, floor: TurnStatus): boolean {
  return STATUS_ORDER.indexOf(status) >= STATUS_ORDER.indexOf(floor);
}

export function outcomeOf(turn: Turn): Outcome {
  return question(turn.question).reply(turn.role).outcome;
}

function finishTurns(log: readonly Entry[]): Entry[] {
  return log.map(entry => (entry.kind === 'turn' && entry.status !== 'done' ? { ...entry, status: 'done' } : entry));
}

function withRole(state: RagState, role: RoleId): RagState {
  if (role === state.role) return state;
  return {
    ...state,
    role,
    log: [...finishTurns(state.log), { kind: 'role', key: state.nextKey, role }],
    nextKey: state.nextKey + 1,
    focus: null,
  };
}

function ask(state: RagState, id: QuestionId, isInstant: boolean, ghost: QuestionId | null): RagState {
  const turn: Turn = { kind: 'turn', key: state.nextKey, question: id, role: state.role, status: isInstant ? 'done' : 'typing' };
  return {
    ...state,
    pipeline: 'ready',
    log: [...finishTurns(state.log), turn],
    nextKey: state.nextKey + 1,
    tab: 'chat',
    focus: null,
    ghost,
  };
}

function autoStepAfter(id: QuestionId): number {
  return AUTOPILOT.findIndex(step => step.kind === 'ask' && step.question === id) + 1;
}

function jump(state: RagState, to: PartId, isInstant: boolean): RagState {
  const keepGoing = { isAutopilot: !isInstant, hasInteracted: true };
  switch (to) {
    case 'read':
      return isInstant
        ? finalState(state.run + 1)
        : { ...INITIAL_STATE, run: state.run + 1, pipeline: 'reading', role: state.role, ...keepGoing };
    case 'index':
      return isInstant
        ? finalState(state.run + 1)
        : { ...INITIAL_STATE, run: state.run + 1, pipeline: 'indexing', role: state.role, ...keepGoing };
    case 'answer':
      return { ...ask(state, 'surcharge', isInstant, null), autoStep: autoStepAfter('surcharge'), ...keepGoing };
    case 'guard':
      return { ...ask(withRole(state, 'dispatcher'), 'salary', isInstant, null), autoStep: autoStepAfter('salary'), ...keepGoing };
    case 'insights':
      return {
        ...state,
        pipeline: 'ready',
        log: finishTurns(state.log),
        tab: 'insights',
        hasSeenInsights: true,
        autoStep: AUTOPILOT.length,
        isAutopilot: false,
        hasInteracted: true,
      };
  }
}

export function ragReducer(state: RagState, action: RagAction): RagState {
  switch (action.type) {
    case 'START':
      return state.pipeline === 'idle' ? { ...state, pipeline: 'reading' } : state;
    case 'PIPELINE':
      return { ...state, pipeline: action.to };
    case 'ASK': {
      const next = ask(state, action.question, action.isInstant, action.by === 'auto' ? action.question : null);
      if (action.by === 'auto') return { ...next, autoStep: state.autoStep + 1 };
      return { ...next, isAutopilot: false, hasInteracted: true };
    }
    case 'ADVANCE':
      return {
        ...state,
        ghost: null,
        log: state.log.map(entry => (entry.kind === 'turn' && entry.key === action.key ? { ...entry, status: action.to } : entry)),
      };
    case 'ROLE': {
      const next = withRole(state, action.role);
      return action.by === 'auto' ? next : { ...next, isAutopilot: false, hasInteracted: true };
    }
    case 'TAB': {
      const next = { ...state, tab: action.tab, hasSeenInsights: state.hasSeenInsights || action.tab === 'insights', focus: null };
      if (action.by === 'auto') return { ...next, autoStep: state.autoStep + 1, isAutopilot: state.autoStep + 1 < AUTOPILOT.length };
      return { ...next, isAutopilot: false, hasInteracted: true };
    }
    case 'FOCUS':
      return { ...state, focus: action.focus };
    case 'RESTART':
      return action.isInstant
        ? finalState(state.run + 1)
        : { ...INITIAL_STATE, run: state.run + 1, pipeline: 'reading', isAutopilot: action.isAutopilot, hasInteracted: true };
    case 'JUMP':
      return jump(state, action.to, action.isInstant);
  }
}

export interface DirectorContext {
  isReduced: boolean;
  isTouch: boolean;
  /** The chat is on screen: the autopilot only asks while the visitor can watch. */
  isChatInView: boolean;
  /** Tokens a turn's answer streams (words + citation chips) in the visitor's language: the stream's length. */
  tokenCount: (turn: Turn) => number;
}

export interface PlannedStep {
  action: RagAction;
  delay: number;
}

function nextStatus(status: TurnStatus): TurnStatus {
  return STATUS_ORDER[Math.min(STATUS_ORDER.indexOf(status) + 1, STATUS_ORDER.length - 1)];
}

function beatDelay(turn: Turn, tokenCount: (turn: Turn) => number): number {
  switch (turn.status) {
    case 'typing':
      return TIMING.type;
    case 'searching':
      return TIMING.search;
    case 'found':
      return TIMING.found;
    default:
      return tokenCount(turn) * TIMING.word + TIMING.streamTail;
  }
}

/** The next timed step, or null when the demo waits for the visitor (or the viewport). */
export function planNext(state: RagState, ctx: DirectorContext): PlannedStep | null {
  const pace = pipelineTiming(ctx.isTouch);
  if (state.pipeline === 'reading') return { action: { type: 'PIPELINE', to: 'indexing' }, delay: pace.read };
  if (state.pipeline === 'indexing') return { action: { type: 'PIPELINE', to: 'ready' }, delay: pace.index };
  if (state.pipeline !== 'ready') return null;

  const turn = lastTurn(state);
  if (turn && turn.status !== 'done') {
    return { action: { type: 'ADVANCE', key: turn.key, to: nextStatus(turn.status) }, delay: beatDelay(turn, ctx.tokenCount) };
  }

  const step = AUTOPILOT[state.autoStep];
  if (!state.isAutopilot || ctx.isReduced || !ctx.isChatInView || !step) return null;
  const delay = state.autoStep === 0 ? pace.firstAsk : TIMING.readAnswer;
  if (step.kind === 'tab') return { action: { type: 'TAB', tab: step.tab, by: 'auto' }, delay };
  return { action: { type: 'ASK', question: step.question, by: 'auto', isInstant: false }, delay };
}

/** What the autopilot presses next (it breathes until then): a chip id, or 'tab-insights'. */
export function autopilotTarget(state: RagState): string | null {
  if (!state.isAutopilot || state.pipeline !== 'ready' || isBusy(state)) return null;
  const step = AUTOPILOT[state.autoStep];
  if (!step) return null;
  return step.kind === 'ask' ? step.question : `tab-${step.tab}`;
}

export function activePart(state: RagState): PartId | null {
  if (state.pipeline === 'idle') return null;
  if (state.tab === 'insights') return 'insights';
  if (state.pipeline === 'reading') return 'read';
  if (state.pipeline === 'indexing') return 'index';
  const turn = lastTurn(state);
  if (!turn) return 'index';
  return outcomeOf(turn) === 'answered' ? 'answer' : 'guard';
}

/** 0–1 for the legend's rails. */
export function partProgress(state: RagState, part: PartId): number {
  const stage = ['idle', 'reading', 'indexing', 'ready'].indexOf(state.pipeline);
  const all = turns(state);
  switch (part) {
    case 'read':
      return stage > 1 ? 1 : stage === 1 ? 0.5 : 0;
    case 'index':
      return stage > 2 ? 1 : stage === 2 ? 0.5 : 0;
    case 'answer': {
      const answered = all.filter(turn => outcomeOf(turn) === 'answered');
      if (answered.some(turn => turn.status === 'done')) return 1;
      return answered.length ? 0.5 : 0;
    }
    case 'guard': {
      const guarded = all.filter(turn => outcomeOf(turn) !== 'answered');
      const done = new Set(guarded.filter(turn => turn.status === 'done').map(outcomeOf));
      const pending = guarded.some(turn => turn.status !== 'done') ? 0.25 : 0;
      return Math.min(1, done.size / 2 + pending);
    }
    case 'insights':
      return state.hasSeenInsights ? 1 : 0;
  }
}
