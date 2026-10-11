import { CAPS } from '@/modules/estimator/ai-brief/constants';
import { asList, extractJson, label, type TextContext } from '@/modules/estimator/ai-brief/parse';
import { namesRegex, stripZeroAmounts } from '@/modules/estimator/ai-brief/screens';
import { inventedDetail } from '@/modules/estimator/ai-brief/specifics';
import { isClaimLike } from '@/modules/estimator/ai-brief/textGuards';
import type { Parsed } from '@/modules/estimator/ai-brief/types';

/**
 * Parser for the sample-content call: the items, prices and places both
 * wireframe halves reuse, so the two calls that draw them in parallel stop
 * contradicting each other. Sample copy follows the wireframe rules: no facts
 * about the client, no invented statistics, none of the names the scrubber
 * removed, no contact details, no invented branches, cities or brands
 * (`specifics.ts`).
 */

/** A phone number ("+998 90 123 45 67", "90-123-45-67") or an email — never a price ("1 250 000 so'm"). */
const CONTACT = /@|\+\d{3}|\(\d{2,3}\)\s?\d{3}|(?<!\d)\d{2,3}[\s-]\d{3}[\s-]\d{2}[\s-]\d{2}(?!\d)/u;

export function parseSamplesJson(text: string, ctx: TextContext): Parsed<string[]> | null {
  const raw = extractJson(text);
  if (!raw) return null;
  const issues: string[] = [];
  const names = namesRegex(ctx.avoidNames);
  const seen = new Set<string>();
  const samples: string[] = [];
  for (const entry of asList(raw.samples)) {
    const sample = stripZeroAmounts(label(entry, CAPS.label, ctx));
    if (!sample) continue;
    const invented = inventedDetail(sample, { locale: ctx.locale, idea: ctx.idea });
    if (isClaimLike(sample, ctx.idea) || CONTACT.test(sample) || names?.test(sample) || invented) {
      issues.push(`dropped sample "${sample}"`);
      continue;
    }
    const key = sample.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    samples.push(sample);
  }
  const value = samples.slice(0, CAPS.samples);
  const usable = value.length >= 2;
  if (!usable) issues.push(`unusable: ${value.length} sample(s)`);
  return { value, issues, usable };
}
