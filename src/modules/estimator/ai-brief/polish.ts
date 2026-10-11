import { cleanVisibleText } from '@/modules/estimator/ai-brief/cleanText';
import { POLISH_CHUNK_CHARS, POLISH_CHUNK_STRINGS } from '@/modules/estimator/ai-brief/constants';
import { asList, asObject, extractJson } from '@/modules/estimator/ai-brief/parse';
import type { BriefPlan, BriefRisks } from '@/modules/estimator/ai-brief/parseNarrative';
import { mentionsPriceOrDuration } from '@/modules/estimator/ai-brief/textGuards';
import type { BriefScope, Parsed, WireframeScreen } from '@/modules/estimator/ai-brief/types';

/**
 * Uzbek copy-edit of a brief's visible text (uz pages only).
 *
 * Every native audit of round 2 found errors no word list prevents — non-words
 * ("stolga zinagarmi", "Biz tomonlanma"), broken hybrids ("dvigatel
 * shumnari"), a word that flips the meaning ("sur'atlari" for photos). A
 * second model pass reads each part's strings and returns ONLY the ones that
 * need a fix, each rewritten whole; this module collects the strings, checks
 * every fix and applies it. A fix is refused when it changes a number, adds a
 * price or a duration, drops a brand or an IT term, writes Cyrillic, rewrites
 * far more than an edit would, only changes the case of the first letter, or
 * turns a question about "us" into one about "you" — so the pass can correct
 * language but never the scope, a price or a fact. The consistency guard
 * still runs on the edited text afterwards.
 *
 * Each part's strings go out in balanced chunks (`chunkTexts`), all in
 * parallel, each string with the glossary terms it contains as a "check"
 * (`uzGlossary.ts`): the reviewers' recurring errors that need context.
 */

/** Rewrites every visible string of a value through `f`, keeping its shape. */
export type TextMapper<T> = (value: T, f: (text: string) => string) => T;

export const mapScopeTexts: TextMapper<BriefScope> = (scope, f) => ({
  ...scope,
  title: f(scope.title),
  summary: f(scope.summary),
  audience: scope.audience.map(a => ({ segment: f(a.segment), need: f(a.need) })),
  assumptions: scope.assumptions.map(f),
  features: scope.features.map(i => ({ ...i, note: f(i.note) })),
  integrations: scope.integrations.map(i => ({ ...i, note: f(i.note) })),
  unpricedItems: scope.unpricedItems.map(f),
  extraDeliverables: scope.extraDeliverables.map(e => ({ ...e, reason: f(e.reason) })),
  policy: { ...scope.policy, note: f(scope.policy.note) },
});

export const mapPlanTexts: TextMapper<BriefPlan> = (plan, f) => ({
  buildFirst: { what: f(plan.buildFirst.what), why: f(plan.buildFirst.why) },
  canWait: plan.canWait.map(c => ({ ...c, item: f(c.item), reason: f(c.reason) })),
  phases: plan.phases.map(p => ({ ...p, title: f(p.title), goal: f(p.goal), deliverables: p.deliverables.map(f) })),
});

export const mapRisksTexts: TextMapper<BriefRisks> = (risks, f) => ({
  risks: risks.risks.map(r => ({ title: f(r.title), detail: f(r.detail), mitigation: f(r.mitigation) })),
  questions: risks.questions.map(f),
});

export const mapScreensTexts: TextMapper<WireframeScreen[]> = (screens, f) =>
  screens.map(screen => ({
    ...screen,
    name: f(screen.name),
    purpose: f(screen.purpose),
    blocks: screen.blocks.map(block => ({ ...block, label: f(block.label), items: block.items.map(f) })),
  }));

/** The distinct non-empty strings of a value, in reading order — what the copy editor numbers. */
export function collectTexts<T>(value: T, map: TextMapper<T>): string[] {
  const seen = new Set<string>();
  map(value, text => {
    const key = text.trim();
    if (key) seen.add(key);
    return text;
  });
  return Array.from(seen);
}

/**
 * The strings of one part split for parallel copy-edit calls: as few chunks as
 * the limits allow, balanced so no chunk is much longer than the others (the
 * slowest call sets the wall clock). Order is kept; a string longer than the
 * character limit is a chunk of its own.
 */
export function chunkTexts(
  texts: readonly string[],
  maxStrings: number = POLISH_CHUNK_STRINGS,
  maxChars: number = POLISH_CHUNK_CHARS
): string[][] {
  if (texts.length === 0) return [];
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  const count = Math.max(1, Math.ceil(texts.length / maxStrings), Math.ceil(totalChars / maxChars));
  const perChunk = Math.ceil(texts.length / count);
  const charsPerChunk = Math.min(maxChars, Math.ceil(totalChars / count));
  const chunks: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const text of texts) {
    if (current.length > 0 && (current.length >= perChunk || chars + text.length > charsPerChunk * 1.15)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += text.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Apply fixes keyed by the original string (every occurrence of it). */
export function applyFixes<T>(value: T, map: TextMapper<T>, fixes: ReadonlyMap<string, string>): T {
  if (fixes.size === 0) return value;
  return map(value, text => fixes.get(text.trim()) ?? text);
}

const digitsOf = (text: string) => (text.match(/\d+/g) ?? []).join(',');
const CYRILLIC = /\p{Script=Cyrillic}/u;
/**
 * Brands, abbreviations and CamelCase product names ("Payme", "API", "amoCRM",
 * "1C", "iOS") — the core of the word, without the suffix it carries
 * ("APIini" → "API", so fixing the suffix is allowed).
 */
const PROTECTED =
  /(?<![\p{L}\p{N}])(?:Payme|Click|Uzum|Paynet|Telegram|Instagram|WhatsApp|Google|Yandex|Excel|Eskiz|MyID|OneID|Stripe|PayPal|Kaspi|Android|App Store|Google Play|\p{Ll}*\p{Lu}[\p{Lu}\p{N}]+|\d\p{Lu})/gu;
/** Terms the copy editor may drop: "MVP" reads as jargon in an Uzbek sentence ("birinchi versiya"). */
const DROPPABLE: ReadonlySet<string> = new Set(['MVP']);

const protectedTerms = (text: string) => Array.from(text.matchAll(PROTECTED), m => m[0]).filter(t => t.length > 1 && !DROPPABLE.has(t));

/** "we" (SoftWhere) in Uzbek: biz, bizning…, and a verb or possessive in -miz (kiritamizmi, botimiz). */
const FIRST_PERSON = /(?<![\p{L}'])biz(?:ning|ga|ni|dan|da)?(?![\p{L}'])|\p{L}{2,}miz(?:mi)?(?![\p{L}'])/giu;
/** "you" (the reader): siz, sizning…, o'zingiz, and a verb or possessive in -siz / -ngiz (kiritasizmi, botingiz). */
const SECOND_PERSON = /(?<![\p{L}'])(?:siz(?:ning|ga|ni|dan|da)?|o'zingiz\p{L}*)(?![\p{L}'])|\p{L}{2,}(?:siz|ngiz)(?:mi)?(?![\p{L}'])/giu;
const countOf = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

/**
 * A question to the client whose edit swapped "we" and "you" ("…ularni biz
 * kiritamizmi?" → "…siz kiritasizmi?"): it now asks something else, and it
 * contradicted a plan that says we do it (round 3, the bakery brief).
 */
function flipsQuestionSubject(original: string, fixed: string): boolean {
  if (!original.includes('?')) return false;
  const we = Math.sign(countOf(fixed, FIRST_PERSON) - countOf(original, FIRST_PERSON));
  const you = Math.sign(countOf(fixed, SECOND_PERSON) - countOf(original, SECOND_PERSON));
  return we !== 0 && we === -you;
}

/** A first word spelled with a lower-case start and an inner capital is a brand's own spelling: amoCRM, iOS, iPhone. */
const startsWithCamelBrand = (text: string) => /^\p{Ll}[\p{L}\p{N}]*\p{Lu}/u.test(text);

/** The same string but for the case of its first letter ("Martdagi" → "martdagi"; "AmoCRM" → "amoCRM" is a brand fix). */
const onlyFirstLetterCase = (original: string, fixed: string) =>
  fixed.length === original.length &&
  fixed.slice(1) === original.slice(1) &&
  fixed[0].toLowerCase() === original[0].toLowerCase() &&
  !startsWithCamelBrand(fixed);

/**
 * A visible string or label starts with a capital: an edit that lowercases its
 * first letter while fixing something else keeps the capital (unless the
 * string now starts with a brand spelled that way, "amoCRM").
 */
export function keepLeadingCapital(original: string, fixed: string): string {
  const [first, edited] = [original.charAt(0), fixed.charAt(0)];
  const lowered = first !== first.toLowerCase() && edited === first.toLowerCase() && !startsWithCamelBrand(fixed);
  return lowered ? first + fixed.slice(1) : fixed;
}

/** Why a proposed fix is refused (null = accepted). */
export function refuseFix(original: string, fixed: string): string | null {
  if (!fixed || fixed === original) return 'unchanged';
  if (onlyFirstLetterCase(original, fixed)) return "only the first letter's case";
  if (digitsOf(fixed) !== digitsOf(original)) return 'changes a number';
  if (CYRILLIC.test(fixed)) return 'Cyrillic';
  if (mentionsPriceOrDuration(fixed) && !mentionsPriceOrDuration(original)) return 'adds a price or duration';
  if (Math.abs(fixed.length - original.length) > Math.max(30, original.length * 0.5)) return 'rewrites too much';
  // Case may change ("AmoCRM" → "amoCRM"); the term itself may not go.
  const missing = protectedTerms(original).filter(term => !fixed.toLowerCase().includes(term.toLowerCase()));
  if (missing.length) return `drops ${missing.join(', ')}`;
  if (flipsQuestionSubject(original, fixed)) return 'flips who a question is about';
  return null;
}

/** Apostrophe variants and spacing, for matching a span the model copied loosely. */
const loose = (text: string) => text.replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, ' ');

/** Replace the first occurrence of `find` in `text` (exactly, else ignoring apostrophe variants); null when absent. */
export function replaceSpan(text: string, find: string, replace: string): string | null {
  if (!find) return null;
  const at = text.indexOf(find);
  if (at >= 0) return text.slice(0, at) + replace + text.slice(at + find.length);
  const normalized = loose(text);
  const looseAt = normalized.indexOf(loose(find));
  if (looseAt < 0 || normalized.length !== text.length) return null;
  return text.slice(0, looseAt) + replace + text.slice(looseAt + loose(find).length);
}

/**
 * Copy-edit answer → fixes keyed by the original string: every span of a
 * string applied in order, then the whole result checked (`refuseFix`).
 * Usable whenever it is a JSON object ("no fixes" is a complete answer);
 * refused or unmatched fixes are listed in `issues`.
 */
export function parsePolishJson(text: string, texts: readonly string[]): Parsed<Map<string, string>> | null {
  const raw = extractJson(text);
  if (!raw) return null;
  const issues: string[] = [];
  const edited = new Map<number, string>();
  for (const entry of asList(raw.fixes)) {
    const fix = asObject(entry);
    const id = Number(fix.id);
    const original = Number.isInteger(id) ? texts[id - 1] : undefined;
    if (original === undefined || typeof fix.find !== 'string' || typeof fix.replace !== 'string') {
      issues.push(`fix ${JSON.stringify(fix.id)}: unknown string`);
      continue;
    }
    const next = replaceSpan(edited.get(id) ?? original, fix.find, fix.replace);
    if (next === null) {
      issues.push(`fix ${id}: "${fix.find}" not found in "${original}"`);
      continue;
    }
    edited.set(id, next);
  }
  const fixes = new Map<string, string>();
  for (const [id, value] of edited) {
    const original = texts[id - 1];
    const fixed = keepLeadingCapital(original, cleanVisibleText(value.replace(/\s+/g, ' ').trim(), 'uz'));
    const why = refuseFix(original, fixed);
    if (why === 'unchanged') continue;
    if (why) {
      issues.push(`refused "${original}" → "${fixed}" (${why})`);
      continue;
    }
    fixes.set(original, fixed);
  }
  return { value: fixes, issues, usable: true };
}
