'use client';

import { memo } from 'react';
import { CLUSTER_IDS, question } from './data';
import { statusAtLeast, type Turn } from './machine';
import css from './minimap.module.css';
import { ANCHORS, CLUSTERS, MAP_H, MAP_W, QUERY_AT, THRESHOLD_RADIUS } from './points';

/** A topic cloud's drawn radius, in standard deviations. */
const CLOUD_SPREAD = 1.7;
const QUERY_R = 26;
const HIT_R = 18;

/** The topic clouds: static, drawn once for every thumbnail. */
const Clouds = memo(function Clouds() {
  return (
    <>
      {CLUSTER_IDS.map(id => (
        <circle key={id} className={css.cloud} cx={CLUSTERS[id].x} cy={CLUSTERS[id].y} r={CLUSTERS[id].sigma * CLOUD_SPREAD} />
      ))}
    </>
  );
});

/**
 * Phones only (the full map sits beside the chat from 760px): a static
 * thumbnail of the index in the answer's status row, so the visitor sees where
 * the question landed and which snippets it reached while the big map is off
 * screen. The question's point shows while searching; the lines to the
 * snippets it found join it once the turn is found.
 */
export default function MiniMap({ turn }: { turn: Turn }) {
  const reply = question(turn.question).reply(turn.role);
  const isFound = statusAtLeast(turn.status, 'found');
  const query = QUERY_AT[turn.question];
  return (
    <svg className={css.mini} viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden='true' data-outcome={isFound ? reply.outcome : undefined}>
      <Clouds />
      {isFound && reply.outcome === 'missing' && <circle className={css.threshold} cx={query.x} cy={query.y} r={THRESHOLD_RADIUS} />}
      {isFound &&
        reply.hits.map(hit => {
          const anchor = ANCHORS[hit.anchor];
          return (
            <g key={hit.anchor} data-cite={hit.cite ? 'true' : undefined}>
              <line className={css.link} x1={query.x} y1={query.y} x2={anchor.x} y2={anchor.y} />
              <circle className={css.hit} cx={anchor.x} cy={anchor.y} r={HIT_R} />
            </g>
          );
        })}
      <circle className={css.query} cx={query.x} cy={query.y} r={QUERY_R} />
    </svg>
  );
}
