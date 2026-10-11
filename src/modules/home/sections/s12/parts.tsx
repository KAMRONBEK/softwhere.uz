'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties, MouseEvent, ReactNode, Ref } from 'react';
import { scrollToSection } from '../../global/scroll';
import { PROCESS_STEPS, useProcessSteps, VERSION_LABELS, type ProcessStep, type ProcessStepDef } from './copy';
import type { RouteDetail, RouteGeometry } from './geometry';
import { STAGE_ICONS } from './icons';
import css from './process.module.css';
import dcss from './details.module.css';

export const pad2 = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------------ */

/** The heading, whose full stop is a drawn dot: the route starts there. */
export function ProcessTitle() {
  const t = useTranslations('home.process');
  return (
    <>
      {t('heading')}
      <span className={css.period} data-period='' aria-hidden='true' />
    </>
  );
}

/* ------------------------------------------------------------------------ */

function onBookCall(event: MouseEvent<HTMLAnchorElement>) {
  // In ?only= mode there is no finale to jump to: leave the link inert.
  if (!document.getElementById('finale')) return;
  event.preventDefault();
  scrollToSection('finale');
}

/** The one action of the section: jump to the contact panel in the finale. */
function BookCallLink({ isGhost = false }: { isGhost?: boolean }) {
  const shared = useTranslations('home.shared');
  return (
    <a className={`${css.cta} ${isGhost ? css.ctaGhost : ''}`} href='#finale' onClick={onBookCall} data-magnetic=''>
      {shared('callCta')}
      <svg className={css.ctaArrow} viewBox='0 0 16 16' aria-hidden='true'>
        <path d='M3 8h10M9 4l4 4-4 4' />
      </svg>
    </a>
  );
}

interface StageBlockProps {
  step: ProcessStep;
  index: number;
  className?: string;
  style?: CSSProperties;
}

/** A stage's words: where it sits on the timeline, its name, one line, and (Discover) the call to act. */
export function StageBlock({ step, index, className, style }: StageBlockProps) {
  return (
    <div className={`${css.block} ${className ?? ''}`} style={style} data-block={index}>
      <p className={css.when} data-rise=''>
        <span className={css.whenIdx} aria-hidden='true'>
          {pad2(index + 1)}
        </span>
        {step.when}
      </p>
      <h3 id={`s12-${step.id}-title`} className={css.blockTitle} data-rise=''>
        {step.title}
      </h3>
      <p className={css.summary} data-rise=''>
        {step.summary}
      </p>
      {index === 0 && (
        // The wrapper takes the entrance transform, so the button keeps its own press scale.
        <div className={css.ctaWrap} data-rise=''>
          <BookCallLink />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** Where the line ends: the loop closes, the honest footnote, and a second way in. Revealed when the pen lands. */
export function Outro({ className, style }: { className?: string; style?: CSSProperties }) {
  const t = useTranslations('home.process');
  const shared = useTranslations('home.shared');
  return (
    <div className={`${css.outro} ${className ?? ''}`} style={style}>
      <p className={css.outroLine} style={{ '--k': 0 } as CSSProperties}>
        {t('outro')}
      </p>
      <p className={css.outroNote} style={{ '--k': 1 } as CSSProperties}>
        {t('footnote')} {shared('exactPriceLine')}
      </p>
      <div className={css.outroCta} style={{ '--k': 2 } as CSSProperties}>
        <BookCallLink isGhost />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

interface FactFlagProps {
  id: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  isOn?: boolean;
}

/** One deliverable, hung on the route: a dot on the line, a leader, the words. */
export function FactFlag({ id, children, className, style, isOn = false }: FactFlagProps) {
  return (
    <li className={`${css.flag} ${className ?? ''}`} style={style} data-flag={id} data-on={isOn ? 'true' : 'false'}>
      <span className={css.flagDot} aria-hidden='true' />
      <span className={css.flagLeader} aria-hidden='true' />
      <span className={css.flagText}>{children}</span>
    </li>
  );
}

/* ------------------------------------------------------------------------ */

interface StageNodeProps {
  step: Pick<ProcessStepDef, 'id'>;
  index: number;
  className?: string;
  style?: CSSProperties;
  isDone?: boolean;
}

/** The station on the line; its icon draws itself when the stage becomes active. */
export function StageNode({ step, index, className, style, isDone = false }: StageNodeProps) {
  const icon = STAGE_ICONS[step.id];
  return (
    <span
      className={`${css.node} ${className ?? ''}`}
      style={style}
      data-node={index}
      data-step={step.id}
      data-state={isDone ? 'done' : 'todo'}
      aria-hidden='true'
    >
      <span className={css.nodeRing} />
      <svg className={css.nodeIcon} viewBox='0 0 24 24'>
        {icon.parts.map((d, k) => (
          <path key={d} d={d} pathLength={1} data-part={k} style={{ '--k': k } as CSSProperties} />
        ))}
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------------ */

const BURST_RAYS = 10;

function Detail({ detail, isOn }: { detail: RouteDetail; isOn: boolean }) {
  const t = useTranslations('home.process');
  const common = { 'data-detail': detail.id, 'data-kind': detail.kind, 'data-on': isOn ? 'true' : 'false' };
  switch (detail.kind) {
    case 'flow': {
      const [a, b, c] = detail.points;
      return (
        <g {...common} className={dcss.dFlow}>
          <path d={`M${a.x} ${a.y}L${b.x} ${b.y}L${c.x} ${c.y}`} pathLength={1} className={dcss.dDraw} />
          {detail.points.map((pt, k) => (
            <circle key={k} cx={pt.x} cy={pt.y} r={detail.r} className={dcss.dPop} style={{ '--k': k + 1 } as CSSProperties} />
          ))}
        </g>
      );
    }
    case 'grip':
      return (
        <g {...common} className={dcss.dGrip}>
          <path d={`M${detail.from.x} ${detail.from.y}L${detail.to.x} ${detail.to.y}`} pathLength={1} />
        </g>
      );
    case 'phone': {
      const { x, y, w, h, divider } = detail;
      const inset = w * 0.12;
      const left = x + inset;
      const inner = w - inset * 2;
      const imgTop = y + h * 0.1;
      const imgBottom = divider - h * 0.05;
      const sun = { x: left + inner * 0.72, y: imgTop + (imgBottom - imgTop) * 0.3, r: Math.max(4, w * 0.05) };
      const lineY = (k: number) => divider + h * (0.08 + k * 0.065);
      const btnTop = y + h - h * 0.15;
      const btnH = h * 0.07;
      const cursor = { x: left + inner * 0.62, y: btnTop + btnH * 0.6 };
      return (
        <g {...common}>
          <path d={`M${x + w * 0.4} ${y + h * 0.045}H${x + w * 0.6}`} pathLength={1} className={dcss.dDraw} />
          <rect x={left} y={imgTop} width={inner} height={imgBottom - imgTop} rx={Math.min(10, w * 0.05)} className={dcss.dImage} />
          <circle cx={sun.x} cy={sun.y} r={sun.r} className={dcss.dSun} />
          <path
            d={`M${left + 2} ${imgBottom - 2}L${left + inner * 0.34} ${imgTop + (imgBottom - imgTop) * 0.5}L${left + inner * 0.56} ${imgBottom - (imgBottom - imgTop) * 0.24}L${left + inner * 0.7} ${imgBottom - (imgBottom - imgTop) * 0.36}L${left + inner - 2} ${imgBottom - 2}`}
            pathLength={1}
            className={dcss.dDraw}
            style={{ '--k': 1 } as CSSProperties}
          />
          {[0.86, 0.62, 0.74].map((share, k) => (
            <path
              key={k}
              d={`M${left} ${lineY(k)}H${left + inner * share}`}
              pathLength={1}
              className={dcss.dDraw}
              style={{ '--k': k + 2 } as CSSProperties}
            />
          ))}
          <rect x={left} y={btnTop} width={inner} height={btnH} rx={btnH / 2} className={dcss.dButton} />
          <g className={dcss.dCursor}>
            <path d={`M${cursor.x} ${cursor.y}l0 18l5-4.6l3.4 7.4l3-1.4l-3.4-7.2l6.6-0.4z`} className={dcss.dCursorShape} />
          </g>
        </g>
      );
    }
    case 'dot':
      return (
        <g {...common} className={dcss.dDot}>
          <g className={dcss.dDotMark}>
            <circle cx={detail.at.x} cy={detail.at.y} r={11} className={dcss.dDotHalo} />
            <circle cx={detail.at.x} cy={detail.at.y} r={4.5} className={dcss.dDotCore} />
          </g>
          <text x={detail.labelAt.x} y={detail.labelAt.y} textAnchor={detail.anchor} className={`${dcss.dLabel} ${dcss.dWeek}`}>
            {t('weekTag', { week: detail.week })}
          </text>
        </g>
      );
    case 'bracket': {
      const { from, to, labelAt, hasLine } = detail;
      return (
        <g {...common} className={dcss.dBracket}>
          {hasLine && (
            <path
              d={`M${from.x} ${from.y + 6}V${from.y}H${to.x}V${to.y + 6}`}
              pathLength={1}
              className={dcss.dDraw}
              style={{ '--k': 0 } as CSSProperties}
            />
          )}
          <text x={labelAt.x} y={labelAt.y} textAnchor='middle' className={dcss.dLabel}>
            {t('sprintLabel')}
          </text>
        </g>
      );
    }
    case 'tick': {
      const { at, isVertical, count } = detail;
      const tick = isVertical ? `M${at.x - 8} ${at.y}H${at.x + 8}` : `M${at.x} ${at.y - 8}V${at.y + 8}`;
      return (
        <g {...common} className={dcss.dTick}>
          <path d={tick} className={dcss.dTickLine} />
          <text
            x={isVertical ? at.x + 16 : at.x}
            y={isVertical ? at.y + 4 : at.y - 16}
            textAnchor={isVertical ? 'start' : 'middle'}
            className={dcss.dLabel}
          >
            {count}
          </text>
        </g>
      );
    }
    case 'burst': {
      const { at, r } = detail;
      return (
        <g {...common} style={{ '--bx': `${at.x}px`, '--by': `${at.y}px` } as CSSProperties}>
          {Array.from({ length: BURST_RAYS }, (_, k) => {
            const angle = (k / BURST_RAYS) * Math.PI * 2 - Math.PI / 2;
            const inner = r * (k % 2 ? 0.5 : 0.42);
            const outer = r * (k % 2 ? 0.82 : 1);
            return (
              <path
                key={k}
                d={`M${at.x + Math.cos(angle) * inner} ${at.y + Math.sin(angle) * inner}L${at.x + Math.cos(angle) * outer} ${at.y + Math.sin(angle) * outer}`}
                className={dcss.dRay}
                style={{ '--k': k % 3 } as CSSProperties}
              />
            );
          })}
        </g>
      );
    }
    case 'version':
      return (
        <g {...common} className={dcss.dVersion}>
          <text x={detail.at.x} y={detail.at.y} textAnchor='end' className={dcss.dLabel}>
            {VERSION_LABELS[detail.index]}
          </text>
        </g>
      );
    case 'arrow':
      return (
        <g {...common} className={dcss.dArrow}>
          <path d='M-15 -9L0 0L-15 9' transform={`translate(${detail.at.x} ${detail.at.y}) rotate(${detail.angle})`} />
        </g>
      );
    default:
      return null;
  }
}

interface RouteSvgProps {
  geometry: RouteGeometry;
  isStatic: boolean;
}

/**
 * The route: one static SVG with the dotted plan of the whole way, then one
 * small SVG per piece (its decorations, a soft halo on dark styles, the line
 * and the wet-ink run), so drawing a piece repaints only that piece.
 */
export function RouteSvg({ geometry, isStatic }: RouteSvgProps) {
  const { width, height, pieces, details } = geometry;
  return (
    <>
      <svg className={css.route} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden='true'>
        <g className={css.ghost}>
          {pieces.map((piece, i) => (
            <path key={i} d={piece.d} />
          ))}
        </g>
      </svg>
      {pieces.map((piece, i) => {
        const { x, y, w, h } = piece.box;
        return (
          <svg
            key={i}
            className={`${css.route} ${css.piece}`}
            style={{ left: x, top: y }}
            width={w}
            height={h}
            viewBox={`${x} ${y} ${w} ${h}`}
            aria-hidden='true'
          >
            {details
              .filter(detail => detail.piece === i)
              .map(detail => (
                <Detail key={detail.id} detail={detail} isOn={isStatic} />
              ))}
            <path d={piece.d} className={css.halo} pathLength={1} data-halo={i} />
            <path d={piece.d} className={css.line} pathLength={1} data-piece={i} />
            {!isStatic && <path d={piece.d} className={css.hot} pathLength={1} data-hot={i} />}
          </svg>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------------ */

const DIGITS = '0123456789'.split('');

interface OdometerProps {
  className?: string;
  tensRef: Ref<HTMLSpanElement>;
  onesRef: Ref<HTMLSpanElement>;
  plusRef: Ref<HTMLSpanElement>;
}

/** Two rolling digit wheels: the week counter. */
export function Odometer({ className, tensRef, onesRef, plusRef }: OdometerProps) {
  return (
    <span className={`${css.odometer} ${className ?? ''}`} aria-hidden='true'>
      <span className={css.digitWindow}>
        <span ref={tensRef} className={css.digitStrip}>
          {DIGITS.map(d => (
            <span key={d}>{d}</span>
          ))}
        </span>
      </span>
      <span className={css.digitWindow}>
        <span ref={onesRef} className={css.digitStrip} style={{ transform: 'translateY(-10%)' }}>
          {DIGITS.map(d => (
            <span key={d}>{d}</span>
          ))}
        </span>
      </span>
      <span ref={plusRef} className={css.digitPlus}>
        +
      </span>
    </span>
  );
}

/** The five stage names on a wheel; the renderer rolls it to the active one. */
export function NameWheel({ stripRef, className }: { stripRef: Ref<HTMLSpanElement>; className?: string }) {
  const steps = useProcessSteps();
  return (
    <span className={`${css.nameWindow} ${className ?? ''}`} aria-hidden='true'>
      <span ref={stripRef} className={css.nameStrip}>
        {steps.map(step => (
          <span key={step.id}>{step.title}</span>
        ))}
      </span>
    </span>
  );
}

/** The HUD glyph that morphs to the active stage's icon. */
export function MorphIcon({ pathRef, className }: { pathRef: Ref<SVGPathElement>; className?: string }) {
  return (
    <svg className={`${css.morph} ${className ?? ''}`} viewBox='0 0 24 24' aria-hidden='true'>
      <path ref={pathRef} d={STAGE_ICONS[PROCESS_STEPS[0].id].morph} />
    </svg>
  );
}
