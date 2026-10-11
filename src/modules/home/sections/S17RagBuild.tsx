'use client';

import { SplitText } from 'gsap/SplitText';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useReducer, useRef, type Dispatch, type MouseEvent, type RefObject } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, useGSAP, SPLIT_KEEP_NBSP } from '../global/gsap';
import { scrollToSection } from '../global/scroll';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import Assistant from './s17/Assistant';
import { RagDemoContext, type RagDemoValue } from './s17/context';
import { GET_IDS, TIMELINE, type PartId } from './s17/data';
import { answerTokenCount } from './s17/i18n';
import { ArrowIcon, BookIcon, CheckIcon, ReplayIcon, ShieldIcon } from './s17/icons';
import IndexMap from './s17/IndexMap';
import Library from './s17/Library';
import {
  INITIAL_STATE,
  autopilotTarget,
  lastTurn,
  planNext,
  ragReducer,
  type CiteFocus,
  type RagAction,
  type RagState,
  type Turn,
} from './s17/machine';
import css from './s17/section.module.css';
import SourceFlight from './s17/SourceFlight';
import Steps from './s17/Steps';

if (typeof window !== 'undefined') gsap.registerPlugin(SplitText);

/** Where the "price it" button goes: the AI brief. */
const PRICE_SECTION = 'ai-demo';

/**
 * Runs the demo's timed beats one at a time, only while the stage is on
 * screen. Any state change reschedules, so a visitor's tap cancels the
 * pending autopilot step.
 */
function useDirector(
  state: RagState,
  dispatch: Dispatch<RagAction>,
  isActive: boolean,
  isReduced: boolean,
  isTouch: boolean,
  isChatInView: boolean,
  tokenCount: (turn: Turn) => number
): void {
  useEffect(() => {
    if (!isActive) return;
    const step = planNext(state, { isReduced, isTouch, isChatInView, tokenCount });
    if (!step) return;
    const id = window.setTimeout(() => dispatch(step.action), step.delay);
    return () => window.clearTimeout(id);
  }, [state, dispatch, isActive, isReduced, isTouch, isChatInView, tokenCount]);
}

/** The heading's lines tip up in 3D one after another, then the rest follows. Once; still under reduced motion. */
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
      gsap.from(root.querySelectorAll<HTMLElement>('[data-enter]'), {
        y: 26,
        autoAlpha: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.07,
        delay: 0.25,
        scrollTrigger: trigger,
        clearProps: 'transform',
      });
      return () => split.revert();
    },
    { scope: rootRef, dependencies: [isReduced], revertOnUpdate: true }
  );
}

function onPriceIt(event: MouseEvent<HTMLAnchorElement>) {
  // In ?only= mode there is no AI brief to go to: leave the link inert.
  event.preventDefault();
  if (document.getElementById(PRICE_SECTION)) scrollToSection(PRICE_SECTION);
}

/**
 * 10 · AI on your docs — how we build RAG, told on a sample logistics
 * company, on one stage: the pipeline across the top, the company's five
 * files, the index as a constellation of snippets (the hero) and a staff
 * chat. The files are read and cut into snippets that pour into the map
 * (drawn dim from the first paint); a question lands on the map, draws lines
 * to the snippets it finds and the chat answers with numbered sources that
 * fly over from their dots. The guardrails show themselves: HR files stay
 * locked for a dispatcher, and a question the files can't answer gets "I
 * don't know", which lands in the insights as a gap to fill. Scripted, no AI
 * call, no data leaves the page. It plays itself while in view; any tap
 * takes over. Reduced motion: the indexed map and one answered question,
 * still clickable, no autoplay.
 */
export default function S17RagBuild({ meta }: LabSectionProps) {
  const t = useTranslations('home.rag-build');
  const { scheme } = useLabTheme();
  const { reducedMotion: isReduced, isTouch } = useLabDevice();
  const [state, dispatch] = useReducer(ragReducer, INITIAL_STATE);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const isOnScreen = useInView(stageRef);
  // Reading starts as soon as the stage's top is well in view, so the index is built by the time
  // the visitor reaches the chat.
  const isStageEngaged = useInView(stageRef, '0px 0px -12% 0px');
  const isChatInView = useInView(chatRef, '0px 0px -18% 0px');

  useEffect(() => {
    if (state.pipeline !== 'idle') return;
    if (isReduced) dispatch({ type: 'RESTART', isAutopilot: false, isInstant: true });
    else if (isStageEngaged) dispatch({ type: 'START' });
  }, [state.pipeline, isReduced, isStageEngaged]);

  const tokenCount = useCallback((turn: Turn) => answerTokenCount(t, turn), [t]);
  useDirector(state, dispatch, isOnScreen, isReduced, isTouch, isChatInView, tokenCount);
  useCopyEntrance(rootRef, isReduced);

  const focusCite = useCallback((focus: CiteFocus | null) => dispatch({ type: 'FOCUS', focus }), []);
  const shownTurn = useMemo(() => {
    const focused = state.focus ? state.log.find(entry => entry.kind === 'turn' && entry.key === state.focus?.turn) : null;
    return focused?.kind === 'turn' ? focused : lastTurn(state);
  }, [state]);
  const hintTarget = isReduced ? null : autopilotTarget(state);
  const demo = useMemo<RagDemoValue>(
    () => ({ state, dispatch, isReduced, isTouch, hintTarget, shownTurn, focusCite }),
    [state, isReduced, isTouch, hintTarget, shownTurn, focusCite]
  );

  const jump = useCallback((to: PartId) => dispatch({ type: 'JUMP', to, isInstant: isReduced }), [isReduced]);
  const replay = () => dispatch({ type: 'RESTART', isAutopilot: !isReduced, isInstant: isReduced });

  return (
    <RagDemoContext.Provider value={demo}>
      <div ref={rootRef} className={css.root} data-scheme={scheme} data-paused={isOnScreen ? undefined : 'true'}>
        <div className={css.aura} aria-hidden='true' />
        <div className={css.inner}>
          <header className={css.intro}>
            <SectionHeading meta={meta} className={css.title}>
              {t('heading')}
            </SectionHeading>
            <div className={css.introAside}>
              <p className={css.lead} data-enter>
                {t('lead')}
              </p>
              <p className={css.privacy} data-enter>
                <span className={css.privacyIcon} aria-hidden='true'>
                  <ShieldIcon />
                </span>
                <span>
                  <b>{t('privacyTitle')}</b> {t('privacy')}
                </span>
              </p>
            </div>
          </header>

          <div className={css.stage} ref={stageRef} role='group' aria-label={t('demoLabel')}>
            <div className={css.paneSteps}>
              <Steps onJump={jump} />
            </div>
            <div className={css.paneLib}>
              <Library />
            </div>
            <div className={css.paneMap}>
              <IndexMap stageRef={stageRef} />
            </div>
            <div className={css.paneChat} ref={chatRef}>
              <Assistant />
            </div>
            <SourceFlight stageRef={stageRef} />
          </div>

          <footer className={css.outro}>
            <div className={css.get} data-enter>
              <h3 className={css.outroTitle}>{t('getTitle')}</h3>
              <ul className={css.getList}>
                {GET_IDS.map(id => (
                  <li key={id}>
                    <CheckIcon className={css.getIcon} />
                    {t(`get.${id}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div className={css.timeline} data-enter>
              <h3 className={css.outroTitle}>{t('weeksLabel')}</h3>
              <dl className={css.weeks}>
                {TIMELINE.map(row => (
                  <div key={row.id} className={css.weeksRow}>
                    <dt className={css.weeksValue}>{t('weeks', row.weeks)}</dt>
                    <dd className={css.weeksScope}>{t(`timeline.${row.id}`)}</dd>
                  </div>
                ))}
              </dl>
              <p className={css.weeksNote}>{t('weeksNote')}</p>
            </div>
            <div className={css.close} data-enter>
              <p className={css.proof}>
                <span className={css.proofIcon} aria-hidden='true'>
                  <BookIcon />
                </span>
                <span>
                  <span className={css.muted}>{t('proof')}</span>
                  <span className={css.next}>{t('next')}</span>
                </span>
              </p>
              <div className={css.actions}>
                <a className={css.cta} href={`#${PRICE_SECTION}`} onClick={onPriceIt} data-magnetic=''>
                  {t('cta')}
                  <ArrowIcon className={css.ctaIcon} />
                </a>
                <button type='button' className={css.replay} onClick={replay}>
                  <ReplayIcon />
                  {t('replay')}
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </RagDemoContext.Provider>
  );
}
