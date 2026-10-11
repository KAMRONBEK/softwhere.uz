/**
 * Pure layout math for the Work Wall: tile metrics for a stage size, and a
 * torus layout (rows that wrap horizontally, a column of rows that wraps
 * vertically) for tiles of different widths. No DOM access here.
 */

/** Lowest zoom the drag "lift" reaches; wrap seams must stay offscreen at it. */
export const ZOOM_MIN = 0.86;

/** Wall px per scrolled px: the diagonal drift while the stage is pinned (wallMotion.scrollDrift). */
export const SCROLL_DRIFT_X = 0.62;
export const SCROLL_DRIFT_Y = 0.34;
/** Scroll (in viewports) the drift path covers for placement: the approach, the pinned stretch and the exit. */
const PATH_FROM_VH = -0.5;
const PATH_TO_VH = 1.8;
/** How much farther along the path counts against a slot (nearest the start ranks first). */
const PATH_LEAN = 0.35;

/** Parallax speed per row, cycled. 1 = front row, lower = farther back. */
const ROW_DEPTHS = [1, 0.8, 0.93, 0.74, 0.97, 0.84, 0.9, 0.78] as const;
const DEPTH_MIN = 0.74;

export interface WallMetrics {
  vw: number;
  vh: number;
  /** Media height shared by every tile (widths follow each tile's aspect). */
  mediaH: number;
  /** Mat around the media on each side (light styles frame their tiles). */
  mat: number;
  captionH: number;
  /** Mat + media + caption. */
  cardH: number;
  gapX: number;
  pitchY: number;
  /** The clear band between the header and the footer controls. */
  usableTop: number;
  usableBottom: number;
  /** Stage y the eye rests on: the middle of that band. */
  focusY: number;
  isCompact: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function measureMetrics(vw: number, vh: number, headerBottom: number, footerTop: number, mat: number): WallMetrics {
  const isCompact = vw < 640;
  const mediaH = Math.round(isCompact ? clamp(vh * 0.22, 150, 210) : clamp(Math.min(vh * 0.27, vw * 0.17), 170, 300));
  const captionH = isCompact ? 44 : 50;
  const cardH = mediaH + 2 * mat + captionH;
  const gapX = isCompact ? 14 : Math.round(clamp(vw * 0.018, 20, 34));
  const pitchY = cardH + (isCompact ? 20 : 30);
  const usableTop = clamp(headerBottom, 0, vh * 0.5);
  const usableBottom = clamp(footerTop, usableTop + vh * 0.25, vh);
  const focusY = (usableTop + usableBottom) / 2;
  return { vw, vh, mediaH, mat, captionH, cardH, gapX, pitchY, usableTop, usableBottom, focusY, isCompact };
}

export interface RowSpec {
  /** Horizontal parallax factor (1 when parallax is off). */
  parallax: number;
  /** Static depth: tile scale, dimming (dark styles), stacking order. */
  scale: number;
  dim: number;
  z: number;
  /** Wrap period of this row (its tiles' widths and gaps). */
  width: number;
  /** Row center, relative to the stage center. */
  y: number;
}

export interface SlotSpec {
  row: number;
  /** Tile center offset from the stage center before panning. */
  x: number;
  /** Unscaled tile width (media + mat). */
  w: number;
}

export interface WallLayout {
  rows: RowSpec[];
  /** By project index. */
  slots: Map<number, SlotSpec>;
  /** Vertical wrap period (rows × pitch). */
  height: number;
  wrapX: boolean;
  wrapY: boolean;
  /** Max |pan| on an axis that does not wrap (0 = locked). */
  rangeX: number;
  rangeY: number;
}

/** Wraps v into [-period/2, period/2). */
export function wrapCentered(v: number, period: number): number {
  return ((((v + period / 2) % period) + period) % period) - period / 2;
}

/** `step` counts rows away from the focus row, which is always the front row. */
function depthRow(step: number, width: number, y: number, hasParallax: boolean): RowSpec {
  const len = ROW_DEPTHS.length;
  const depth = ROW_DEPTHS[((step % len) + len) % len];
  const t = (depth - DEPTH_MIN) / (1 - DEPTH_MIN);
  return {
    parallax: hasParallax ? depth : 1,
    scale: 0.88 + 0.12 * t,
    dim: 0.8 + 0.2 * t,
    z: 1 + Math.round(t * 10),
    width,
    y,
  };
}

/** Row sizes for n tiles over r rows, larger rows first. */
function splitRows(n: number, r: number): number[] {
  const base = Math.floor(n / r);
  const extra = n % r;
  return Array.from({ length: r }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Rank of an even-grid slot (x, y relative to the focus point): its distance
 * (screen-normalized, rows weigh 1.6x) to the stretch of wall the scroll
 * drift carries past the focus point, plus a lean toward the start of it.
 * Wrapped copies count, since the wall is a torus. Without drift, plain
 * distance to the focus point. The strongest projects line the path the
 * page scroll takes; the last in the order sit where it never goes.
 */
function slotRank(x: number, y: number, periodX: number, periodY: number, m: WallMetrics, hasDrift: boolean): number {
  if (!hasDrift) return Math.hypot(x / m.vw, (y / m.vh) * 1.6);
  const ux = SCROLL_DRIFT_X / m.vw;
  const uy = periodY > 0 ? (SCROLL_DRIFT_Y / m.vh) * 1.6 : 0;
  const uu = ux * ux + uy * uy;
  let best = Infinity;
  for (const j of [-1, 0, 1]) {
    for (const k of periodY > 0 ? [-1, 0, 1] : [0]) {
      const qx = (x + j * periodX) / m.vw;
      const qy = ((y + k * periodY) / m.vh) * 1.6;
      const s = clamp((qx * ux + qy * uy) / uu, PATH_FROM_VH * m.vh, PATH_TO_VH * m.vh);
      best = Math.min(best, Math.hypot(qx - s * ux, qy - s * uy) + PATH_LEAN * Math.abs(s) * Math.sqrt(uu));
    }
  }
  return best;
}

interface Placed {
  index: number;
  row: number;
  /** Position on the even grid, before packing real widths. */
  approxX: number;
}

/**
 * Packs one row with real widths, keeping the grid order, then shifts it so
 * its most central tile stays where the grid put it (the strongest projects
 * stay near the focus point).
 */
function packRow(tiles: Placed[], widthOf: (i: number) => number, gap: number): { xs: Map<number, number>; width: number } {
  const sorted = [...tiles].sort((a, b) => a.approxX - b.approxX);
  const width = sorted.reduce((sum, t) => sum + widthOf(t.index) + gap, 0);
  const xs = new Map<number, number>();
  let cursor = -width / 2;
  sorted.forEach(t => {
    const w = widthOf(t.index);
    xs.set(t.index, cursor + gap / 2 + w / 2);
    cursor += w + gap;
  });
  const anchor = sorted.reduce((best, t) => (Math.abs(t.approxX) < Math.abs(best.approxX) ? t : best), sorted[0]);
  const shift = anchor.approxX - (xs.get(anchor.index) ?? 0);
  xs.forEach((x, i) => xs.set(i, wrapCentered(x + shift, width)));
  return { xs, width };
}

/**
 * Lays out `indices` (display order). When there are enough tiles to hide
 * the seams, the wall wraps in both axes and the strongest projects take the
 * slots nearest the focus point and along the scroll drift's path (`hasDrift`),
 * so the sensitive-finance ones (last in the order) sit where the page scroll
 * never carries them. With fewer tiles it wraps horizontally only, and a
 * handful of tiles becomes a centered, non-wrapping grid.
 */
export function computeLayout(
  indices: readonly number[],
  widthOf: (index: number) => number,
  m: WallMetrics,
  hasParallax: boolean,
  hasDrift: boolean
): WallLayout {
  const n = indices.length;
  const focusOffset = m.focusY - m.vh / 2;
  const visibleH = m.usableBottom - m.usableTop;
  if (n === 0) return { rows: [], slots: new Map(), height: m.pitchY, wrapX: false, wrapY: false, rangeX: 0, rangeY: 0 };

  const total = indices.reduce((sum, i) => sum + widthOf(i) + m.gapX, 0);
  const maxW = Math.max(...indices.map(widthOf));
  const minRowW = m.vw / ZOOM_MIN + maxW + m.gapX;
  const minRowsWrap = Math.ceil((m.vh / ZOOM_MIN + m.pitchY) / m.pitchY);
  const maxRows = Math.floor(total / minRowW);

  if (maxRows >= 1) {
    const wrapY = maxRows >= minRowsWrap;
    const ideal = Math.round(Math.sqrt((total * m.vh) / (m.pitchY * m.vw)));
    let rowCount = wrapY ? clamp(ideal, minRowsWrap, maxRows) : clamp(ideal, 1, Math.min(maxRows, minRowsWrap - 1));
    // A short wall (one or two rows) grows into the free height; growing only
    // widens each row, so the horizontal seams stay hidden.
    // Phones cap it lower, so a row of grown tiles still shows its neighbours at the edges (it swipes).
    const grow = wrapY ? 1 : clamp((visibleH * 0.92) / (rowCount * m.pitchY), 1, m.isCompact ? 1.18 : 1.35);
    const pitchY = m.pitchY * grow;
    const avgPitch = (total / n) * grow;
    const scaledWidth = (i: number) => widthOf(i) * grow;

    for (;;) {
      const sizes = splitRows(n, rowCount);
      const height = rowCount * pitchY;
      const centerOffset = wrapY ? 0 : focusOffset;
      const rowY = (r: number) => centerOffset + (r - (rowCount - 1) / 2) * pitchY;
      const offFocus = (r: number) => Math.abs(wrapY ? wrapCentered(rowY(r) - focusOffset, height) : rowY(r) - focusOffset);
      const focusRow = sizes.reduce((best, _, r) => (offFocus(r) < offFocus(best) ? r : best), 0);

      // Even-grid slots ranked by distance to the focus point and the drift path, nearest first.
      const grid = sizes.flatMap((count, r) => {
        // Golden-ratio stagger so columns never line up between rows.
        const shift = (((r * 0.618) % 1) - 0.5) * avgPitch;
        const y = wrapY ? wrapCentered(rowY(r) - focusOffset, height) : rowY(r) - focusOffset;
        return Array.from({ length: count }, (_, c) => {
          const x = wrapCentered((c - (count - 1) / 2) * avgPitch + shift, count * avgPitch);
          return { row: r, x, distance: slotRank(x, y, count * avgPitch, wrapY ? height : 0, m, hasDrift) };
        });
      });
      grid.sort((a, b) => a.distance - b.distance);
      const placed: Placed[] = indices.map((index, k) => ({ index, row: grid[k].row, approxX: grid[k].x }));

      const packed = sizes.map((_, r) =>
        packRow(
          placed.filter(p => p.row === r),
          scaledWidth,
          m.gapX * grow
        )
      );
      // A row of mostly narrow tiles could come up short of the seam guard: use fewer, longer rows.
      const isTooShort = packed.some(row => row.width < minRowW * grow);
      if (isTooShort && rowCount > 1) {
        rowCount -= 1;
        continue;
      }

      const rows = packed.map((row, r) => {
        const spec = depthRow(r - focusRow, row.width, rowY(r), hasParallax);
        return { ...spec, scale: spec.scale * grow };
      });
      const slots = new Map<number, SlotSpec>();
      // Positions are in grown units; the tile itself is scaled by row.scale around its center.
      placed.forEach(p => slots.set(p.index, { row: p.row, x: packed[p.row].xs.get(p.index) ?? 0, w: widthOf(p.index) }));
      return {
        rows,
        slots,
        height,
        wrapX: true,
        wrapY,
        rangeX: 0,
        rangeY: wrapY ? 0 : Math.max(0, (height - visibleH) / 2 + pitchY * 0.15),
      };
    }
  }

  // A few tiles: centered rows, shown larger when there is room, that pan only if they overflow.
  const maxLine = Math.max(m.vw - 48, maxW + m.gapX);
  // As many lines as greedy packing needs, then the tiles shared out evenly (3 + 2, not 4 + 1).
  let lineCount = 1;
  let lineW = 0;
  indices.forEach(i => {
    const w = widthOf(i) + m.gapX;
    if (lineW > 0 && lineW + w > maxLine) {
      lineCount += 1;
      lineW = 0;
    }
    lineW += w;
  });
  const perLine = splitRows(n, lineCount);
  let next = 0;
  const lines = perLine.map(count => {
    const line = indices.slice(next, next + count);
    next += count;
    return line;
  });
  const lineWidths = lines.map(line => line.reduce((sum, i) => sum + widthOf(i) + m.gapX, 0));
  const widest = Math.max(...lineWidths);
  const grow = clamp(Math.min((m.vw * 0.8) / widest, visibleH / (lines.length * m.pitchY)), 1, 1.45);
  const pitchY = m.pitchY * grow;
  const height = lines.length * pitchY;
  const slots = new Map<number, SlotSpec>();
  const rows = lines.map((line, r) => {
    let cursor = (-lineWidths[r] * grow) / 2;
    line.forEach(i => {
      const w = (widthOf(i) + m.gapX) * grow;
      slots.set(i, { row: r, x: cursor + w / 2, w: widthOf(i) });
      cursor += w;
    });
    return {
      parallax: 1,
      scale: grow,
      dim: 1,
      z: 6,
      width: lineWidths[r] * grow,
      y: focusOffset + (r - (lines.length - 1) / 2) * pitchY,
    };
  });
  return {
    rows,
    slots,
    height,
    wrapX: false,
    wrapY: false,
    rangeX: Math.max(0, (widest * grow - m.vw) / 2 + 24),
    rangeY: Math.max(0, (height - visibleH) / 2 + 24),
  };
}
