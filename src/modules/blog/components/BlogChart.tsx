import type { ParsedChart, ChartSeries } from '@/modules/blog/utils/chart';
import {
  DONUT_SLOT_ORDER,
  donutSlicePath,
  formatExactNumber,
  makeNumberFormatter,
  niceTicks,
  truncateLabel,
} from '@/modules/blog/utils/chart';

/**
 * Native, theme-aware rendering of a stored blog chart (decoded from its
 * QuickChart URL by parseQuickChartSrc). Server component — pure SVG/HTML
 * styled with the Ember chart tokens in globals.css, so it follows the
 * light/dark toggle with zero client JS. Hover detail is CSS-only; the
 * <details> data table is the accessibility twin of every chart.
 *
 * Forms: bar (rendered horizontally — category labels in ru/uz run long),
 * line (with null gaps), doughnut. Series colors use the fixed --chart-1..6
 * slots, validated for CVD safety on both surfaces — never cycled.
 */

interface BlogChartProps {
  chart: ParsedChart;
  caption: string;
  locale: string;
  viewDataLabel: string;
  /** Header for the table's category column (charts have no generic name for it). */
  categoryLabel: string;
  /** Header used when a dataset carried no label of its own. */
  valueLabel: string;
}

const slot = (i: number) => `var(--chart-${i + 1})`;

const isNum = (v: number | null): v is number => v !== null;

// ---------------------------------------------------------------------------
// Bars — HTML rows, horizontal. Long RU/UZ category labels get a full text
// line instead of the rotated/colliding x-axis labels of the old PNGs; every
// bar carries its value at the tip, so no value axis is needed.
// ---------------------------------------------------------------------------

function Bars({ chart, locale }: { chart: ParsedChart; locale: string }) {
  const all = chart.series.flatMap(s => s.values).filter(isNum);
  const maxAbs = Math.max(...all.map(Math.abs), 1e-9);
  const fmt = makeNumberFormatter(locale, all);
  return (
    <div>
      {chart.labels.map((cat, i) => (
        <div className='bc-cat' key={i}>
          <div className='bc-cat-label'>{cat}</div>
          {chart.series.map((s, si) => {
            const v = s.values[i];
            const width = v === null ? 0 : Math.max((Math.abs(v) / maxAbs) * 100, 0.5);
            const text = v === null ? '—' : fmt(v);
            return (
              <div className='bc-row' key={si}>
                {/* A missing value draws NO bar: .bc-bar has a 2px min-width,
                    so a zero-width one would read as a real (zero) value. */}
                {v === null ? (
                  <span className='bc-bar-none' />
                ) : (
                  <div className='bc-bar' style={{ width: `${width}%`, background: slot(si) }} />
                )}
                <span className='bc-val'>{text}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line — SVG. Null values leave gaps; markers wear a 2px surface ring. Hover
// (or keyboard focus) on a column shows a tooltip listing every series at
// that x — pre-rendered, toggled by CSS.
// ---------------------------------------------------------------------------

const LINE = { w: 720, h: 380, top: 16, right: 20, bottom: 46, left: 60 };
// SVG units, not px: the chart scales to its container (down to ~0.78x at the
// 560-unit minimum on phones), so sizes are set high enough to stay legible
// there. ~6.3 units/char at FS.body is a measured average across Latin and
// Cyrillic in the site's UI face.
const FS = { axis: 13, body: 13, head: 13.5 };
const CHAR_W = 6.3;

function Line({ chart, locale, label }: { chart: ParsedChart; locale: string; label: string }) {
  const { w, h, top, right, bottom, left } = LINE;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const n = chart.labels.length;
  const values = chart.series.flatMap(s => s.values).filter(isNum);
  const { ticks, min, max } = niceTicks(Math.min(...values), Math.max(...values));
  const fmt = makeNumberFormatter(locale, [...values, ...ticks]);
  const x = (i: number) => left + (plotW * (i + 0.5)) / n;
  const y = (v: number) => top + plotH * (1 - (v - min) / (max - min || 1));
  const band = plotW / n;
  // Skip labels by measured WIDTH, not just count: at n=8 the slots are wide
  // enough to place but a 16-char label is wider than its slot and collides
  // with its neighbour. Widest label decides the stride, and the last point is
  // always labelled (it is the one a trend chart is read for).
  const maxLabelChars = Math.max(...chart.labels.map(l => Math.min(l.length, 16)));
  const labelEvery = Math.max(1, Math.ceil((maxLabelChars * CHAR_W + 10) / band));
  const showLabel = (i: number) => i === n - 1 || (n - 1 - i) % labelEvery === 0;

  const segments = (s: ChartSeries): string[] => {
    const paths: string[] = [];
    let current: string[] = [];
    s.values.forEach((v, i) => {
      if (v === null) {
        if (current.length > 1) paths.push(current.join(' '));
        current = [];
      } else {
        current.push(`${current.length === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
      }
    });
    if (current.length > 1) paths.push(current.join(' '));
    return paths;
  };

  return (
    // role=img + name on the scroll container: the SVG itself is aria-hidden
    // (its shapes say nothing useful), and tabIndex makes the overflow
    // scrollable by keyboard on narrow screens (axe scrollable-region-focusable).
    <div className='bc-scroll' tabIndex={0} role='img' aria-label={label}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', minWidth: 560, height: 'auto', display: 'block' }} aria-hidden='true'>
        {ticks.map(t => (
          <g key={t}>
            <line
              x1={left}
              x2={w - right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}
              strokeWidth={1}
            />
            <text
              x={left - 8}
              y={y(t) + 4}
              textAnchor='end'
              fontSize={FS.axis}
              fill='var(--muted)'
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(t)}
            </text>
          </g>
        ))}
        {chart.labels.map((l, i) => {
          if (!showLabel(i)) return null;
          // Centred text near the right edge (the last point is always
          // labelled) would spill past the viewBox, which clips it. Nudge it
          // back inside using the estimated half-width.
          const half = (truncateLabel(l, 16).length * CHAR_W) / 2;
          const cx = Math.min(Math.max(x(i), left + half), w - right - half);
          return (
            <text key={i} x={cx} y={h - bottom + 22} textAnchor='middle' fontSize={FS.axis} fill='var(--muted)'>
              {truncateLabel(l, 16)}
            </text>
          );
        })}
        {chart.series.map((s, si) => (
          <g key={si}>
            {segments(s).map((d, di) => (
              <path key={di} d={d} fill='none' stroke={slot(si)} strokeWidth={2} strokeLinejoin='round' strokeLinecap='round' />
            ))}
            {s.values.map((v, i) =>
              v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={slot(si)} stroke='var(--surface)' strokeWidth={2} />
            )}
          </g>
        ))}
        {chart.labels.map((l, i) => {
          const rows = chart.series.map((s, si) => ({ si, label: s.label, v: s.values[i] })).filter(r => r.v !== null);
          if (rows.length === 0) return null;
          const header = truncateLabel(l, 24);
          // Width is estimated, not measured (no DOM on the server), so the
          // header is weighted for its bold, larger face and the row estimate
          // covers key + label + gutter + value.
          const rowChars = rows.map(r => truncateLabel(r.label || '', 18).length + fmt(r.v as number).length + 6);
          const tipW = Math.max(header.length * CHAR_W * 1.14, ...rowChars.map(c => c * CHAR_W)) + 46;
          const tipH = 30 + rows.length * 20;
          const tx = x(i) + 12 + tipW > w - right ? x(i) - 12 - tipW : x(i) + 12;
          const ty = top + 6;
          return (
            <g className='bc-col' key={i}>
              {/* Hover-only: no tabIndex. Focusable nodes inside an
                  aria-hidden subtree are unlabelled tab stops (axe
                  aria-hidden-focus); the data table below is the keyboard and
                  screen-reader path to every value. */}
              <rect className='bc-hit' x={x(i) - band / 2} y={top} width={band} height={plotH} fill='transparent' />
              <g className='bc-tip'>
                <line x1={x(i)} x2={x(i)} y1={top} y2={top + plotH} stroke='var(--chart-axis)' strokeWidth={1} />
                <rect x={tx} y={ty} width={tipW} height={tipH} rx={6} fill='var(--surface2)' stroke='var(--border)' />
                <text x={tx + 12} y={ty + 19} fontSize={FS.head} fontWeight={600} fill='var(--text)'>
                  {header}
                </text>
                {rows.map((r, ri) => (
                  <g key={r.si}>
                    <line
                      x1={tx + 12}
                      x2={tx + 24}
                      y1={ty + 35 + ri * 20}
                      y2={ty + 35 + ri * 20}
                      stroke={slot(r.si)}
                      strokeWidth={3}
                      strokeLinecap='round'
                    />
                    <text x={tx + 30} y={ty + 39 + ri * 20} fontSize={FS.body} fill='var(--muted)'>
                      {truncateLabel(r.label || '', 18)}
                    </text>
                    <text
                      x={tx + tipW - 12}
                      y={ty + 39 + ri * 20}
                      textAnchor='end'
                      fontSize={FS.body}
                      fontWeight={600}
                      fill='var(--text)'
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {fmt(r.v as number)}
                    </text>
                  </g>
                ))}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doughnut — SVG ring with 2px surface gaps between slices; the legend (not
// in-slice text) carries labels, values, and shares. Center shows the total.
// ---------------------------------------------------------------------------

function Doughnut({ chart, locale, valueLabel }: { chart: ParsedChart; locale: string; valueLabel: string }) {
  const series = chart.series[0];
  const slices = chart.labels
    .map((label, i) => ({ label, v: series.values[i] }))
    .filter((s): s is { label: string; v: number } => isNum(s.v) && s.v > 0);
  const sum = slices.reduce((acc, s) => acc + s.v, 0);
  const fmt = makeNumberFormatter(locale, [...slices.map(s => s.v), sum]);
  // The unit comes from what the series SAYS it is, never from the sum landing
  // near 100 — person-days [45,30,25] also sum to 100 and are not percentages.
  const unit = /%/.test(series.label) ? '%' : '';
  // Ring-safe color order: the last slice touches the first, so slot order
  // depends on the slice count (see DONUT_SLOT_ORDER).
  const slotOrder = DONUT_SLOT_ORDER[slices.length] ?? DONUT_SLOT_ORDER[6];
  const arcs = slices.reduce<Array<{ label: string; v: number; i: number; color: string; start: number; end: number; pct: number }>>(
    (acc, s, i) => {
      const start = acc.length > 0 ? acc[acc.length - 1].end : 0;
      acc.push({
        ...s,
        i,
        color: `var(--chart-${slotOrder[i]})`,
        start,
        end: start + (s.v / sum) * Math.PI * 2,
        pct: (s.v / sum) * 100,
      });
      return acc;
    },
    []
  );
  return (
    <div className='bc-donut'>
      <svg viewBox='0 0 260 260' width={210} height={210} aria-hidden='true' style={{ flex: 'none' }}>
        {arcs.map(a => (
          <path
            key={a.i}
            className='bc-slice'
            d={donutSlicePath(130, 130, 104, 64, a.start, a.end)}
            fill={a.color}
            stroke='var(--surface)'
            strokeWidth={2}
          >
            <title>{`${a.label}: ${fmt(a.v)}${unit} (${a.pct.toFixed(a.pct < 10 ? 1 : 0)}%)`}</title>
          </path>
        ))}
        <text x={130} y={126} textAnchor='middle' fontSize={30} fontWeight={700} fill='var(--text)'>
          {`${fmt(sum)}${unit}`}
        </text>
        {series.label && (
          // Truncated to fit the 128-unit hole; a longer string would run out
          // over the slices, where --muted has no contrast guarantee.
          <text x={130} y={150} textAnchor='middle' fontSize={13} fill='var(--muted)'>
            {truncateLabel(series.label, 16)}
          </text>
        )}
      </svg>
      <ul className='bc-legend bc-legend-col'>
        {arcs.map(a => (
          <li key={a.i}>
            <span className='bc-key' style={{ background: a.color }} />
            <span className='bc-legend-label'>{a.label || valueLabel}</span>
            <span className='bc-legend-val'>{unit ? `${fmt(a.v)}%` : `${fmt(a.v)} · ${a.pct.toFixed(0)}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function BlogChart({ chart, caption, locale, viewDataLabel, categoryLabel, valueLabel }: BlogChartProps) {
  const multiSeries = chart.series.length >= 2;
  const measure = !multiSeries && chart.form !== 'doughnut' ? chart.series[0].label : '';
  // The name a screen reader announces for the whole figure. A visible
  // figcaption already names it, so aria-label is only set when there is none
  // — otherwise it overrides the caption and the same text is read twice.
  const name = caption || measure || valueLabel;
  return (
    <figure className='blog-chart' aria-label={caption ? undefined : name}>
      <div className='bc-card'>
        {measure && <div className='bc-measure'>{measure}</div>}
        {multiSeries && (
          <ul className='bc-legend'>
            {chart.series.map((s, si) => (
              <li key={si}>
                <span className={chart.form === 'line' ? 'bc-key-line' : 'bc-key'} style={{ background: slot(si) }} />
                <span className='bc-legend-label'>{s.label || valueLabel}</span>
              </li>
            ))}
          </ul>
        )}
        {chart.form === 'bar' && <Bars chart={chart} locale={locale} />}
        {chart.form === 'line' && <Line chart={chart} locale={locale} label={name} />}
        {chart.form === 'doughnut' && <Doughnut chart={chart} locale={locale} valueLabel={valueLabel} />}
        <details className='bc-details'>
          <summary>{viewDataLabel}</summary>
          {/* The table is the chart's accessible twin, so it carries its own
              caption and a header on every column — an unlabelled dataset
              would otherwise leave cells with no header to announce. Values
              are printed in full: the marks above may compact ("4.2K"), and
              this is the one place the exact number must be readable. */}
          <div className='bc-table-wrap' tabIndex={0}>
            <table className='bc-table'>
              <caption className='bc-table-caption'>{name}</caption>
              <thead>
                <tr>
                  <th scope='col'>{categoryLabel}</th>
                  {chart.series.map((s, si) => (
                    <th key={si} scope='col' className='bc-num'>
                      {s.label || valueLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.labels.map((l, i) => (
                  <tr key={i}>
                    <th scope='row'>{l}</th>
                    {chart.series.map((s, si) => (
                      <td key={si} className='bc-num'>
                        {s.values[i] === null ? '—' : formatExactNumber(s.values[i] as number, locale)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
      {caption && <figcaption className='text-center text-sm text-ember-muted mt-3'>{caption}</figcaption>}
    </figure>
  );
}
