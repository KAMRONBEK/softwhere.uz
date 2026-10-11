/**
 * Route geometry for 16 · Process. One continuous line, built in pixels from
 * measured layout (no stretched viewBox, so circles stay round and strokes
 * stay even). It starts at the full stop of the section heading and changes
 * character per stage:
 *
 *   Discover  a magnifier: the line circles a lens and leaves by its rim
 *   Design    a phone: the line traces the device, then its UI fills in
 *   Build     a square wave: one pulse per two-week sprint, a dot per weekly demo
 *   Launch    a countdown, a vertical take-off and a burst at the apex
 *   Grow      a rising line with three iteration loops and an arrow
 *
 * Piece 0 is the lead-in from the full stop to the first station; piece i + 1
 * is stage i, from its station to the next one. Each piece is its own SVG, so
 * drawing one repaints only that piece's box.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Decorations that switch on when the pen passes `trigger` (a point on the route). */
export type RouteDetail =
  | { id: string; piece: number; trigger: Pt; kind: 'flow'; points: readonly Pt[]; r: number }
  | { id: string; piece: number; trigger: Pt; kind: 'grip'; from: Pt; to: Pt }
  | { id: string; piece: number; trigger: Pt; kind: 'phone'; x: number; y: number; w: number; h: number; divider: number }
  | { id: string; piece: number; trigger: Pt; kind: 'dot'; at: Pt; week: number; labelAt: Pt; anchor: 'start' | 'middle' | 'end' }
  | { id: string; piece: number; trigger: Pt; kind: 'bracket'; from: Pt; to: Pt; labelAt: Pt; hasLine: boolean }
  | { id: string; piece: number; trigger: Pt; kind: 'tick'; at: Pt; count: number; isVertical: boolean }
  | { id: string; piece: number; trigger: Pt; kind: 'burst'; at: Pt; r: number }
  | { id: string; piece: number; trigger: Pt; kind: 'version'; at: Pt; index: number }
  | { id: string; piece: number; trigger: Pt; kind: 'arrow'; at: Pt; angle: number };

/** A point on the route that switches something in the DOM on (a fact flag). */
export interface RouteMark {
  id: string;
  piece: number;
  at: Pt;
  /** Desktop: how far below the line the flag's label hangs. */
  depth?: number;
}

export interface RoutePiece {
  d: string;
  /** Conservative bounds of the path (control points included), padded. */
  box: Box;
}

export interface RouteGeometry {
  width: number;
  height: number;
  pieces: readonly RoutePiece[];
  start: Pt;
  nodes: readonly Pt[];
  details: readonly RouteDetail[];
  flags: readonly RouteMark[];
}

export const flagId = (step: number, k: number) => `flag-${step}-${k}`;

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
const BOX_PAD = 44;

/** Minimal SVG path writer (absolute commands only) that tracks its bounds. */
class PathWriter {
  private readonly out: string[] = [];
  private last: Pt = { x: 0, y: 0 };
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  private grow(x: number, y: number, r = 0): void {
    this.minX = Math.min(this.minX, x - r);
    this.minY = Math.min(this.minY, y - r);
    this.maxX = Math.max(this.maxX, x + r);
    this.maxY = Math.max(this.maxY, y + r);
  }

  M(x: number, y: number): this {
    this.out.push(`M${fmt(x)} ${fmt(y)}`);
    this.last = { x, y };
    this.grow(x, y);
    return this;
  }

  L(x: number, y: number): this {
    this.out.push(`L${fmt(x)} ${fmt(y)}`);
    this.last = { x, y };
    this.grow(x, y);
    return this;
  }

  C(x1: number, y1: number, x2: number, y2: number, x: number, y: number): this {
    this.out.push(`C${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)}`);
    this.last = { x, y };
    this.grow(x1, y1);
    this.grow(x2, y2);
    this.grow(x, y);
    return this;
  }

  Q(x1: number, y1: number, x: number, y: number): this {
    this.out.push(`Q${fmt(x1)} ${fmt(y1)} ${fmt(x)} ${fmt(y)}`);
    this.last = { x, y };
    this.grow(x1, y1);
    this.grow(x, y);
    return this;
  }

  A(r: number, isLarge: boolean, isClockwise: boolean, x: number, y: number): this {
    this.out.push(`A${fmt(r)} ${fmt(r)} 0 ${isLarge ? 1 : 0} ${isClockwise ? 1 : 0} ${fmt(x)} ${fmt(y)}`);
    // An arc stays within 2r of either end point.
    this.grow(this.last.x, this.last.y, 2 * r);
    this.last = { x, y };
    this.grow(x, y, 2 * r);
    return this;
  }

  /** Straight runs through `points` with rounded corners of radius `r`. */
  rounded(points: readonly Pt[], r: number): this {
    let from = this.last;
    points.forEach((corner, index) => {
      const next = points[index + 1];
      if (!next) {
        this.L(corner.x, corner.y);
        return;
      }
      const inLen = Math.hypot(corner.x - from.x, corner.y - from.y) || 1;
      const outLen = Math.hypot(next.x - corner.x, next.y - corner.y) || 1;
      const k = Math.min(r, inLen / 2, outLen / 2);
      const a = { x: corner.x - ((corner.x - from.x) / inLen) * k, y: corner.y - ((corner.y - from.y) / inLen) * k };
      const b = { x: corner.x + ((next.x - corner.x) / outLen) * k, y: corner.y + ((next.y - corner.y) / outLen) * k };
      this.L(a.x, a.y).Q(corner.x, corner.y, b.x, b.y);
      from = corner;
    });
    return this;
  }

  /**
   * A full loop of radius r that leaves and rejoins the line at the current
   * point with the same heading (dx, dy), bulging to the heading's left.
   */
  loop(dx: number, dy: number, r: number): this {
    const p = this.last;
    const len = Math.hypot(dx, dy) || 1;
    const n = { x: dy / len, y: -dx / len };
    const opposite = { x: p.x + 2 * r * n.x, y: p.y + 2 * r * n.y };
    return this.A(r, false, false, opposite.x, opposite.y).A(r, false, false, p.x, p.y);
  }

  piece(): RoutePiece {
    const x = Math.floor(this.minX - BOX_PAD);
    const y = Math.floor(this.minY - BOX_PAD);
    return {
      d: this.out.join(''),
      box: { x, y, w: Math.ceil(this.maxX + BOX_PAD) - x, h: Math.ceil(this.maxY + BOX_PAD) - y },
    };
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/** Evenly spread depths from deepest (first flag) to shallowest, so no leader crosses a label. */
function flagDepths(count: number, deepest: number, shallowest: number): number[] {
  if (count <= 1) return [shallowest];
  return Array.from({ length: count }, (_, k) => Math.round(deepest + ((shallowest - deepest) * k) / (count - 1)));
}

/** The magnifier's thick grip along its handle, drawn out of the lens once the lens is closed. */
function grip(piece: number, joint: Pt, handleEnd: Pt, lensBottom: Pt): RouteDetail {
  const dx = handleEnd.x - joint.x;
  const dy = handleEnd.y - joint.y;
  return {
    id: 'grip',
    piece,
    kind: 'grip',
    trigger: lensBottom,
    from: { x: joint.x + dx * 0.12, y: joint.y + dy * 0.12 },
    to: { x: joint.x + dx * 0.78, y: joint.y + dy * 0.78 },
  };
}

/* ------------------------------------------------------------------------ */
/* Horizontal (desktop): a track that the camera follows                     */
/* ------------------------------------------------------------------------ */

export interface HorizontalInput {
  /** Stage (viewport) size. */
  vw: number;
  vh: number;
  /** Height reserved at the bottom for the HUD. */
  hudHeight: number;
  /** Track x of the heading's full stop; the route starts there, on the baseline. */
  startX: number;
  /** Number of facts per stage. */
  factCounts: readonly number[];
}

export interface HorizontalLayout extends RouteGeometry {
  /** Screen x the pen is kept at while the camera follows it. */
  focusX: number;
  seg: number;
  baseline: number;
  /** Width of a stage's title block (it stands above the line, left of the figure). */
  blockW: number;
  /** Max width of a flag label. */
  flagW: number;
  outro: Pt;
  /** Width of the outro block, so it always ends inside the screen in the last frame. */
  outroW: number;
  /** Most negative camera offset. */
  minCam: number;
}

/** Baseline y for a stage height: words stand above it on the left, flags hang below. */
export function horizontalBaseline(vh: number, hudHeight: number): number {
  const top = Math.max(92, vh * 0.11);
  const floor = vh - hudHeight - 20;
  return Math.round(clamp(vh * 0.56, top + 300, floor - 190));
}

export function buildHorizontal({ vw, vh, hudHeight, startX, factCounts }: HorizontalInput): HorizontalLayout {
  const seg = Math.round(clamp(vw * 0.6, 660, 1040));
  const top = Math.max(92, vh * 0.11);
  const floor = vh - hudHeight - 20;
  const yb = horizontalBaseline(vh, hudHeight);
  const above = yb - top;
  const lead = 170;
  const blockW = Math.round(Math.min(seg * 0.38, 360));
  const flagW = Math.round(seg * 0.27);
  const deepest = clamp(floor - yb - 44, 90, 168);

  const pieces: RoutePiece[] = [];
  const details: RouteDetail[] = [];
  const flags: RouteMark[] = [];
  const nodes: Pt[] = Array.from({ length: 5 }, (_, i) => ({ x: startX + lead + i * seg, y: yb }));

  pieces.push(new PathWriter().M(startX, yb).L(nodes[0].x, yb).piece());

  factCounts.forEach((count, i) => {
    const n = nodes[i].x;
    const shares = count >= 3 ? [0.06, 0.2, 0.34] : [0.08, 0.3];
    const depths = flagDepths(count, count >= 3 ? deepest : deepest * 0.8, 46);
    for (let k = 0; k < count; k++) {
      flags.push({ id: flagId(i, k), piece: i + 1, at: { x: n + seg * (shares[k] ?? 0.34), y: yb }, depth: depths[k] });
    }
  });

  // 1 · Discover — a magnifier, handle down-left onto the line.
  {
    const n = nodes[0].x;
    const r = Math.min(above * 0.3, seg * 0.12, 110);
    const handle = r * 0.62;
    const cx = n + seg * 0.72;
    const cy = yb - 0.707 * r - handle;
    const joint = { x: cx - 0.707 * r, y: cy + 0.707 * r };
    const handleEnd = { x: joint.x - handle, y: yb };
    const exit = { x: cx + 1.7 * r, y: yb };
    const p = new PathWriter().M(n, yb).rounded([handleEnd, joint], 16);
    p.A(r, false, false, cx + 0.707 * r, cy - 0.707 * r)
      .A(r, false, false, joint.x, joint.y)
      .A(r, false, false, cx, cy + r);
    p.C(cx + 0.7 * r, cy + r, cx + 1.1 * r, yb, exit.x, yb).L(n + seg, yb);
    pieces.push(p.piece());
    details.push(grip(1, joint, handleEnd, { x: cx, y: cy + r }));
    details.push({
      id: 'flow',
      piece: 1,
      kind: 'flow',
      trigger: exit,
      r: r * 0.09,
      points: [
        { x: cx - 0.42 * r, y: cy + 0.18 * r },
        { x: cx + 0.02 * r, y: cy - 0.36 * r },
        { x: cx + 0.42 * r, y: cy + 0.1 * r },
      ],
    });
  }

  // 2 · Design — the line traces a phone floating above it, then crosses it as a divider.
  {
    const n = nodes[1].x;
    const ph = Math.min(above - 26, seg * 0.44, 400);
    const pw = ph * 0.5;
    const pb = yb - 22;
    const pt = pb - ph;
    const cx = n + seg * 0.68;
    const pl = cx - pw / 2;
    const pr = cx + pw / 2;
    const rr = pw * 0.16;
    const ym = pt + ph * 0.48;
    const land = { x: pr + 96, y: yb };
    const p = new PathWriter()
      .M(n, yb)
      .L(pl - 70, yb)
      .C(pl - 26, yb, pl, yb - 8, pl, pb - rr);
    p.L(pl, pt + rr)
      .A(rr, false, true, pl + rr, pt)
      .L(pr - rr, pt)
      .A(rr, false, true, pr, pt + rr)
      .L(pr, pb - rr)
      .A(rr, false, true, pr - rr, pb)
      .L(pl + rr, pb)
      .A(rr, false, true, pl, pb - rr)
      .L(pl, ym)
      .L(pr, ym);
    p.C(pr + 50, ym, pr + 34, yb, land.x, yb).L(n + seg, yb);
    pieces.push(p.piece());
    details.push({ id: 'phone', piece: 2, kind: 'phone', trigger: land, x: pl, y: pt, w: pw, h: ph, divider: ym });
  }

  // 3 · Build — three two-week sprints as a square wave, a dot per weekly demo.
  {
    const n = nodes[2].x;
    const x0 = n + seg * 0.44;
    const x1 = n + seg * 0.97;
    const w = (x1 - x0) / 3;
    const yh = yb - Math.min(above * 0.5, 190);
    const corners: Pt[] = [];
    for (let k = 0; k < 3; k++) {
      const a = x0 + k * w;
      corners.push({ x: a, y: yb }, { x: a, y: yh }, { x: a + w / 2, y: yh }, { x: a + w / 2, y: yb });
      const top = { x: a + w / 4, y: yh };
      const low = { x: a + (3 * w) / 4, y: yb };
      details.push(
        {
          id: `dot-${k}a`,
          piece: 3,
          kind: 'dot',
          trigger: top,
          at: top,
          week: 3 + 2 * k,
          labelAt: { x: top.x, y: yh - 16 },
          anchor: 'middle',
        },
        {
          id: `dot-${k}b`,
          piece: 3,
          kind: 'dot',
          trigger: low,
          at: low,
          week: 4 + 2 * k,
          labelAt: { x: low.x, y: yb - 16 },
          anchor: 'middle',
        }
      );
    }
    corners.push({ x: n + seg, y: yb });
    const p = new PathWriter()
      .M(n, yb)
      .L(x0 - 1, yb)
      .rounded(corners, Math.min(10, w / 8));
    pieces.push(p.piece());
    details.push({
      id: 'sprint',
      piece: 3,
      kind: 'bracket',
      trigger: { x: x0 + w / 4, y: yh },
      from: { x: x0, y: yh - 38 },
      to: { x: x0 + w, y: yh - 38 },
      labelAt: { x: x0 + w / 2, y: yh - 48 },
      hasLine: true,
    });
  }

  // 4 · Launch — countdown ticks, vertical take-off, burst, a glide back down.
  {
    const n = nodes[3].x;
    const xs = n + seg * 0.64;
    const ya = top + 24;
    [0.47, 0.52, 0.57].forEach((share, k) => {
      const at = { x: n + seg * share, y: yb };
      details.push({ id: `tick-${k}`, piece: 4, kind: 'tick', trigger: at, at, count: 3 - k, isVertical: false });
    });
    const p = new PathWriter().M(n, yb).rounded(
      [
        { x: xs, y: yb },
        { x: xs, y: ya + 30 },
      ],
      22
    );
    p.C(xs, ya - 6, xs + seg * 0.05, ya - 8, xs + seg * 0.09, ya + 6);
    p.C(xs + seg * 0.2, ya + (yb - ya) * 0.4, xs + seg * 0.26, yb, n + seg * 0.96, yb).L(n + seg, yb);
    pieces.push(p.piece());
    details.push({ id: 'burst', piece: 4, kind: 'burst', trigger: { x: xs, y: ya + 30 }, at: { x: xs + seg * 0.035, y: ya - 3 }, r: 34 });
  }

  // 5 · Grow — a rising line with three iteration loops, ending in an arrow.
  let arrowTip: Pt;
  {
    const n = nodes[4].x;
    const p0 = { x: n + seg * 0.46, y: yb - 14 };
    const p1 = { x: n + seg * 0.97, y: top + 14 };
    arrowTip = p1;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    const p = new PathWriter().M(n, yb).L(n + seg * 0.36, yb);
    p.C(n + seg * 0.41, yb, p0.x - (dx / len) * 30, p0.y - (dy / len) * 30, p0.x, p0.y);
    const radii = [0.026, 0.034, 0.043].map(share => Math.max(12, vh * share));
    [0.26, 0.52, 0.78].forEach((t, k) => {
      const at = { x: p0.x + dx * t, y: p0.y + dy * t };
      p.L(at.x, at.y).loop(dx, dy, radii[k]);
      const nrm = { x: dy / len, y: -dx / len };
      details.push({
        id: `version-${k}`,
        piece: 5,
        kind: 'version',
        trigger: { x: at.x + dx * 0.06, y: at.y + dy * 0.06 },
        at: { x: at.x + nrm.x * radii[k] * 2 - 6, y: at.y + nrm.y * radii[k] * 2 - 10 },
        index: k,
      });
    });
    p.L(p1.x, p1.y);
    pieces.push(p.piece());
    details.push({
      id: 'arrow',
      piece: 5,
      kind: 'arrow',
      trigger: { x: p1.x - (dx / len) * 6, y: p1.y - (dy / len) * 6 },
      at: p1,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    });
  }

  const end = nodes[4].x + seg;
  // Far enough right that a stage's title block stays on screen until its figure is drawn.
  const focusX = Math.round(Math.min(Math.max(vw * 0.6, seg * 0.97 + 40), vw - 200));

  return {
    width: end + vw * 0.45,
    height: vh,
    pieces,
    start: { x: startX, y: yb },
    nodes,
    details,
    flags,
    focusX,
    seg,
    baseline: yb,
    blockW,
    flagW,
    outro: { x: end + 24, y: arrowTip.y + 30 },
    outroW: Math.round(Math.min(440, vw * 0.3, vw - focusX - 24 - 40)),
    minCam: focusX - end,
  };
}

/* ------------------------------------------------------------------------ */
/* Vertical (phones, reduced motion): the line runs down a gutter            */
/* ------------------------------------------------------------------------ */

export interface VerticalInput {
  width: number;
  height: number;
  /** Gutter x the line runs down. */
  gutter: number;
  /** The heading's full stop. */
  start: Pt;
  /** Y where the lead-in swings from the right margin into the gutter (below the lede). */
  turnY: number;
  /** Per step: station centre y, its flags' y, and the figure zone. */
  steps: ReadonlyArray<{ nodeY: number; flagYs: readonly number[]; zoneTop: number; zoneBottom: number }>;
}

export function sameVerticalInput(a: VerticalInput | null, b: VerticalInput): boolean {
  if (!a || a.width !== b.width || a.height !== b.height || a.turnY !== b.turnY) return false;
  if (a.start.x !== b.start.x || a.start.y !== b.start.y || a.steps.length !== b.steps.length) return false;
  return a.steps.every((step, i) => {
    const other = b.steps[i];
    return (
      step.nodeY === other.nodeY &&
      step.zoneTop === other.zoneTop &&
      step.zoneBottom === other.zoneBottom &&
      step.flagYs.length === other.flagYs.length &&
      step.flagYs.every((y, k) => y === other.flagYs[k])
    );
  });
}

export function buildVertical({ width, height, gutter: g, start, turnY, steps }: VerticalInput): RouteGeometry {
  const pieces: RoutePiece[] = [];
  const details: RouteDetail[] = [];
  const flags: RouteMark[] = [];
  const nodes: Pt[] = steps.map(step => ({ x: g, y: step.nodeY }));
  const right = width - 6;

  // Lead-in: out of the full stop, down the right margin past the lede, then
  // one long swing into the gutter and down to the first station.
  {
    const p = new PathWriter().M(start.x, start.y);
    const bend = Math.min(46, Math.max(24, (turnY - start.y) * 0.3));
    p.C(start.x + Math.max(20, (right - start.x) * 0.7), start.y, right, start.y + 4, right, start.y + bend);
    p.L(right, Math.max(start.y + bend, turnY - 24));
    const swingEnd = Math.min(steps[0].nodeY - 26, turnY + 70);
    p.C(right, turnY + 34, g, swingEnd - 52, g, swingEnd).L(g, steps[0].nodeY);
    pieces.push(p.piece());
  }

  steps.forEach((step, i) => {
    const piece = i + 1;
    const zt = step.zoneTop;
    const zb = step.zoneBottom;
    const z = zb - zt;
    const next = steps[i + 1];
    step.flagYs.forEach((y, k) => flags.push({ id: flagId(i, k), piece, at: { x: g, y } }));
    const p = new PathWriter().M(g, step.nodeY).L(g, zt);

    if (i === 0) {
      // Magnifier: a J up into the handle, round the lens, a U-turn under it.
      const r = Math.min(width * 0.18, z * 0.26, 70);
      const handle = r * 0.62;
      const cx = width * 0.64;
      const cy = zt + z * 0.36;
      const joint = { x: cx - 0.707 * r, y: cy + 0.707 * r };
      const handleEnd = { x: joint.x - handle, y: joint.y + handle };
      p.C(g, handleEnd.y + 22, handleEnd.x - 28, handleEnd.y + 28, handleEnd.x, handleEnd.y).L(joint.x, joint.y);
      p.A(r, false, false, cx + 0.707 * r, cy - 0.707 * r)
        .A(r, false, false, joint.x, joint.y)
        .A(r, false, false, cx, cy + r);
      const low = Math.min(zb - 20, cy + 2.1 * r);
      const exit = { x: cx + 0.2 * r, y: low };
      p.C(cx + 1.3 * r, cy + r, cx + 1.3 * r, low, exit.x, exit.y);
      p.C(cx - 1.4 * r, low, g, zb - (zb - low) * 0.5, g, zb);
      details.push(grip(piece, joint, handleEnd, { x: cx, y: cy + r }));
      details.push({
        id: 'flow',
        piece,
        kind: 'flow',
        trigger: exit,
        r: r * 0.09,
        points: [
          { x: cx - 0.42 * r, y: cy + 0.18 * r },
          { x: cx + 0.02 * r, y: cy - 0.36 * r },
          { x: cx + 0.42 * r, y: cy + 0.1 * r },
        ],
      });
    } else if (i === 1) {
      // Phone outline traced by the line, a divider across, then around it.
      const ph = Math.min(z * 0.86, 300);
      const pw = ph * 0.5;
      const cx = width * 0.56;
      const pt = zt + (z - ph) * 0.3;
      const pb = pt + ph;
      const pl = cx - pw / 2;
      const pr = cx + pw / 2;
      const rr = pw * 0.16;
      const ym = pt + ph * 0.46;
      p.C(g, ym + 36, pl, ym + 70, pl, ym + 20)
        .L(pl, pt + rr)
        .A(rr, false, true, pl + rr, pt)
        .L(pr - rr, pt)
        .A(rr, false, true, pr, pt + rr)
        .L(pr, pb - rr)
        .A(rr, false, true, pr - rr, pb)
        .L(pl + rr, pb)
        .A(rr, false, true, pl, pb - rr)
        .L(pl, ym)
        .L(pr, ym);
      const side = Math.min(right - 2, pr + 30);
      const gap = zb - pb;
      const exit = { x: side, y: ym + 44 };
      p.C(pr + 22, ym, side, ym + 8, side, ym + 30).L(side, pb - 12);
      p.C(side, pb + gap * 0.85, g, zb - gap * 0.55, g, zb);
      details.push({ id: 'phone', piece, kind: 'phone', trigger: exit, x: pl, y: pt, w: pw, h: ph, divider: ym });
    } else if (i === 2) {
      // The square wave turned on its side: three sprints, a dot per weekly demo.
      const xr = Math.min(right - 8, width * 0.86);
      const top = zt + Math.min(26, z * 0.1);
      const bottom = zb - Math.min(26, z * 0.1);
      const half = (bottom - top) / 6;
      const corners: Pt[] = [{ x: g, y: top }];
      for (let k = 0; k < 3; k++) {
        const a = top + k * 2 * half;
        corners.push({ x: xr, y: a }, { x: xr, y: a + half }, { x: g, y: a + half }, { x: g, y: a + 2 * half });
        const out = { x: xr, y: a + half / 2 };
        const back = { x: g, y: a + half * 1.5 };
        details.push(
          {
            id: `dot-${k}a`,
            piece,
            kind: 'dot',
            trigger: out,
            at: out,
            week: 3 + 2 * k,
            labelAt: { x: xr - 16, y: out.y + 4 },
            anchor: 'end',
          },
          {
            id: `dot-${k}b`,
            piece,
            kind: 'dot',
            trigger: back,
            at: back,
            week: 4 + 2 * k,
            labelAt: { x: g + 16, y: back.y + 4 },
            anchor: 'start',
          }
        );
      }
      corners.push({ x: g, y: zb });
      p.rounded(corners, Math.min(9, half / 3));
      details.push({
        id: 'sprint',
        piece,
        kind: 'bracket',
        trigger: { x: xr, y: top + half / 2 },
        from: { x: g, y: top + half / 2 },
        to: { x: xr, y: top + half / 2 },
        labelAt: { x: (g + xr) / 2, y: top + half / 2 + 4 },
        hasLine: false,
      });
    } else if (i === 3) {
      // Countdown down the gutter, then a take-off up to the apex and a glide back.
      const launchY = zt + z * 0.8;
      const ya = zt + z * 0.1;
      const xs = width * 0.5;
      [0.18, 0.32, 0.46].forEach((share, k) => {
        const at = { x: g, y: zt + z * share };
        details.push({ id: `tick-${k}`, piece, kind: 'tick', trigger: at, at, count: 3 - k, isVertical: true });
      });
      p.L(g, launchY - 30);
      p.C(g, launchY, g + 10, launchY, g + 40, launchY);
      p.rounded(
        [
          { x: xs, y: launchY },
          { x: xs, y: ya + 26 },
        ],
        22
      );
      p.C(xs, ya - 6, xs + width * 0.06, ya - 8, xs + width * 0.11, ya + 6);
      p.C(right, ya + z * 0.35, right - 10, zb - z * 0.05, g + 60, zb - z * 0.02);
      p.C(g + 20, zb - z * 0.01, g, zb, g, zb);
      details.push({ id: 'burst', piece, kind: 'burst', trigger: { x: xs, y: ya + 26 }, at: { x: xs + width * 0.04, y: ya - 3 }, r: 30 });
    } else {
      // Grow: a rising diagonal with three loops, ending in an arrow.
      const p0 = { x: g + 30, y: zb - z * 0.12 };
      const p1 = { x: right - 14, y: zt + z * 0.14 };
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      p.C(g, p0.y + 20, p0.x - (dx / len) * 24, p0.y - (dy / len) * 24, p0.x, p0.y);
      const radii = [12, 16, 21];
      [0.24, 0.5, 0.76].forEach((t, k) => {
        const at = { x: p0.x + dx * t, y: p0.y + dy * t };
        p.L(at.x, at.y).loop(dx, dy, radii[k]);
        const nrm = { x: dy / len, y: -dx / len };
        details.push({
          id: `version-${k}`,
          piece,
          kind: 'version',
          trigger: { x: at.x + dx * 0.06, y: at.y + dy * 0.06 },
          at: { x: at.x + nrm.x * radii[k] * 2 - 4, y: at.y + nrm.y * radii[k] * 2 - 8 },
          index: k,
        });
      });
      p.L(p1.x, p1.y);
      details.push({
        id: 'arrow',
        piece,
        kind: 'arrow',
        trigger: { x: p1.x - (dx / len) * 6, y: p1.y - (dy / len) * 6 },
        at: p1,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    }

    // Every stage piece ends at the next station, so piece i + 1 starts exactly at node i.
    if (next) p.L(g, next.nodeY);
    pieces.push(p.piece());
  });

  return { width, height, pieces, start, nodes, details, flags };
}
