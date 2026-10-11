/**
 * 2D-canvas "plan pipeline" for 12 · ai-demo: a layered, fully connected
 * network (the textbook neural-net diagram) with one layer per step (Read,
 * Scope, Sketch, Price). The idea's letters stream into the first layer, the
 * layers light up as the steps finish, pulses race through them, and the last
 * layer converges on one output whose feed wire carries them to the print
 * head that "prints" the plan card.
 *
 * Framework-free on purpose: FlowField.tsx owns the lifecycle (mount, in-view
 * pause, resize, theme) and this file owns pixels. Only the dirty part of the
 * canvas is cleared each frame; the loop runs at 30fps unless something is
 * moving fast, and stops by itself once the plan has settled (or after a few
 * calm seconds while it waits for an idea).
 */

export interface FlowSignal {
  /** 0 = calm, 1 = thinking. Tween it from outside. */
  intensity: number;
  /** -1 = idle (nothing scoped yet); 0..4 = columns below floor(step) are done, floor(step) is working. */
  step: number;
  /** 0..1: the output feeds the plan (pulses ride the wire to the print head). */
  feed: number;
  /** Print head position, CSS px below the plan card's top edge. */
  printY: number;
}

export interface FlowColors {
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
}

interface Point {
  x: number;
  y: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlowGeometry {
  /** Canvas size, CSS px. */
  width: number;
  height: number;
  /** Where the node columns live, canvas-local. */
  plot: Rect;
  /** Column centres (x), canvas-local: one per step label. */
  columns: readonly number[];
  output: Point;
  /**
   * Feed wire end. 'x': the plan sits to the right, the wire ends on its left
   * edge at the print head (y + printY). 'y': the plan sits below, the wire
   * drops into its top edge.
   */
  feed: { x: number; y: number; axis: 'x' | 'y' } | null;
}

export interface FlowDensity {
  /** Most nodes in one column. */
  maxNodes: number;
  maxPulses: number;
  /** Multiplier on the spawn rate. */
  rate: number;
  /** Soft glow sprites around pulses and working nodes. */
  hasGlow: boolean;
  /** Frame-rate ceiling. */
  maxFps: 30 | 60;
}

export interface FlowGlyph {
  ch: string;
  /** Canvas-local centre. */
  x: number;
  y: number;
}

interface EngineOptions {
  canvas: HTMLCanvasElement;
  signal: FlowSignal;
  density: FlowDensity;
  dpr: number;
  seed: number;
}

export interface FlowEngine {
  layout(geometry: FlowGeometry): void;
  setColors(colors: FlowColors, isDark: boolean): void;
  /** Letters peel off the idea and stream into the first layer. */
  launch(glyphs: readonly FlowGlyph[], font: string): void;
  /** In view or not: the loop only runs while active. */
  setActive(isActive: boolean): void;
  /** Restart the loop after it settled (a replay, a status change). */
  wake(): void;
  /** One composed frame of the finished plan (reduced motion, no loop). */
  drawStill(): void;
  destroy(): void;
}

const TAU = Math.PI * 2;
const SPRITE_SIZE = 64;
const TAIL = [0, 0.07, 0.14, 0.21] as const;
const FEED_EDGE = -2;
/** The plan is done and calm for this long → stop spawning, drain, stop the loop. */
const SETTLE_SECONDS = 3;
const IDLE_SECONDS = 6;
const GLYPH_DURATION = 0.8;
const GLYPH_SPREAD = 0.7;
const NODE_PITCH = 44;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function makeDot(hex: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = SPRITE_SIZE;
  sprite.height = SPRITE_SIZE;
  const ctx = sprite.getContext('2d');
  if (!ctx) return sprite;
  const half = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, rgba(hex, 1));
  gradient.addColorStop(0.2, rgba(hex, 0.5));
  gradient.addColorStop(0.55, rgba(hex, 0.1));
  gradient.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return sprite;
}

/** A soft vertical light bar (stretched over the working column). */
function makeBand(hex: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = SPRITE_SIZE;
  sprite.height = SPRITE_SIZE;
  const ctx = sprite.getContext('2d');
  if (!ctx) return sprite;
  const across = ctx.createLinearGradient(0, 0, SPRITE_SIZE, 0);
  across.addColorStop(0, rgba(hex, 0));
  across.addColorStop(0.5, rgba(hex, 1));
  across.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  // Fade the ends so the bar has no hard top or bottom.
  ctx.globalCompositeOperation = 'destination-in';
  const along = ctx.createLinearGradient(0, 0, 0, SPRITE_SIZE);
  along.addColorStop(0, 'rgba(0,0,0,0)');
  along.addColorStop(0.3, 'rgba(0,0,0,1)');
  along.addColorStop(0.7, 'rgba(0,0,0,1)');
  along.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return sprite;
}

interface Graph {
  /** Base positions (before drift). */
  bx: Float32Array;
  by: Float32Array;
  /** Layer index; columns.length = the output node. */
  col: Int8Array;
  phase: Float32Array;
  amp: Float32Array;
  act: Float32Array;
  edgeA: Int16Array;
  edgeB: Int16Array;
  edgeLen: Float32Array;
  edgeAct: Float32Array;
  out: number[][];
  /** The first layer (Read): the letters land here and pulses start here. */
  firstLayer: readonly number[];
  output: number;
  columnCount: number;
}

function buildGraph(g: FlowGeometry, density: FlowDensity, rand: () => number): Graph {
  const columnCount = g.columns.length;
  const base = Math.max(2, Math.min(density.maxNodes - 1, Math.round(g.plot.height / NODE_PITCH)));
  const xs: number[] = [];
  const ys: number[] = [];
  const cols: number[] = [];
  const layers: number[][] = [];
  // Evenly spaced layers, alternating n and n+1 nodes: the classic diagram, not a tangle.
  for (let c = 0; c < columnCount; c++) {
    const count = Math.min(density.maxNodes, base + (c % 2 === 1 ? 1 : 0));
    const layer: number[] = [];
    const pitch = g.plot.height / count;
    for (let k = 0; k < count; k++) {
      layer.push(xs.length);
      xs.push(g.columns[c]);
      ys.push(g.plot.top + pitch * (k + 0.5));
      cols.push(c);
    }
    layers.push(layer);
  }
  layers.push([xs.length]);
  xs.push(g.output.x);
  ys.push(g.output.y);
  cols.push(columnCount);

  // Fully connected between neighbouring layers.
  const edgeA: number[] = [];
  const edgeB: number[] = [];
  const out: number[][] = xs.map(() => []);
  for (let j = 0; j < layers.length - 1; j++) {
    for (const a of layers[j]) {
      for (const b of layers[j + 1]) {
        out[a].push(edgeA.length);
        edgeA.push(a);
        edgeB.push(b);
      }
    }
  }

  const n = xs.length;
  const phase = new Float32Array(n);
  const amp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    phase[i] = rand() * TAU;
    amp[i] = cols[i] >= columnCount ? 0 : 0.5 + rand() * 0.9;
  }
  const edgeLen = new Float32Array(edgeA.length);
  for (let e = 0; e < edgeA.length; e++) {
    edgeLen[e] = Math.hypot(xs[edgeB[e]] - xs[edgeA[e]], ys[edgeB[e]] - ys[edgeA[e]]) + 1;
  }
  return {
    bx: Float32Array.from(xs),
    by: Float32Array.from(ys),
    col: Int8Array.from(cols),
    phase,
    amp,
    act: new Float32Array(n),
    edgeA: Int16Array.from(edgeA),
    edgeB: Int16Array.from(edgeB),
    edgeLen,
    edgeAct: new Float32Array(edgeA.length),
    out,
    firstLayer: layers[0] ?? [],
    output: n - 1,
    columnCount,
  };
}

interface Pulse {
  edge: number;
  t: number;
  speed: number;
  hue: 0 | 1;
}

interface Flight {
  ch: string;
  /** The first-layer node it lands on. */
  node: number;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  delay: number;
  duration: number;
}

/** Bounding box of everything drawn this frame, so the next frame clears only that. */
class Dirty {
  x0 = Infinity;
  y0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;

  mark(x0: number, y0: number, x1: number, y1: number): void {
    if (x0 < this.x0) this.x0 = x0;
    if (y0 < this.y0) this.y0 = y0;
    if (x1 > this.x1) this.x1 = x1;
    if (y1 > this.y1) this.y1 = y1;
  }

  reset(): void {
    this.x0 = Infinity;
    this.y0 = Infinity;
    this.x1 = -Infinity;
    this.y1 = -Infinity;
  }

  get isEmpty(): boolean {
    return this.x1 < this.x0;
  }
}

export function createFlowEngine({ canvas, signal, density, dpr, seed }: EngineOptions): FlowEngine | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const rand = mulberry32(seed);
  let graph: Graph | null = null;
  let geometry: FlowGeometry | null = null;
  let nx = new Float32Array(0);
  let ny = new Float32Array(0);
  const pulses: Pulse[] = [];
  const flights: Flight[] = [];
  let glyphFont = '16px sans-serif';
  let flightClock = 0;
  let arrivals = 0;

  let colors: FlowColors = { fg: '#ffffff', muted: '#888888', accent: '#00ffff', accent2: '#ff00ff' };
  let isDark = true;
  let dots: [HTMLCanvasElement, HTMLCanvasElement] | null = null;
  let band: HTMLCanvasElement | null = null;

  let frame = 0;
  let isActive = false;
  let isStill = false;
  let lastTick = 0;
  let clock = 0;
  let spawnDebt = 0;
  let settledFor = 0;
  let outputFlash = 0;
  let headFlash = 0;
  const dirty = new Dirty();
  const xy = new Float32Array(2);

  const columnState = (column: number): 'done' | 'active' | 'pending' => {
    const step = signal.step;
    if (step < 0) return 'pending';
    if (step >= 4 || column < Math.floor(step)) return 'done';
    return column === Math.floor(step) ? 'active' : 'pending';
  };

  const placeNodes = (time: number) => {
    if (!graph) return;
    for (let i = 0; i < nx.length; i++) {
      nx[i] = graph.bx[i] + Math.cos(time * 0.5 + graph.phase[i] * 1.7) * graph.amp[i] * 0.6;
      ny[i] = graph.by[i] + Math.sin(time * 0.7 + graph.phase[i]) * graph.amp[i];
    }
  };

  const feedEnd = (out: Float32Array) => {
    const feed = geometry?.feed;
    if (!feed) return;
    out[0] = feed.x;
    out[1] = feed.axis === 'x' ? feed.y + signal.printY : feed.y;
  };

  const feedEndXY = new Float32Array(2);

  /** Cubic bezier control points of edge e (or the feed wire) into a scratch array. */
  const controls = new Float32Array(8);
  const edgeControls = (e: number) => {
    if (!graph) return;
    if (e === FEED_EDGE) {
      feedEnd(feedEndXY);
      const x0 = nx[graph.output];
      const y0 = ny[graph.output];
      const x3 = feedEndXY[0];
      const y3 = feedEndXY[1];
      const isRow = geometry?.feed?.axis === 'x';
      controls[0] = x0;
      controls[1] = y0;
      controls[2] = isRow ? x0 + Math.max(26, (x3 - x0) * 0.7) : x0 + 12;
      controls[3] = isRow ? y0 : y0 + (y3 - y0) * 0.15;
      controls[4] = isRow ? x3 - 30 : x3;
      controls[5] = isRow ? y3 : y3 - (y3 - y0) * 0.55;
      controls[6] = x3;
      controls[7] = y3;
      return;
    }
    // Straight wires (controls on the thirds, so pulses move at an even speed).
    const a = graph.edgeA[e];
    const b = graph.edgeB[e];
    const dx = (nx[b] - nx[a]) / 3;
    const dy = (ny[b] - ny[a]) / 3;
    controls[0] = nx[a];
    controls[1] = ny[a];
    controls[2] = nx[a] + dx;
    controls[3] = ny[a] + dy;
    controls[4] = nx[b] - dx;
    controls[5] = ny[b] - dy;
    controls[6] = nx[b];
    controls[7] = ny[b];
  };

  const pointOn = (e: number, t: number, out: Float32Array) => {
    edgeControls(e);
    const s = 1 - t;
    const k0 = s * s * s;
    const k1 = 3 * s * s * t;
    const k2 = 3 * s * t * t;
    const k3 = t * t * t;
    out[0] = k0 * controls[0] + k1 * controls[2] + k2 * controls[4] + k3 * controls[6];
    out[1] = k0 * controls[1] + k1 * controls[3] + k2 * controls[5] + k3 * controls[7];
  };

  const traceEdge = (e: number) => {
    edgeControls(e);
    ctx.moveTo(controls[0], controls[1]);
    ctx.bezierCurveTo(controls[2], controls[3], controls[4], controls[5], controls[6], controls[7]);
  };

  const feedLength = () => {
    if (!graph) return 1;
    feedEnd(feedEndXY);
    return Math.hypot(feedEndXY[0] - nx[graph.output], feedEndXY[1] - ny[graph.output]) * 1.15 + 1;
  };

  const pickOut = (node: number): number => {
    if (!graph) return -1;
    const options = graph.out[node];
    return options.length ? options[Math.floor(rand() * options.length)] : -1;
  };

  /** A pulse leaves a first-layer node (a random one, or the one a letter just hit). */
  const spawn = (speed: number, from = -1) => {
    if (!graph || pulses.length >= density.maxPulses || !graph.firstLayer.length) return;
    const node = from >= 0 ? from : graph.firstLayer[Math.floor(rand() * graph.firstLayer.length)];
    const edge = pickOut(node);
    if (edge < 0) return;
    pulses.push({ edge, t: 0, speed: speed * (0.8 + rand() * 0.4), hue: rand() < 0.66 ? 0 : 1 });
    graph.act[node] = Math.max(graph.act[node], 0.6);
  };

  /** Calm: the plan is done, or still waiting for an idea, and nothing is being fed. */
  const isSettled = () => (signal.step >= 4 || signal.step < 0) && signal.intensity < 0.4 && signal.feed < 0.05;
  /** Waiting for an idea idles a little longer before it rests (a visitor may be about to play it). */
  const settleAfter = () => (signal.step < 0 ? IDLE_SECONDS : SETTLE_SECONDS);

  const stepFlights = (dt: number, speed: number) => {
    if (!flights.length || !geometry) return;
    flightClock += dt;
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      if (flightClock - f.delay < f.duration) continue;
      flights.splice(i, 1);
      if (graph) graph.act[f.node] = 1;
      arrivals += 1;
      if (arrivals % 3 === 0) spawn(speed * 1.2, f.node);
    }
  };

  const step = (dt: number) => {
    if (!graph) return;
    const intensity = Math.min(Math.max(signal.intensity, 0), 1);
    const speed = 110 + 280 * intensity;
    settledFor = isSettled() ? settledFor + dt : 0;
    if (settledFor < settleAfter()) {
      spawnDebt += dt * (1.1 + 20 * intensity * intensity) * density.rate;
      while (spawnDebt >= 1) {
        spawn(speed);
        spawnDebt -= 1;
      }
    } else {
      spawnDebt = 0;
    }
    stepFlights(dt, speed);

    const canFeed = signal.feed > 0.05 && geometry?.feed;
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pulse = pulses[i];
      const length = pulse.edge === FEED_EDGE ? feedLength() : graph.edgeLen[pulse.edge];
      pulse.t += (dt * pulse.speed) / length;
      if (pulse.edge >= 0) graph.edgeAct[pulse.edge] = Math.max(graph.edgeAct[pulse.edge], 0.9);
      if (pulse.t < 1) continue;
      if (pulse.edge === FEED_EDGE) {
        headFlash = 1;
        pulses.splice(i, 1);
        continue;
      }
      const node = graph.edgeB[pulse.edge];
      graph.act[node] = 1;
      if (node === graph.output) {
        outputFlash = 1;
        if (canFeed) {
          pulse.edge = FEED_EDGE;
          pulse.t = 0;
        } else {
          pulses.splice(i, 1);
        }
        continue;
      }
      const next = pickOut(node);
      if (next < 0) {
        pulses.splice(i, 1);
        continue;
      }
      pulse.edge = next;
      pulse.t -= 1;
    }

    const edgeDecay = Math.exp(-dt * 2.8);
    const nodeDecay = Math.exp(-dt * 2.4);
    for (let e = 0; e < graph.edgeAct.length; e++) graph.edgeAct[e] *= edgeDecay;
    for (let i = 0; i < graph.act.length; i++) graph.act[i] *= nodeDecay;
    outputFlash *= nodeDecay;
    headFlash *= Math.exp(-dt * 3.2);
  };

  const isQuiet = () => {
    if (!graph || pulses.length || flights.length) return false;
    if (outputFlash > 0.02 || headFlash > 0.02) return false;
    for (let e = 0; e < graph.edgeAct.length; e++) if (graph.edgeAct[e] > 0.02) return false;
    for (let i = 0; i < graph.act.length; i++) if (graph.act[i] > 0.02) return false;
    return true;
  };

  const markPlot = () => {
    const g = geometry;
    if (!g) return;
    dirty.mark(g.plot.left - 28, g.plot.top - 28, g.plot.left + g.plot.width + 28, g.plot.top + g.plot.height + 28);
    dirty.mark(g.output.x - 28, g.output.y - 28, g.output.x + 28, g.output.y + 28);
  };

  const drawWires = (breath: number) => {
    if (!graph) return;
    const columns = graph.columnCount;
    const edgeCount = graph.edgeA.length;

    // Base wiring, one batched path.
    ctx.globalAlpha = isDark ? 0.13 : 0.17;
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let e = 0; e < edgeCount; e++) traceEdge(e);
    ctx.stroke();

    // Wires into finished columns stay lit; wires into the working column breathe.
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = isDark ? 1.15 : 1.3;
    for (const state of ['done', 'active'] as const) {
      ctx.globalAlpha = state === 'done' ? (isDark ? 0.3 : 0.36) : (isDark ? 0.16 : 0.2) + 0.16 * breath;
      ctx.beginPath();
      let count = 0;
      for (let e = 0; e < edgeCount; e++) {
        const column = Math.min(graph.col[graph.edgeB[e]], columns - 1);
        if (columnState(column) !== state) continue;
        traceEdge(e);
        count++;
      }
      if (count) ctx.stroke();
    }

    // Recently travelled wires flare.
    ctx.lineWidth = isDark ? 1.5 : 1.6;
    for (let e = 0; e < edgeCount; e++) {
      const act = graph.edgeAct[e];
      if (act < 0.04) continue;
      ctx.globalAlpha = act * (isDark ? 0.55 : 0.6);
      ctx.beginPath();
      traceEdge(e);
      ctx.stroke();
    }

    // The feed wire to the plan.
    const g = geometry;
    if (g?.feed) {
      edgeControls(FEED_EDGE);
      dirty.mark(
        Math.min(controls[0], controls[2], controls[4], controls[6]) - 16,
        Math.min(controls[1], controls[3], controls[5], controls[7]) - 16,
        Math.max(controls[0], controls[2], controls[4], controls[6]) + 16,
        Math.max(controls[1], controls[3], controls[5], controls[7]) + 16
      );
      const lit = signal.step >= 4 ? 0.5 : signal.feed;
      ctx.setLineDash([3, 5]);
      ctx.globalAlpha = (isDark ? 0.22 : 0.3) * (1 - lit);
      ctx.strokeStyle = colors.fg;
      ctx.lineWidth = 1;
      ctx.beginPath();
      traceEdge(FEED_EDGE);
      ctx.stroke();
      ctx.setLineDash([]);
      if (lit > 0.02) {
        ctx.globalAlpha = lit * (isDark ? 0.7 : 0.8);
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        traceEdge(FEED_EDGE);
        ctx.stroke();
      }
    }
  };

  const drawNodes = (breath: number) => {
    if (!graph || !geometry) return;
    const g = geometry;
    // The working column gets a soft light bar.
    const working = signal.step >= 0 && signal.step < 4 ? Math.floor(signal.step) : -1;
    if (working >= 0 && band && working < g.columns.length) {
      const w = 40;
      ctx.globalCompositeOperation = isDark ? 'lighter' : 'source-over';
      ctx.globalAlpha = (isDark ? 0.24 : 0.12) * (0.75 + 0.25 * breath);
      ctx.drawImage(band, g.columns[working] - w / 2, g.plot.top - 22, w, g.plot.height + 44);
      ctx.globalCompositeOperation = 'source-over';
    }

    for (let i = 0; i < nx.length; i++) {
      const column = graph.col[i];
      if (column < 0 || column >= graph.columnCount) continue;
      const state = columnState(column);
      const act = graph.act[i];
      if (state === 'done') {
        ctx.globalAlpha = isDark ? 0.3 : 0.4;
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(nx[i], ny[i], 6.5, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(nx[i], ny[i], 3.3, 0, TAU);
        ctx.fill();
      } else if (state === 'active') {
        ctx.globalAlpha = 0.5 + 0.5 * breath;
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(nx[i], ny[i], 4.6 + 1.6 * breath, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.fg;
        ctx.beginPath();
        ctx.arc(nx[i], ny[i], 2.6, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = isDark ? 0.8 : 0.9;
        ctx.strokeStyle = colors.muted;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(nx[i], ny[i], 2.8, 0, TAU);
        ctx.stroke();
      }
      if (act > 0.05) {
        if (dots && density.hasGlow) {
          const size = 12 + 22 * act;
          ctx.globalCompositeOperation = isDark ? 'lighter' : 'source-over';
          ctx.globalAlpha = act * (isDark ? 0.85 : 0.35);
          ctx.drawImage(dots[0], nx[i] - size / 2, ny[i] - size / 2, size, size);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = Math.min(1, act * 1.2);
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(nx[i], ny[i], 2.6, 0, TAU);
        ctx.fill();
      }
    }
  };

  const drawPulses = () => {
    if (!pulses.length) return;
    if (isDark) ctx.globalCompositeOperation = 'lighter';
    for (const hue of [0, 1] as const) {
      const color = hue === 0 ? colors.accent : colors.accent2;
      ctx.strokeStyle = color;
      ctx.lineWidth = isDark ? 1.8 : 2;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      for (const pulse of pulses) {
        if (pulse.hue !== hue) continue;
        for (let k = 0; k < TAIL.length; k++) {
          pointOn(pulse.edge, Math.max(0, pulse.t - TAIL[k]), xy);
          if (k === 0) ctx.moveTo(xy[0], xy[1]);
          else ctx.lineTo(xy[0], xy[1]);
        }
      }
      ctx.stroke();
      const sprite = density.hasGlow ? dots?.[hue] : undefined;
      ctx.fillStyle = color;
      for (const pulse of pulses) {
        if (pulse.hue !== hue) continue;
        pointOn(pulse.edge, pulse.t, xy);
        dirty.mark(xy[0] - 16, xy[1] - 16, xy[0] + 16, xy[1] + 16);
        if (sprite) {
          const size = isDark ? 24 : 16;
          ctx.globalAlpha = isDark ? 0.85 : 0.3;
          ctx.drawImage(sprite, xy[0] - size / 2, xy[1] - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], isDark ? 2 : 2.2, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  const drawFlights = () => {
    if (!flights.length || !geometry || !graph) return;
    ctx.font = glyphFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.accent;
    if (isDark) ctx.globalCompositeOperation = 'lighter';
    for (const f of flights) {
      // Letters still waiting their turn sit lit on top of the dimmed text, then peel off.
      const t = Math.max(0, (flightClock - f.delay) / f.duration);
      const e = Math.pow(t, 1.6);
      const s = 1 - e;
      const tx = nx[f.node];
      const ty = ny[f.node];
      const x = s * s * f.x0 + 2 * s * e * f.cx + e * e * tx;
      const y = s * s * f.y0 + 2 * s * e * f.cy + e * e * ty;
      const scale = 1 - 0.72 * e;
      ctx.globalAlpha = t < 0.75 ? 1 : 0.2 + 0.8 * (1 - (t - 0.75) / 0.25);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);
      ctx.fillText(f.ch, 0, 0);
      dirty.mark(x - 16, y - 16, x + 16, y + 16);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  };

  const drawTerminal = (x: number, y: number, flash: number) => {
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 5.5 + flash * 2.5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, TAU);
    ctx.fill();
    if (flash > 0.04) {
      ctx.globalAlpha = flash * 0.55;
      ctx.beginPath();
      ctx.arc(x, y, 9 + (1 - flash) * 18, 0, TAU);
      ctx.stroke();
    }
  };

  const draw = () => {
    const g = geometry;
    if (!g || !graph) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!dirty.isEmpty) ctx.clearRect(dirty.x0, dirty.y0, dirty.x1 - dirty.x0, dirty.y1 - dirty.y0);
    dirty.reset();
    markPlot();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    const breath = 0.5 + 0.5 * Math.sin(clock * 5.2);

    drawWires(breath);
    drawNodes(breath);
    drawPulses();
    drawTerminal(nx[graph.output], ny[graph.output], outputFlash);
    if (g.feed && (signal.feed > 0.05 || headFlash > 0.04)) {
      feedEnd(feedEndXY);
      ctx.globalAlpha = Math.max(signal.feed, headFlash) * 0.9;
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(feedEndXY[0], feedEndXY[1], 2.4 + headFlash * 1.6, 0, TAU);
      ctx.fill();
    }
    drawFlights();
    ctx.globalAlpha = 1;
  };

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    const isBusy = signal.intensity > 0.45 || flights.length > 0 || signal.feed > 0.05;
    const fps = isBusy ? density.maxFps : 30;
    const elapsed = now - lastTick;
    if (elapsed < 1000 / fps - 3) return;
    // Clamp: the first frame after a pause can be seconds late.
    const dt = Math.min(elapsed / 1000, 1 / 20);
    lastTick = now;
    clock += dt;
    placeNodes(clock);
    step(dt);
    draw();
    if (settledFor >= settleAfter() && isQuiet()) stopLoop();
  };

  const startLoop = () => {
    if (frame || isStill || !isActive || !graph) return;
    lastTick = performance.now();
    frame = requestAnimationFrame(loop);
  };

  function stopLoop() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  const engine: FlowEngine = {
    layout(next) {
      geometry = next;
      canvas.width = Math.max(1, Math.round(next.width * dpr));
      canvas.height = Math.max(1, Math.round(next.height * dpr));
      dirty.reset();
      pulses.length = 0;
      graph = buildGraph(next, density, mulberry32(seed));
      nx = new Float32Array(graph.bx.length);
      ny = new Float32Array(graph.bx.length);
      placeNodes(clock);
      draw();
    },
    setColors(next, dark) {
      colors = next;
      isDark = dark;
      dots = [makeDot(next.accent), makeDot(next.accent2)];
      band = makeBand(next.accent);
      draw();
    },
    launch(glyphs, font) {
      const layer = graph?.firstLayer;
      if (!geometry || !layer?.length) return;
      glyphFont = font;
      flightClock = 0;
      arrivals = 0;
      flights.length = 0;
      const count = glyphs.length;
      // Reading order maps onto the layer top to bottom, like tokens onto inputs.
      const targets = glyphs.map((_, i) => layer[Math.min(layer.length - 1, Math.floor((i / Math.max(1, count)) * layer.length))]);
      // The letters nearest their node go first, so none flies across one still waiting.
      const order = glyphs
        .map((glyph, i) => ({ i, d: Math.hypot(nx[targets[i]] - glyph.x, ny[targets[i]] - glyph.y) }))
        .sort((a, b) => a.d - b.d);
      order.forEach(({ i }, rank) => {
        const glyph = glyphs[i];
        const node = targets[i];
        const tx = nx[node];
        const ty = ny[node];
        // Beside the layer: lift, then swoop in. Above it: drop, then converge.
        const isBeside = tx > glyph.x + 24 && Math.abs(ty - glyph.y) < 120;
        flights.push({
          ch: glyph.ch,
          node,
          x0: glyph.x,
          y0: glyph.y,
          cx: isBeside ? glyph.x + (tx - glyph.x) * 0.55 : glyph.x + (tx - glyph.x) * 0.1,
          cy: isBeside ? glyph.y - 36 : glyph.y + (ty - glyph.y) * 0.8,
          delay: (rank / Math.max(1, count)) * GLYPH_SPREAD + rand() * 0.05,
          duration: GLYPH_DURATION * (0.85 + rand() * 0.3),
        });
      });
      engine.wake();
    },
    setActive(next) {
      isActive = next;
      if (next) startLoop();
      else stopLoop();
    },
    wake() {
      settledFor = 0;
      startLoop();
    },
    drawStill() {
      isStill = true;
      stopLoop();
      if (!graph) return;
      // A composed moment of the finished plan: a few comets mid-wire, one on the feed.
      const stillRand = mulberry32(seed + 7);
      pulses.length = 0;
      graph.edgeAct.fill(0);
      graph.act.fill(0);
      const count = Math.min(9, density.maxPulses, graph.edgeA.length);
      for (let i = 0; i < count; i++) {
        const edge = Math.floor(stillRand() * graph.edgeA.length);
        pulses.push({ edge, t: 0.35 + stillRand() * 0.5, speed: 0, hue: stillRand() < 0.66 ? 0 : 1 });
        graph.edgeAct[edge] = 0.6;
      }
      if (geometry?.feed) pulses.push({ edge: FEED_EDGE, t: 0.55, speed: 0, hue: 0 });
      placeNodes(0);
      draw();
      pulses.length = 0;
    },
    destroy() {
      stopLoop();
      pulses.length = 0;
      flights.length = 0;
      dots = null;
      band = null;
      graph = null;
      canvas.width = 1;
      canvas.height = 1;
    },
  };
  return engine;
}
