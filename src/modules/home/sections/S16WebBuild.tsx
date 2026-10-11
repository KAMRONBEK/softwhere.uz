'use client';

import { SplitText } from 'gsap/SplitText';
import { useTranslations } from 'next-intl';
import { startTransition, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, useGSAP, SPLIT_KEEP_NBSP } from '../global/gsap';
import { scrollToSection, scrollToY } from '../global/scroll';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import { ArrowIcon, CheckIcon } from './s16/art';
import { BakeDefs } from './s16/bakery';
import Browser, { Toolbar } from './s16/Browser';
import { STEP_COUNT, STEPS, type StepId, type WidthMode } from './s16/data';
import Panels from './s16/Panels';
import css from './s16/section.module.css';
import SiteStack, { type SitePhase } from './s16/Site';
import { useModeDirector } from './s16/useModeDirector';
import { useSpecialEditor } from './s16/useSpecialEditor';
import { CopyContext, useCopy, useS16Copy } from './s16/useCopy';
import { useStepStory } from '../components/useStepStory';
import { useViewportMorph } from './s16/useViewportMorph';
import { useStoryKeys } from './useStoryKeys';

if (typeof window !== 'undefined') gsap.registerPlugin(SplitText);

/** The stage counts as arrived once its top three quarters are on screen. */
const ENGAGE_MARGIN = '0px 0px -25% 0px';
/** The section the closing button jumps to: the AI brief prices the visitor's own site. */
const PRICE_SECTION = 'ai-demo';
/** Still version on phones: room above the demo after a step tap brings it back (the header). */
const DEMO_JUMP_OFFSET = 72;

/** The heading's lines rise and tip up as it arrives, then the lead follows. Once; still under reduced motion. */
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
        y: 24,
        autoAlpha: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.08,
        delay: 0.25,
        scrollTrigger: trigger,
      });
      return () => split.revert();
    },
    { scope: rootRef, dependencies: [isReduced], revertOnUpdate: true }
  );
}

/** Latches true the first time the element enters the (shrunk) viewport. */
function useOnceInView(ref: RefObject<Element | null>, rootMargin: string): boolean {
  const [isSeen, setIsSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || isSeen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsSeen(true);
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, isSeen]);
  return isSeen;
}

function GetLine({ id }: { id: StepId }) {
  const copy = useCopy();
  return (
    <p className={css.get}>
      <span className={css.getLabel}>{copy.getLabel}</span> {copy.step(id).get}
    </p>
  );
}

function Outro() {
  const copy = useCopy();
  return (
    <footer className={css.outro}>
      <div className={css.deliver} data-enter>
        <p className={css.summary}>{copy.timeline}</p>
        <h3 className={css.deliverTitle}>{copy.deliverTitle}</h3>
        <ul className={css.deliverList}>
          {copy.deliver.map(item => (
            <li key={item}>
              <CheckIcon className={css.deliverIcon} />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className={css.next} data-enter>
        <p className={css.proof}>{copy.proof}</p>
        <p className={css.nextLine}>{copy.next}</p>
        <div className={css.action}>
          <button type='button' className={css.cta} onClick={() => scrollToSection(PRICE_SECTION)} data-magnetic>
            {copy.cta}
            <ArrowIcon className={css.ctaIcon} />
          </button>
          <p className={css.footnote}>{copy.footnote}</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * 09 · Website — how we build a website, told on an example bakery's site
 * in a browser frame, one step per slice of scroll (sticky stage): the
 * wireframe draws in, the design system paints it, the code step folds the
 * page from desktop to tablet to phone (every block flies to its new place),
 * a speed & SEO report counts up to green, the admin edits and publishes
 * today's special, and launch day shows the live domain with visitors and
 * pre-orders ticking. Each step says when it happens and what you get. The
 * visitor can switch the width and dark mode any time, edit the special,
 * and tap a step to jump to it. The site is pre-rendered once per layout and
 * only transforms and fades, so the demo never shifts the page.
 *
 * Phones: the step, what you get and its progress sit above the browser; the
 * cards rise over the foot of the page. Reduced motion: no scroll story; the
 * six steps as a list beside (phones: under) the demo, which opens on the
 * finished site; pick a step to show it. Every control still works.
 */
export default function S16WebBuild({ meta }: LabSectionProps) {
  const t = useTranslations('home.web-build');
  const copy = useS16Copy();
  const site = copy.site;
  const stepWords = STEPS.map(({ id }) => ({ id, ...copy.step(id) }));
  const { scheme } = useLabTheme();
  const { tier, reducedMotion: isStill, isTouch } = useLabDevice();

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLOutputElement>(null);

  const isOnScreen = useInView(stageRef);
  // The wireframe draws in once the stage is well on screen (at once in the still version).
  const isStarted = useOnceInView(stageRef, ENGAGE_MARGIN) || isStill;
  const [mode, setMode] = useState<WidthMode>('desktop');
  const [isUserMode, setIsUserMode] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [pingCount, setPingCount] = useState(0);

  const { step, goTo } = useStepStory(trackRef, rootRef, STEP_COUNT, !isStill);
  useStoryKeys({ trackRef, step, count: STEP_COUNT, goTo, isEnabled: !isStill });
  const stepId = STEPS[step].id;
  const isLive = isStarted && isOnScreen;

  // Before the story starts (and in the still version), width changes apply at once.
  const { isWide } = useViewportMorph(areaRef, readoutRef, mode, isStill || !isStarted, tier === 'low');
  useModeDirector({ stepId, mode, isActive: isLive, isReduced: isStill, isWide, isUserMode, setMode });
  const editor = useSpecialEditor(isLive && stepId === 'content', isStill, site.specialBefore, site.specialAfter);
  useCopyEntrance(rootRef, isStill);

  // Toolbar taps are transitions: the button answers at once, the page follows.
  const chooseMode = useCallback((next: WidthMode) => {
    startTransition(() => {
      setIsUserMode(true);
      setMode(next);
    });
  }, []);
  const toggleDark = useCallback(() => startTransition(() => setIsDark(value => !value)), []);
  const onOrder = useCallback(() => setPingCount(count => count + 1), []);

  const onPick = useCallback(
    (index: number) => {
      goTo(index);
      if (!isStill) return;
      // Still version on phones: the demo sits above the list, so bring it back into view (instantly).
      const top = setRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) scrollToY(window.scrollY + top - DEMO_JUMP_OFFSET);
    },
    [goTo, isStill]
  );

  const phase: SitePhase = !isStarted ? 'blank' : stepId === 'wire' ? 'wire' : 'design';

  return (
    <CopyContext.Provider value={copy}>
      <div
        ref={rootRef}
        className={css.root}
        data-scheme={scheme}
        data-tier={tier}
        data-touch={isTouch ? '' : undefined}
        data-still={isStill ? '' : undefined}
        data-paused={isOnScreen ? undefined : 'true'}
      >
        <BakeDefs />
        <header className={css.intro}>
          <SectionHeading meta={meta} className={css.title}>
            {t('heading')}
          </SectionHeading>
          <p className={css.lead} data-enter>
            {isStill ? copy.leadStill : copy.lead}
          </p>
        </header>

        <div ref={trackRef} className={css.track} data-s16-track=''>
          <div ref={stageRef} className={css.stage}>
            <div className={css.aura} aria-hidden='true' />

            <div className={css.side}>
              <ol className={css.legend} aria-label={copy.stepsLabel}>
                {stepWords.map((item, index) => (
                  <li key={item.id} className={css.legendItem} data-active={index === step ? 'true' : undefined}>
                    <button
                      type='button'
                      className={css.legendButton}
                      aria-current={index === step ? 'step' : undefined}
                      aria-label={copy.stepAction(item.term, item.when)}
                      onClick={() => onPick(index)}
                      data-cursor={copy.cursorShow}
                      data-cursor-icon='show'
                    >
                      <span className={css.rail} aria-hidden='true'>
                        <span className={css.railFill} data-fill='y' data-index={index} />
                      </span>
                      <span className={css.num}>{String(index + 1).padStart(2, '0')}</span>
                      <span className={css.term}>{item.term}</span>
                      <span className={css.when}>{item.when}</span>
                    </button>
                    <div className={css.legendBody}>
                      <p className={css.legendText}>{item.text}</p>
                      <GetLine id={item.id} />
                    </div>
                  </li>
                ))}
              </ol>
              {/* Story mode: every step's detail in one cell (the tallest sets its height), the current one shows. */}
              <div className={css.details}>
                {STEPS.map(({ id }, index) => (
                  <div key={id} className={css.detail} data-active={index === step ? 'true' : undefined}>
                    <p className={css.detailText}>{copy.step(id).text}</p>
                    <GetLine id={id} />
                  </div>
                ))}
              </div>
            </div>

            <div className={css.header}>
              <div className={css.captions}>
                {stepWords.map((item, index) => (
                  <div key={item.id} className={css.caption} data-active={index === step ? 'true' : undefined}>
                    <p className={css.headerTop}>
                      <span className={css.srOnly}>{`${String(index + 1).padStart(2, '0')} / ${String(STEP_COUNT).padStart(2, '0')}`}</span>
                      <span className={css.headerTerm}>{item.term}</span>
                      <span className={css.headerWhen}>{item.when}</span>
                    </p>
                    <p className={css.headerText}>{item.text}</p>
                    <GetLine id={item.id} />
                  </div>
                ))}
              </div>
              <div className={css.segments}>
                {stepWords.map((item, index) => (
                  <button
                    key={item.id}
                    type='button'
                    className={css.segment}
                    aria-current={index === step ? 'step' : undefined}
                    aria-label={copy.stepAction(item.term, item.when)}
                    onClick={() => onPick(index)}
                  >
                    <span className={css.segmentTrack} aria-hidden='true'>
                      <span className={css.segmentFill} data-fill='x' data-index={index} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div ref={setRef} className={css.set} role='group' aria-label={copy.demoLabel}>
              <Browser
                areaRef={areaRef}
                stepId={stepId}
                site={<SiteStack phase={phase} isDark={isDark} special={editor.edit.published} pingCount={pingCount} copy={site} />}
                panels={
                  <Panels
                    activeId={stepId}
                    isLive={isLive}
                    isReduced={isStill}
                    mode={mode}
                    editor={editor}
                    hours={site.hours}
                    onOrder={onOrder}
                  />
                }
              />
              <Toolbar mode={mode} isDark={isDark} readoutRef={readoutRef} onMode={chooseMode} onToggleDark={toggleDark} />
            </div>
          </div>
        </div>

        <Outro />
      </div>
    </CopyContext.Provider>
  );
}
