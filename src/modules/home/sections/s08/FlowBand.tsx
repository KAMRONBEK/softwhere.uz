'use client';

import { useTranslations } from 'next-intl';
import type { Ref } from 'react';
import { STEP_IDS } from './data';
import css from './aiDemo.module.css';

type StepState = 'pending' | 'active' | 'done';

function stateOf(index: number, step: number): StepState {
  if (step < 0) return 'pending';
  if (step >= 4 || index < Math.floor(step)) return 'done';
  return index === Math.floor(step) ? 'active' : 'pending';
}

/**
 * Mirrors the network's progress on the DOM step labels ('pending' | 'active'
 * | 'done'). Writes only what changed, so it is safe in an onUpdate.
 */
export function paintSteps(band: HTMLElement | null, step: number): void {
  if (!band) return;
  band.querySelectorAll('[data-step]').forEach((label, i) => {
    const next = stateOf(i, step);
    if (label.getAttribute('data-state') !== next) label.setAttribute('data-state', next);
  });
}

/**
 * The graph's slot: an empty [data-plot] box the canvas draws the network
 * over, and one label per column (the canvas centres its columns on them).
 * The resting DOM state is "all done" (reduced motion, no JS).
 */
export default function FlowBand({ bandRef, className }: { bandRef: Ref<HTMLDivElement>; className?: string }) {
  const t = useTranslations('home.ai-demo');
  return (
    <div ref={bandRef} className={className ? `${css.flow} ${className}` : css.flow}>
      <div className={css.plot} data-plot='' />
      <ol className={css.steps} aria-label={t('stepsLabel')}>
        {STEP_IDS.map((step, i) => (
          <li key={step} className={css.step} data-step='' data-state='done'>
            <span className={css.stepNum} aria-hidden='true'>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className={css.stepName}>{t(`steps.${step}.short`)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
