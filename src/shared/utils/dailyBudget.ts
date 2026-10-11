/**
 * Per-instance daily circuit breaker for paid API calls: caps both the number
 * of calls and the estimated USD spend per UTC day.
 *
 * KNOWN LIMITATION (same as the estimator route's AI_DAILY_BUDGET): the state
 * lives in memory, so it resets on every cold start / redeploy and each warm
 * serverless instance has its own counter. It bounds what one instance can
 * spend, not the account total — a durable cap needs shared storage (a Neon
 * row or KV) and the provider-side spend limit remains the real backstop.
 */

export interface DailyBudgetLimits {
  maxCalls: number;
  maxUsd: number;
  /** Expected cost of one call, held back so a call is never started past the cap. */
  reserveUsd?: number;
}

export interface DailyBudget {
  /** Count one call if both caps still allow it, holding back its reserve until `record`; false = refuse the call. */
  tryStart(): boolean;
  /** Add the actual (estimated) cost of a finished call and release its reserve — call once per started call, even on failure (cost 0). */
  record(costUsd: number): void;
  snapshot(): { day: string; calls: number; spentUsd: number; inFlight: number };
}

export function createDailyBudget(limits: DailyBudgetLimits, now: () => Date = () => new Date()): DailyBudget {
  let state = { day: '', calls: 0, spentUsd: 0 };
  // Calls started but not yet recorded. Each holds `reserveUsd` against the cap: a brief takes ~50 s, so
  // without it a burst of parallel requests all passed the check before the first one recorded its cost.
  // Not reset at midnight — a call started yesterday still finishes (its cost lands on the new day).
  let inFlight = 0;
  const reserve = limits.reserveUsd ?? 0;

  const current = () => {
    const today = now().toISOString().slice(0, 10);
    if (state.day !== today) state = { day: today, calls: 0, spentUsd: 0 };
    return state;
  };

  return {
    tryStart() {
      const s = current();
      if (s.calls >= limits.maxCalls || s.spentUsd + (inFlight + 1) * reserve > limits.maxUsd) return false;
      state = { ...s, calls: s.calls + 1 };
      inFlight++;
      return true;
    },
    record(costUsd: number) {
      const s = current();
      inFlight = Math.max(0, inFlight - 1);
      if (Number.isFinite(costUsd) && costUsd > 0) state = { ...s, spentUsd: s.spentUsd + costUsd };
    },
    snapshot() {
      return { ...current(), inFlight };
    },
  };
}

/**
 * A positive number from the environment, else the fallback: an empty, zero,
 * negative or non-numeric value never lifts (or zeroes) a cap by accident.
 */
export function positiveNumberOr(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
