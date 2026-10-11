import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { mapEstimateText, mapPhases, type AiBrief, type BriefPreview } from '@/modules/estimator/ai-brief/types';
import type { TextMapper } from '@/modules/estimator/ai-brief/polish';
import { mapScreensTexts } from '@/modules/estimator/ai-brief/polish';

/**
 * Uzbek letters oʻ and gʻ in the brief's visible text (uz pages only).
 *
 * The official Latin alphabet writes oʻ/gʻ with the turned comma U+02BB and
 * the tutuq belgisi (maʼlumot) with U+02BC. The pipeline itself works in the
 * plain "'" the prompts ask for (`normalizeUzApostrophes`; every Uzbek word
 * list and guard matches it), so this is the LAST step: the assembled brief,
 * the preview and the streamed wireframes are converted once, nothing after
 * reads them. The site's own copy (`messages/uz.json`, `messages/home/<section>/uz.json`)
 * is written with ʻ/ʼ directly (`tests/i18n/parity.ts` checks it).
 *
 * Deterministic and narrow: a mark between two Latin letters becomes ʻ after
 * o/O/g/G and ʼ after any other letter. Left alone: a mark at the start or end
 * of a word (quotes: 'Bazaviy'), an English possessive ("McDonald's",
 * "Domino's"), digits ("5'000"), and every token that looks like a URL, an
 * e-mail or a handle.
 */

export const UZ_OKINA = 'ʻ';
export const UZ_TUTUQ = 'ʼ';

const MARK = "['‘’ʻʼ`´]";
/** o/g + mark + a letter (not a possessive "'s" ending the word) → oʻ / gʻ. */
const OG_MARK = new RegExp(`(?<=[OoGg])${MARK}(?=\\p{Script=Latin})(?!s(?!\\p{L}))`, 'gu');
/** Any other Latin letter + mark + letter → tutuq belgisi ʼ. */
const TUTUQ_MARK = new RegExp(`(?<=\\p{Script=Latin})(?<![OoGg])${MARK}(?=\\p{Script=Latin})(?!s(?!\\p{L}))`, 'gu');
/** Tokens that are addresses, not words. */
const SKIP_TOKEN = /:\/\/|www\.|@|\.(?:uz|com|ru|org|net|io|app|me)(?![\p{L}])/iu;

function convertToken(token: string): string {
  if (SKIP_TOKEN.test(token)) return token;
  return token.replace(OG_MARK, UZ_OKINA).replace(TUTUQ_MARK, UZ_TUTUQ);
}

/** One Uzbek string with oʻ/gʻ (U+02BB) and the tutuq belgisi (U+02BC). */
export function toUzbekLetters(text: string): string {
  if (!text || !/['‘’ʻʼ`´]/u.test(text)) return text;
  return text
    .split(/(\s+)/u)
    .map(part => (/^\s+$/u.test(part) ? part : convertToken(part)))
    .join('');
}

/** Every visible string of the preview (what streams once the scope is priced). */
export const mapPreviewTexts = <T extends BriefPreview>(preview: T, f: (text: string) => string): T => ({
  ...preview,
  title: f(preview.title),
  summary: f(preview.summary),
  audience: preview.audience.map(a => ({ segment: f(a.segment), need: f(a.need) })),
  roles: preview.roles.map(f),
  features: preview.features.map(i => ({ ...i, note: f(i.note) })),
  integrations: preview.integrations.map(i => ({ ...i, note: f(i.note) })),
  estimate: mapPhases(mapEstimateText(preview.estimate, f), p => ({
    ...p,
    title: f(p.title),
    goal: f(p.goal),
    deliverables: p.deliverables.map(f),
  })),
  policy: { ...preview.policy, note: f(preview.policy.note) },
});

/** Every visible string of a finished brief. */
export const mapBriefTexts: TextMapper<AiBrief> = (brief, f) => {
  const n = brief.narrative;
  return {
    ...mapPreviewTexts(brief, f),
    screens: mapScreensTexts(brief.screens, f),
    narrative: {
      buildFirst: { what: f(n.buildFirst.what), why: f(n.buildFirst.why) },
      canWait: n.canWait.map(c => ({ ...c, item: f(c.item), reason: f(c.reason) })),
      risks: n.risks.map(r => ({ title: f(r.title), detail: f(r.detail), mitigation: f(r.mitigation) })),
      questions: n.questions.map(f),
      assumptions: n.assumptions.map(f),
    },
  };
};

/** The value with Uzbek letters on uz pages; any other page's value unchanged. */
export function withUzbekLetters<T>(locale: BriefLocale, value: T, map: (value: T, f: (text: string) => string) => T): T {
  return locale === 'uz' ? map(value, toUzbekLetters) : value;
}
