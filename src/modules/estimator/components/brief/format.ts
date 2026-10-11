import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import type { BriefPrice } from '@/modules/estimator/ai-brief/types';

/**
 * Display helpers for the brief. `uz` formats through `ru-RU` for the same
 * reason the estimator does (Node and Chrome disagree on `uz-UZ` currency
 * output, which breaks hydration); Uzbek uses the same grouping.
 */
const INTL_LOCALES: Record<BriefLocale, string> = { en: 'en-US', ru: 'ru-RU', uz: 'ru-RU' };

export function usdFormatter(locale: BriefLocale): (value: number) => string {
  const nf = new Intl.NumberFormat(INTL_LOCALES[locale], { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  return value => nf.format(value);
}

/** Clock time ("21:15", "9:15 PM") in the page language — browser-only (it reads the visitor's time zone). */
export function timeFormatter(locale: BriefLocale): (epochMs: number) => string {
  const tf = new Intl.DateTimeFormat(INTL_LOCALES[locale], { hour: 'numeric', minute: '2-digit' });
  return epochMs => tf.format(epochMs);
}

/** Whether the next free brief opens later today or tomorrow, in the visitor's own calendar. */
export function nextFreeDay(nextFreeAt: number, now: number): 'today' | 'tomorrow' {
  return new Date(nextFreeAt).toDateString() === new Date(now).toDateString() ? 'today' : 'tomorrow';
}

export function priceRange(price: Pick<BriefPrice, 'min' | 'max'>, format: (value: number) => string): string {
  return `${format(price.min)} – ${format(price.max)}`;
}

export function isBriefLocale(value: string): value is BriefLocale {
  return value === 'en' || value === 'ru' || value === 'uz';
}

/** The idea as it goes into the contact form: whitespace tidied, capped so the prefilled message stays readable. */
const PREFILL_IDEA_CHARS = 1_200;

export function prefillIdea(idea: string): string {
  const tidy = idea
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return tidy.length > PREFILL_IDEA_CHARS ? `${tidy.slice(0, PREFILL_IDEA_CHARS).trimEnd()}…` : tidy;
}

/** Stable small hash for deterministic sketch details (chart bar heights, highlighted days). */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
