'use client';

import { memo, useRef, type RefObject } from 'react';
import { STEPS } from './data';
import { useStep } from './context';
import { useRig } from './hooks';
import Phone from './Phone';
import Satellites from './Satellites';
import { STEP_INDEX } from './state';
import { useCopy } from './useCopy';
import css from './stage.module.css';

const INTERACTIVE_STEPS: readonly number[] = [STEP_INDEX.design, STEP_INDEX.build, STEP_INDEX.release];

interface StageProps {
  rootRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
  isTiltEnabled: boolean;
  isTouch: boolean;
}

/**
 * The 3D set: the phone on a soft floor shadow, with the step's satellites
 * floating beside it on desktop, all on one rig the camera swings around
 * from step to step (useRig composes the pose, the scroll sway, the pointer
 * lean and the entrance into one transform). A hint invites taps on the
 * steps where the app answers them.
 */
function Stage({ rootRef, stageRef, trackRef, isTiltEnabled, isTouch }: StageProps) {
  const { step } = useStep();
  const copy = useCopy();
  const rigRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLSpanElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);

  useRig({ root: rootRef, stage: stageRef, track: trackRef, rig: rigRef, glare: glareRef, floor: floorRef }, step, isTiltEnabled, isTouch);

  const isHintShown = INTERACTIVE_STEPS.includes(step);

  return (
    <div className={css.stage} ref={stageRef} data-step={STEPS[step].id}>
      <div className={css.camera}>
        <p className={css.hint} data-hide={isHintShown ? undefined : 'true'} aria-hidden='true'>
          <span className={css.hintDot} />
          {isTouch ? copy.hintTouch : copy.hintPointer}
        </p>
        <div className={css.rig} ref={rigRef}>
          <div className={css.floor} ref={floorRef} aria-hidden='true' />
          <Phone glareRef={glareRef} />
          <Satellites />
        </div>
      </div>
    </div>
  );
}

export default memo(Stage);
