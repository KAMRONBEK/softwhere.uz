import type { DailyBudget } from '@/shared/utils/dailyBudget';
import { overflowRunOptions } from '@/modules/estimator/ai-brief/chains';
import type { BriefRunOptions } from '@/modules/estimator/ai-brief/orchestrator';

/**
 * Which daily budget pays for a brief, and how that brief runs:
 *  - main     — the chains of the admin's provider choice (`providerChainSet`:
 *               Kimi K3 with a deepseek-flash fallback by default), under the
 *               main cap (`AI_BRIEF_DAILY_USD`);
 *  - overflow — once the main cap is spent: every call on deepseek-flash, no
 *               Uzbek copy-edit (`overflowRunOptions`), under its own smaller
 *               cap (`AI_BRIEF_OVERFLOW_DAILY_USD`).
 * The per-visitor allowance is checked before either and is the same for both.
 */
export interface BriefLane {
  name: 'main' | 'overflow';
  budget: DailyBudget;
  options: BriefRunOptions;
}

/**
 * Hold one brief's reserve on the main budget, else on the overflow budget
 * when the overflow can run (`overflowReady`: a DeepSeek key is configured).
 * null = both are spent for today (the route's "resting for today" answer);
 * nothing is held then.
 */
export function pickBriefLane(
  main: DailyBudget,
  overflow: DailyBudget,
  overflowReady: boolean,
  mainOptions: BriefRunOptions = {}
): BriefLane | null {
  if (main.tryStart()) return { name: 'main', budget: main, options: mainOptions };
  if (!overflowReady || !overflow.tryStart()) return null;
  return { name: 'overflow', budget: overflow, options: overflowRunOptions() };
}
