'use client';

import { SplitText } from 'gsap/SplitText';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MouseEvent,
  type RefObject,
} from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useStepStory } from '../components/useStepStory';
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
  SCENES,
  SCENE_PART,
  autopilotTarget,
  firstSceneOf,
  lastTurn,
  planNext,
  ragReducer,
  type CiteFocus,
  type RagAction,
  type RagState,
  type SceneId,
  type Turn,
} from './s17/machine';
import css from './s17/section.module.css';
import SourceFlight from './s17/SourceFlight';
import Steps from './s17/Steps';
import { useStoryKeys } from './useStoryKeys';

if (typeof window !== 'undefined') gsap.registerPlugin(SplitText);

/** Where the "price it" button goes: the AI brief. */
const PRICE_SECTION = 'ai-demo';
/** Scroll per scene (svh): long enough to watch a scene's beat at a reading pace. */
const SCENE_SVH = 75;
const TRACK_LEN = `${SCENES.length * SCENE_SVH}svh`;

/** What the beats depend on: everything but a pointed-at citation, so hovering never restarts a beat's timer. */
function beatKey(state: RagState): string {
  const turn = lastTurn(state);
  return [
    state.run,
    state.pipeline,
    state.log.length,
    turn?.key,
    turn?.status,
    state.autoStep,
    state.isAutopilot,
    state.tab,
    state.role,
  ].join('|');
}

/**
 * Runs the demo's timed beats one at a time, only while the stage is on
 * screen, never past the scene the scroll picked (`limit`). Any beat change
 * reschedules, so a visitor's tap cancels the pending autopilot step.
 */
function useDirector(
  state: RagState,
  dispatch: Dispatch<RagAction>,
  isActive: boolean,
  isReduced: boolean,
  isTouch: boolean,
  limit: SceneId | null,
  tokenCount: (turn: Turn) => number
): void {
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const beat = beatKey(state);
  useEffect(() => {
    if (!isActive) return;
    const step = planNext(stateRef.current, { isReduced, isTouch, limit, tokenCount });
    if (!step) return;
    const id = window.setTimeout(() => dispatch(step.action), step.delay);
    return () => window.clearTimeout(id);
  }, [beat, dispatch, isActive, isReduced, isTouch, limit, tokenCount]);
}

/**
 * Scroll → scene: when the scroll picks a new scene (and the stage is on
 * screen), the demo opens on it. Kept in a ref, so a scene is set once per
 * arrival; a remount (the section is torn down far away) starts fresh and
 * picks up wherever the scroll is.
 */
function useSceneFromScroll(scene: SceneId | null, isOnScreen: boolean, dispatch: Dispatch<RagAction>): (scene: SceneId | null) => void {
  const appliedRef = useRef<SceneId | null>(null);
  useEffect(() => {
    if (!scene || !isOnScreen || appliedRef.current === scene) return;
    appliedRef.current = scene;
    dispatch({ type: 'SCENE', scene });
  }, [scene, isOnScreen, dispatch]);
  return useCallback((next: SceneId | null) => {
    appliedRef.current = next;
  }, []);
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
 * chat. The files are read and cut into snippets that pour into the map as
 * an unsorted cloud; indexing sorts them into topics; a question enters the
 * map as a probe, hops through the snippets, locks on to the closest ones and
 * the chat answers with numbered sources that fly over from their dots. The
 * guardrails show themselves: the HR lock stops the probe for a dispatcher,
 * and a question the files can't answer gets "I don't know", which lands in
 * the insights as a gap to fill. Scripted, no AI call, no data leaves the page.
 *
 * Scroll-driven like 08, 09 and 11: a tall track with a sticky stage, its
 * progress picks the scene (read, index, answer, guard, "I don't know",
 * insights), each scene plays its beat by itself, scrolling back goes back,
 * and the steps glide the scroll to a part. Taps in the chat or on the map
 * take over inside a scene. Phones: the sticky screen shows the pane the
 * scene is about (the files and the map, then the map and the chat).
 * Reduced motion: no track; the indexed map and one answered question,
 * still clickable, no autoplay.
 */
export default function S17RagBuild({ meta }: LabSectionProps) {
  const t = useTranslations('home.rag-build');
  const { scheme } = useLabTheme();
  const { reducedMotion: isReduced, isTouch } = useLabDevice();
  const [state, dispatch] = useReducer(ragReducer, INITIAL_STATE);
  /**
   * Still version: the step the visitor picked. Reading and indexing have no
   * still frame of their own (the map shows them done), so without this a tap
   * on 01 or 02 would light up 03. Anything else the visitor does lets go.
   */
  const [pickedPart, setPickedPart] = useState<PartId | null>(null);
  const visitorDispatch = useCallback<Dispatch<RagAction>>(action => {
    if (action.type !== 'FOCUS') setPickedPart(null);
    dispatch(action);
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const isOnScreen = useInView(stageRef);
  const isScroll = !isReduced;

  const { step, goTo } = useStepStory(trackRef, rootRef, SCENES.length, isScroll);
  useStoryKeys({ trackRef, step, count: SCENES.length, goTo, isEnabled: isScroll });
  const scene = isScroll ? SCENES[step] : null;
  const markApplied = useSceneFromScroll(scene, isOnScreen, dispatch);

  // Reduced motion: the finished state at once, no scroll story.
  useEffect(() => {
    if (isReduced && state.pipeline === 'idle') dispatch({ type: 'RESTART', isAutopilot: false, isInstant: true });
  }, [state.pipeline, isReduced]);

  const tokenCount = useCallback((turn: Turn) => answerTokenCount(t, turn), [t]);
  useDirector(state, dispatch, isOnScreen, isReduced, isTouch, scene, tokenCount);
  useCopyEntrance(rootRef, isReduced);

  const focusCite = useCallback((focus: CiteFocus | null) => dispatch({ type: 'FOCUS', focus }), []);
  const shownTurn = useMemo(() => {
    const focused = state.focus ? state.log.find(entry => entry.kind === 'turn' && entry.key === state.focus?.turn) : null;
    return focused?.kind === 'turn' ? focused : lastTurn(state);
  }, [state]);
  const hintTarget = isReduced ? null : autopilotTarget(state, scene);
  const demo = useMemo<RagDemoValue>(
    () => ({ state, dispatch: visitorDispatch, isReduced, isTouch, hintTarget, shownTurn, focusCite }),
    [state, visitorDispatch, isReduced, isTouch, hintTarget, shownTurn, focusCite]
  );

  // Scroll owns the part: a step glides the scroll to it (the current one stays put).
  const jump = useCallback(
    (to: PartId) => {
      if (!isScroll) {
        dispatch({ type: 'JUMP', to, isInstant: true });
        setPickedPart(to);
      } else if (!scene || SCENE_PART[scene] !== to) goTo(firstSceneOf(to));
    },
    [isScroll, scene, goTo]
  );
  const replay = () => {
    if (!isScroll) {
      visitorDispatch({ type: 'RESTART', isAutopilot: false, isInstant: true });
      return;
    }
    // Back to the first scene and play it again (the glide passes the others on its way up).
    markApplied(SCENES[0]);
    dispatch({ type: 'SCENE', scene: SCENES[0] });
    goTo(0);
  };

  return (
    <RagDemoContext.Provider value={demo}>
      <div
        ref={rootRef}
        className={css.root}
        data-scheme={scheme}
        data-paused={isOnScreen ? undefined : 'true'}
        data-scroll={isScroll ? '' : undefined}
        style={isScroll ? ({ '--track-len': TRACK_LEN } as CSSProperties) : undefined}
      >
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

          <div ref={trackRef} className={css.track}>
            <div className={css.sticky} data-rag-sticky={isScroll ? '' : undefined}>
              <div className={css.stage} ref={stageRef} role='group' aria-label={t('demoLabel')} data-scene={scene ?? undefined}>
                <div className={css.paneSteps}>
                  <Steps onJump={jump} scene={scene} picked={isScroll ? null : pickedPart} />
                </div>
                <div className={css.paneLib}>
                  <Library />
                </div>
                <div className={css.paneMap}>
                  <IndexMap stageRef={stageRef} />
                </div>
                <div className={css.paneChat} data-rag-chat=''>
                  <Assistant />
                </div>
                <SourceFlight stageRef={stageRef} />
              </div>
            </div>
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
