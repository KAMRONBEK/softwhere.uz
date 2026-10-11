/**
 * The demo's words come from `home.rag-build` (src/messages/home/rag-build).
 * These helpers turn the data in data.ts into the visitor's language; each
 * component gets its translator from useTranslations('home.rag-build').
 */
import type { useTranslations } from 'next-intl';
import { answerSegments, bestScore, percent, question, type ReplyDef } from './data';
import type { Turn } from './machine';

export type RagT = ReturnType<typeof useTranslations<'home.rag-build'>>;

/** The reply a turn got (it depends on who asked). */
export function replyOf(turn: Turn): ReplyDef {
  return question(turn.question).reply(turn.role);
}

/** The answer, with [n] citation markers. */
export function answerText(t: RagT, reply: ReplyDef): string {
  return t(`replies.${reply.id}`);
}

/** Tokens the answer streams (words + citation chips) in this language: the stream's length. */
export function answerTokenCount(t: RagT, turn: Turn): number {
  return answerSegments(answerText(t, replyOf(turn))).length;
}

/** Retrieval status once found, e.g. "Found 3 snippets · best match 89%". */
export function foundLine(t: RagT, reply: ReplyDef): string {
  return t(`found.${reply.outcome}`, { count: reply.hits.length, best: percent(bestScore(reply)) });
}
