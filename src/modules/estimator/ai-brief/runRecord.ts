import { createHmac } from 'node:crypto';
import { providerOfModel } from '@/core/ai';
import type { BriefProvider } from '@/modules/estimator/ai-brief/chains';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import type { BriefRun } from '@/modules/estimator/ai-brief/orchestrator';
import type { NewAiBriefRun } from '@/modules/estimator/model/BriefRun';

/**
 * The admin stats row of one brief (`ai_brief_runs`): metadata only — never
 * the idea text or the IP.
 */

const VISITOR_HASH_FALLBACK_KEY = 'softwhere-ai-brief-visitor';

/**
 * A keyed hash of the visitor's IP: the same visitor always hashes the same
 * (unique-visitor counts), but the IP cannot be read back from the row.
 */
export function visitorHash(
  ip: string,
  key = process.env.NEON_AUTH_COOKIE_SECRET || process.env.API_SECRET || VISITOR_HASH_FALLBACK_KEY
): string {
  return createHmac('sha256', key).update(ip).digest('hex').slice(0, 24);
}

export interface RunRecordContext {
  locale: BriefLocale;
  provider: BriefProvider;
  lane: 'main' | 'overflow';
  visitor: string;
}

/** The stats row of a finished run: spend and tokens per provider, summed from its calls. */
export function briefRunRecord(run: BriefRun, ctx: RunRecordContext): NewAiBriefRun {
  // The overflow runs on DeepSeek by design; only a call outside the lane's own provider is a fallback.
  const primary = ctx.lane === 'overflow' ? 'deepseek' : ctx.provider;
  let kimiCostUsd = 0;
  let deepseekCostUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let fallbackUsed = false;
  for (const attempt of run.attempts) {
    const provider = providerOfModel(attempt.model) ?? 'kimi';
    if (provider === 'deepseek') deepseekCostUsd += attempt.costUsd;
    else kimiCostUsd += attempt.costUsd;
    inputTokens += attempt.usage?.promptTokens ?? 0;
    outputTokens += attempt.usage?.completionTokens ?? 0;
    if (attempt.ok && provider !== primary) fallbackUsed = true;
  }
  return {
    locale: ctx.locale,
    mode: ctx.provider,
    lane: ctx.lane,
    status: run.outcome.status,
    errorCode: run.outcome.status === 'error' ? run.outcome.code : null,
    model: run.model,
    visitorHash: ctx.visitor,
    costUsd: run.totalCostUsd,
    kimiCostUsd,
    deepseekCostUsd,
    inputTokens,
    outputTokens,
    ms: Math.round(run.totalMs),
    calls: run.attempts.length,
    fallbackUsed,
  };
}

/** A request turned away because both daily budgets were spent: nothing ran, nothing was paid. */
export function busyRecord(ctx: Omit<RunRecordContext, 'lane'>): NewAiBriefRun {
  return { locale: ctx.locale, mode: ctx.provider, lane: null, status: 'busy', visitorHash: ctx.visitor };
}
