'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectionHeading } from '../components/LabSection';
import { useInView } from '../components/useInView';
import { useDeviceTier, useIsTouch, useReducedMotion } from '../device/useDeviceTier';
import { gsap, useGSAP } from '../global/gsap';
import { useProjectDescriber } from '../media/useProjectDescriber';
import { useLabTheme } from '../theme/useLabTheme';
import type { LabSectionProps } from '../types';
import Caption from './s05/Caption';
import { BAR_COUNTS, BAR_RATIOS, CARD_KEY, CARD_PROJECT, CODE_FACTS } from './s05/content';
import Editor from './s05/Editor';
import { CodeToUIEngine } from './s05/engine';
import Preview, { type PreviewHandlers } from './s05/Preview';
import { buildSource, tokenize, type UiText } from './s05/source';
import type { CaptionId } from './s05/story';
import { buildModel } from './s05/timeline';
import css from './s05/section.module.css';

/** The story starts while the stage glides in, so it lands half-built. */
const SCROLL_START = 'top 72%';

/**
 * 05 · Code to UI — a split view where TSX types itself block by block as you
 * scroll (scroll back to erase it) and a live preview fills in its wireframe
 * in sync: a card with a real app's walkthrough → a button the pointer clicks
 * (the walkthrough plays) → a dark-mode switch whose circular wipe flips the
 * whole preview (the midpoint) → a chart of our real portfolio → "Compiled",
 * and the product steps forward out of its code. A plain-English caption
 * under the preview says what each block just did.
 *
 * Phones: preview pinned on top, caption, editor below, a finger instead of a
 * cursor. Reduced motion: 150svh, the finished file and screen side by side,
 * still and fully interactive.
 */
export default function S05CodeToUI({ meta }: LabSectionProps) {
  const { scheme, styleId } = useLabTheme();
  const reducedMotion = useReducedMotion();
  const isTouch = useIsTouch();
  const tier = useDeviceTier();
  const startsDark = scheme === 'dark';
  const t = useTranslations('home.code-to-ui');
  const describer = useProjectDescriber();
  const cardKind = describer.describe(CARD_PROJECT);

  const uiText = useMemo<UiText>(() => ({ button: t('ui.button'), toggle: t('ui.toggle'), chartTitle: t('ui.chartTitle') }), [t]);
  const lines = useMemo(() => buildSource({ uiText, appKey: CARD_KEY, startsDark }), [uiText, startsDark]);
  const tokens = useMemo(() => tokenize(lines), [lines]);
  const model = useMemo(() => buildModel(lines), [lines]);
  const source = useMemo(() => lines.join('\n'), [lines]);
  const captions = useMemo<Record<CaptionId, string>>(
    () => ({
      ready: t('captions.ready'),
      main: t('captions.main'),
      card: t('captions.card', { kind: cardKind }),
      btn: t('captions.btn'),
      press: isTouch ? t('captions.pressTouch') : t('captions.pressMouse'),
      toggle: t('captions.toggle'),
      flip: t('captions.flip'),
      chart: t('captions.chart', CODE_FACTS),
      ship: t('captions.ship'),
    }),
    [t, cardKind, isTouch]
  );
  const staticCaptions = useMemo(() => ({ row: t('captions.still'), stack: t('captions.stillStacked') }), [t]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CodeToUIEngine | null>(null);
  const isInView = useInView(stageRef, '15% 0px');

  // Engine + scroll scrub. Re-created when the code (scheme) or motion mode changes.
  useGSAP(
    () => {
      const stage = stageRef.current;
      const track = trackRef.current;
      if (!stage || !track) return;
      const engine = new CodeToUIEngine(stage, {
        model,
        uiText,
        startsDark,
        barRatios: BAR_RATIOS,
        barCounts: BAR_COUNTS,
        isStatic: reducedMotion,
        captions,
        staticCaptions,
        onPlayingChange: setIsPlaying,
        onFlipChange: setIsFlipped,
      });
      if (!engine.isReady) return;
      engineRef.current = engine;
      engine.measure();

      if (reducedMotion) {
        engine.render(1);
      } else {
        const proxy = { p: 0 };
        const render = () => engine.render(proxy.p);
        gsap.to(proxy, {
          p: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: track,
            start: SCROLL_START,
            end: 'bottom bottom',
            scrub: isTouch ? 0.4 : 0.3,
            invalidateOnRefresh: true,
            // A refresh reverts the tween (rendering p = 0) and restores the progress silently.
            onRefresh: render,
          },
          onUpdate: render,
        });
      }

      return () => {
        engine.destroy();
        if (engineRef.current === engine) engineRef.current = null;
      };
    },
    { dependencies: [model, uiText, startsDark, reducedMotion, isTouch, captions, staticCaptions], scope: rootRef, revertOnUpdate: true }
  );

  // Pause the per-frame easing offscreen (also re-applied to a re-created engine).
  useEffect(() => {
    engineRef.current?.setActive(isInView);
  }, [isInView, model, reducedMotion, isTouch, captions]);

  // Re-measure on resize, font loads and style flips (fonts change the code metrics).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => engineRef.current?.measure());
    };
    const observer = new ResizeObserver(remeasure);
    observer.observe(stage);
    const fonts = document.fonts;
    fonts?.addEventListener('loadingdone', remeasure);
    fonts?.ready.then(remeasure).catch(() => undefined);
    remeasure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      fonts?.removeEventListener('loadingdone', remeasure);
    };
  }, [styleId]);

  const onButtonHover = useCallback((isHovered: boolean) => engineRef.current?.setUserHover(isHovered), []);
  const onButtonClick = useCallback(() => engineRef.current?.playByUser(), []);
  const onToggle = useCallback(() => engineRef.current?.toggleTheme(), []);
  const handlers = useMemo<PreviewHandlers>(() => ({ onButtonHover, onButtonClick, onToggle }), [onButtonHover, onButtonClick, onToggle]);

  return (
    <div ref={rootRef} className={css.root}>
      <header className={css.intro}>
        <SectionHeading meta={meta} className={css.title}>
          {t('heading')}
          <span className={css.titleCaret} aria-hidden='true' />
        </SectionHeading>
        <div className={css.copy}>
          <p className={css.lede}>{t('lede')}</p>
          <p className={css.stat}>{t('stat', CODE_FACTS)}</p>
        </div>
      </header>

      <div ref={trackRef} className={css.track}>
        <div ref={stageRef} className={css.stage} data-tier={tier} data-static={reducedMotion ? '1' : '0'}>
          <div className={css.editorSlot} data-editor-slot=''>
            <Editor tokens={tokens} source={source} firstTypedLine={model.firstTypedLine} />
          </div>
          <Preview
            className={css.previewSlot}
            uiText={uiText}
            startsDark={startsDark}
            isChecked={startsDark !== isFlipped}
            isPlaying={isPlaying}
            isTouch={isTouch}
            handlers={handlers}
          />
          <Caption className={css.captionSlot} initial={captions.ready} />
          <svg className={css.wire} aria-hidden='true'>
            <path className={css.wirePath} data-wire-path='' />
            <circle className={css.wireDot} data-wire-dot='' r='3' />
            <circle className={css.wireDot} data-wire-dot='' r='3' />
          </svg>
        </div>
      </div>
    </div>
  );
}
