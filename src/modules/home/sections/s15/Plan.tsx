'use client';

import { memo, type CSSProperties } from 'react';
import { PLAN_WEEKS, STEPS } from './data';
import { useStep } from './context';
import { useCopy } from './useCopy';
import css from './plan.module.css';

const WEEKS = Array.from({ length: PLAN_WEEKS }, (_, index) => index + 1);
/** A test round with every weekly build, weeks 3 to 9 (the end of each week). */
const TEST_ROUNDS = WEEKS.filter(week => week >= 3);

interface PlanProps {
  onSelect: (index: number) => void;
}

/**
 * Desktop only: the whole first version on one 9-week timeline under the
 * set, like a Gantt chart. Scope, wireframes, build and release run in
 * sequence; design runs a week or two ahead of the build; testing happens
 * with every weekly build (a dot per round). As the visitor scrolls, a
 * playhead sweeps week 1 to week 9 while the app grows on the phone: the
 * bars fill behind it, the test dots light up, the current week is marked
 * (all direct writes by useStepScroll). The current step's bar is outlined;
 * click a bar to jump to its step.
 */
function Plan({ onSelect }: PlanProps) {
  const { step } = useStep();
  const copy = useCopy();

  return (
    <div className={css.plan}>
      <div className={css.ruler} aria-hidden='true'>
        {WEEKS.map(week => (
          <span key={week} className={css.week} data-week={week}>
            {copy.weekTag(week)}
          </span>
        ))}
      </div>
      <div className={css.lanes}>
        <span className={css.columns} aria-hidden='true'>
          {WEEKS.map(week => (
            <i key={week} />
          ))}
        </span>
        {/* Under the bars, so their labels stay on top of the line. */}
        <span className={css.playhead} data-playhead='' aria-hidden='true' />
        <ol className={css.bars} aria-label={copy.planLabel}>
          {STEPS.map((item, index) => {
            const isActive = step === index;
            const words = copy.step(item.id);
            const style = {
              ['--from' as string]: item.plan.from,
              ['--to' as string]: item.plan.to,
              ['--lane' as string]: item.plan.lane,
            } as CSSProperties;
            return (
              <li key={item.id} className={css.slot} style={style} data-lane={item.plan.lane} data-active={isActive ? 'true' : undefined}>
                <button
                  type='button'
                  className={css.barButton}
                  aria-label={`${copy.stepAction(index, words.title)} (${words.when})`}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => onSelect(index)}
                  data-cursor={isActive ? undefined : copy.cursor.show}
                  data-cursor-icon='show'
                >
                  <span className={css.barFill} data-bar={index} />
                  <span className={css.barLabel}>{words.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <span className={css.ticks} aria-hidden='true'>
          {TEST_ROUNDS.map(week => (
            <i key={week} data-tick={week} style={{ ['--at' as string]: week } as CSSProperties} />
          ))}
        </span>
      </div>
    </div>
  );
}

export default memo(Plan);
