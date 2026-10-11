/**
 * Free briefs per visitor per window (founder rule 2026-10-10: ONE a day).
 *
 * A brief is held when its run starts and given back when the run ends
 * without one (the idea was rejected or declined, or the pipeline failed), so
 * a visitor whose idea came back "too vague" can try again; a delivered brief
 * — priced or discovery-call — keeps its slot until the window ends. The
 * window starts with the first brief held, so "tomorrow" is 24 hours after it.
 *
 * The visitor is the client IP for now (accounts come later). Same limitation
 * as `rateLimit` and the daily budget: the state lives in memory, per warm
 * serverless instance, and resets on a cold start — it bounds casual use, not
 * a determined visitor; the per-instance spend cap remains the backstop.
 */

export interface AllowanceLimit {
  count: number;
  windowMs: number;
}

export interface BriefAllowance {
  /** Seconds until `key` may start another brief; 0 = it may now. Counts nothing. */
  retryAfter(key: string): number;
  /** Hold one brief for `key`; false when its allowance is used up (or held by a brief still running). */
  take(key: string): boolean;
  /** Give back a held brief that produced none. */
  refund(key: string): void;
}

interface Slot {
  used: number;
  resetAt: number;
}

/** Drop expired slots at most this often, so the map cannot grow without bound. */
const PRUNE_EVERY_MS = 60_000;

export function createBriefAllowance(limit: AllowanceLimit, now: () => number = Date.now): BriefAllowance {
  const slots = new Map<string, Slot>();
  let lastPrune = 0;

  /** The live slot of `key` (null when it has none or it expired), pruning expired slots now and then. */
  const live = (key: string, at: number): Slot | null => {
    if (at - lastPrune > PRUNE_EVERY_MS) {
      for (const [k, slot] of slots) if (at >= slot.resetAt) slots.delete(k);
      lastPrune = at;
    }
    const slot = slots.get(key);
    return slot && at < slot.resetAt ? slot : null;
  };

  return {
    retryAfter(key) {
      const at = now();
      const slot = live(key, at);
      return slot && slot.used >= limit.count ? Math.ceil((slot.resetAt - at) / 1000) : 0;
    },
    take(key) {
      const at = now();
      const slot = live(key, at);
      if (slot && slot.used >= limit.count) return false;
      slots.set(key, slot ? { ...slot, used: slot.used + 1 } : { used: 1, resetAt: at + limit.windowMs });
      return true;
    },
    refund(key) {
      const slot = live(key, now());
      if (!slot) return;
      // Nothing left held: the next brief starts a fresh window.
      if (slot.used <= 1) slots.delete(key);
      else slots.set(key, { ...slot, used: slot.used - 1 });
    },
  };
}
