'use client';

import { useTranslations } from 'next-intl';
import { memo, useMemo, type PointerEvent } from 'react';
import LabVideo from '../../media/LabVideo';
import { useProjectDescriber } from '../../media/useProjectDescriber';
import { CARD_MEDIA, CARD_PROJECT, PLATFORM_STATS } from './content';
import type { UiText } from './source';
import css from './preview.module.css';

export interface PreviewHandlers {
  onButtonHover: (isHovered: boolean) => void;
  onButtonClick: () => void;
  onToggle: () => void;
}

interface LayerProps {
  /** 'a' is the live, interactive layer; 'b' is its theme-flipped twin. */
  variant: 'a' | 'b';
  /** Value of `dark` this layer depicts. */
  isDark: boolean;
  uiText: UiText;
  isChecked?: boolean;
  handlers?: PreviewHandlers;
}

const PlayGlyph = () => (
  <svg viewBox='0 0 16 16' aria-hidden='true'>
    <path d='M5 3.2v9.6c0 .5.6.8 1 .5l7.2-4.8a.6.6 0 0 0 0-1L6 2.7c-.4-.3-1 0-1 .5Z' />
  </svg>
);

function isMouse(event: PointerEvent): boolean {
  return event.pointerType === 'mouse';
}

/**
 * One rendering of the Showcase screen. Every part starts as its wireframe
 * (`*Wire`, `*Skel`) and fills in as its code lands; the engine drives the
 * `data-fx` elements (transform/opacity only) and reads `data-el` boxes.
 */
function Layer({ variant, isDark, uiText, isChecked = false, handlers }: LayerProps) {
  const t = useTranslations('home.code-to-ui');
  const describer = useProjectDescriber();
  const isLive = variant === 'a';
  const TitleTag = isLive ? 'h3' : 'p';
  return (
    <div
      className={isLive ? css.layer : `${css.layer} ${css.inverted}`}
      data-layer={variant}
      aria-hidden={isLive ? undefined : true}
      inert={!isLive}
    >
      <div className={css.head}>
        <span className={css.live}>
          <i className={css.liveDot} />
          {t('preview')}
        </span>
        <span className={css.hmr} data-hmr='' aria-hidden='true'>
          <i className={css.hmrDot} />
          {t('updated')}
        </span>
        <code className={css.readout}>
          dark: <b>{String(isDark)}</b>
        </code>
      </div>

      <div className={css.canvas}>
        <div className={css.main} data-el='main'>
          <i className={css.mainSurface} data-fx='mainSurface' />
          <span className={css.mainClip} aria-hidden='true'>
            <i className={css.mainSheen} data-fx='mainSheen' />
          </span>
          <i className={css.mainWire} data-fx='mainWire' />

          <div className={css.card} data-el='card'>
            <i className={css.cardWire} data-fx='cardWire' />
            <div className={css.mediaSlot} data-el='media'>
              <i className={css.mediaWire} data-fx='mediaWire' />
            </div>
            <div className={css.cardText}>
              <i className={css.titleSkel} data-fx='titleSkel' />
              <i className={css.subSkel} data-fx='subSkel' />
              <TitleTag className={css.cardTitle} data-fx='title'>
                {describer.title(CARD_PROJECT)}
              </TitleTag>
              <p className={css.cardSub} data-fx='sub'>
                {describer.industry(CARD_PROJECT)} · {describer.location(CARD_PROJECT)}
              </p>
            </div>
          </div>

          <div className={css.controls}>
            <button
              type='button'
              className={css.btn}
              data-el='btn'
              data-fx='btn'
              onPointerEnter={event => isMouse(event) && handlers?.onButtonHover(true)}
              onPointerLeave={event => isMouse(event) && handlers?.onButtonHover(false)}
              onClick={handlers?.onButtonClick}
            >
              <i className={css.btnWire} data-fx='btnWire' />
              <span className={css.btnGlow} data-fx='btnGlow' />
              <span className={css.btnFill} data-fx='btnFill' />
              <span className={css.btnShine} data-fx='btnFill'>
                <i className={css.btnSheen} data-fx='btnSheen' />
              </span>
              <span className={css.btnContent} data-fx='btnContent'>
                <span className={css.btnIcon} data-fx='btnIcon'>
                  <PlayGlyph />
                </span>
                {uiText.button}
              </span>
            </button>

            <button
              type='button'
              role='switch'
              aria-checked={isChecked}
              className={css.toggle}
              data-el='toggle'
              onClick={handlers?.onToggle}
            >
              <i className={css.toggleWire} data-fx='toggleWire' />
              <span className={css.toggleLabel} data-fx='toggleLabel'>
                {uiText.toggle}
              </span>
              <span className={css.switch} data-el='switch' data-fx='switch'>
                <i className={css.switchOn} data-fx='switchOn' />
                <i className={css.knob} data-el='knob' data-fx='knob' />
              </span>
            </button>
          </div>

          <div className={css.chart} data-el='chart'>
            <i className={css.chartWire} data-fx='chartWire' />
            <div className={css.chartHead} data-fx='chartHead'>
              <span>{uiText.chartTitle}</span>
              <span className={css.chartNote}>{t('chartNote')}</span>
            </div>
            {PLATFORM_STATS.map((stat, i) => (
              <div key={stat.key} className={css.barRow}>
                <span className={css.barLabel} data-fx='barText'>
                  {describer.platform(stat.key)}
                </span>
                <span className={css.barTrack}>
                  <i className={css.barFill} data-bar={i} />
                </span>
                <span className={css.barCount} data-count={i} data-fx='barText'>
                  0
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PreviewProps {
  className?: string;
  uiText: UiText;
  /** Initial `dark` value (matches the style's scheme). */
  startsDark: boolean;
  /** The switch's current visual state, for aria-checked. */
  isChecked: boolean;
  isPlaying: boolean;
  isTouch: boolean;
  handlers: PreviewHandlers;
}

/**
 * The live preview: the interactive layer, its theme-flipped twin (revealed
 * from the switch by a scaling circle whose content is counter-scaled, so the
 * wipe is transform-only), and overlays shared by both: the walkthrough
 * video, the inspector frame, the landing ping and the scripted pointer.
 */
function Preview({ className, uiText, startsDark, isChecked, isPlaying, isTouch, handlers }: PreviewProps) {
  const title = useProjectDescriber().title(CARD_PROJECT);
  const media = useMemo(() => ({ ...CARD_MEDIA, name: title }), [title]);
  return (
    <div className={`${css.slot} ${className ?? ''}`} data-slot=''>
      <i className={css.lift} data-lift='' aria-hidden='true' />
      <div className={css.pane} data-pane=''>
        <Layer variant='a' isDark={startsDark} uiText={uiText} isChecked={isChecked} handlers={handlers} />
        <div className={css.reveal} data-reveal='' aria-hidden='true'>
          <div className={css.revealInner} data-reveal-inner=''>
            <Layer variant='b' isDark={!startsDark} uiText={uiText} />
          </div>
        </div>

        <div className={css.media} data-media=''>
          <div className={css.mediaInner} data-media-inner=''>
            {/* Re-keyed so scrolling back before the click restores the still. */}
            <LabVideo key={isPlaying ? 'playing' : 'still'} project={media} shouldPlay={isPlaying} className={css.video} />
          </div>
          <span className={css.badge} data-badge='' aria-hidden='true'>
            <PlayGlyph />
          </span>
        </div>

        <div className={css.insp} data-insp='' aria-hidden='true'>
          {['t', 'b', 'l', 'r'].map(edge => (
            <i key={edge} className={css.edge} data-edge={edge} />
          ))}
          {['tl', 'tr', 'bl', 'br'].map(corner => (
            <i key={corner} className={css.handle} data-handle={corner} />
          ))}
          <span className={css.inspTag} data-insp-tag=''>
            <b data-insp-name='' />
            <span className={css.inspSize} data-insp-size='' />
          </span>
        </div>
        <i className={css.ping} data-ping='' aria-hidden='true' />

        <div className={css.pointer} data-pointer='' aria-hidden='true'>
          <span className={css.ripple} data-ripple='' />
          {isTouch ? (
            <span className={css.finger} data-tap='' />
          ) : (
            <svg className={css.arrow} data-tap='' viewBox='0 0 22 22'>
              <path d='M2 2v16.6l4.4-4.1 3.1 6.6 2.9-1.3-3-6.4h6.2Z' />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(Preview);
