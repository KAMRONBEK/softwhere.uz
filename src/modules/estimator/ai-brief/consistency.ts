import { FEATURES, INTEGRATIONS } from '@/modules/estimator/data/catalog';
import type { ProjectType } from '@/modules/estimator/types';
import {
  BLOCK_CONCEPTS,
  BRAND_TOKENS,
  CASH_ONLY,
  CONCEPTS,
  DEFERRAL,
  EXTERNAL,
  INTEGRATION_WORDS,
  INVISIBLE_REFS,
  NEGATION,
  NON_SOFTWARE,
  SCREEN_DEFERRAL,
  STOPWORDS,
  type Concept,
} from '@/modules/estimator/ai-brief/consistencyLexicon';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import type { PricedScope } from '@/modules/estimator/ai-brief/digest';
import { refLabel } from '@/modules/estimator/ai-brief/labels';
import type { AiBrief, ScopeItem } from '@/modules/estimator/ai-brief/types';

/**
 * Brief CONSISTENCY checker — does what the visitor reads match what was
 * priced? Deterministic, no model. Used by the eval harness to score briefs
 * (the 2026-10 audit's weakest axis); not on the request path.
 *
 *  - Every MVP wireframe block and the MVP narrative may only show work the MVP
 *    prices, or generic UI. A mention of an unpriced need (the model's own
 *    "not priced" list, or a catalog id the product cannot price) or of a
 *    LATER item is an error; a capability priced nowhere is a warning.
 *  - Assumptions must not contradict the priced scope: no "payments later"
 *    when the MVP prices Payme, no "stored in Mailchimp" when Mailchimp is not
 *    priced, no "one language" when the engine priced two.
 *  - The summary and the audience must not present an unpriced need as part
 *    of the product ("It syncs with SharePoint" with SharePoint not priced —
 *    the round-2 auditors' most common must-not-ship finding).
 *  - Prompt framing must not leak into visible text ("the visitor himself").
 *
 * The same checks run on the request path (`guard.ts`, through
 * `createConsistencyGuard`) to drop the offending copy before a brief ships;
 * the eval harness scores the brief both before and after that guard.
 *
 * Vocabulary lives in `consistencyLexicon.ts`.
 */

export type ConsistencyKind =
  | 'screen_unpriced'
  | 'screen_later'
  | 'screen_not_in_scope'
  | 'narrative_unpriced'
  | 'narrative_later'
  | 'narrative_not_in_scope'
  | 'assumption_negates_mvp'
  | 'assumption_unpriced'
  | 'assumption_later'
  | 'assumption_not_in_scope'
  | 'assumption_config'
  | 'summary_unpriced'
  | 'framing_leak';

export type Severity = 'error' | 'warn';

export interface ConsistencyViolation {
  kind: ConsistencyKind;
  severity: Severity;
  /** Where in the brief: `screen "Cart" › checkout`, `assumptions[2]`, `phases.mvp.goal`… */
  where: string;
  text: string;
  /** The concept (`payment`, `brand:stripe`…) or unpriced item it is about. */
  subject: string;
  detail: string;
}

export interface ConsistencyReport {
  violations: ConsistencyViolation[];
  errors: number;
  warnings: number;
  /** Visible MVP refs vs the ones the MVP screens show — information, not a violation. */
  coverage: { visible: string[]; shown: string[]; share: number | null };
}

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const APOSTROPHES = /['‘’ʻ`]/g;

export function normalizeToken(token: string): string {
  const t = token.toLowerCase().replace(APOSTROPHES, '').replace(/ё/g, 'е');
  return /^[a-z]{5,}$/.test(t) && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t;
}

const STOP = new Set([...STOPWORDS].map(normalizeToken));

export function tokenize(text: string): string[] {
  const words = text.replace(APOSTROPHES, '').match(/[\p{L}\p{N}]+/gu) ?? [];
  return (
    words
      .map(normalizeToken)
      // Bare numbers ("30 тыс.") are quantities, not names; "1c" or "2gis" are.
      .filter(t => !STOP.has(t) && !/^\d+$/.test(t) && (t.length >= 4 || BRAND_TOKENS.has(t) || (/\d/.test(t) && t.length >= 2)))
  );
}

/**
 * Same word up to inflection: one is a ≥4-letter prefix of the other, or they
 * share 6 letters. A 4-letter prefix only reaches an inflection (+5 letters at
 * most): "main" is not "maintenance" (round 2 iteration 2 dropped every "Main
 * menu" of an ERP brief whose maintenance module was not priced).
 */
export function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.startsWith(short) && (short.length > 4 || long.length - short.length <= 5)) return true;
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return i >= 6;
}

/* ------------------------------------------------------------------ */
/* What was priced                                                     */
/* ------------------------------------------------------------------ */

interface UnpricedItem {
  label: string;
  /** Distinctive tokens and their weight (brand names weigh 2). */
  tokens: { token: string; weight: number }[];
  required: number;
}

interface ScopeView {
  locale: string;
  projectType: ProjectType;
  mvp: Set<string>;
  later: Set<string>;
  /** Catalog ids the product could not price (listed as not priced). */
  unpricedRefs: Set<string>;
  unpriced: UnpricedItem[];
  languages: number;
  platforms: string[];
  extraTypes: Set<string>;
}

type Verdict = 'ok' | 'unpriced' | 'later' | 'not_in_scope';

const CONCEPT_BY_ID = new Map(CONCEPTS.map(c => [c.id, c]));
const CATALOG_IDS = [...FEATURES.map(f => f.id), ...INTEGRATIONS.map(i => i.id)];
const STRICT_REF: Record<string, string> = { chat: 'chat', 'video-call': 'video_call' };

function verdict(concept: Concept, view: ScopeView, text: string): Verdict {
  const strict = STRICT_REF[concept.id];
  if (strict && !view.mvp.has(strict) && view.unpricedRefs.has(strict)) return 'unpriced';
  if (concept.refs.some(r => view.mvp.has(r)) || concept.exempt?.test(text)) return 'ok';
  if (concept.refs.some(r => view.unpricedRefs.has(r))) return 'unpriced';
  if (concept.inherentFor?.includes(view.projectType)) return 'ok';
  return concept.refs.some(r => view.later.has(r)) ? 'later' : 'not_in_scope';
}

/** Concepts mentioned in `text` (`withNegationOnly` adds the broad ones used to spot "X is absent"). */
function conceptsIn(text: string, locale: string, withNegationOnly = false): Concept[] {
  return CONCEPTS.filter(c => (withNegationOnly || !c.negationOnly) && !c.skipLocales?.includes(locale) && c.re.test(text));
}

interface Vocabulary {
  /** Words of what is priced (title, roles, MVP labels, MVP integration notes). */
  words: string[];
  /** Brands a priced MVP integration connects ("custom API — SharePoint sync"). */
  pricedBrands: Set<string>;
}

function unpricedItem(label: string, vocabulary: Vocabulary, view: Omit<ScopeView, 'unpriced'>): UnpricedItem | null {
  if (NON_SOFTWARE.test(label) && !INTEGRATION_WORDS.test(label)) return null;
  const tokens = Array.from(new Set(tokenize(label)))
    .filter(t => (BRAND_TOKENS.has(t) ? !vocabulary.pricedBrands.has(t) : !vocabulary.words.some(v => tokensMatch(t, v))))
    // A word for something the MVP does price ("Uzcard" with Payme priced) is not distinctive.
    .filter(t => BRAND_TOKENS.has(t) || !CONCEPTS.some(c => c.re.test(t) && verdict(c, { ...view, unpriced: [] }, t) === 'ok'))
    .map(token => ({ token, weight: BRAND_TOKENS.has(token) ? 2 : 1 }));
  const total = tokens.reduce((sum, t) => sum + t.weight, 0);
  if (total === 0 || (total === 1 && tokens[0].token.length < 6)) return null;
  return { label, tokens, required: Math.min(2, total) };
}

function matchesUnpriced(text: string, item: UnpricedItem): boolean {
  const words = tokenize(text);
  const weight = item.tokens.filter(t => words.some(w => tokensMatch(t.token, w))).reduce((sum, t) => sum + t.weight, 0);
  return weight >= item.required;
}

const isPricedInMvp = (priced: PricedScope, id: string) => priced.mvpRefs.includes(id);

/** What the checks need to know about a brief besides the priced scope (available before the brief is assembled). */
export interface ViewSource {
  locale: BriefLocale;
  title: string;
  roles: string[];
  integrations: Pick<ScopeItem, 'id' | 'phase' | 'note'>[];
  /** Engine config: interface languages and mobile platforms priced. */
  languages: number;
  platforms: string[];
}

export function viewSourceOf(brief: AiBrief): ViewSource {
  const { locale, title, roles, integrations } = brief;
  return { locale, title, roles, integrations, languages: brief.estimate.config.languages, platforms: brief.estimate.config.platforms };
}

function scopeView(src: ViewSource, priced: PricedScope): ScopeView {
  const { locale } = src;
  // Saved runs from before `unpricedRefs` existed named them by their bare catalog label.
  const labels = new Map(CATALOG_IDS.map(id => [refLabel(id, locale).toLowerCase(), id]));
  const unpricedRefs = new Set(
    priced.unpricedRefs ?? priced.unpriced.map(u => labels.get(u.toLowerCase())).filter((id): id is string => !!id)
  );
  const base = {
    locale,
    projectType: priced.product.projectType,
    mvp: new Set(priced.mvpRefs),
    later: new Set([...priced.laterRefs, ...priced.extraRefs]),
    unpricedRefs,
    languages: src.languages,
    platforms: src.platforms,
    extraTypes: new Set(priced.extraRefs.map(r => r.split(':')[0])),
  };
  // What a priced integration connects is priced ("custom API — playbook rules engine").
  const integrationNotes = tokenize(
    src.integrations
      .filter(i => i.phase === 'mvp' && isPricedInMvp(priced, i.id))
      .map(i => i.note)
      .join(' ')
  );
  const vocabulary: Vocabulary = {
    words: [
      ...tokenize(
        [
          src.title,
          ...src.roles,
          refLabel(`${priced.product.projectType}:${priced.product.subtype}`, locale),
          ...priced.mvpRefs.map(r => refLabel(r, locale)),
        ].join(' ')
      ),
      ...integrationNotes,
    ],
    pricedBrands: new Set(integrationNotes.filter(t => BRAND_TOKENS.has(t))),
  };
  const unpriced = priced.unpriced.map(label => unpricedItem(label, vocabulary, base)).filter((u): u is UnpricedItem => !!u);
  return { ...base, unpriced };
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

type Emit = (v: ConsistencyViolation) => void;
type Area = 'screen' | 'narrative';

const KIND: Record<Area, Record<Exclude<Verdict, 'ok'>, ConsistencyKind>> = {
  screen: { unpriced: 'screen_unpriced', later: 'screen_later', not_in_scope: 'screen_not_in_scope' },
  narrative: { unpriced: 'narrative_unpriced', later: 'narrative_later', not_in_scope: 'narrative_not_in_scope' },
};

const DETAIL: Record<Exclude<Verdict, 'ok'>, string> = {
  unpriced: 'shown in the MVP but listed as not priced',
  later: 'shown in the MVP but priced only for the growth phase',
  not_in_scope: 'shown in the MVP but priced nowhere',
};

interface MvpText {
  area: Area;
  where: string;
  text: string;
  /** Surrounding words that can make a mention offline ("Касса" screen → cash). */
  context?: string;
  /** Concepts implied by the block kind itself (a map block draws a map). */
  implied?: Concept[];
}

/** One unit of MVP text (a block, a screen header, a narrative sentence) against the priced scope. */
function checkMvpText({ area, where, text, context = '', implied = [] }: MvpText, view: ScopeView, emit: Emit): string[] {
  if (!text || SCREEN_DEFERRAL.test(text)) return [];
  const unpriced = view.unpriced.filter(item => matchesUnpriced(text, item));
  for (const item of unpriced)
    emit({ kind: KIND[area].unpriced, severity: 'error', where, text, subject: item.label, detail: DETAIL.unpriced });

  const shown: string[] = [];
  const mentioned = conceptsIn(text, view.locale).filter(c => !negatedNear(text, c.re));
  for (const concept of Array.from(new Set([...implied, ...mentioned]))) {
    const v = verdict(concept, view, `${context} ${text}`);
    if (v === 'ok') shown.push(...concept.refs.filter(r => view.mvp.has(r)));
    // One unpriced finding per unit is enough; a vaguer "priced nowhere" would only repeat it.
    else if (v !== 'not_in_scope' || unpriced.length === 0) {
      emit({ kind: KIND[area][v], severity: v === 'not_in_scope' ? 'warn' : 'error', where, text, subject: concept.id, detail: DETAIL[v] });
    }
  }
  return shown;
}

/** Landing pages and corporate sites describe the client's business: their content blocks are copy, not functionality. */
const CONTENT_SUBTYPES: readonly string[] = ['landing', 'corporate'];
const CONTENT_BLOCKS: readonly string[] = ['hero', 'text', 'image', 'video', 'card-grid', 'list', 'stats'];

function checkScreens(brief: AiBrief, view: ScopeView, emit: Emit, subtype: string): string[] {
  const shown: string[] = [];
  const copyOnly = CONTENT_SUBTYPES.includes(subtype);
  for (const screen of brief.screens.filter(s => s.phase === 'mvp')) {
    const at = `screen "${screen.name}"`;
    const context = screen.name;
    shown.push(...checkMvpText({ area: 'screen', where: at, text: [screen.name, screen.purpose].join(' — ') }, view, emit));
    for (const block of screen.blocks) {
      if (copyOnly && CONTENT_BLOCKS.includes(block.kind)) continue;
      const blockConcept = CONCEPT_BY_ID.get(BLOCK_CONCEPTS[block.kind] ?? '');
      // A bot's whole screen is a chat: the chat frame is the product, not a feature.
      const inherentChat = block.kind === 'chat' && (screen.device === 'chat' || view.projectType === 'telegram');
      const implied = blockConcept && !inherentChat ? [blockConcept] : [];
      const text = [block.label, ...block.items].filter(Boolean).join(' · ') || block.kind;
      shown.push(...checkMvpText({ area: 'screen', where: `${at} › ${block.kind}`, text, context, implied }, view, emit));
    }
  }
  return shown;
}

/** MVP narrative text, clause by clause: a clause that defers, negates or hands the thing to someone else is not a promise. */
function checkNarrativeText(text: string, where: string, view: ScopeView, emit: Emit): void {
  for (const clause of clauses(text)) {
    if (DEFERRAL.test(clause) || NEGATION.test(clause) || EXTERNAL.test(clause)) continue;
    checkMvpText({ area: 'narrative', where, text: clause }, view, emit);
  }
}

function checkNarrative(brief: AiBrief, view: ScopeView, emit: Emit): void {
  const mvp = brief.estimate.phases.find(p => p.id === 'mvp');
  const units: [string, string][] = [
    ['buildFirst.what', brief.narrative.buildFirst.what],
    ['phases.mvp.goal', mvp?.goal ?? ''],
    ...(mvp?.deliverables ?? []).map((d, i): [string, string] => [`phases.mvp.deliverables[${i}]`, d]),
  ];
  for (const [where, text] of units) checkNarrativeText(text, where, view, emit);
}

/** Clauses of a sentence: the unit a "no"/"later" applies to. */
export function clauses(text: string): string[] {
  return text
    .split(/(?<=[.;!?])\s+|;\s*|,\s+|\s+(?:but|но|lekin|ammo|biroq)\s+/iu)
    .map(c => c.trim())
    .filter(Boolean);
}

/* Interface languages, platforms and product type claimed in an assumption. */

const UI_WORDS =
  /interface|(?<!\p{L})ui(?!\p{L})|storefront|website|(?<!\p{L})(?:site|app|bot)(?!\p{L})|интерфейс|сайт|приложени|(?<!\p{L})бот|interfeys|(?<!\p{L})sayt|ilova|(?<!\p{L})bot(?!\p{L})/iu;
const LANGUAGE_COUNT =
  /(?<!\p{L})(one|single|1|two|2|three|3|один|одн\p{L}*|два|двух|три|тр[её]х|bitta|ikki|uch)(?!\p{L})(?:\s+\p{L}+){0,2}\s+(?:languages?|язык\p{L}*|til\p{L}*)/iu;
const NUMBER_WORDS: [RegExp, number][] = [
  [/^(?:one|single|1|один|одн\p{L}*|bitta)$/iu, 1],
  [/^(?:two|2|два|двух|ikki)$/iu, 2],
  [/^(?:three|3|три|тр[её]х|uch)$/iu, 3],
];
const LANGUAGES: RegExp[] = [
  /english|английск|ingliz/iu,
  /russian|русск|(?<!\p{L})rus(?:cha|ch|\s+til|(?!\p{L}))/iu,
  /uzbek|узбекск|o['‘’ʻ`]?zbek/iu,
  /arabic|арабск|(?<!\p{L})arab(?:cha|\s+til)/iu,
  /spanish|испанск|ispan/iu,
  /kazakh|казахск|qozoq/iu,
  /turkish|турецк|turk(?:cha|\s+til)/iu,
  /chinese|китайск|xitoy/iu,
  /french|французск|fransuz/iu,
  /german|немецк|nemis/iu,
];

export function claimedLanguages(clause: string): number | null {
  const count = clause.match(LANGUAGE_COUNT);
  if (count) return NUMBER_WORDS.find(([w]) => w.test(count[1]))?.[1] ?? null;
  if (/bilingual|двуязычн|ikki tilli/iu.test(clause)) return 2;
  if (!UI_WORDS.test(clause)) return null;
  const named = LANGUAGES.filter(l => l.test(clause)).length;
  return named > 0 ? named : null;
}

const IOS = '(?:ios|iphone)';
const PLATFORM_CLAIMS: [RegExp, number][] = [
  [
    new RegExp(
      `${IOS}\\s*(?:and|и|va|\\+|&|/)\\s*android|android\\s*(?:and|и|va|\\+|&|/)\\s*${IOS}|both platforms|обе платформы|ikkala platforma`,
      'iu'
    ),
    2,
  ],
  [new RegExp(`${IOS}\\s*(?:only|first)|only (?:for |on )?${IOS}|только (?:для |на )?${IOS}|faqat ${IOS}`, 'iu'), 1],
  [/android\s*(?:only|first)|only (?:for |on )?android|только (?:для |на )?android|faqat android/iu, 1],
];
const MOBILE_CLAIM = /mobile app|мобильн\p{L}* приложени|mobil ilova|(?<!\p{L})(?:ios|android)(?!\p{L})|flutter/iu;
const WEB_CLAIM =
  /web[- ]?(?:platform|app|application|site|version|shop|store|portal)|website|веб-?(?:приложени|платформ|верси|сайт|магазин|портал|систем)|(?<!\p{L})сайт|veb-?(?:sayt|ilova|platforma|do['‘’ʻ`]?kon|versiya)|(?<!\p{L})sayt/iu;

function configClaims(clause: string, view: ScopeView): string | null {
  const languages = claimedLanguages(clause);
  if (languages !== null && languages !== view.languages)
    return `claims ${languages} interface language(s); the engine priced ${view.languages}`;
  if (view.projectType === 'mobile') {
    const platforms = PLATFORM_CLAIMS.find(([claim]) => claim.test(clause))?.[1];
    if (platforms && platforms !== view.platforms.length)
      return `claims ${platforms} platform(s); the engine priced ${view.platforms.join(' + ')}`;
  }
  const isWeb = ['web', 'ai', 'other'].includes(view.projectType);
  if (view.projectType !== 'mobile' && !view.extraTypes.has('mobile') && MOBILE_CLAIM.test(clause))
    return `claims a mobile app; the product is ${view.projectType}`;
  if (!isWeb && view.projectType !== 'telegram' && !view.extraTypes.has('web') && WEB_CLAIM.test(clause))
    return `claims a website/web app; the product is ${view.projectType}`;
  return null;
}

/** Whole words strictly between two character offsets of `text` (a negation suffix counts as its own word). */
function wordsBetween(text: string, from: number, to: number): number {
  let end = to;
  while (end > from && /[\p{L}\p{N}'‘’ʻ`]/u.test(text[end - 1])) end--;
  return (text.slice(from, end).match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

const QUALIFIED = /^\s+(?:from|for|by|от|для|со стороны)\s/iu;
const PREPOSITIONAL = /^(?:no|without|none|never|без|ни)$/iu;

/** "no online payment", "без онлайн-оплаты" (before) / "to'lov yo'q", "оплата не нужна" (after). */
const NEGATION_REACH = { before: 3, after: 2 };
/** Concepts that also describe the product's kind ("not a standalone AI backend"): a nearby "not" is not about the feature. */
const NOT_NEGATABLE: ReadonlySet<string> = new Set(['ai', 'admin']);

/**
 * Does the clause exclude this concept? A deferral or "cash only" covers the
 * whole clause; a negation must sit within a few words of the mention, before
 * it (English, Russian "без") or after it (Uzbek "yo'q", Russian "не требуется").
 */
/** "…, not subscriptions" / "…, а не подписка": a short contrast classifies, it does not say the thing is absent. */
const CONTRAST = /^(?:not|а не|rather than|instead of)\s+(?:\p{L}+\s*){1,3}$/iu;

function excludes(clause: string, concept: Concept): boolean {
  if (DEFERRAL.test(clause) || (concept.id.startsWith('payment') && CASH_ONLY.test(clause))) return true;
  if (NOT_NEGATABLE.has(concept.id) || CONTRAST.test(clause)) return false;
  return negatedNear(clause, concept.re);
}

/** Is a mention of `re` in `text` within reach of a negation? */
function negatedNear(text: string, re: RegExp): boolean {
  const mention = text.match(re);
  if (mention?.index === undefined) return false;
  const start = mention.index;
  const end = start + mention[0].length;
  // "no payments from pet owners": a negation about one party, not about the feature.
  if (QUALIFIED.test(text.slice(end))) return false;
  return Array.from(text.matchAll(new RegExp(NEGATION.source, 'giu'))).some(n => {
    const at = n.index ?? 0;
    // After the mention only a predicate negates ("payments not included", "to'lov yo'q"), never "without one".
    if (at >= end) return !PREPOSITIONAL.test(n[0]) && wordsBetween(text, end, at) <= NEGATION_REACH.after;
    return at + n[0].length <= start && wordsBetween(text, at + n[0].length, start) <= NEGATION_REACH.before;
  });
}

function checkAssumption(assumption: string, where: string, view: ScopeView, emit: Emit): void {
  // Engine-config claims read whole sentences: "English, Russian and Uzbek interfaces" is one claim.
  for (const sentence of assumption.split(/(?<=[.;!?])\s+|;\s*/)) {
    if (!sentence.trim() || DEFERRAL.test(sentence) || NEGATION.test(sentence) || EXTERNAL.test(sentence)) continue;
    const config = configClaims(sentence, view);
    if (config) emit({ kind: 'assumption_config', severity: 'error', where, text: assumption, subject: 'engine config', detail: config });
  }
  const parts = clauses(assumption);
  for (const clause of parts) {
    const mentions = conceptsIn(clause, view.locale);
    // Named positively elsewhere in the same assumption ("SharePoint read access; not custom add-ins"): not absent.
    const affirmed = (c: Concept) => parts.some(other => other !== clause && c.re.test(other) && !excludes(other, c));
    const named = conceptsIn(clause, view.locale, true);
    // "SMS reminders later": the clause is about SMS, not every kind of notification.
    const specific = (c: Concept) => !named.some(d => d !== c && d.refs.length < c.refs.length && d.refs.every(r => c.refs.includes(r)));
    const excluded = named.filter(c => specific(c) && excludes(clause, c) && !affirmed(c));
    // "The Follow Up Boss connection is not in this estimate" next to a priced IDX feed: one brand concept
    // covers every outside system, so a negated brand that names an unpriced item is about that item.
    const namesUnpriced = view.unpriced.some(u => matchesUnpriced(clause, u));
    const negatesMvp = (m: Concept) => m.refs.some(r => view.mvp.has(r)) && !(namesUnpriced && m.id.startsWith('brand:'));
    for (const c of excluded.filter(negatesMvp)) {
      emit({
        kind: 'assumption_negates_mvp',
        severity: 'error',
        where,
        text: assumption,
        subject: c.id === 'payment-any' ? 'payment' : c.id,
        detail: 'says it is absent or deferred, but the MVP prices it',
      });
    }
    const outside = DEFERRAL.test(clause) || NEGATION.test(clause) || CASH_ONLY.test(clause) || EXTERNAL.test(clause);
    if (outside) continue;

    const unpriced = view.unpriced.filter(u => matchesUnpriced(clause, u));
    for (const item of unpriced) {
      emit({
        kind: 'assumption_unpriced',
        severity: 'error',
        where,
        text: assumption,
        subject: item.label,
        detail: 'treats an unpriced need as part of the build',
      });
    }
    for (const c of mentions) {
      const v = verdict(c, view, clause);
      if (v === 'ok' || (v === 'not_in_scope' && unpriced.length > 0)) continue;
      const kind = v === 'unpriced' ? 'assumption_unpriced' : v === 'later' ? 'assumption_later' : 'assumption_not_in_scope';
      const detail = `treats it as part of the build, but it is ${v === 'unpriced' ? 'listed as not priced' : v === 'later' ? 'priced only for the growth phase' : 'priced nowhere'}`;
      emit({ kind, severity: v === 'unpriced' ? 'error' : 'warn', where, text: assumption, subject: c.id, detail });
    }
  }
}

function checkAssumptions(brief: AiBrief, view: ScopeView, emit: Emit): void {
  brief.narrative.assumptions.forEach((assumption, i) => checkAssumption(assumption, `assumptions[${i}]`, view, emit));
}

/* Summary and audience: the whole product (MVP + later) — only unpriced work is a contradiction. */

function checkSummaryText(text: string, where: string, view: ScopeView, emit: Emit): void {
  for (const clause of clauses(text)) {
    if (DEFERRAL.test(clause) || NEGATION.test(clause) || EXTERNAL.test(clause)) continue;
    const unpriced = view.unpriced.filter(u => matchesUnpriced(clause, u));
    for (const item of unpriced)
      emit({
        kind: 'summary_unpriced',
        severity: 'error',
        where,
        text,
        subject: item.label,
        detail: 'presents an unpriced need as part of the product',
      });
    if (unpriced.length) continue;
    for (const c of conceptsIn(clause, view.locale).filter(c => verdict(c, view, clause) === 'unpriced'))
      emit({
        kind: 'summary_unpriced',
        severity: 'error',
        where,
        text,
        subject: c.id,
        detail: 'presents an unpriced need as part of the product',
      });
  }
}

function checkSummary(brief: AiBrief, view: ScopeView, emit: Emit): void {
  checkSummaryText(brief.summary, 'summary', view, emit);
  brief.audience.forEach((a, i) => checkSummaryText(`${a.segment}: ${a.need}`, `audience[${i}]`, view, emit));
}

/* Prompt framing in visible text. */

/** Prompt framing that must never reach a visitor (errors) and internal jargon that reads oddly (warnings). */
const FRAMING: [RegExp, Severity][] = [
  [
    /the visitor(?:['’]s)?\s+(?:him|her|them)sel(?:f|ves)|(?:the |this )?visitor (?:also |only |explicitly |clearly |specifically )?(?:said|wrote|mentioned|asked|requested|described|named|wants|needs|requires|expects|did not|didn['’]t)|visitor['’]s (?:idea|request|brief)|as the visitor/iu,
    'error',
  ],
  [/(?:сам|сама) посетитель|посетитель (?:сам|также |тоже )?(?:указал|написал|упомянул|просил|попросил|хочет)|идея посетителя/iu, 'error'],
  [
    /tashrif buyur?(?:uv)?chi(?:ning)?\s+o['‘’ʻ`]?zi|tashrif buyur?(?:uv)?chining g['‘’ʻ`]?oyasi|tashrif buyur?(?:uv)?chi\s+(?:\p{L}+\s+){0,3}(?:so['‘’ʻ`]?ra(?:di|gan)|ayt(?:di|gan)|yoz(?:di|gan)|xohla(?:ydi|gan)|ista(?:ydi|gan)|talab qil(?:di|gan))(?!\p{L})/iu,
    'error',
  ],
  [
    /scope ref|(?<!\p{L})ref id|catalog ids?|system prompt|snake_case|(?<!\p{L})(?:PRICED SCOPE|NOT PRICED|EXTRA PRODUCTS)(?!\p{L})/u,
    'error',
  ],
  // Words put in the reader's mouth: they wrote an idea, they confirmed nothing (round 2: "the module you
  // confirmed as first", "as you said yourself", "Siz o'zingiz aytdingiz").
  [
    /(?<!\p{L})as you(?:['’]ve| have)? (?:already )?(?:confirmed|agreed)|(?<!(?:once|after|when|until|if|before)\s)(?<!\p{L})you (?:already )?(?:confirmed|agreed)(?!\s+(?:to|on|with)(?!\p{L}))|you (?:said|told us|mentioned|wrote) (?:it |so )?yourself/iu,
    'error',
  ],
  [/(?:как )?вы (?:уже |сами )?(?:подтвердили|согласились)|вы сами (?:сказали|написали|говорили|указали)|как вы сами/iu, 'error'],
  [
    /o['‘’ʻ`]?zingiz (?:aytdingiz|aytgansiz|aytganingizdek|yozdingiz|tasdiqladingiz)|(?<!\p{L})(?:siz )?tasdiqla(?:dingiz|gansiz|ganingizdek|ganingiz)(?!\p{L})|(?<!\p{L})siz tasdiqlagan(?!\p{L})/iu,
    'error',
  ],
  [/priced scope|estimator engine|page language|оцен\p{L}* скоуп|priced (?:mvp|later)|the idea (?:requires|expects|needs|asks)/iu, 'warn'],
];

/** Framing leaks in one visible text. */
export function framingLeaks(text: string): { subject: string; severity: Severity }[] {
  return FRAMING.flatMap(([re, severity]) => {
    const hit = text.match(re);
    return hit ? [{ subject: hit[0], severity }] : [];
  });
}

function visibleTexts(brief: AiBrief): [string, string][] {
  const n = brief.narrative;
  return [
    ['title', brief.title],
    ['summary', brief.summary],
    ...brief.audience.map((a, i): [string, string] => [`audience[${i}]`, `${a.segment} ${a.need}`]),
    ...[...brief.features, ...brief.integrations].map((f): [string, string] => [`note:${f.id}`, f.note]),
    ['buildFirst', `${n.buildFirst.what} ${n.buildFirst.why}`],
    ...n.canWait.map((c, i): [string, string] => [`canWait[${i}]`, `${c.item} ${c.reason}`]),
    ...n.risks.map((r, i): [string, string] => [`risks[${i}]`, `${r.title} ${r.detail} ${r.mitigation}`]),
    ...n.questions.map((q, i): [string, string] => [`questions[${i}]`, q]),
    ...n.assumptions.map((a, i): [string, string] => [`assumptions[${i}]`, a]),
    ...brief.estimate.extras.map((e, i): [string, string] => [`extras[${i}]`, e.reason]),
    ...brief.estimate.phases.map((p): [string, string] => [`phases.${p.id}`, [p.title, p.goal, ...p.deliverables].join(' ')]),
    ...brief.screens.map((s): [string, string] => [
      `screen "${s.name}"`,
      [s.name, s.purpose, ...s.blocks.flatMap(b => [b.label, ...b.items])].join(' '),
    ]),
  ];
}

function checkFraming(brief: AiBrief, emit: Emit): void {
  for (const [where, text] of visibleTexts(brief)) {
    for (const { subject, severity } of framingLeaks(text))
      emit({ kind: 'framing_leak', severity, where, text, subject, detail: 'prompt framing leaked into visible text' });
  }
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function checkBriefConsistency(brief: AiBrief, priced: PricedScope): ConsistencyReport {
  const view = scopeView(viewSourceOf(brief), priced);
  const violations: ConsistencyViolation[] = [];
  const seen = new Set<string>();
  const emit: Emit = v => {
    const key = `${v.kind}|${v.where}|${v.subject}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push(v);
  };

  const shown = new Set(checkScreens(brief, view, emit, priced.product.subtype));
  checkNarrative(brief, view, emit);
  checkAssumptions(brief, view, emit);
  checkSummary(brief, view, emit);
  checkFraming(brief, emit);

  const detectable = new Set(CONCEPTS.flatMap(c => c.refs));
  const visible = priced.mvpRefs.filter(r => !INVISIBLE_REFS.has(r) && detectable.has(r));
  const covered = visible.filter(r => shown.has(r));
  violations.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return {
    violations,
    errors: violations.filter(v => v.severity === 'error').length,
    warnings: violations.filter(v => v.severity === 'warn').length,
    coverage: { visible, shown: covered, share: visible.length && brief.screens.length ? covered.length / visible.length : null },
  };
}

/* ------------------------------------------------------------------ */
/* Request-path guard                                                  */
/* ------------------------------------------------------------------ */

/** The checks of one kind of visible text, for `guard.ts` to drop what fails. Only errors are returned. */
export interface ConsistencyGuard {
  /** MVP wireframe copy or an MVP narrative sentence (`context`: the screen it sits on). */
  mvpText(text: string, area: Area, context?: string): ConsistencyViolation[];
  assumption(text: string): ConsistencyViolation[];
  /** A summary sentence or an audience line. */
  summary(text: string): ConsistencyViolation[];
}

export function createConsistencyGuard(src: ViewSource, priced: PricedScope): ConsistencyGuard {
  const view = scopeView(src, priced);
  const collect = (run: (emit: Emit) => void): ConsistencyViolation[] => {
    const found: ConsistencyViolation[] = [];
    run(v => {
      if (v.severity === 'error') found.push(v);
    });
    return found;
  };
  return {
    mvpText: (text, area, context) =>
      collect(emit =>
        area === 'narrative' ? checkNarrativeText(text, area, view, emit) : checkMvpText({ area, where: area, text, context }, view, emit)
      ),
    assumption: text => collect(emit => checkAssumption(text, 'assumption', view, emit)),
    summary: text => collect(emit => checkSummaryText(text, 'summary', view, emit)),
  };
}
