import type { BriefErrorCode, BriefOutcome, BriefProgress } from '@/modules/estimator/ai-brief/types';

/**
 * Wire format of the streamed brief: newline-delimited JSON, one event per
 * line. The route sends it when the request carries `Accept: application/x-ndjson`
 * (the page does); without that header it answers with a single JSON body as
 * before. Shared by the route and the page, so it imports nothing server-only.
 *
 *   {"type":"accepted"}                           the idea passed every check; the model is reading it
 *   {"type":"progress","progress":{"stage":…}}    scoped → (screens | narrative, any order)
 *   {"type":"result","data":<outcome>}            last line on success / rejection / decline
 *   {"type":"error","code":"timeout"}             last line when the pipeline failed
 */

export const BRIEF_STREAM_CONTENT_TYPE = 'application/x-ndjson';

export type BriefStreamErrorCode = BriefErrorCode | 'internal';

export type BriefStreamEvent =
  | { type: 'accepted' }
  | { type: 'progress'; progress: BriefProgress }
  | { type: 'result'; data: Exclude<BriefOutcome, { status: 'error' }> }
  | { type: 'error'; code: BriefStreamErrorCode };

export function encodeBriefEvent(event: BriefStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

const EVENT_TYPES: ReadonlySet<string> = new Set(['accepted', 'progress', 'result', 'error']);

function toEvent(line: string): BriefStreamEvent | null {
  try {
    const value: unknown = JSON.parse(line);
    if (value && typeof value === 'object' && EVENT_TYPES.has(String((value as { type?: unknown }).type))) {
      return value as BriefStreamEvent;
    }
  } catch {
    // A torn or foreign line is skipped; the missing final event is what the caller acts on.
  }
  return null;
}

/**
 * Incremental NDJSON decoder: feed it chunks as they arrive, get back the
 * complete events so far. Lines may be split anywhere, including inside a
 * multi-byte character (the TextDecoder is used in streaming mode).
 */
export function createBriefEventDecoder() {
  const decoder = new TextDecoder();
  let buffer = '';

  const drain = (final: boolean): BriefStreamEvent[] => {
    const lines = buffer.split('\n');
    buffer = final ? '' : (lines.pop() ?? '');
    return lines
      .map(line => line.trim())
      .filter(Boolean)
      .map(toEvent)
      .filter((event): event is BriefStreamEvent => event !== null);
  };

  return {
    push(chunk: Uint8Array): BriefStreamEvent[] {
      buffer += decoder.decode(chunk, { stream: true });
      return drain(false);
    },
    end(): BriefStreamEvent[] {
      buffer += decoder.decode();
      return drain(true);
    },
  };
}
