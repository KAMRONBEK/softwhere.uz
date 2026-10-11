'use client';

import { useTranslations } from 'next-intl';
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useLabDevice } from '../../device/useDeviceTier';
import { CLUSTER_IDS, DOCS, THRESHOLD, TOTAL_PASSAGES, percent, question } from './data';
import { useRagDemo } from './context';
import { LockIcon } from './icons';
import { statusAtLeast } from './machine';
import { useMapLean, useSnippetFlight } from './mapMotion';
import css from './map.module.css';
import { ANCHORS, CLUSTERS, LINKS_PATH, MAP_H, MAP_W, POINTS, QUERY_AT, THRESHOLD_RADIUS, toPercent } from './points';
import Probe from './Probe';

const HR_DOCS = new Set(DOCS.filter(doc => doc.isHrOnly).map(doc => doc.id));
/** Dot sizes are CSS pixels; the map converts them to map units so dots stay crisp at any width. */
const HIT_R = 4.6;
const QUERY_R = 5.4;
/** The searching sweep's reach, as a share of the map's width. */
const SCAN_SIZE = `${((THRESHOLD_RADIUS * 2.8) / MAP_W) * 100}%`;
/** The dots drift in a few groups, each on its own slow loop (one CSS animation per group, not per dot). */
const DRIFT_GROUPS = 3;
const GROUPED = Array.from({ length: DRIFT_GROUPS }, (_, group) =>
  POINTS.map((point, index) => ({ point, index })).filter(({ index }) => index % DRIFT_GROUPS === group)
);

/** Map units per CSS pixel, kept in sync with the rendered width. */
function useMapUnit(ref: RefObject<HTMLDivElement | null>): number {
  const [unit, setUnit] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setUnit(MAP_W / width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return unit;
}

/** One path of small rings: where every snippet will land. Shown dim until the index is built. */
function ghostPath(unit: number): string {
  return POINTS.map(point => {
    const r = Math.round(point.r * unit * 9) / 10;
    return `M${point.x - r} ${point.y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  }).join('');
}

/** The graph and the 148 snippets: static per width, so the demo's beats never re-render them. */
const Passages = memo(function Passages({ unit }: { unit: number }) {
  const ghost = useMemo(() => ghostPath(unit), [unit]);
  return (
    <>
      <path className={css.ghost} d={ghost} />
      <path className={css.links} d={LINKS_PATH} pathLength={1} />
      {GROUPED.map((group, groupIndex) => (
        <g key={groupIndex} className={css.drift} data-drift={groupIndex}>
          {group.map(({ point, index }) => (
            <circle
              key={point.id}
              className={css.dot}
              cx={point.x}
              cy={point.y}
              r={point.r * unit}
              data-i={index}
              data-doc-dot={point.doc}
              data-hr={HR_DOCS.has(point.doc) ? 'true' : undefined}
            />
          ))}
        </g>
      ))}
    </>
  );
});

/**
 * The vector index as a map of meaning: one dot per snippet, close dots mean
 * similar text. The map is drawn dim from the first paint (the slots the
 * snippets will fill); reading pours each file's snippets into an unsorted
 * cloud, indexing pulls them into their topics and draws the links between
 * near neighbours. Once indexed it lives: the dots drift, and on desktop the
 * ones near the pointer lean toward it and glow. A question enters as a probe
 * (Probe.tsx), lands as a point, and lines reach the snippets it retrieves
 * with their match. HR snippets are hollow (locked) unless you're signed in
 * as HR; a question with nothing close enough shows the empty "close enough"
 * ring around it. Reduced motion and weak devices: no drift, no lean, no probe
 * under reduced motion.
 */
export default function IndexMap({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  const t = useTranslations('home.rag-build');
  const { state, shownTurn, isReduced, isTouch } = useRagDemo();
  const { tier } = useLabDevice();
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const unit = useMapUnit(boxRef);
  const isLively = !isReduced && tier !== 'low';
  useSnippetFlight(svgRef, stageRef, state.pipeline, !isReduced, isTouch, state.run);
  useMapLean(boxRef, svgRef, isLively && !isTouch && state.pipeline === 'ready');

  const isHrLocked = state.role !== 'hr';
  const turn = shownTurn && statusAtLeast(shownTurn.status, 'searching') ? shownTurn : null;
  const reply = turn ? question(turn.question).reply(turn.role) : null;
  const isFound = Boolean(turn && statusAtLeast(turn.status, 'found'));
  const query = turn ? QUERY_AT[turn.question] : null;
  const outcome = reply?.outcome ?? null;
  const isBlocked = outcome === 'blocked';
  const focusCite = state.focus && turn && state.focus.turn === turn.key ? state.focus.cite : null;
  const turnKey = `${state.run}-${turn?.key ?? 0}`;

  return (
    <div
      className={css.map}
      data-pipeline={state.pipeline}
      data-outcome={isFound ? (outcome ?? undefined) : undefined}
      data-still={isLively ? undefined : 'true'}
    >
      <p className={css.head}>
        <span className={css.title}>{t('map.title')}</span>
        <span className={css.count}>{t('map.count', { count: TOTAL_PASSAGES })}</span>
      </p>
      <div className={css.box} ref={boxRef} data-map-box=''>
        <div className={css.grid} aria-hidden='true' />
        {CLUSTER_IDS.map(id => (
          <span
            key={id}
            className={css.hull}
            style={{ ...toPercent(CLUSTERS[id].x, CLUSTERS[id].y), '--s': CLUSTERS[id].sigma / MAP_W } as CSSProperties}
            data-locked={id === 'hr' && isHrLocked ? 'true' : undefined}
            aria-hidden='true'
          />
        ))}
        <svg
          ref={svgRef}
          className={css.svg}
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          role='img'
          aria-label={t('map.label')}
          style={{ '--u': unit } as CSSProperties}
        >
          <g
            className={css.dots}
            data-dim={isFound ? 'true' : undefined}
            data-searching={turn?.status === 'searching' ? 'true' : undefined}
            data-locked={isHrLocked ? 'true' : undefined}
          >
            <Passages unit={unit} />
          </g>
          {turn && query && reply && (
            <g key={turnKey} className={css.retrieval}>
              {isFound && outcome === 'missing' && (
                <circle className={css.threshold} cx={query.x} cy={query.y} r={THRESHOLD_RADIUS} vectorEffect='non-scaling-stroke' />
              )}
              {isFound &&
                reply.hits.map((hit, index) => {
                  const anchor = ANCHORS[hit.anchor];
                  return (
                    <line
                      key={hit.anchor}
                      className={css.link}
                      x1={query.x}
                      y1={query.y}
                      x2={anchor.x}
                      y2={anchor.y}
                      pathLength={outcome === 'answered' ? 1 : undefined}
                      vectorEffect='non-scaling-stroke'
                      style={{ '--k': index } as CSSProperties}
                      data-cite={hit.cite ? 'true' : undefined}
                      data-focus={hit.cite && hit.cite === focusCite ? 'true' : undefined}
                    />
                  );
                })}
              {isFound &&
                reply.hits.map((hit, index) => {
                  const anchor = ANCHORS[hit.anchor];
                  return (
                    <g key={hit.anchor} className={css.hit} style={{ '--k': index } as CSSProperties}>
                      <circle
                        className={css.hitRing}
                        cx={anchor.x}
                        cy={anchor.y}
                        r={HIT_R * 2 * unit}
                        vectorEffect='non-scaling-stroke'
                        data-focus={hit.cite && hit.cite === focusCite ? 'true' : undefined}
                      />
                      <circle
                        className={css.hitDot}
                        cx={anchor.x}
                        cy={anchor.y}
                        r={HIT_R * unit}
                        data-cite={hit.cite ? 'true' : undefined}
                      />
                    </g>
                  );
                })}
              <circle className={css.query} cx={query.x} cy={query.y} r={QUERY_R * unit} />
            </g>
          )}
        </svg>
        <div className={css.overlay} aria-hidden='true'>
          {CLUSTER_IDS.map(id => {
            const isLocked = id === 'hr' && isHrLocked;
            return (
              <span
                key={id}
                className={css.label}
                style={toPercent(CLUSTERS[id].label.x, CLUSTERS[id].label.y)}
                data-align={CLUSTERS[id].label.align}
                data-locked={isLocked ? 'true' : undefined}
              >
                {isLocked && <LockIcon />}
                {t(`clusters.${id}`)}
                {isLocked && <span className={css.labelNote}>{t('map.locked')}</span>}
              </span>
            );
          })}
          {isFound &&
            reply?.hits.map((hit, index) => {
              const anchor = ANCHORS[hit.anchor];
              return (
                <span
                  key={`${turnKey}-${hit.anchor}`}
                  className={css.score}
                  style={{ ...toPercent(anchor.x, anchor.y), '--k': index } as CSSProperties}
                  data-cite={hit.cite && outcome === 'answered' ? 'true' : undefined}
                  data-low={hit.score < THRESHOLD ? 'true' : undefined}
                  data-focus={hit.cite && hit.cite === focusCite ? 'true' : undefined}
                  data-side={query && anchor.x < query.x ? 'left' : 'right'}
                >
                  {isBlocked && <LockIcon />}
                  {hit.cite && !isBlocked && <b>{hit.cite}</b>}
                  {percent(hit.score)}
                </span>
              );
            })}
          {isFound && outcome === 'missing' && query && (
            <span key={`gap-${turnKey}`} className={css.gap} style={toPercent(query.x - THRESHOLD_RADIUS, query.y - THRESHOLD_RADIUS - 16)}>
              {t('map.nothingClose')}
            </span>
          )}
        </div>
        {/* Animated HTML (compositor-only) above everything else in the map, so nothing static paints over it. */}
        {query && (
          <div className={css.fx} aria-hidden='true'>
            {!isFound && !isReduced && (
              <span key={`scan-${turnKey}`} className={css.scan} style={{ ...toPercent(query.x, query.y), width: SCAN_SIZE }} />
            )}
            <span key={`halo-${turnKey}`} className={css.halo} style={toPercent(query.x, query.y)} />
          </div>
        )}
        {turn?.status === 'searching' && !isReduced && <Probe key={`probe-${turnKey}`} turn={turn} boxRef={boxRef} />}
      </div>
      <p className={css.caption}>{t('map.caption')}</p>
    </div>
  );
}
