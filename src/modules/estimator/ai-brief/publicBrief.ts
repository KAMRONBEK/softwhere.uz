import type { BriefPriceMode } from '@/modules/estimator/ai-brief/priceMode';
import {
  isPricedEstimate,
  type AiBrief,
  type BriefEstimate,
  type BriefOutcome,
  type BriefPreview,
  type BriefProgress,
  type PlanEstimate,
  type PricedEstimate,
} from '@/modules/estimator/ai-brief/types';

/**
 * The route's single exit: what of a brief may reach the browser. In 'request'
 * mode every price figure is left out; nothing changes in 'range' mode. The
 * repository is public, so this keeps the price off the page and out of the
 * visitor's hands to edit; it does not make it a secret.
 */
export interface Audience {
  mode: BriefPriceMode;
  /** The page understands a plan without a price (`BRIEF_CONTRACT`). */
  knowsPlan: boolean;
}

/** A priced estimate without its figures: weeks, team and scope text only, field by field. */
export function toPlanEstimate(estimate: PricedEstimate): PlanEstimate {
  return {
    mode: 'plan',
    config: estimate.config,
    weeks: estimate.mvp.weeks,
    fullWeeks: estimate.fullVision?.weeks ?? null,
    team: estimate.mvp.team,
    extras: estimate.extras.map(({ projectType, subtype, labelKey, reason }) => ({ projectType, subtype, labelKey, reason })),
    phases: estimate.phases.map(({ id, title, goal, deliverables, weeks }) => ({ id, title, goal, deliverables, weeks })),
    unpricedItems: estimate.unpricedItems,
    adjustments: [],
  };
}

function publicEstimate(estimate: BriefEstimate, { mode, knowsPlan }: Audience): BriefEstimate {
  if (mode === 'range') return estimate;
  if (!isPricedEstimate(estimate)) return { ...estimate, adjustments: [] };
  const plan = toPlanEstimate(estimate);
  if (knowsPlan) return plan;
  // An old tab would read a plan as priced and crash; it knows the number-free discovery shape.
  const { config, team, extras, unpricedItems } = plan;
  const phases = plan.phases.map(({ id, title, goal, deliverables }) => ({ id, title, goal, deliverables }));
  return { mode: 'discovery', reasons: [], config, team, extras, phases, unpricedItems, adjustments: [] };
}

function withPublicEstimate<T extends BriefPreview | AiBrief>(brief: T, audience: Audience): T {
  return audience.mode === 'range' ? brief : { ...brief, estimate: publicEstimate(brief.estimate, audience) };
}

export function publicProgress(progress: BriefProgress, audience: Audience): BriefProgress {
  return progress.stage === 'scoped' ? { ...progress, preview: withPublicEstimate(progress.preview, audience) } : progress;
}

export function publicOutcome<T extends BriefOutcome>(outcome: T, audience: Audience): T {
  return outcome.status === 'ok' ? { ...outcome, brief: withPublicEstimate(outcome.brief, audience) } : outcome;
}

/** A brief saved in this browser while prices were shown, for a page that no longer shows them. */
export function hideSavedPrice(brief: AiBrief, mode: BriefPriceMode): AiBrief {
  return withPublicEstimate(brief, { mode, knowsPlan: true });
}
