'use client';

import { memo } from 'react';
import { STEPS } from './data';
import { useDemoEnv, useStep } from './context';
import { useCopy } from './useCopy';
import css from './steps.module.css';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

interface StepsProps {
  onSelect: (index: number) => void;
}

/**
 * The six steps. Scroll story: one step at a time, as a chapter caption
 * (what we do, when, and what you get), all six stacked in one grid cell so
 * the cell never changes height. Desktop puts it beside the phone (the plan
 * below the set lists every step on a 9-week timeline); phones put it under
 * the phone, with a segmented bar above it (one segment per step, tap to
 * jump). Still version: every step open in a list, tap one to show it.
 *
 * The segments are filled by useStepScroll (direct writes, no re-render per
 * scroll frame); the still version fills the current one.
 */
function Steps({ onSelect }: StepsProps) {
  const { step } = useStep();
  const { isStatic } = useDemoEnv();
  const copy = useCopy();
  const fill = (index: number, axis: 'X' | 'Y') => (isStatic ? { transform: `scale${axis}(${index === step ? 1 : 0})` } : undefined);

  return (
    <div className={css.steps} data-static={isStatic ? 'true' : undefined}>
      <p className={css.label}>{copy.stepsLabel}</p>
      <div className={css.bar}>
        {STEPS.map((item, index) => (
          <button
            key={item.id}
            type='button'
            className={css.segment}
            aria-label={copy.stepAction(index, copy.step(item.id).title)}
            aria-current={step === index ? 'step' : undefined}
            onClick={() => onSelect(index)}
          >
            <span className={css.segmentTrack}>
              <span className={css.segmentFill} data-seg={index} style={fill(index, 'X')} />
            </span>
          </button>
        ))}
      </div>
      <ol className={css.list} aria-label={copy.stepsLabel}>
        {STEPS.map((item, index) => {
          const isActive = step === index;
          const words = copy.step(item.id);
          return (
            <li key={item.id} className={css.item} data-active={isActive ? 'true' : undefined}>
              <span className={css.track} aria-hidden='true'>
                <span className={css.fill} style={fill(index, 'Y')} />
              </span>
              <button
                type='button'
                className={css.head}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onSelect(index)}
                data-cursor={isActive ? undefined : copy.cursor.show}
                data-cursor-icon='show'
              >
                <span className={css.num}>
                  {pad(index + 1)}
                  <span className={css.of}> / {pad(STEPS.length)}</span>
                </span>
                <span className={css.term}>{words.title}</span>
                <span className={css.when}>{words.when}</span>
              </button>
              <div className={css.body}>
                <div className={css.bodyInner}>
                  <p className={css.text}>{words.text}</p>
                  <p className={css.get}>
                    <span className={css.getLabel}>{copy.getLabel}</span> {words.get}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default memo(Steps);
