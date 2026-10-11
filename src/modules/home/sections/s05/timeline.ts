/**
 * Scroll progress (0..1) → what is typed and what the preview shows.
 *
 * The story is a list of beats: `type` beats type one JSX block fast, `pause`
 * beats hold the caret while the preview performs (the click, the theme flip
 * at the midpoint, the bars, the ship). The file opens with its imports and
 * state already written, so the first frame is never an empty editor.
 * Everything here is pure, so the engine stays a thin DOM writer.
 */

export type PauseId = 'press' | 'flip' | 'bars' | 'ship' | 'rest';

type BeatDef = { kind: 'type'; through: string; weight: number } | { kind: 'pause'; id: PauseId; weight: number };

/** The file already holds everything before this line when the section opens. */
const PREFILLED_BEFORE = '  return (';

const BEATS: readonly BeatDef[] = [
  { kind: 'type', through: '<main', weight: 0.06 },
  { kind: 'type', through: '/>', weight: 0.1 },
  { kind: 'type', through: '</Button>', weight: 0.075 },
  { kind: 'pause', id: 'press', weight: 0.09 },
  { kind: 'type', through: '</Toggle>', weight: 0.06 },
  { kind: 'pause', id: 'flip', weight: 0.13 },
  { kind: 'type', through: '/>', weight: 0.075 },
  { kind: 'pause', id: 'bars', weight: 0.05 },
  { kind: 'type', through: '__END__', weight: 0.04 },
  { kind: 'pause', id: 'ship', weight: 0.2 },
  { kind: 'pause', id: 'rest', weight: 0.12 },
];

export interface CodeModel {
  lines: readonly string[];
  /** Leading spaces per line: the editor auto-indents, so they are never "typed". */
  indent: readonly number[];
  /** Typed-index of each line's first typed character. */
  base: readonly number[];
  /** Total typed characters (newlines count as one). */
  total: number;
  /** Characters already in the file at progress 0. */
  prefilled: number;
  /** First line typed during the story (rows from here get the diff marker). */
  firstTypedLine: number;
  maxCols: number;
  beats: readonly Beat[];
  /** Progress at which the last character lands. */
  typedAt: number;
}

interface Beat {
  kind: 'type' | 'pause';
  id?: PauseId;
  /** Progress range. */
  p0: number;
  p1: number;
  /** Typed-index range (constant for pauses). */
  n0: number;
  n1: number;
}

function findLine(lines: readonly string[], needle: string, from = 0): number {
  if (needle === '__END__') return lines.length - 1;
  for (let i = from; i < lines.length; i++) if (lines[i].includes(needle)) return i;
  throw new Error(`code-to-ui: no line contains "${needle}"`);
}

export function buildModel(lines: readonly string[]): CodeModel {
  const indent = lines.map(line => line.length - line.trimStart().length);
  const base: number[] = [];
  let cursor = 0;
  lines.forEach((line, i) => {
    base.push(cursor);
    cursor += line.length - indent[i] + 1;
  });
  const total = cursor - 1;
  const lineEnd = (i: number) => base[i] + lines[i].length - indent[i];
  const firstTypedLine = findLine(lines, PREFILLED_BEFORE);
  const prefilled = base[firstTypedLine];

  const weightSum = BEATS.reduce((sum, beat) => sum + beat.weight, 0);
  const beats: Beat[] = [];
  let p = 0;
  let n = prefilled;
  let searchFrom = firstTypedLine;
  let typedAt = 1;
  for (const def of BEATS) {
    const p1 = p + def.weight / weightSum;
    if (def.kind === 'type') {
      const line = findLine(lines, def.through, searchFrom);
      searchFrom = line + 1;
      const n1 = lineEnd(line);
      beats.push({ kind: 'type', p0: p, p1, n0: n, n1 });
      n = n1;
      if (n1 >= total) typedAt = p1;
    } else {
      beats.push({ kind: 'pause', id: def.id, p0: p, p1, n0: n, n1: n });
    }
    p = p1;
  }

  return {
    lines,
    indent,
    base,
    total,
    prefilled,
    firstTypedLine,
    maxCols: Math.max(...lines.map(line => line.length)),
    beats,
    typedAt,
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface Frame {
  /** Characters typed. */
  n: number;
  line: number;
  col: number;
  /** Sub-progress of each pause beat (0 before it, 1 after it). */
  pause: Record<PauseId, number>;
}

/** Typing inside a beat eases out a little: each block lands with a flourish. */
const typeEase = (t: number) => 1 - (1 - t) * (1 - t) * 0.6 - (1 - t) * 0.4;

export function frameAt(model: CodeModel, progress: number): Frame {
  const p = clamp01(progress);
  let n = model.prefilled;
  const pause: Record<PauseId, number> = { press: 0, flip: 0, bars: 0, ship: 0, rest: 0 };
  for (const beat of model.beats) {
    const t = clamp01((p - beat.p0) / (beat.p1 - beat.p0));
    if (beat.kind === 'pause' && beat.id) pause[beat.id] = t;
    if (p >= beat.p0) n = Math.floor(beat.n0 + (beat.n1 - beat.n0) * typeEase(t));
  }
  const { line, col } = caretAt(model, n);
  return { n, line, col, pause };
}

/** The finished file with nothing performed: the still frame for reduced motion. */
export function staticFrame(model: CodeModel): Frame {
  const { line, col } = caretAt(model, model.total);
  return { n: model.total, line, col, pause: { press: 0, flip: 0, bars: 1, ship: 0, rest: 0 } };
}

export function caretAt(model: CodeModel, n: number): { line: number; col: number } {
  let line = 0;
  while (line + 1 < model.base.length && model.base[line + 1] <= n) line++;
  const typed = Math.min(n - model.base[line], model.lines[line].length - model.indent[line]);
  return { line, col: model.indent[line] + typed };
}

/** Typed-index range of `needle` on the first line (from `fromLine`) that contains it. */
export function anchorRange(model: CodeModel, needle: string, fromLine = 0): [number, number] {
  const line = findLine(model.lines, needle, fromLine);
  const start = model.base[line] + model.lines[line].indexOf(needle) - model.indent[line];
  return [start, start + needle.length];
}

export function rangeProgress(n: number, [a, b]: readonly [number, number]): number {
  return clamp01((n - a) / Math.max(1, b - a));
}

/** Sub-range of a 0..1 progress, eased in and out. */
export function phase(t: number, from: number, to: number): number {
  const x = clamp01((t - from) / (to - from));
  return x * x * (3 - 2 * x);
}

export { clamp01 };
