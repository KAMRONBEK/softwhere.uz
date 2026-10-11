/**
 * Lays the stack out as a tower: one or more brick rows per layer, every row
 * stretched to the same width so the tower is a solid wall (stable in the
 * physics world, and readable as an architecture diagram). Picks the largest
 * type size whose tower still fits the free space AND leaves room for the
 * heap it turns into when it falls.
 *
 * The box model here is the CSS one (stack.module.css: .tile, .face, .name):
 * tiles get explicit pixel sizes from this layout, so the DOM and the bodies
 * always match.
 */

/** The size `.name` is measured at (any size works: widths scale linearly). */
export const PROBE_FS = 40;
/** Physical gap between neighbours in a row, so resting bricks don't rub. */
const GAP_X = 2;
const FONT_STEP = 0.5;

export function tilePadX(fs: number): number {
  return Math.round(fs * 0.55 + 10);
}

export function tileHeight(fs: number): number {
  return Math.round(fs * 1.85 + 12);
}

export interface TileSlot {
  index: number;
  layerIndex: number;
  /** Row from the floor up (0 = bottom row). */
  row: number;
  /** Center, in root coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayerBand {
  layerIndex: number;
  top: number;
  bottom: number;
}

export interface TowerLayout {
  fs: number;
  tower: { left: number; top: number; width: number; height: number };
  /** Indexed by tile index. */
  slots: TileSlot[];
  layers: LayerBand[];
  /** Tile indices per row, bottom row first (the build order). */
  rows: number[][];
}

export interface LayoutRegion {
  left: number;
  right: number;
  top: number;
  /** The floor line the tower stands on. */
  floor: number;
  align: 'center' | 'end';
}

export interface LayoutInput {
  region: LayoutRegion;
  /** Layer index per tile (0 = foundation); tiles keep their order inside a layer. */
  layerOf: readonly number[];
  /** `.name` width at PROBE_FS, per tile. */
  textWidths: readonly number[];
  fontRange: readonly [min: number, max: number];
  /** Largest tower area (px²) whose heap still fits the stage. */
  areaBudget: number;
  /** Tower height ≤ this share of the region height. */
  maxHeightShare: number;
  /**
   * Bricks may grow taller than their type needs (up to this factor) so the
   * tower fills the region's height: phones, where width caps the type
   * long before height does. 1 = never.
   */
  maxStretch?: number;
}

function rowWidth(widths: readonly number[]): number {
  return widths.reduce((sum, width) => sum + width, 0) + GAP_X * Math.max(0, widths.length - 1);
}

/**
 * Splits `widths` (in order) into the fewest rows no wider than `limit`,
 * balanced so the widest row is as narrow as possible. Null if a single
 * tile is wider than the limit.
 */
export function partition(widths: readonly number[], limit: number): number[][] | null {
  const count = widths.length;
  if (count === 0) return [];
  if (widths.some(width => width > limit)) return null;
  for (let rows = 1; rows <= count; rows++) {
    const split = balancedSplit(widths, rows);
    if (Math.max(...split.map(group => rowWidth(group.map(index => widths[index])))) <= limit) return split;
  }
  return widths.map((_, index) => [index]);
}

/** Contiguous split into `rows` groups minimising the widest group (tiny n: exhaustive DP). */
function balancedSplit(widths: readonly number[], rows: number): number[][] {
  const count = widths.length;
  const span = (from: number, to: number) => rowWidth(widths.slice(from, to));
  // best[k][i]: minimal widest row splitting the first i tiles into k rows.
  const best: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(count + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(count + 1).fill(0));
  best[0][0] = 0;
  for (let k = 1; k <= rows; k++) {
    for (let i = 1; i <= count; i++) {
      for (let j = k - 1; j < i; j++) {
        const value = Math.max(best[k - 1][j], span(j, i));
        if (value < best[k][i]) {
          best[k][i] = value;
          cut[k][i] = j;
        }
      }
    }
  }
  const groups: number[][] = [];
  let end = count;
  for (let k = rows; k >= 1; k--) {
    const start = cut[k][end];
    groups.unshift(Array.from({ length: end - start }, (_, offset) => start + offset));
    end = start;
  }
  return groups;
}

interface Attempt {
  fs: number;
  width: number;
  height: number;
  /** Per layer: rows of tile indices (top row of the layer first). */
  layerRows: number[][][];
  naturals: number[];
}

function attempt(input: LayoutInput, fs: number, layerTiles: readonly number[][]): Attempt | null {
  const { region, textWidths } = input;
  const limit = region.right - region.left;
  const padX = tilePadX(fs);
  const naturals = textWidths.map(width => Math.ceil((width * fs) / PROBE_FS) + padX * 2);
  const layerRows: number[][][] = [];
  let width = 0;
  for (const tiles of layerTiles) {
    const split = partition(
      tiles.map(index => naturals[index]),
      limit
    );
    if (!split) return null;
    const rows = split.map(group => group.map(position => tiles[position]));
    rows.forEach(row => {
      width = Math.max(width, rowWidth(row.map(index => naturals[index])));
    });
    layerRows.push(rows);
  }
  const rowCount = layerRows.reduce((sum, rows) => sum + rows.length, 0);
  return { fs, width: Math.ceil(width), height: rowCount * tileHeight(fs), layerRows, naturals };
}

function fits(input: LayoutInput, candidate: Attempt): boolean {
  const { region, areaBudget, maxHeightShare } = input;
  const maxHeight = (region.floor - region.top) * maxHeightShare;
  return candidate.height <= maxHeight && candidate.width * candidate.height <= areaBudget;
}

/** Stretches every row to the tower width (proportionally) and stacks the rows on the floor. */
function place(input: LayoutInput, chosen: Attempt): TowerLayout {
  const { region } = input;
  const rowCount = chosen.layerRows.reduce((sum, rows) => sum + rows.length, 0);
  const maxHeight = (region.floor - region.top) * input.maxHeightShare;
  const natural = tileHeight(chosen.fs);
  const rowHeight = Math.max(natural, Math.floor(Math.min(natural * (input.maxStretch ?? 1), maxHeight / Math.max(1, rowCount))));
  const towerWidth = chosen.width;
  const left = Math.round(region.align === 'end' ? region.right - towerWidth : (region.left + region.right - towerWidth) / 2);
  const slots: TileSlot[] = new Array<TileSlot>(input.layerOf.length);
  const rows: number[][] = [];
  const layers: LayerBand[] = [];
  let rowFromFloor = 0;

  chosen.layerRows.forEach((layerRows, layerIndex) => {
    const bottomRow = rowFromFloor;
    // The layer's first row sits on top, so a layer reads in order top-down.
    [...layerRows].reverse().forEach(row => {
      const naturals = row.map(index => chosen.naturals[index]);
      const free = towerWidth - rowWidth(naturals);
      const total = naturals.reduce((sum, width) => sum + width, 0);
      const top = region.floor - (rowFromFloor + 1) * rowHeight;
      let x = left;
      row.forEach((index, position) => {
        const isLast = position === row.length - 1;
        const width = isLast ? left + towerWidth - x : Math.round(naturals[position] + (free * naturals[position]) / total);
        slots[index] = { index, layerIndex, row: rowFromFloor, x: x + width / 2, y: top + rowHeight / 2, width, height: rowHeight };
        x += width + GAP_X;
      });
      rows.push(row);
      rowFromFloor++;
    });
    layers.push({
      layerIndex,
      top: region.floor - rowFromFloor * rowHeight,
      bottom: region.floor - bottomRow * rowHeight,
    });
  });

  const height = rowFromFloor * rowHeight;
  return { fs: chosen.fs, tower: { left, top: region.floor - height, width: towerWidth, height }, slots, layers, rows };
}

export function layoutTower(input: LayoutInput): TowerLayout | null {
  const layerCount = Math.max(0, ...input.layerOf) + 1;
  const layerTiles: number[][] = Array.from({ length: layerCount }, () => []);
  input.layerOf.forEach((layer, index) => layerTiles[layer].push(index));
  const [minFs, maxFs] = input.fontRange;
  let fallback: Attempt | null = null;
  for (let fs = maxFs; fs >= minFs; fs -= FONT_STEP) {
    const candidate = attempt(input, fs, layerTiles);
    if (!candidate) continue;
    fallback = candidate;
    if (fits(input, candidate)) return place(input, candidate);
  }
  return fallback ? place(input, fallback) : null;
}
