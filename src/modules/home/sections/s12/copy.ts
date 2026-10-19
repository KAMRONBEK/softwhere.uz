/**
 * 16 · Process: "working with us". The route's structure lives here; its
 * words live in src/messages/home/process/<locale>.json (useProcessCopy).
 *
 * 08 · Mobile App already tells how an app is built, week by week. This
 * section keeps the same week route but answers what an owner asks before
 * signing: what you sign, when you pay, what you see each week, who owns the
 * code and what happens after launch. Every term is the studio's own (the
 * softwhere-proposal skill's "Terms to include": NDA on request, contract
 * plus a written scope, a deposit then milestone payments, two-week sprints, a
 * demo every week, a daily written update, priced change requests, code and
 * accounts in the client's name, ownership as milestones are paid, 12 months
 * of bug fixes, an optional monthly care plan). The price sentence is the AI
 * brief's own (home.shared.exactPriceLine). Nothing here is a number the
 * founders have not set.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { PROCESS_STEPS, type FactKey, type ProcessStepDef } from './steps';

// The route's structure is a plain module (steps.ts) so server code can read it too.
export { PROCESS_STEPS, VERSION_LABELS, type FactKey, type ProcessStepDef, type StepId } from './steps';

/** A stage with its words in the visitor's language. */
export interface ProcessStep extends Omit<ProcessStepDef, 'facts'> {
  title: string;
  /** Where the stage sits on the typical timeline, e.g. "Weeks 3–8". */
  when: string;
  summary: string;
  facts: readonly { key: FactKey; text: string }[];
}

/** PROCESS_STEPS with their words. */
export function useProcessSteps(): readonly ProcessStep[] {
  const t = useTranslations('home.process');
  return useMemo(
    () =>
      PROCESS_STEPS.map(step => {
        const [from, to] = step.weeks;
        const when = to === null ? t('when.open', { from }) : to === from ? t('when.single', { from }) : t('when.range', { from, to });
        return {
          id: step.id,
          weeks: step.weeks,
          title: t(`steps.${step.id}.title`),
          summary: t(`steps.${step.id}.summary`),
          when,
          facts: step.facts.map(key => ({ key, text: t(`facts.${key}`) })),
        };
      }),
    [t]
  );
}
