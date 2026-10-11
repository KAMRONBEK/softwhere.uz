/**
 * The vector index as a 2D map: one dot per passage, grouped into topic
 * clusters, plus the named passages the demo questions retrieve and where
 * each question lands. Coordinates are in map units (MAP_W × MAP_H).
 *
 * Built once at module load from a seeded PRNG using arithmetic only (no
 * trig or logs), so the server and every browser engine produce identical
 * numbers and hydration never mismatches.
 */
import { DOCS, type AnchorId, type ClusterId, type DocId, type QuestionId } from './data';

export const MAP_W = 600;
export const MAP_H = 420;

interface ClusterDef {
  x: number;
  y: number;
  /** Spread (≈ one standard deviation) in map units. */
  sigma: number;
  /** Where its label sits, and which side of the anchor point the text hangs. */
  label: { x: number; y: number; align: 'start' | 'end' | 'middle' };
}

export const CLUSTERS: Record<ClusterId, ClusterDef> = {
  rates: { x: 205, y: 140, sigma: 36, label: { x: 205, y: 76, align: 'middle' } },
  customs: { x: 395, y: 98, sigma: 30, label: { x: 440, y: 44, align: 'middle' } },
  fleet: { x: 478, y: 250, sigma: 38, label: { x: 586, y: 180, align: 'end' } },
  warehouse: { x: 300, y: 322, sigma: 32, label: { x: 340, y: 394, align: 'start' } },
  hr: { x: 104, y: 312, sigma: 28, label: { x: 14, y: 386, align: 'start' } },
};

interface QueryDef {
  x: number;
  y: number;
  /** No ordinary passage lands closer than this (keeps the drawn lines legible). */
  clear: number;
}

/** Where each question's embedding lands. Charity sits in empty space: nothing is close. */
export const QUERY_AT: Record<QuestionId, QueryDef> = {
  surcharge: { x: 292, y: 126, clear: 24 },
  salary: { x: 170, y: 262, clear: 22 },
  charity: { x: 70, y: 112, clear: 70 },
};

/** The radius of "close enough" around a query (the 0.75 threshold, drawn). */
export const THRESHOLD_RADIUS = 58;

interface AnchorDef {
  doc: DocId;
  cluster: ClusterId;
  x: number;
  y: number;
}

/** The passages the questions retrieve, placed by hand so the drawn distances match the scores. */
export const ANCHORS: Record<AnchorId, AnchorDef> = {
  surcharge: { doc: 'rates', cluster: 'rates', x: 266, y: 136 },
  customsFee: { doc: 'customs', cluster: 'customs', x: 334, y: 108 },
  fuelCards: { doc: 'handbook', cluster: 'rates', x: 244, y: 170 },
  payGrades: { doc: 'hr', cluster: 'hr', x: 142, y: 284 },
  payReview: { doc: 'hr', cluster: 'hr', x: 132, y: 248 },
  leave: { doc: 'hr', cluster: 'hr', x: 160, y: 318 },
  volume: { doc: 'rates', cluster: 'rates', x: 156, y: 124 },
  minLoad: { doc: 'rates', cluster: 'rates', x: 162, y: 160 },
  palletRate: { doc: 'rates', cluster: 'warehouse', x: 146, y: 186 },
};

export interface MapPoint {
  id: string;
  doc: DocId;
  cluster: ClusterId;
  x: number;
  y: number;
  /** Radius in CSS pixels (the map converts it to map units). */
  r: number;
  /** Set on a named passage that a question retrieves. */
  anchor?: AnchorId;
}

/** mulberry32: tiny, fast, deterministic. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bell-shaped noise in about [-1.7, 1.7] (Irwin–Hall, no trig, identical on every engine). */
function bell(rand: () => number): number {
  return (rand() + rand() + rand() - 1.5) * 1.15;
}

const round = (value: number) => Math.round(value * 10) / 10;
const EDGE = 14;

function isClear(x: number, y: number): boolean {
  if (x < EDGE || x > MAP_W - EDGE || y < EDGE || y > MAP_H - EDGE) return false;
  for (const query of Object.values(QUERY_AT)) {
    const dx = x - query.x;
    const dy = y - query.y;
    if (dx * dx + dy * dy < query.clear * query.clear) return false;
  }
  return true;
}

function buildPoints(): MapPoint[] {
  const rand = prng(0x5f17);
  const points: MapPoint[] = [];
  const anchors = Object.entries(ANCHORS) as Array<[AnchorId, AnchorDef]>;
  for (const doc of DOCS) {
    for (const [clusterId, count = 0] of Object.entries(doc.spread) as Array<[ClusterId, number | undefined]>) {
      const cluster = CLUSTERS[clusterId];
      const own = anchors.filter(([, anchor]) => anchor.doc === doc.id && anchor.cluster === clusterId);
      for (const [id, anchor] of own) {
        points.push({ id: `${doc.id}-${id}`, doc: doc.id, cluster: clusterId, x: anchor.x, y: anchor.y, r: 3.3, anchor: id });
      }
      for (let i = own.length; i < count; i++) {
        let x = cluster.x;
        let y = cluster.y;
        for (let attempt = 0; attempt < 24; attempt++) {
          x = cluster.x + bell(rand) * cluster.sigma;
          y = cluster.y + bell(rand) * cluster.sigma * 0.86;
          if (isClear(x, y)) break;
        }
        points.push({
          id: `${doc.id}-${clusterId}-${i}`,
          doc: doc.id,
          cluster: clusterId,
          x: round(x),
          y: round(y),
          r: round(2.4 + rand() * 1.5),
        });
      }
    }
  }
  return points;
}

export const POINTS: readonly MapPoint[] = buildPoints();

/**
 * Each passage linked to its two nearest neighbours in the same cluster: the
 * navigable graph an HNSW index (pgvector's) walks to find neighbours fast.
 * One SVG path, so it costs a single element.
 */
function buildLinks(points: readonly MapPoint[]): string {
  const seen = new Set<string>();
  const segments: string[] = [];
  for (const point of points) {
    const near = points
      .filter(other => other !== point && other.cluster === point.cluster)
      .map(other => ({ other, d: (other.x - point.x) * (other.x - point.x) + (other.y - point.y) * (other.y - point.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { other, d } of near) {
      const key = point.id < other.id ? `${point.id}|${other.id}` : `${other.id}|${point.id}`;
      if (seen.has(key) || d > 46 * 46) continue;
      seen.add(key);
      segments.push(`M${point.x} ${point.y}L${other.x} ${other.y}`);
    }
  }
  return segments.join('');
}

export const LINKS_PATH = buildLinks(POINTS);

export function anchorPoint(id: AnchorId): AnchorDef {
  return ANCHORS[id];
}

/** Percent position inside the map box, for HTML overlays (labels, pills). */
export function toPercent(x: number, y: number): { left: string; top: string } {
  return { left: `${(x / MAP_W) * 100}%`, top: `${(y / MAP_H) * 100}%` };
}

/* ── Motion data: the unsorted cloud while reading, and the retrieval probe's walk ── */

/**
 * Where each snippet sits right after reading, before indexing sorts it by
 * topic: an unsorted cloud over the whole map (aligned with POINTS). Seeded,
 * so the server and every browser agree.
 */
function buildScatter(points: readonly MapPoint[]): ReadonlyArray<{ x: number; y: number }> {
  const rand = prng(0x51a7);
  const pad = EDGE * 2;
  return points.map(() => ({ x: round(pad + rand() * (MAP_W - pad * 2)), y: round(pad + rand() * (MAP_H - pad * 2)) }));
}

export const SCATTER = buildScatter(POINTS);

/** One stop of the probe's walk through the index: a snippet it checks, and whether it is a match. */
export interface ProbeStop {
  x: number;
  y: number;
  kind: 'miss' | 'hit' | 'lock';
}

/** The snippet nearest to a spot, so every stop of the walk lands on a real dot. */
function nearestPoint(x: number, y: number, exclude: ClusterId | null = null): { x: number; y: number } {
  let best = POINTS[0];
  let bestD = Infinity;
  for (const point of POINTS) {
    if (point.cluster === exclude) continue;
    const d = (point.x - x) * (point.x - x) + (point.y - y) * (point.y - y);
    if (d < bestD) {
      best = point;
      bestD = d;
    }
  }
  return { x: best.x, y: best.y };
}

const miss = (x: number, y: number): ProbeStop => ({ ...nearestPoint(x, y, 'hr'), kind: 'miss' });

/**
 * The walk a question's probe takes, like a vector search hopping through
 * the index graph: a couple of far snippets that don't match (they flash and
 * dim), then the question's own spot. What follows depends on the answer
 * (the hits lock on, the HR lock stops it, or nothing is close).
 */
export const PROBE_WALK: Record<QuestionId, readonly ProbeStop[]> = {
  surcharge: [miss(478, 250), miss(395, 98)],
  salary: [miss(300, 322), miss(205, 150)],
  charity: [miss(205, 140), miss(160, 60)],
};
