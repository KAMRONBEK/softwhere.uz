import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { cleanVisibleText } from '@/modules/estimator/ai-brief/cleanText';
import { stripUnsupportedClaims } from '@/modules/estimator/ai-brief/textGuards';

/**
 * Lenient-normalizer toolkit shared by the three output parsers (scope,
 * narrative, screens). Hand-rolled in the style of `utils/sanitize.ts`: zod
 * is only a transitive dependency here, not a declared one. Every repair is
 * recorded in an `issues` list — audit material, not errors.
 */

export type Raw = Record<string, unknown>;

/** What the parsers need to know about the request to clean model text. */
export interface TextContext {
  locale: BriefLocale;
  /** The scrubbed idea — percentages it contains are facts, not inventions. */
  idea: string;
  /** Words of names the scrubber replaced (server memory only): sample copy never shows them. */
  avoidNames?: string[];
}

export function asObject(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {};
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Collapse whitespace and cut to `max` characters, at a word boundary when possible. */
export function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\s]+$/, '')}…`;
}

/**
 * Prose cut to `max` characters at the end of its last whole sentence, so a
 * long answer loses a sentence instead of showing "…in English and…" (round 2
 * shipped two cut-off "build first" sentences). Falls back to `clip` when the
 * first sentence alone is too long.
 */
export function clipSentences(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max + 1);
  const ends = Array.from(head.matchAll(/[.!?…](?=\s)/g)).map(m => (m.index ?? 0) + 1);
  const end = ends.filter(i => i <= max).pop();
  return end && end >= max * 0.4 ? text.slice(0, end).trim() : clip(text, max);
}

export function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T, field: string, issues: string[]): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  if (value !== undefined) issues.push(`${field}: unknown value ${JSON.stringify(value)} → ${fallback}`);
  return fallback;
}

export function intIn(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : fallback;
}

/** A short visible string (title, label, note): clipped and cosmetically repaired. */
export function label(value: unknown, max: number, ctx: TextContext): string {
  return clip(cleanVisibleText(clip(value, max * 2), ctx.locale), max);
}

export function labelList(value: unknown, maxItems: number, maxChars: number, ctx: TextContext): string[] {
  return asList(value)
    .map(v => label(v, maxChars, ctx))
    .filter(Boolean)
    .slice(0, maxItems);
}

/**
 * Model prose: repaired, then every sentence stating a price, a duration or a
 * percentage the visitor did not give is removed (counted into `issues`).
 */
export function prose(value: unknown, max: number, field: string, issues: string[], ctx: TextContext): string {
  const cleaned = cleanVisibleText(
    typeof value === 'string'
      ? value
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, max * 3)
      : '',
    ctx.locale
  );
  const { text, removed } = stripUnsupportedClaims(cleaned, ctx.idea);
  if (removed) issues.push(`${field}: removed ${removed} sentence(s) stating a price, duration or invented percentage`);
  return clipSentences(text, max);
}

export function proseList(value: unknown, maxItems: number, maxChars: number, field: string, issues: string[], ctx: TextContext): string[] {
  return asList(value)
    .map((v, i) => prose(v, maxChars, `${field}[${i}]`, issues, ctx))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Pull the JSON object out of a model answer (strict mode returns bare JSON; fallbacks may wrap it). */
export function extractJson(text: string): Raw | null {
  const attempt = (s: string): Raw | null => {
    try {
      const value = JSON.parse(s);
      return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null;
    } catch {
      return null;
    }
  };
  const direct = attempt(text.trim());
  if (direct) return direct;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? attempt(text.slice(start, end + 1)) : null;
}
