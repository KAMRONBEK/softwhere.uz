/**
 * Parsing + math helpers for rendering stored blog charts natively.
 *
 * Stored post markdown embeds charts as QuickChart image URLs whose `c=`
 * query param is the URL-encoded Chart.js v2 config the writer model emitted
 * (see renderChartBlocks in normalize.ts). Instead of shipping that static
 * white PNG, the blog post page decodes the config back out of the URL and
 * renders a themed SVG/HTML chart. The QuickChart <img> remains the fallback
 * for anything this parser rejects, so a bad config can never break a post.
 */

export interface ChartSeries {
  label: string;
  /** Aligned with labels; null = missing point (gap in a line). */
  values: (number | null)[];
}

export interface ParsedChart {
  /** bar covers Chart.js bar + horizontalBar + radar; pie renders as doughnut. */
  form: 'bar' | 'line' | 'doughnut';
  labels: string[];
  series: ChartSeries[];
}

const QUICKCHART_SRC = /^https:\/\/quickchart\.io\/chart\?/;

// Renderable forms. radar (never emitted by the current writer prompt) maps to
// grouped bars — same data shape, far more legible; pie maps to doughnut.
// A Map, not an object literal: a bare object index would resolve inherited
// keys, so a config of type "constructor"/"toString"/"__proto__" would yield a
// truthy non-form and slip past the guard as an empty chart.
const FORM_BY_TYPE = new Map<string, ParsedChart['form']>([
  ['bar', 'bar'],
  ['horizontalBar', 'bar'],
  ['radar', 'bar'],
  ['line', 'line'],
  ['pie', 'doughnut'],
  ['doughnut', 'doughnut'],
]);

const MAX_SERIES = 6; // palette slots are finite and never cycled
const MAX_LINE_POINTS = 24;
const MAX_DONUT_SLICES = 6;
const MAX_CATEGORIES = 40; // bar rows; beyond this the card is a wall, not a chart
// Values beyond this magnitude break the tick math (float steps stop advancing)
// and are never real blog figures. Reject rather than render garbage.
const MAX_MAGNITUDE = 1e12;

/**
 * Slice-color slot order per doughnut slice count (1-based --chart-N slots).
 * In a ring the LAST slice touches the FIRST, so the linear slot order is not
 * enough: e.g. with 5 slices, slots 1..5 close the ring green↔orange — a pair
 * that collapses under deuteranopia (ΔE 3.6). These orders were derived by
 * enumerating slot arrangements (anchored on the ember-orange slot 1) and
 * maximizing the worst CYCLIC-adjacent CVD ΔE with the dataviz validator in
 * both themes; every ring pair clears ΔE ≥ 10 (target 8). Re-derive if the
 * --chart-* hexes change.
 */
export const DONUT_SLOT_ORDER: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 2, 4],
  4: [1, 4, 3, 6],
  5: [1, 2, 4, 3, 6],
  6: [1, 2, 3, 4, 5, 6],
};

// null = a genuine gap (Chart.js uses null for "no point here"). OUT_OF_RANGE
// is distinct: it means the config carries a number we refuse to plot, which
// must reject the whole chart rather than quietly become a gap.
const OUT_OF_RANGE = Symbol('out-of-range');

function toNumberOrNull(v: unknown): number | null | typeof OUT_OF_RANGE {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return OUT_OF_RANGE;
  return Math.abs(n) <= MAX_MAGNITUDE ? n : OUT_OF_RANGE;
}

/**
 * Decode a QuickChart URL back into a chart the page can render natively.
 * Returns null for anything unexpected — the caller falls back to the <img>.
 */
export function parseQuickChartSrc(src: string | undefined): ParsedChart | null {
  if (!src || !QUICKCHART_SRC.test(src)) return null;
  let cfg: unknown;
  try {
    const encoded = new URL(src).searchParams.get('c');
    if (!encoded) return null;
    cfg = JSON.parse(encoded);
  } catch {
    return null;
  }
  if (!cfg || typeof cfg !== 'object') return null;
  const { type, data } = cfg as { type?: unknown; data?: unknown };
  const form = typeof type === 'string' ? FORM_BY_TYPE.get(type) : undefined;
  if (!form || !data || typeof data !== 'object') return null;

  const rawLabels = (data as { labels?: unknown }).labels;
  const rawDatasets = (data as { datasets?: unknown }).datasets;
  if (!Array.isArray(rawLabels) || !Array.isArray(rawDatasets)) return null;

  const labels = rawLabels.map(l => String(l ?? '').trim());
  if (labels.length === 0 || labels.length > MAX_CATEGORIES) return null;
  // More series than palette slots: don't silently drop data — fall back.
  if (rawDatasets.length > MAX_SERIES) return null;

  const series: ChartSeries[] = [];
  for (const ds of rawDatasets) {
    if (!ds || typeof ds !== 'object' || !Array.isArray((ds as { data?: unknown }).data)) continue;
    const raw = (ds as { data: unknown[] }).data;
    // A dataset longer than labels[] has points we cannot place. Truncating
    // would silently restate the data (worst on a doughnut, where dropping a
    // slice renormalizes every share) — fall back to the image instead.
    if (raw.length > labels.length) return null;
    const parsed = raw.map(toNumberOrNull);
    // One unplottable number invalidates the whole chart: dropping it would
    // silently restate the data (and on a doughnut, every share with it).
    if (parsed.some(v => v === OUT_OF_RANGE)) return null;
    const values = parsed as (number | null)[];
    while (values.length < labels.length) values.push(null);
    if (values.some(v => v !== null)) {
      series.push({ label: String((ds as { label?: unknown }).label ?? '').trim(), values });
    }
  }
  if (series.length === 0) return null;

  if (form === 'line' && labels.length > MAX_LINE_POINTS) return null;

  // Bars grow one way from a single baseline, so a negative would draw exactly
  // like its positive twin. Chart.js renders those around a zero baseline, so
  // hand the config back to the image rather than invert the comparison.
  if (form === 'bar' && series.some(s => s.values.some(v => v !== null && v < 0))) return null;

  // A doughnut is a single part-to-whole series of positive shares: every
  // plotted value must be positive, since a ring that quietly omits a
  // zero/negative entry claims a whole it does not represent.
  if (form === 'doughnut') {
    if (series.length !== 1) return null;
    const values = series[0].values;
    if (values.some(v => v === null || v <= 0)) return null;
    // Past six slices a ring stops being readable at a glance (and the palette
    // has six slots, which are never cycled). Bars carry the same one-series
    // magnitudes honestly at any count, so change the form rather than the
    // data — still themed, where falling back to the image would not be.
    if (values.length > MAX_DONUT_SLICES) return { form: 'bar', labels, series };
  }

  return { form, labels, series };
}

/**
 * Build one formatter for a whole axis/series so every label shares a notation.
 * Deciding per value (compact above 10k) mixes formats on one axis — ticks
 * would read "5,000 | 10K | 15K" — so the scale's own magnitude decides once.
 */
export function makeNumberFormatter(locale: string, values: number[]): (v: number) => string {
  const peak = Math.max(...values.map(v => Math.abs(v)), 0);
  const compact = peak >= 10000;
  // Two fraction digits is too coarse for a sub-unit scale — 0.005 and 0.01
  // would both print "0.01" and mislabel their own gridlines.
  const digits = compact ? 1 : peak > 0 && peak < 1 ? 4 : 2;
  const fmt = new Intl.NumberFormat(locale, {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: digits,
  });
  return v => fmt.format(v);
}

/**
 * Full-precision label for the data table. The table is the chart's exact
 * twin — the one place every value must be readable as written — so it never
 * compacts: "1.2M" cannot distinguish 1,234,567 from 1,234,999.
 */
export function formatExactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value);
}

/** Locale-aware number label for a standalone value (tooltip, table cell). */
export function formatChartNumber(value: number, locale: string): string {
  return makeNumberFormatter(locale, [value])(value);
}

/** Round a step up to a clean 1/2/5 × 10^k value. */
function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const unit = rough / pow;
  if (unit <= 1) return pow;
  if (unit <= 2) return 2 * pow;
  if (unit <= 5) return 5 * pow;
  return 10 * pow;
}

/**
 * Clean axis ticks covering [min(0, dataMin), dataMax].
 *
 * The tick count is bounded explicitly rather than by a `t <= max` loop
 * condition: when min is large and step is small relative to it, `t += step`
 * stops advancing at float precision and the loop never terminates — an
 * SSR hang / RangeError on a page that would then be cached. Computing each
 * tick from the index also avoids accumulating float error across the axis.
 */
export function niceTicks(dataMin: number, dataMax: number, target = 4): { ticks: number[]; min: number; max: number } {
  const lo = Number.isFinite(dataMin) ? Math.min(0, dataMin) : 0;
  // A flat all-zero series has no span to divide; give it a plain 0..1 axis
  // rather than a sliver that renders as several identical "0" ticks.
  const hi = Number.isFinite(dataMax) && dataMax > lo ? dataMax : lo + (Math.abs(lo) || 1);
  const step = niceStep((hi - lo) / target || 1);
  if (!Number.isFinite(step) || step <= 0) return { ticks: [lo, hi], min: lo, max: hi };
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const count = Math.min(Math.round((max - min) / step), 20);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    const t = min + i * step;
    ticks.push(Math.abs(t) < step * 1e-9 ? 0 : t);
  }
  return { ticks, min, max: ticks[ticks.length - 1] };
}

/** SVG path for a donut slice between two angles (radians, 0 = 12 o'clock). */
export function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number): string {
  // A full-circle arc degenerates (start == end mod 2π); stop just short.
  const a1 = start;
  const a2 = Math.min(end, start + Math.PI * 2 - 0.0001);
  const large = a2 - a1 > Math.PI ? 1 : 0;
  const px = (r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x1, y1] = px(rOuter, a1);
  const [x2, y2] = px(rOuter, a2);
  const [x3, y3] = px(rInner, a2);
  const [x4, y4] = px(rInner, a1);
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/**
 * Truncate for axis/tooltip labels. Cuts on code points, not UTF-16 units:
 * slicing mid-surrogate would emit a lone surrogate into the server HTML.
 */
export function truncateLabel(label: string, max: number): string {
  const chars = Array.from(label);
  return chars.length <= max
    ? label
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}
