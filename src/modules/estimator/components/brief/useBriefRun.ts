'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { BRIEF_STREAM_CONTENT_TYPE, createBriefEventDecoder, type BriefStreamEvent } from '@/modules/estimator/ai-brief/stream';
import type { BriefOutcome } from '@/modules/estimator/ai-brief/types';
import { briefReducer, INITIAL_BRIEF_STATE, type BriefAction, type BriefFailure } from './briefState';
import { browserStore, DAY_MS, loadBrief, loadNextFree, saveBrief, saveNextFree } from './briefStorage';

const ENDPOINT = '/api/estimate/brief';
/** Above the route's 120s maxDuration: the server always answers first unless the connection is gone. */
const CLIENT_TIMEOUT_MS = 130_000;
/** Retry-After of a daily-limit answer that lost its header: the full window. */
const DAILY_LIMIT_FALLBACK_SEC = DAY_MS / 1000;

/** Map a non-2xx answer to what the page can say about it. */
async function failureOf(res: Response): Promise<BriefFailure> {
  const body = (await res.json().catch(() => null)) as { code?: string } | null;
  switch (body?.code) {
    case 'daily_limit':
      return { code: 'daily_limit', retryAfterSec: Number(res.headers.get('Retry-After')) || DAILY_LIMIT_FALLBACK_SEC };
    case 'rate_limited':
      return { code: 'rate_limited', retryAfterSec: Number(res.headers.get('Retry-After')) || 600 };
    case 'busy':
      return { code: 'busy' };
    case 'too_long':
      return { code: 'too_long' };
    default:
      return { code: 'failed' };
  }
}

type Dispatch = (action: BriefAction) => void;

/** Read the NDJSON stream to its end; true when a final result/error line arrived. */
async function readStream(body: ReadableStream<Uint8Array>, dispatch: Dispatch): Promise<boolean> {
  const decoder = createBriefEventDecoder();
  const reader = body.getReader();
  let isFinal = false;
  const handle = (events: BriefStreamEvent[]) => {
    for (const event of events) {
      dispatch({ type: 'event', event, at: Date.now() });
      if (event.type === 'result' || event.type === 'error') isFinal = true;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    handle(decoder.push(value));
  }
  handle(decoder.end());
  return isFinal;
}

/**
 * One AI brief at a time: POST the idea, follow the streamed milestones, keep
 * the result in this browser (`briefStorage.ts`) and know when the visitor's
 * next free brief opens. A newer submit or a reset aborts the older request.
 */
export function useBriefRun(locale: BriefLocale) {
  const [state, dispatch] = useReducer(briefReducer, INITIAL_BRIEF_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const store = browserStore();
    const now = Date.now();
    const nextFreeAt = loadNextFree(store, now);
    if (nextFreeAt !== null) dispatch({ type: 'quota', nextFreeAt });
    const saved = loadBrief(store, locale, now);
    if (saved) dispatch({ type: 'restore', idea: saved.idea, brief: saved.brief, elapsedMs: saved.elapsedMs });
    return () => controllerRef.current?.abort();
  }, [locale]);

  useEffect(() => {
    if (state.status === 'done' && state.brief && !state.restored) {
      saveBrief(browserStore(), locale, { idea: state.idea, brief: state.brief, elapsedMs: state.elapsedMs, savedAt: Date.now() });
    }
  }, [locale, state.status, state.brief, state.idea, state.elapsedMs, state.restored]);

  // Remember when the next free brief opens, and reopen the composer once that time passes with the page still open.
  useEffect(() => {
    const at = state.nextFreeAt;
    if (at === null) return;
    saveNextFree(browserStore(), at);
    const id = window.setTimeout(() => dispatch({ type: 'quota', nextFreeAt: null }), Math.max(0, at - Date.now()));
    return () => window.clearTimeout(id);
  }, [state.nextFreeAt]);

  const submit = useCallback(
    async (idea: string) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      let isTimedOut = false;
      let hasResponse = false;
      const timer = window.setTimeout(() => {
        isTimedOut = true;
        controller.abort();
      }, CLIENT_TIMEOUT_MS);
      const fail = (failure: BriefFailure) => dispatch({ type: 'fail', failure, at: Date.now() });

      // The saved brief stays until a new one replaces it: when today's free brief turns out to be used, it is shown again.
      dispatch({ type: 'start', idea, at: Date.now() });
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: BRIEF_STREAM_CONTENT_TYPE },
          body: JSON.stringify({ idea, locale }),
          signal: controller.signal,
        });
        hasResponse = true;
        if (!res.ok) {
          const failure = await failureOf(res);
          fail(failure);
          const saved = failure.code === 'daily_limit' ? loadBrief(browserStore(), locale, Date.now()) : null;
          if (saved) dispatch({ type: 'restore', idea: saved.idea, brief: saved.brief, elapsedMs: saved.elapsedMs });
          return;
        }

        if (res.body && (res.headers.get('content-type') ?? '').includes(BRIEF_STREAM_CONTENT_TYPE)) {
          if (!(await readStream(res.body, dispatch))) fail({ code: 'failed' });
          return;
        }
        // A plain JSON answer (a proxy that dropped the Accept header).
        const json = (await res.json()) as { success?: boolean; data?: BriefOutcome };
        if (json?.success && json.data && json.data.status !== 'error') {
          dispatch({ type: 'outcome', outcome: json.data, at: Date.now() });
        } else {
          fail({ code: 'failed' });
        }
      } catch {
        // A reset or a newer submit aborted this one on purpose; anything else is a real failure.
        if (controller.signal.aborted && !isTimedOut) return;
        fail(hasResponse || isTimedOut ? { code: 'failed' } : { code: 'network' });
      } finally {
        window.clearTimeout(timer);
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [locale]
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    dispatch({ type: 'reset' });
  }, []);

  return { state, submit, reset };
}
