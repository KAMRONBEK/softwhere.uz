'use client';

import { useRef, type RefObject } from 'react';
import { useMediaQuery } from '../../device/useDeviceTier';
import AdminCard from './AdminCard';
import CafeBoard from './CafeBoard';
import { useDemo } from './context';
import { usePhoneTilt } from './hooks';
import { isConfirmBeat, stageFocus } from './machine';
import Phone from './Phone';
import Route from './Route';
import css from './stage.module.css';

const SIDE_QUERY = '(min-width: 900px)';
const RINGS = [0, 1, 2];

interface StageProps {
  rootRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
  /** Scroll story: the set fills its pinned cell (sized by the cell, not the viewport). */
  isPinned: boolean;
  isTiltEnabled: boolean;
  isTouch: boolean;
}

/**
 * The 3D set. Desktop: the customer's phone and the café's tablet stand side
 * by side; the tablet sleeps until the first order is paid, then wakes and
 * turns toward the camera as the order flies over. Phones: the phone is the
 * screen; it steps back and a compact order card rises beneath it on cue, so
 * nothing ever covers the chat. "Order confirmed" sends a shock ring through
 * the set and a ripple across the floor.
 */
export default function Stage({ rootRef, stageRef, trackRef, isPinned, isTiltEnabled, isTouch }: StageProps) {
  const { state, isReduced, copy } = useDemo();
  const isSide = useMediaQuery(SIDE_QUERY);
  const { isSplit, isAdmin } = stageFocus(state.phase);
  // Reduced motion opens on the finished demo: keep the invitation to tap.
  const isHintHidden = state.hasInteracted || (isSplit && !isReduced);
  const isConfirmed = isConfirmBeat(state.phase) && !isReduced;

  const scrollTiltRef = useRef<HTMLDivElement>(null);
  const pointerTiltRef = useRef<HTMLDivElement>(null);
  const entranceRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLSpanElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);

  usePhoneTilt(
    {
      root: rootRef,
      stage: stageRef,
      track: isPinned ? trackRef : undefined,
      scrollTilt: scrollTiltRef,
      pointerTilt: pointerTiltRef,
      entrance: entranceRef,
      glare: glareRef,
      floor: floorRef,
    },
    isTiltEnabled,
    isTouch
  );

  return (
    <div
      className={css.stage}
      ref={stageRef}
      data-pinned={isPinned ? 'true' : undefined}
      data-split={isSplit ? 'true' : undefined}
      data-admin={isAdmin ? 'true' : undefined}
    >
      <div className={css.camera}>
        <p className={css.hint} data-hide={isHintHidden ? 'true' : undefined} aria-hidden='true'>
          <span className={css.hintDot} />
          {isTouch ? copy.hintTouch : copy.hintPointer}
        </p>
        <div className={css.floor} ref={floorRef} aria-hidden='true'>
          {isConfirmed && (
            <span className={css.ripple} key={state.run}>
              {RINGS.map(i => (
                <i key={i} style={{ ['--i' as string]: i }} />
              ))}
            </span>
          )}
        </div>
        <div className={css.tiltScroll} ref={scrollTiltRef}>
          <div className={css.tiltPointer} ref={pointerTiltRef}>
            <div className={css.entrance} ref={entranceRef}>
              {isConfirmed && <span className={css.shock} key={`shock-${state.run}`} aria-hidden='true' />}
              <div className={css.phoneWrap}>
                {isConfirmed && (
                  <span className={css.pulse} key={state.run} aria-hidden='true'>
                    {RINGS.map(i => (
                      <i key={i} style={{ ['--i' as string]: i }} />
                    ))}
                  </span>
                )}
                <Phone glareRef={glareRef} />
              </div>
              {isSide ? <CafeBoard /> : <AdminCard />}
              {/* After both devices: the route starts on the phone's glass and ends on the café's screen. */}
              <Route layout={isSide ? 'side' : 'below'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
