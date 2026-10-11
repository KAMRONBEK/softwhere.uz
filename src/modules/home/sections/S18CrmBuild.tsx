'use client';

import { SplitText } from 'gsap/SplitText';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useLabDevice } from '../device/useDeviceTier';
import { gsap, ScrollTrigger, useGSAP, SPLIT_KEEP_NBSP } from '../global/gsap';
import { getLabLenis, scrollToSection, scrollToY } from '../global/scroll';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import { boardReducer } from './s18/board';
import { DELIVER_IDS, INITIAL_BOARD, TIMELINE_WEEKS, currencyForLocale, type DealId, type ModuleId, type RoleId } from './s18/data';
import { buildDemo } from './s18/demo';
import { CrmEngine } from './s18/engine';
import { ArrowDownIcon, CheckIcon, ReplayIcon } from './s18/icons';
import { SHIPPED_ADMIN_WORK } from './s18/proof';
import css from './s18/section.module.css';
import type { Slot } from './s18/board';
import {
  CHAPTERS,
  CHAPTER_COUNT,
  SCROLL_SCREENS,
  chapterAt,
  chapterIndexOfModule,
  chapterLanding,
  chapterProgress,
  moduleOf,
  morphProgress,
} from './s18/story';
import Window from './s18/Window';
import { useStoryKeys } from './useStoryKeys';

if (typeof window !== 'undefined') gsap.registerPlugin(SplitText);

/** Reduced motion opens on the spreadsheet (chapter 0), as the lead says; the rail opens the admin. */
const REDUCED_START_CHAPTER = 0;
/** The spreadsheet with its problems flagged (the morph's first beat). */
const BEFORE_T = 0.14;
const JUMP_SECONDS = 1.1;
/** The "imported" toast: at most this long, and only while the board is the chapter. */
const TOAST_MS = 3600;
const PIPELINE_CHAPTER = 1;

/**
 * Rail fill elements ([data-fill-chapter=i]), scaled along their own axis:
 * by scroll progress `p`, or (reduced motion) full for the picked chapter.
 */
function railFills(root: HTMLElement | null): HTMLElement[] {
  return Array.from(root?.querySelectorAll<HTMLElement>('[data-fill-chapter]') ?? []);
}

function paintRail(fills: readonly HTMLElement[], fill: (index: number) => number): void {
  fills.forEach(el => {
    const value = fill(Number(el.dataset.fillChapter)).toFixed(4);
    el.style.transform = el.dataset.axis === 'x' ? `scaleX(${value})` : `scaleY(${value})`;
  });
}

/**
 * Heading lines tip up on entry, the rest follows (as in 07). Once; still under reduced motion.
 * The lines drop their 3D transform when they land, so the heading doesn't keep a layer that
 * Chrome would merge with the sticky stage's.
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
        autoSplit: true,
        onSplit: self =>
          gsap.from(self.lines, {
            yPercent: 70,
            rotationX: -70,
            autoAlpha: 0,
            transformPerspective: 700,
            transformOrigin: '50% 100% -0.3em',
            duration: 1.2,
            ease: 'expo.out',
            stagger: 0.11,
            clearProps: 'transform,transformOrigin',
            scrollTrigger: trigger,
          }),
      });
      gsap.from(root.querySelectorAll<HTMLElement>('[data-enter]'), {
        y: 24,
        autoAlpha: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.08,
        delay: 0.2,
        scrollTrigger: trigger,
      });
      return () => split.revert();
    },
    { scope: rootRef, dependencies: [isReduced], revertOnUpdate: true }
  );
}

/** "a, b and c" with the visitor's "and" (not Intl.ListFormat: Node and browsers disagree for uz, which breaks hydration). */
function joinList(items: readonly string[], and: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

/** "01 / 06": the chapter counter (digits only, the same in every language). */
function stepOf(index: number, total: number): string {
  return `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
}

/**
 * 11 · CRM & Admin — "how we build" a CRM, told on one app window. A messy
 * shared spreadsheet (duplicates, painted cells, a #REF! total, four copies)
 * sorts itself out as you scroll: problems get flagged, duplicates merge,
 * rows lift off and land as cards on a pipeline board, and the admin's
 * chrome fades in. Then five chapters, each live and touchable: the board
 * (drag or tap cards), roles (switch who you are), an automation (a new
 * lead → Telegram alert → task), reports (this month is the live board) and
 * integrations (tools switching on). Each plays a little by itself first.
 *
 * The track is (1 + SCROLL_SCREENS) screens with a sticky stage; the rail
 * (desktop) or the segment bar (phones) shows the chapter and jumps to any.
 * Reduced motion: no sticky track; the finished admin with clickable
 * chapters, chapter 01 showing the spreadsheet it replaced.
 */
export default function S18CrmBuild({ meta }: LabSectionProps) {
  const locale = useLocale();
  const t = useTranslations('home.crm-build');
  const demo = useMemo(() => buildDemo(currencyForLocale(locale), t), [locale, t]);
  const { scheme } = useLabTheme();
  const { tier, reducedMotion: isReduced, isTouch } = useLabDevice();

  const [board, dispatch] = useReducer(boardReducer, INITIAL_BOARD);
  /** The chapter the scroll is in (motion), or the one picked on the rail (reduced motion). */
  const [scrollChapter, setScrollChapter] = useState(0);
  const [pickedChapter, setPickedChapter] = useState<number | null>(null);
  const chapter = isReduced ? (pickedChapter ?? REDUCED_START_CHAPTER) : scrollChapter;
  const [isLive, setIsLive] = useState(false);
  const [role, setRole] = useState<RoleId>('owner');
  const [runs, setRuns] = useState(0);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CrmEngine | null>(null);
  const slotsRef = useRef<Map<DealId, Slot> | null>(null);
  const storyRef = useRef<ScrollTrigger | null>(null);
  const chapterRef = useRef(chapter);
  const hasToastedRef = useRef(false);
  const toastTimerRef = useRef(0);
  const isOnScreen = useInView(stageRef);

  useEffect(() => {
    chapterRef.current = chapter;
  }, [chapter]);

  // The engine reports the admin coming alive; the first time, "6 deals imported" shows.
  const onLiveChange = useCallback((live: boolean) => {
    setIsLive(live);
    if (!live || hasToastedRef.current) return;
    hasToastedRef.current = true;
    setIsToastVisible(true);
    toastTimerRef.current = window.setTimeout(() => setIsToastVisible(false), TOAST_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  // The engine and the scroll story.
  useGSAP(
    () => {
      const body = bodyRef.current;
      const track = trackRef.current;
      if (!body || !track) return;
      const engine = new CrmEngine(body, { isTiltEnabled: !isReduced && tier !== 'low', onLiveChange });
      engineRef.current = engine;
      if (slotsRef.current) engine.setSlots(slotsRef.current);
      engine.measure();

      if (isReduced) {
        engine.render(chapterRef.current === 0 ? BEFORE_T : 1);
      } else {
        const proxy = { p: 0 };
        const fills = railFills(rootRef.current);
        const apply = () => {
          // Reverting the tween renders it once more: ignore that.
          if (engineRef.current !== engine) return;
          engine.render(morphProgress(proxy.p));
          paintRail(fills, index => chapterProgress(proxy.p, index));
          const next = chapterAt(proxy.p);
          setScrollChapter(prev => (prev === next ? prev : next));
        };
        const tween = gsap.to(proxy, {
          p: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: track,
            start: 'top top',
            end: 'bottom bottom',
            scrub: isTouch ? 0.35 : 0.25,
            invalidateOnRefresh: true,
            // A refresh (a section above or below changed height) reverts the tween, which renders
            // p = 0, then restores the progress without an update: repaint from the restored value.
            onRefresh: apply,
          },
          onUpdate: apply,
        });
        storyRef.current = tween.scrollTrigger ?? null;
        apply();
      }

      // Layout reads on resize, font swaps and style flips.
      let frame = 0;
      const remeasure = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => engine.measure());
      };
      const observer = new ResizeObserver(remeasure);
      observer.observe(body);
      document.fonts?.addEventListener('loadingdone', remeasure);

      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        document.fonts?.removeEventListener('loadingdone', remeasure);
        storyRef.current = null;
        engine.destroy();
        if (engineRef.current === engine) engineRef.current = null;
      };
    },
    { scope: rootRef, dependencies: [isReduced, isTouch, tier, onLiveChange], revertOnUpdate: true }
  );

  // Reduced motion: chapter 01 shows the spreadsheet, every other chapter the admin.
  useEffect(() => {
    if (!isReduced) return;
    engineRef.current?.render(chapter === 0 ? BEFORE_T : 1);
    paintRail(railFills(rootRef.current), index => (index === chapter ? 1 : 0));
  }, [isReduced, chapter]);

  useCopyEntrance(rootRef, isReduced);

  const goTo = useCallback(
    (index: number) => {
      if (isReduced) {
        setPickedChapter(index);
        return;
      }
      const story = storyRef.current;
      // Scroll owns the chapter: the current one stays put (a glide would rewind it).
      if (!story || index === chapterRef.current) return;
      const y = story.start + chapterLanding(index) * (story.end - story.start);
      const lenis = getLabLenis();
      if (lenis) lenis.scrollTo(y, { duration: JUMP_SECONDS });
      else scrollToY(y);
    },
    [isReduced]
  );

  useStoryKeys({ trackRef, step: chapter, count: CHAPTER_COUNT, goTo, isEnabled: !isReduced });

  const onNavigate = useCallback((id: ModuleId) => goTo(chapterIndexOfModule(id)), [goTo]);
  const onRun = useCallback(() => setRuns(n => n + 1), []);
  const onReplay = () => {
    dispatch({ type: 'RESET' });
    goTo(0);
  };

  const activeModule = moduleOf(CHAPTERS[chapter]);
  const effectiveRole: RoleId = activeModule === 'roles' ? role : 'owner';

  return (
    <div
      ref={rootRef}
      className={css.root}
      data-scheme={scheme}
      data-paused={isOnScreen ? undefined : 'true'}
      data-reduced={isReduced ? '' : undefined}
      style={{ '--scroll-screens': SCROLL_SCREENS } as CSSProperties}
    >
      <header className={css.intro}>
        <SectionHeading meta={meta} className={css.title}>
          {t('heading')}
        </SectionHeading>
        <p className={css.lead} data-enter>
          {t('lead')} {isReduced ? t('leadActionStill') : t('leadAction')}
        </p>
      </header>

      <div ref={trackRef} className={css.track}>
        <div ref={stageRef} className={css.stage}>
          <nav className={css.rail} aria-label={t('railLabel')}>
            <p className={css.railStep} aria-hidden='true'>
              {stepOf(chapter, CHAPTER_COUNT)}
            </p>
            <ol className={css.railList}>
              {CHAPTERS.map((item, index) => (
                <li key={item}>
                  <button
                    type='button'
                    className={css.railButton}
                    aria-current={index === chapter ? 'step' : undefined}
                    aria-label={t('chapterAction', { term: t(`chapters.${item}.term`) })}
                    onClick={() => goTo(index)}
                    data-cursor={t('cursor.show')}
                  >
                    <span className={css.railTrack} aria-hidden='true'>
                      <span className={css.railFill} data-fill-chapter={index} data-axis='y' />
                    </span>
                    <span className={css.railNum} aria-hidden='true'>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={css.railTerm} aria-hidden='true'>
                      {t(`chapters.${item}.term`)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {/* Every chapter's line in one cell: the tallest sets the height, so nothing moves. */}
            <div className={css.railTexts}>
              {CHAPTERS.map((item, index) => (
                <p
                  key={item}
                  className={css.railText}
                  data-current={index === chapter ? '' : undefined}
                  aria-hidden={index === chapter ? undefined : true}
                >
                  {t(`chapters.${item}.text`)}
                </p>
              ))}
            </div>
          </nav>

          <div className={css.caption}>
            <div className={css.segments}>
              {CHAPTERS.map((item, index) => (
                <button
                  key={item}
                  type='button'
                  className={css.segment}
                  aria-current={index === chapter ? 'step' : undefined}
                  aria-label={t('chapterAction', { term: t(`chapters.${item}.term`) })}
                  onClick={() => goTo(index)}
                >
                  <span className={css.segmentTrack} aria-hidden='true'>
                    <span className={css.segmentFill} data-fill-chapter={index} data-axis='x' />
                  </span>
                </button>
              ))}
            </div>
            <div className={css.captionStack}>
              {CHAPTERS.map((item, index) => (
                <p
                  key={item}
                  className={css.captionText}
                  data-current={index === chapter ? '' : undefined}
                  aria-hidden={index === chapter ? undefined : true}
                >
                  <span className={css.captionStep}>{stepOf(index, CHAPTER_COUNT)}</span>
                  <span className={css.captionTerm}>{t(`chapters.${item}.term`)}</span>
                  <span className={css.captionBody}>{t(`chapters.${item}.text`)}</span>
                </p>
              ))}
            </div>
          </div>

          <div className={css.window}>
            <Window
              bodyRef={bodyRef}
              engineRef={engineRef}
              slotsRef={slotsRef}
              board={board}
              dispatch={dispatch}
              demo={demo}
              module={activeModule}
              role={effectiveRole}
              onRole={setRole}
              runs={runs}
              onRun={onRun}
              isLive={isLive}
              isPlaying={isOnScreen}
              isTouch={isTouch}
              isReduced={isReduced}
              isToastVisible={isToastVisible && isLive && chapter === PIPELINE_CHAPTER}
              onNavigate={onNavigate}
              onAnnounce={setAnnouncement}
            />
          </div>
        </div>
      </div>

      <footer className={css.outro}>
        <div className={css.deliver} data-enter>
          <p className={css.timeline}>
            <span className={css.timelineLabel}>{t('timeline.label')}</span>
            <span className={css.timelineValue}>{t('timeline.value', TIMELINE_WEEKS)}</span>
            <span className={css.timelineNote}>{t('timeline.note')}</span>
          </p>
          <h3 className={css.deliverTitle}>{t('deliverTitle')}</h3>
          <ul className={css.deliverList}>
            {DELIVER_IDS.map(id => (
              <li key={id}>
                <CheckIcon className={css.deliverIcon} />
                {t(`deliver.${id}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className={css.next} data-enter>
          {SHIPPED_ADMIN_WORK.length > 0 && (
            <p className={css.shipped}>
              {t('shipped', {
                list: joinList(
                  SHIPPED_ADMIN_WORK.map(slug => t(`shippedWork.${slug}`)),
                  t('and')
                ),
              })}
            </p>
          )}
          <p className={css.nextLine}>{t('next')}</p>
          <div className={css.actions}>
            <button type='button' className={css.cta} onClick={() => scrollToSection('ai-demo')} data-magnetic>
              {t('cta')}
              <ArrowDownIcon className={css.ctaIcon} />
            </button>
            <button type='button' className={css.replay} onClick={onReplay}>
              <ReplayIcon className={css.replayIcon} />
              {t('replay')}
            </button>
          </div>
        </div>
      </footer>

      <p className={css.srOnly} aria-live='polite'>
        {announcement}
      </p>
    </div>
  );
}
