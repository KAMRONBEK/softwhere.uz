import type { Range } from '@/modules/estimator/types';
import { buildEstimate, engineSize, type MappedScope } from '@/modules/estimator/ai-brief/mapping';
import type { BriefScope } from '@/modules/estimator/ai-brief/types';

interface QuoteLine {
  /** Local-market range (the uz/ru price). */
  local: Range;
  /** The en page's dual-rate range. */
  en: Range;
  weeks: Range;
  hours: Range;
}

/** The engine's numbers for the owner. Server-side only: never part of a brief. */
export interface OwnerQuote {
  mvp: QuoteLine;
  /** Everything planned for later included; null when there is no later scope. */
  full: QuoteLine | null;
}

const range = ({ min, max }: Range): Range => ({ min, max });

export function ownerQuote(scope: BriefScope, mapped: MappedScope): OwnerQuote {
  const local = buildEstimate(scope, mapped, 'uz');
  const en = buildEstimate(scope, mapped, 'en');
  const { mvpHours, fullHours } = engineSize(mapped);
  return {
    mvp: { local: range(local.mvp.price), en: range(en.mvp.price), weeks: range(local.mvp.weeks), hours: range(mvpHours) },
    full:
      local.fullVision && en.fullVision && fullHours
        ? {
            local: range(local.fullVision.price),
            en: range(en.fullVision.price),
            weeks: range(local.fullVision.weeks),
            hours: range(fullHours),
          }
        : null,
  };
}
