import type { BriefStreamEvent } from '@/modules/estimator/ai-brief/stream';
import type { AiBrief, BriefOutcome, BriefPreview, WireframeScreen } from '@/modules/estimator/ai-brief/types';
import type { PolicyTopic } from '@/modules/estimator/ai-brief/constants';
import { DAY_MS } from './briefStorage';

/**
 * Client state of one AI brief, as a pure reducer (no React, no fetch) so the
 * progress logic can be unit-tested. Every update returns a new object.
 */

export type RejectReason = Extract<BriefOutcome, { status: 'rejected' }>['reason'];

export type BriefFailure =
  /** Today's free brief is used (one per visitor a day): a friendly state, not an error. */
  | { code: 'daily_limit'; retryAfterSec: number }
  | { code: 'rate_limited'; retryAfterSec: number }
  | { code: 'busy' }
  | { code: 'too_long' }
  /** The pipeline failed or the stream was cut before a result. */
  | { code: 'failed' }
  /** The request never reached the server. */
  | { code: 'network' };

export type BriefStatus = 'idle' | 'running' | 'done' | 'rejected' | 'declined' | 'error';

export interface BriefRunState {
  status: BriefStatus;
  /** The idea exactly as submitted (the composer keeps its own draft). */
  idea: string;
  startedAt: number | null;
  accepted: boolean;
  preview: BriefPreview | null;
  previewAt: number | null;
  screens: WireframeScreen[] | null;
  hasNarrative: boolean;
  brief: AiBrief | null;
  /** Wall-clock duration once finished. */
  elapsedMs: number | null;
  /** True when this brief came back from session storage (no entrance animation). */
  restored: boolean;
  rejection: RejectReason | null;
  declined: { topics: PolicyTopic[]; note: string } | null;
  failure: BriefFailure | null;
  /**
   * When this visitor's next free brief opens (epoch ms); null = it is open
   * now. One brief a day: set when a brief arrives or the server says today's
   * is used, and kept across a reset or a new run.
   */
  nextFreeAt: number | null;
}

export const INITIAL_BRIEF_STATE: BriefRunState = {
  status: 'idle',
  idea: '',
  startedAt: null,
  accepted: false,
  preview: null,
  previewAt: null,
  screens: null,
  hasNarrative: false,
  brief: null,
  elapsedMs: null,
  restored: false,
  rejection: null,
  declined: null,
  failure: null,
  nextFreeAt: null,
};

export type BriefAction =
  | { type: 'start'; idea: string; at: number }
  | { type: 'event'; event: BriefStreamEvent; at: number }
  | { type: 'outcome'; outcome: Exclude<BriefOutcome, { status: 'error' }>; at: number }
  | { type: 'fail'; failure: BriefFailure; at: number }
  | { type: 'restore'; idea: string; brief: AiBrief; elapsedMs: number | null }
  /** The next free brief's time from storage, or null once it has passed. */
  | { type: 'quota'; nextFreeAt: number | null }
  | { type: 'reset' };

function finishedAfter(state: BriefRunState, at: number): number | null {
  return state.startedAt === null ? null : Math.max(0, at - state.startedAt);
}

/** A later time wins: a fresh signal never reopens a brief that is still closed. */
function laterOf(a: number | null, b: number): number {
  return a === null ? b : Math.max(a, b);
}

function applyOutcome(state: BriefRunState, outcome: Exclude<BriefOutcome, { status: 'error' }>, at: number): BriefRunState {
  const elapsedMs = finishedAfter(state, at);
  switch (outcome.status) {
    case 'ok':
      return {
        ...state,
        status: 'done',
        elapsedMs,
        // The server's window opened when this brief started.
        nextFreeAt: laterOf(state.nextFreeAt, (state.startedAt ?? at) + DAY_MS),
        brief: outcome.brief,
        preview: state.preview ?? outcome.brief,
        screens: outcome.brief.screens,
        hasNarrative: true,
      };
    case 'rejected':
      return { ...state, status: 'rejected', elapsedMs, rejection: outcome.reason };
    case 'declined_policy':
      return { ...state, status: 'declined', elapsedMs, declined: { topics: outcome.topics, note: outcome.note } };
  }
}

function applyEvent(state: BriefRunState, event: BriefStreamEvent, at: number): BriefRunState {
  if (state.status !== 'running') return state; // a late line after a reset/abort
  switch (event.type) {
    case 'accepted':
      return { ...state, accepted: true };
    case 'progress': {
      const { progress } = event;
      if (progress.stage === 'scoped') return { ...state, accepted: true, preview: progress.preview, previewAt: at };
      if (progress.stage === 'screens') return { ...state, screens: progress.screens };
      return { ...state, hasNarrative: true };
    }
    case 'result':
      return applyOutcome(state, event.data, at);
    case 'error':
      return { ...state, status: 'error', elapsedMs: finishedAfter(state, at), failure: { code: 'failed' } };
  }
}

export function briefReducer(state: BriefRunState, action: BriefAction): BriefRunState {
  switch (action.type) {
    case 'start':
      return { ...INITIAL_BRIEF_STATE, status: 'running', idea: action.idea, startedAt: action.at, nextFreeAt: state.nextFreeAt };
    case 'event':
      return applyEvent(state, action.event, action.at);
    case 'outcome':
      return state.status === 'running' ? applyOutcome(state, action.outcome, action.at) : state;
    case 'fail': {
      if (state.status !== 'running') return state;
      const { failure } = action;
      const nextFreeAt =
        failure.code === 'daily_limit' ? laterOf(state.nextFreeAt, action.at + failure.retryAfterSec * 1000) : state.nextFreeAt;
      return { ...state, status: 'error', elapsedMs: finishedAfter(state, action.at), failure, nextFreeAt };
    }
    case 'quota':
      return { ...state, nextFreeAt: action.nextFreeAt };
    case 'restore':
      return {
        ...INITIAL_BRIEF_STATE,
        nextFreeAt: state.nextFreeAt,
        status: 'done',
        idea: action.idea,
        accepted: true,
        preview: action.brief,
        screens: action.brief.screens,
        hasNarrative: true,
        brief: action.brief,
        elapsedMs: action.elapsedMs,
        restored: true,
      };
    case 'reset':
      return { ...INITIAL_BRIEF_STATE, nextFreeAt: state.nextFreeAt };
  }
}

/* ------------------------------------------------------------------ */
/* Progress steps                                                      */
/* ------------------------------------------------------------------ */

export const BRIEF_STEPS = ['read', 'scope', 'price', 'screens', 'plan'] as const;
export type BriefStep = (typeof BRIEF_STEPS)[number];
export type StepState = 'pending' | 'active' | 'done' | 'skipped';

/** "Reading" is instant server-side; hold it long enough to be read. */
const READ_MIN_MS = 1_400;
/** The engine prices instantly; the step stays lit while the price counts up. */
const PRICE_MIN_MS = 900;

/**
 * Which steps are done, from what the server has actually reported. Screens
 * and plan are written in parallel, so both can be active at once.
 */
export function stepStates(state: BriefRunState, now: number): Record<BriefStep, StepState> {
  const since = (at: number | null) => (at === null ? 0 : now - at);
  const finished = state.status === 'done';
  const readDone = state.preview !== null || (state.accepted && since(state.startedAt) >= READ_MIN_MS);
  const scopeDone = state.preview !== null;
  const priceDone = scopeDone && (finished || since(state.previewAt) >= PRICE_MIN_MS);
  const screensDone = state.screens !== null;
  const after = (isPrevDone: boolean, isDone: boolean): StepState => (isDone ? 'done' : isPrevDone ? 'active' : 'pending');

  return {
    read: readDone ? 'done' : 'active',
    scope: after(readDone, scopeDone),
    price: after(scopeDone, priceDone),
    screens: finished && (state.screens?.length ?? 0) === 0 ? 'skipped' : after(priceDone, screensDone),
    plan: after(priceDone, state.hasNarrative || finished),
  };
}
