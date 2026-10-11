'use client';

import { SplitText } from 'gsap/SplitText';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useReducer, useRef, type RefObject } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, useGSAP, SPLIT_KEEP_NBSP } from '../global/gsap';
import { getProjectBySlug } from '../media/portfolio';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import { DemoContext, type DemoContextValue } from './s07/context';
import { PART_IDS, currencyForLocale, type PartId } from './s07/data';
import { useDirector } from './s07/hooks';
import { ReplayIcon } from './s07/icons';
import { INITIAL_STATE, actionFor, activePart, autopilotTarget, chatReducer, isConfirmBeat, partProgress } from './s07/machine';
import css from './s07/section.module.css';
import Stage from './s07/Stage';
import { useS07Copy } from './s07/useCopy';

if (typeof window !== 'undefined') gsap.registerPlugin(SplitText);

/** The one proof line comes from the real portfolio: the admin panel of a Telegram-bot shop (its poster is the thumb). */
const PROOF_PROJECT = getProjectBySlug('hello-box');

/**
 * The copy arrives with the phone: the heading's lines rise and tip up in 3D
 * one after another, then the lead, legend and footer follow. Once only;
 * nothing moves under reduced motion.
 */
function useCopyEntrance(rootRef: RefObject<HTMLDivElement | null>, isReduced: boolean): void {
  useGSAP(
    () => {
      const root = rootRef.current;
      const title = root?.querySelector<HTMLElement>(`.${css.title}`);
      if (isReduced || !root || !title) return;
      const trigger = { trigger: title, start: 'top 88%', once: true };
      const split = SplitText.create(title, {
        ...SPLIT_KEEP_NBSP,
        type: 'lines',
        linesClass: css.titleLine,
        autoSplit: true,
        onSplit: self =>
          gsap.from(self.lines, {
            yPercent: 70,
            rotationX: -70,
            autoAlpha: 0,
            transformPerspective: 700,
            transformOrigin: '50% 100% -0.3em',
            duration: 1.25,
            ease: 'expo.out',
            stagger: 0.11,
            scrollTrigger: trigger,
          }),
      });
      const rest = root.querySelectorAll<HTMLElement>('[data-enter]');
      gsap.from(rest, {
        y: 26,
        autoAlpha: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.07,
        delay: 0.25,
        scrollTrigger: trigger,
      });
      return () => split.revert();
    },
    { scope: rootRef, dependencies: [isReduced], revertOnUpdate: true }
  );
}

/**
 * 07 · Telegram — a café ordering bot on a CSS-3D phone that the visitor can
 * actually use: pick a drink, size and pickup time, pay (SMS-code card flow
 * for uz/ru, plain card for en), watch the order ride over to the café's
 * admin screen and the "ready" signal ride back, then open the Mini App menu.
 * It plays itself while in view; any tap takes over. Reduced motion: the
 * finished conversation, still clickable, no autoplay.
 */
export default function S07Telegram({ meta }: LabSectionProps) {
  const locale = useLocale();
  const currency = currencyForLocale(locale);
  const t = useTranslations('home.telegram');
  const copy = useS07Copy(currency);
  const needsCode = currency === 'uzs';
  const { scheme } = useLabTheme();
  const { tier, reducedMotion: isReduced, isTouch } = useLabDevice();
  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const isOnScreen = useInView(stageRef);
  const isEngaged = useInView(stageRef, '0px 0px -28% 0px');

  // Reduced motion opens on the finished conversation; otherwise the chat
  // starts once the phone is well inside the viewport.
  useEffect(() => {
    if (state.phase !== 'idle') return;
    if (isReduced) dispatch({ type: 'JUMP', to: 'final', needsCode, isAutopilot: false });
    else if (isEngaged) dispatch({ type: 'START', isInstant: false });
  }, [state.phase, isReduced, isEngaged, needsCode]);

  useDirector(state, dispatch, isOnScreen, { isReduced, needsCode });

  const tap = useCallback(
    (target: string) => {
      const action = actionFor(target, 'user', needsCode);
      if (action) dispatch(action);
    },
    [needsCode]
  );
  const hintTarget = isReduced ? null : autopilotTarget(state);
  const demo = useMemo<DemoContextValue>(
    () => ({ state, dispatch, currency, copy, needsCode, isReduced, hintTarget, tap }),
    [state, currency, copy, needsCode, isReduced, hintTarget, tap]
  );

  const part = state.phase === 'idle' ? null : activePart(state.phase);
  const isBlooming = !isReduced && isConfirmBeat(state.phase);
  useCopyEntrance(rootRef, isReduced);
  const jump = (to: PartId) => dispatch({ type: 'JUMP', to, needsCode, isAutopilot: !isReduced });
  const replay = () => dispatch({ type: 'RESTART', isAutopilot: !isReduced, isInstant: isReduced });

  return (
    <DemoContext.Provider value={demo}>
      <div
        ref={rootRef}
        className={css.root}
        data-scheme={scheme}
        data-paused={isOnScreen ? undefined : 'true'}
        data-bloom={isBlooming ? 'true' : undefined}
      >
        <div className={css.aura} aria-hidden='true' />
        <div className={css.inner}>
          <div className={css.intro}>
            <SectionHeading meta={meta} className={css.title}>
              {t('heading')}
            </SectionHeading>
            <p className={css.lead} data-enter>
              {copy.lead}
            </p>
          </div>

          <Stage rootRef={rootRef} stageRef={stageRef} isTiltEnabled={!isReduced && tier !== 'low'} isTouch={isTouch} />

          <div className={css.outro}>
            <ol className={css.legend}>
              {PART_IDS.map(id => ({ id, ...copy.legend(id) })).map((row, index) => (
                <li key={row.id} data-enter>
                  <button
                    type='button'
                    className={css.legendButton}
                    aria-current={part === row.id ? 'step' : undefined}
                    aria-label={`${row.term}: ${row.text} ${row.action}`}
                    onClick={() => jump(row.id)}
                    data-cursor={copy.cursor.show}
                    data-cursor-icon='show'
                  >
                    <span className={css.track} aria-hidden='true'>
                      <span className={css.fill} style={{ transform: `scaleY(${partProgress(state, row.id)})` }} />
                    </span>
                    <span className={css.num}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={css.term}>{row.term}</span>
                    <span className={css.legendText}>{row.text}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className={css.reach} data-enter>
              {copy.reach}
            </p>
            <div className={css.foot} data-enter>
              {PROOF_PROJECT && (
                <p className={css.proof}>
                  <Image className={css.proofThumb} src={PROOF_PROJECT.poster} alt='' width={48} height={48} sizes='48px' />
                  <span>{copy.proof}</span>
                </p>
              )}
              <button type='button' className={css.replay} onClick={replay} data-magnetic>
                <ReplayIcon />
                {copy.replay}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DemoContext.Provider>
  );
}
