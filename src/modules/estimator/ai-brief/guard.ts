import { CAPS, type BriefLocale } from '@/modules/estimator/ai-brief/constants';
import {
  claimedLanguages,
  createConsistencyGuard,
  framingLeaks,
  type ConsistencyGuard,
  type ViewSource,
} from '@/modules/estimator/ai-brief/consistency';
import type { PricedScope } from '@/modules/estimator/ai-brief/digest';
import { mapPhases, type AiBrief, type BriefScope, type WireframeBlock, type WireframeScreen } from '@/modules/estimator/ai-brief/types';

/**
 * Consistency guard on the request path: drops visible copy that contradicts
 * the priced scope before a brief ships. The prompts ask for consistency; this
 * makes it hold when a model slips anyway. It runs the same deterministic
 * checks the eval scores (`consistency.ts`) and removes, never rewrites:
 *
 *  - summary sentences and audience lines that present an unpriced need as
 *    part of the product ("It syncs with SharePoint" — not priced);
 *  - assumptions that contradict the scope ("QuickBooks sync built against its
 *    API" — not priced; "one interface language" — two priced);
 *  - MVP wireframe copy that shows unpriced or later work ("We will text you",
 *    an extracted-terms table with nothing priced to extract them), and MVP
 *    narrative sentences or deliverables that promise it;
 *  - sentences where prompt framing leaked ("the visitor asked for…");
 *  - statements that the interface ships in another number of languages than
 *    priced ("…o'zbek, rus va ingliz tillarida" next to the Uzbek + Russian a
 *    uz/ru page prices), a wireframe language switch with more languages than
 *    priced, and — only where ONE language is priced (English pages) — a
 *    second-language switch or field and a risk built on translation. With
 *    two languages priced, "Uzbek + Russian" copy, its switch and its
 *    translation risks agree with the scope and stay.
 *
 * A field is never emptied by the guard: when every sentence of a required
 * text fails, the text is kept and the finding is only recorded. Every removal
 * is listed in `removed` (eval/audit material; the route never returns it).
 */

export interface Guarded<T> {
  value: T;
  removed: string[];
}

const SENTENCE_SPLIT = /(?<=[.!?…])\s+/u;

const hasFraming = (text: string) => framingLeaks(text).some(f => f.severity === 'error');

/**
 * Drop the sentences `fails` flags. Keeps the original text when nothing would
 * be left, so a required field is never emptied by the guard.
 */
function dropSentences(text: string, fails: (sentence: string) => string | null, where: string, removed: string[]): string {
  if (!text) return text;
  const sentences = text.split(SENTENCE_SPLIT);
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const sentence of sentences) {
    const why = fails(sentence);
    if (why) dropped.push(`${where}: "${sentence}" (${why})`);
    else kept.push(sentence);
  }
  if (dropped.length === 0) return text;
  if (kept.length === 0) {
    removed.push(...dropped.map(d => `kept (nothing else left) — ${d}`));
    return text;
  }
  removed.push(...dropped.map(d => `dropped ${d}`));
  return kept.join(' ');
}

const firstSubject = (violations: { subject: string }[]) => (violations.length ? `contradicts: ${violations[0].subject}` : null);
const framingReason = (sentence: string) => (hasFraming(sentence) ? 'framing leak' : null);

/**
 * A statement (never a question — "Do you need a Russian version?" is a good
 * call question) that the interface ships in another number of languages than
 * the engine priced.
 */
export function languageReason(sentence: string, languages: number): string | null {
  if (/\?\s*$/u.test(sentence.trim()) || !LANGUAGE_CONTEXT.test(sentence)) return null;
  const claimed = claimedLanguages(sentence);
  return claimed !== null && claimed !== languages ? `claims ${claimed} interface language(s); ${languages} priced` : null;
}

/** Words that make a language name a language ("на русском", "o'zbek tilida") — not "a Chinese manufacturer". */
const LANGUAGE_CONTEXT =
  /til(?:da|lar|lari|larida|ida|i|ini|li)?(?!\p{L})|tillarida|язык\p{L}*|languages?|bilingual|двуязычн|ikki tilli|(?:на|и)\s+(?:русском|узбекском|английском|казахском)|in (?:english|russian|uzbek)|o['‘’ʻ`]?zbekcha|ruscha|inglizcha/iu;

/** Translation work — a risk about it only exists when more than one language is priced. */
const TRANSLATION = /tarjima|перевод|translat/iu;

/* ------------------------------------------------------------------ */
/* Scope stage (before the preview streams)                            */
/* ------------------------------------------------------------------ */

/** Summary, audience, assumptions and extra-product reasons, against the priced scope. */
export function guardScopeText(scope: BriefScope, source: ViewSource, priced: PricedScope): Guarded<BriefScope> {
  const guard = createConsistencyGuard(source, priced);
  const removed: string[] = [];
  const summaryCheck = (sentence: string) =>
    framingReason(sentence) ?? languageReason(sentence, source.languages) ?? firstSubject(guard.summary(sentence));

  const summary = dropSentences(scope.summary, summaryCheck, 'summary', removed);

  const audience = scope.audience.filter((a, i) => {
    const why = summaryCheck(`${a.segment}: ${a.need}`);
    if (why) removed.push(`dropped audience[${i}]: "${a.segment}: ${a.need}" (${why})`);
    return !why;
  });

  const assumptions = scope.assumptions.filter((a, i) => {
    const why = framingReason(a) ?? firstSubject(guard.assumption(a));
    if (why) removed.push(`dropped assumptions[${i}]: "${a}" (${why})`);
    return !why;
  });

  const extraDeliverables = scope.extraDeliverables.map((e, i) => ({
    ...e,
    reason: dropSentences(e.reason, framingReason, `extras[${i}].reason`, removed),
  }));

  return {
    value: { ...scope, summary, audience: audience.length ? audience : scope.audience, assumptions, extraDeliverables },
    removed,
  };
}

/* ------------------------------------------------------------------ */
/* Assembled brief                                                     */
/* ------------------------------------------------------------------ */

/**
 * A language switch or a second-language field on a wireframe ("Til: O'zbek /
 * Русский", "Nomi rus tilida", "Название на узбекском") — drawn for an
 * interface language the engine did not price when only ONE is priced (an
 * English page). A uz/ru page prices Uzbek + Russian, so there it is kept.
 */
const SECOND_LANGUAGE_UI =
  /(?<!\p{L})(?:o['‘’ʻ`]?zbek|узбек|uz)\p{L}*\s*[/|·]\s*(?:рус|rus|ru)|(?<!\p{L})(?:рус|rus|ru)\p{L}*\s*[/|·]\s*(?:o['‘’ʻ`]?zbek|узбек|uz)|(?<!\p{L})(?:rus tilida|ruscha|на узбекском|на русском|по-узбекски|по-русски|o['‘’ʻ`]?zbekcha)(?!\p{L})/iu;

/** One interface language as a switch names it — the whole token: a name in the page languages, its own name or a code. */
const SWITCH_LANGUAGES: readonly (readonly [string, RegExp])[] = [
  ['uz', /^(?:o['‘’ʻ`]?zbek(?:cha|\s+tili)?|uzbek|узбекский|ўзбекча|uz|уз)$/iu],
  ['ru', /^(?:rus(?:cha|\s+tili)?|русский|russian|ru|ру|рус)$/iu],
  ['en', /^(?:ingliz(?:cha|\s+tili)?|english|английский|en|eng)$/iu],
  ['kk', /^(?:qozoq(?:cha|\s+tili)?|kazakh|казахский|қазақша|kz|kk)$/iu],
  ['ky', /^(?:qirg['‘’ʻ`]?iz(?:cha|\s+tili)?|kyrgyz|кыргызский|кыргызча|ky)$/iu],
  ['tg', /^(?:tojik(?:cha|\s+tili)?|tajik|таджикский|tg)$/iu],
  ['tr', /^(?:turk(?:cha|\s+tili)|turkish|türkçe|турецкий|tr)$/iu],
  ['ar', /^(?:arab(?:cha|\s+tili)|arabic|العربية|арабский|ar)$/iu],
  ['zh', /^(?:xitoy(?:cha|\s+tili)?|chinese|中文|китайский|zh|cn)$/iu],
];
const FLAG_OR_MARK = /[\u{1F1E6}-\u{1F1FF}\p{Extended_Pictographic}()[\]]/gu;
/** A label that makes a list of languages a language switch ("Til", "Tilni tanlang", "Язык версии", "Language"). */
const SWITCH_LABEL = /(?<!\p{L})(?:til|tilni|tili|язык\p{L}*|languages?|lang)(?!\p{L})/iu;
const SCRIPTS = [/\p{Script=Latin}/u, /\p{Script=Cyrillic}/u, /\p{Script=Arabic}/u, /\p{Script=Han}/u];

/** The interface language a single token names ("Русский", "EN", "🇺🇿 O'zbekcha"), or null. */
export function switchLanguage(token: string): string | null {
  const word = token.replace(FLAG_OR_MARK, '').trim();
  return SWITCH_LANGUAGES.find(([, re]) => re.test(word))?.[0] ?? null;
}

/**
 * Languages a list of names offers when it is a language switch: every token
 * is a language AND it reads as a switch — under a language label, codes only
 * ("UZ | RU | EN"), or names in two scripts ("O'zbek / Русский / English").
 * A course list in the page's script ("Ingliz tili / Arab tili") is not one.
 * Empty when the tokens are not a switch.
 */
function offeredLanguages(tokens: readonly string[], labelled: boolean): string[] {
  const words = tokens.map(t => t.replace(FLAG_OR_MARK, '').trim()).filter(Boolean);
  if (words.length < 2) return [];
  const ids = words.map(switchLanguage);
  if (ids.some(id => id === null)) return [];
  const codes = words.every(w => /^\p{Lu}{2,3}$/u.test(w));
  const scripts = SCRIPTS.filter(re => words.some(w => re.test(w))).length;
  return labelled || codes || scripts > 1 ? [...new Set(ids as string[])] : [];
}

/** The languages a switch drawn as one string offers ("Til: O'zbek / Русский / English"); empty when it is not one. */
export function switchLanguages(text: string): string[] {
  const prefix = text.match(/^([^:]{1,40}):\s*/u);
  const parts = text.slice(prefix ? prefix[0].length : 0).split(/\s*[/|·,]\s*/u);
  return offeredLanguages(parts, !!prefix && SWITCH_LABEL.test(prefix[1]));
}

/** Uzbek and Russian first on uz/ru pages (the pair they price), the page language on English pages. */
const PAGE_LANGUAGES: Record<BriefLocale, readonly string[]> = { uz: ['uz', 'ru'], ru: ['ru', 'uz'], en: ['en'] };

/**
 * A block whose items are a language switch (tabs "Русский", "O'zbek",
 * "English" under "Язык версии") offering more languages than are priced: the
 * items to drop. The page's own languages are kept first, then the others in
 * the order drawn.
 */
function unpricedLanguageItems(block: WireframeBlock, languages: number, locale: BriefLocale): Set<string> {
  const offered = offeredLanguages(block.items, SWITCH_LABEL.test(block.label));
  if (offered.length <= languages) return new Set();
  const page = PAGE_LANGUAGES[locale];
  const keep = new Set([...page.filter(id => offered.includes(id)), ...offered.filter(id => !page.includes(id))].slice(0, languages));
  return new Set(block.items.filter(item => !keep.has(switchLanguage(item) ?? '')));
}

/** Wireframe copy offering an interface language that is not priced. */
function unpricedLanguageUi(text: string, languages: number): boolean {
  return switchLanguages(text).length > languages || (languages === 1 && SECOND_LANGUAGE_UI.test(text));
}

function guardBlock(
  block: WireframeBlock,
  at: string,
  context: string,
  guard: ConsistencyGuard,
  removed: string[],
  languages: number,
  locale: BriefLocale
): WireframeBlock | null {
  const unpricedItems = unpricedLanguageItems(block, languages, locale);
  const isUnpricedLanguage = (text: string) => unpricedItems.has(text) || unpricedLanguageUi(text, languages);
  const fails = (text: string) => !!text && (isUnpricedLanguage(text) || guard.mvpText(text, 'screen', context).length > 0);
  const label = fails(block.label) ? '' : block.label;
  const items = block.items.filter(item => !fails(item));
  const gone = [...(label !== block.label ? [block.label] : []), ...block.items.filter(item => !items.includes(item))];
  if (gone.length === 0) return block;
  const why = gone.every(isUnpricedLanguage) ? 'interface language not priced' : 'not priced in the MVP';
  removed.push(`dropped ${at} › ${block.kind}: ${gone.map(g => `"${g}"`).join(', ')} (${why})`);
  if (!label && items.length === 0) return null;
  return { ...block, label, items };
}

function guardScreens(
  screens: WireframeScreen[],
  guard: ConsistencyGuard,
  removed: string[],
  languages: number,
  locale: BriefLocale
): WireframeScreen[] {
  return screens.flatMap(screen => {
    if (screen.phase !== 'mvp') return [screen];
    const at = `screen "${screen.name}"`;
    if (guard.mvpText(screen.name, 'screen').length) {
      removed.push(`dropped ${at} (its subject is not priced in the MVP)`);
      return [];
    }
    const blocks = screen.blocks
      .map(block => guardBlock(block, at, screen.name, guard, removed, languages, locale))
      .filter((b): b is WireframeBlock => !!b);
    if (blocks.length < CAPS.blocksMin) {
      removed.push(`dropped ${at} (${blocks.length} block(s) left after the guard)`);
      return [];
    }
    const purpose = screen.purpose && guard.mvpText(screen.purpose, 'screen', screen.name).length ? '' : screen.purpose;
    if (purpose !== screen.purpose) removed.push(`dropped ${at}.purpose: "${screen.purpose}"`);
    return [{ ...screen, purpose, blocks }];
  });
}

const AP = "['‘’ʻ`]";
/**
 * Words put in the reader's mouth, as removable clauses: "…, as you said
 * yourself." / "As you confirmed, …" / "Siz o'zingiz aytdingiz: …" / "…, как
 * вы сами сказали." The rest of the sentence usually stands on its own.
 * Leading clauses go first so "; as you confirmed, they…" keeps its "; ".
 */
const ATTRIBUTION_CLAUSES: RegExp[] = [
  /(?<=^|[.!?;:]\s)as you(?:['’]ve| have)? (?:already )?(?:said|told us|confirmed|agreed|mentioned)(?: (?:it |so )?yourself)?,\s*/giu,
  /(?<=^|[.!?;:]\s)как вы (?:уже |сами )?(?:сказали|подтвердили|написали|указали),\s*/giu,
  /,?\s*(?:just\s+)?as you(?:['’]ve| have)? (?:already )?(?:said|told us|confirmed|agreed|mentioned)(?: (?:it |so )?yourself)?(?=\s*[.,;!?]|\s*$)/giu,
  new RegExp(`(?:siz\\s+)?o${AP}?zingiz\\s+(?:aytdingiz|aytgansiz|yozdingiz|tasdiqladingiz)\\s*[:,—-]?\\s*`, 'giu'),
  new RegExp(`,?\\s*o${AP}?zingiz\\s+aytganingizdek,?`, 'giu'),
  /,?\s*как вы (?:уже |сами )?(?:сказали|подтвердили|написали|указали)(?=\s*[.,;!?]|\s*$)/giu,
];

/** Remove attribution clauses; the first letter of what follows a removed lead is capitalized. */
export function stripAttributions(text: string): string {
  if (!text) return text;
  let out = text;
  for (const re of ATTRIBUTION_CLAUSES) out = out.replace(re, '');
  if (out === text) return text;
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_m, lead: string, ch: string) => `${lead}${ch.toUpperCase()}`)
    .trim();
}

/**
 * Text the reader sees in the narrative: attribution clauses stripped, then
 * any sentence that still leaks framing dropped (kept only when nothing would
 * be left — callers that can drop the whole item check `hasFraming` after).
 */
function deframe(text: string, where: string, removed: string[]): string {
  const stripped = stripAttributions(text);
  if (stripped !== text) removed.push(`rewrote ${where}: "${text}" → "${stripped}" (words put in the reader's mouth)`);
  return dropSentences(stripped, framingReason, where, removed);
}

/** "First version: A; B; C." in the page language — the lead the guard falls back to. */
const FIRST_VERSION: Record<BriefLocale, string> = { en: 'First version', ru: 'Первая версия', uz: 'Birinchi versiya' };

export function firstVersionLine(deliverables: string[], locale: BriefLocale): string {
  const items = deliverables.map(d => d.trim().replace(/[.;]+$/u, '')).filter(Boolean);
  return items.length ? `${FIRST_VERSION[locale]}: ${items.join('; ')}.` : '';
}

/** Why build that first, when the model's only reason put words in the reader's mouth. */
const WHY_FALLBACK: Record<BriefLocale, string> = {
  en: 'It is the smallest version that puts the idea in front of real users before anything else is built.',
  ru: 'Это минимальная версия, которая проверит идею на реальных пользователях до остальной разработки.',
  uz: "Bu g'oyani boshqa ishlardan oldin haqiqiy foydalanuvchilarda sinab ko'rish uchun eng kichik versiya.",
};

function fallbackWhy(text: string, locale: BriefLocale, removed: string[]): string {
  removed.push(`replaced buildFirst.why: "${text}" (framing leak, nothing else left)`);
  return WHY_FALLBACK[locale];
}

/**
 * "What we build first" is the brief's headline. When its LEAD sentence fails
 * the guard (or every sentence does), dropping it leaves a non-sequitur ("The
 * interface ships in English, Russian and Uzbek." — round-2 must-not-ship), so
 * the whole text is rebuilt from the guarded MVP deliverables instead. A
 * failing later sentence is simply dropped.
 */
function guardLead(
  text: string,
  fails: (sentence: string) => string | null,
  where: string,
  removed: string[],
  rebuild: () => string
): string {
  if (!text) return text;
  const sentences = text.split(SENTENCE_SPLIT);
  const leadFails = fails(sentences[0]);
  const allFail = sentences.every(sentence => !!fails(sentence));
  if (!leadFails && !allFail) return dropSentences(text, fails, where, removed);
  const rebuilt = rebuild();
  if (!rebuilt) return dropSentences(text, fails, where, removed);
  removed.push(`rebuilt ${where} from the MVP deliverables (lead sentence "${sentences[0]}": ${leadFails ?? 'every sentence fails'})`);
  return rebuilt;
}

/**
 * MVP wireframes, MVP narrative and framing, on the assembled brief. The
 * summary, audience and assumptions were already guarded at the scope stage.
 */
export function guardBriefText(brief: AiBrief, priced: PricedScope, source: ViewSource): Guarded<AiBrief> {
  const guard = createConsistencyGuard(source, priced);
  const removed: string[] = [];
  const languageCheck = (sentence: string) => languageReason(sentence, source.languages);
  const mvpCheck = (sentence: string) =>
    framingReason(sentence) ?? languageCheck(sentence) ?? firstSubject(guard.mvpText(sentence, 'narrative'));

  let mvpDeliverables: string[] = [];
  const estimate = mapPhases(brief.estimate, p => {
    const goal =
      p.id === 'mvp'
        ? dropSentences(p.goal, mvpCheck, 'phases.mvp.goal', removed)
        : dropSentences(deframe(p.goal, `phases.${p.id}.goal`, removed), languageCheck, `phases.${p.id}.goal`, removed);
    if (p.id !== 'mvp') {
      const deliverables = p.deliverables.filter((d, i) => {
        const why = languageCheck(d);
        if (why) removed.push(`dropped phases.${p.id}.deliverables[${i}]: "${d}" (${why})`);
        return !why;
      });
      return { ...p, goal, deliverables: deliverables.length ? deliverables : p.deliverables };
    }
    const deliverables = p.deliverables.filter((d, i) => {
      const why = mvpCheck(d);
      if (why) removed.push(`dropped phases.mvp.deliverables[${i}]: "${d}" (${why})`);
      return !why;
    });
    mvpDeliverables = deliverables;
    return { ...p, goal, deliverables: deliverables.length ? deliverables : p.deliverables };
  });

  const n = brief.narrative;
  const deframedWhy = deframe(n.buildFirst.why, 'buildFirst.why', removed);
  const buildFirst = {
    what: guardLead(n.buildFirst.what, mvpCheck, 'buildFirst.what', removed, () => firstVersionLine(mvpDeliverables, brief.locale)),
    why: hasFraming(deframedWhy) ? fallbackWhy(deframedWhy, brief.locale, removed) : deframedWhy,
  };
  // An item whose only reason is a statement the reader never made goes (round 2: "Siz o'zingiz aytdingiz…").
  const canWait = n.canWait
    .map((c, i) => ({
      ...c,
      reason: dropSentences(deframe(c.reason, `canWait[${i}].reason`, removed), languageCheck, `canWait[${i}].reason`, removed),
    }))
    .filter((c, i) => {
      if (!hasFraming(c.reason)) return true;
      removed.push(`dropped canWait[${i}]: "${c.item}" (its reason is a framing leak)`);
      return false;
    });
  // One priced language (English pages — uz/ru always price two, so their translation risks stay): a risk about
  // translating the interface was written against an assumption the engine did not price.
  const isTranslationRisk = (r: { title: string; detail: string }) =>
    source.languages === 1 && (TRANSLATION.test(`${r.title} ${r.detail}`) || !!languageCheck(r.detail));
  let risksLeft = n.risks.length;
  const risks = n.risks
    .map((r, i) => ({
      ...r,
      detail: dropSentences(deframe(r.detail, `risks[${i}].detail`, removed), languageCheck, `risks[${i}].detail`, removed),
      mitigation: dropSentences(deframe(r.mitigation, `risks[${i}].mitigation`, removed), languageCheck, `risks[${i}].mitigation`, removed),
    }))
    .filter((r, i) => {
      const why = hasFraming(`${r.detail} ${r.mitigation}`)
        ? 'framing leak'
        : isTranslationRisk(n.risks[i])
          ? 'translation risk, one language priced'
          : null;
      // A framing leak goes while another risk is left (as before); a translation risk never takes the brief below two.
      if (!why || risksLeft <= (why === 'framing leak' ? 1 : 2)) return true;
      risksLeft--;
      removed.push(`dropped risks[${i}]: "${r.title}" (${why})`);
      return false;
    });
  const questions = n.questions
    .map((q, i) => dropSentences(q, languageCheck, `questions[${i}]`, removed))
    .filter((q, i) => {
      const leak = hasFraming(q) && n.questions.length > CAPS.questionsMin;
      if (leak) removed.push(`dropped questions[${i}]: "${q}" (framing leak)`);
      return !leak;
    });

  return {
    value: {
      ...brief,
      screens: guardScreens(brief.screens, guard, removed, source.languages, brief.locale),
      estimate,
      narrative: { ...n, buildFirst, canWait, risks, questions },
    },
    removed,
  };
}
