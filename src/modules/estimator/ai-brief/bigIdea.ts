import type { Range } from '@/modules/estimator/types';

/**
 * Very large ideas get a plan but no price (founder decision 2026-10-10).
 *
 * A brief prices a first version from a paragraph. For an enterprise
 * programme — "a complete ERP replacing SAP for 12 plants in three countries"
 * — any number is wrong by a multiple: round 2 quoted it from ~$5,000 and the
 * plan promised "scale to all plants" in a 1–2 week phase (the most-blocked
 * brief of the round). Such an idea keeps its scope, risks, questions and
 * screens, while the price card says it needs a discovery call.
 *
 * The verdict is deterministic — the idea's own words and the engine's
 * numbers, never a model field — and errs towards pricing: one size signal
 * needs the engine to agree, so an SMB idea that mentions a big employer
 * ("we are a 3,000-person bank, we need a landing page") is still priced.
 *
 * Calibrated on every saved round-2/3 scope (54 priced ideas, 557 priced
 * scopes, replayed through this code on 2026-10-10):
 *  - every normal brief stays priced: the largest engine MVP high end is 893 h
 *    (ru-fintech-halal), the largest full vision 1,518 h (uz-marketplace-
 *    farmers), and no other idea names 1,000+ staff, several plants, 50+ own
 *    branches or a core-system replacement;
 *  - all 10 en-huge-erp scopes trigger on their text (replacing SAP; 5,000
 *    employees, 12 plants, three countries) although the engine priced their
 *    "pilot" at only 500–857 h — the engine alone cannot see it.
 * The words are read strictly, because 71% of normal priced scopes are 300 h
 * or more and the engine floor does not protect against a loose match: the
 * replaced system must be the object of the replace verb ("replace Excel
 * with a simple ERP" names the ERP as the target), a generic ERP needs
 * BIG_IDEA_ERP_MIN_MVP_HOURS, and "people" counts only as staff ("an online
 * school for 5000 people" is not a 5,000-person company).
 */

export type BigIdeaReason = 'core_system' | 'enterprise_scale' | 'engine_size';

/** Engine effort that alone makes a first version too big to price from a paragraph. */
export const BIG_IDEA_ENGINE_HOURS = {
  /** High end of the MVP (~$17k at the uz/ru rate, ~$48k at the EN high rate). */
  mvpHigh: 1_200,
  /** High end of the full vision (MVP + later + extra products). */
  fullHigh: 2_000,
} as const;

/**
 * Scale named in the idea that marks an enterprise rollout. Countries only
 * support another signal: "we ship to five countries" is a normal online shop.
 * Branches count only as the business's own ("50 филиалов", "our 60
 * locations"), never the shops a distributor delivers to or the "60 locations"
 * a delivery app covers.
 */
export const BIG_IDEA_SCALE = {
  employees: 1_000,
  /** Plants, factories, mills, mines. */
  industrialSites: 3,
  /** Own branches or locations. */
  branches: 50,
  countries: 3,
} as const;

/** Scale alone is not enough: the engine's MVP must also be at least this big (high end, hours). */
export const BIG_IDEA_SCALE_MIN_MVP_HOURS = 300;

/**
 * A generic ERP — "a full ERP", "replace our ERP", Odoo — is what many small
 * firms mean by stock, orders and invoices ("full ERP for a 12-person
 * workshop"), so it counts only when the engine's MVP (high end, hours) is past
 * every normal round-2 brief (largest: 893 h). A named enterprise suite
 * (SAP, Oracle ERP, Dynamics, NetSuite, 1C:ERP) needs no floor: the model
 * often prices such a replacement as a small pilot.
 */
export const BIG_IDEA_ERP_MIN_MVP_HOURS = 900;

export interface BigIdeaVerdict {
  isBig: boolean;
  reasons: BigIdeaReason[];
  /** What matched, for the audit log ("replaces SAP", "5000 employees", "mvp 1300 h"). */
  signals: string[];
}

export interface EngineSize {
  mvpHours: Range;
  /** Full vision (MVP + later + extras); null when there is no later scope. */
  fullHours: Range | null;
}

/* ------------------------------------------------------------------ */
/* Text signals                                                        */
/* ------------------------------------------------------------------ */

const APOSTROPHE = "['‘’ʻ`]";
/** A word ends here (Latin and Cyrillic alike; JS `\b` is ASCII-only). */
const END = '(?![\\p{L}\\p{N}])';
const START = '(?<![\\p{L}\\p{N}])';

/**
 * Enterprise core systems whose replacement is a programme, whatever the
 * engine priced. Plain "1C" is the SMB accounting default in Uzbekistan and
 * SAP Business One an SMB product — only 1C:ERP and SAP's enterprise suite
 * count. "Oracle" alone is a database (Oracle DB → Postgres is a migration).
 */
const NAMED_SYSTEM = [
  'S\\/4\\s?HANA',
  `SAP(?!\\s*(?:Business\\s*One|B1)${END})`,
  'Oracle\\s+(?:ERP|E-?Business(?:\\s+Suite)?|EBS|Fusion)',
  '(?:Microsoft|MS)\\s+Dynamics',
  'Dynamics\\s+(?:365|AX|NAV|GP)',
  'NetSuite',
  '1[CС]\\s*:?\\s*ERP',
].join('|');
/** A generic ERP: a signal only next to an engine estimate past BIG_IDEA_ERP_MIN_MVP_HOURS. */
const GENERIC_ERP = 'ERP|ЕРП|Odoo|Infor|Epicor';
/** Either kind, as a whole word, with the case suffix the pattern allows ("SAPni", "SAP'dan"). */
const systemWith = (suffix = '') => `${START}(?<system>${NAMED_SYSTEM}|${GENERIC_ERP})${suffix}${END}`;
const NAMED_RE = new RegExp(`^(?:${NAMED_SYSTEM})$`, 'iu');

/** The verb whose object is the system being replaced: "replacing SAP", "migrate from NetSuite", "вместо 1С:ERP". */
const REPLACE_VERB =
  'replac\\p{L}*|instead of|migrat\\p{L}* (?:off|from|away from)|mov\\p{L}* (?:off|away from)|switch\\p{L}* (?:off|from|away from)|retir\\p{L}*|phas\\p{L}* out|get(?:ting)? rid of|sunset\\p{L}*|замен\\p{L}*|вместо|переход\\p{L}* с|перейти с|перейд\\p{L}* с|уйти с|уход\\p{L}* с|миграц\\p{L}* с|мигрир\\p{L}* с|отказ\\p{L}* от';
/**
 * A word between the verb and the system ("replacing our ageing SAP"), never
 * one that makes the system the target or starts another clause: "replace
 * Excel WITH a simple ERP", "заменить таблицы НА ERP", "instead of Excel WE
 * want an ERP" — nor another tool being replaced ("instead of Excel, ERP").
 */
const NOT_SKIPPED = [
  'with|by|to|into|using|for a|на|в|во|bilan',
  'we|i|you|they|it|мы|я|вы|они|biz|men|siz|ular',
  'excel|spreadsheets?|sheets|paper|notebooks?|whiteboards?|таблиц\\p{L}*|эксел\\p{L}*|бумаг\\p{L}*|тетрад\\p{L}*|daftar\\p{L}*|jadval\\p{L}*',
].join('|');
const SKIP_WORD = `(?!(?:${NOT_SKIPPED})${END})[\\p{L}\\p{N}'’/-]+`;
/** "replacing SAP", "replace our old SAP ECC", "замена 1С:ERP", "migrate from Oracle E-Business Suite". */
const VERB_THEN_SYSTEM = new RegExp(`${START}(?:${REPLACE_VERB})\\s+(?:${SKIP_WORD}\\s+){0,3}?[("«“]?${systemWith()}`, 'giu');
const UZ_LETTERS = `[\\p{L}${APOSTROPHE.slice(1, -1)}]+`;
/** A word before "almashtir" that is not its target ("…ni Y bilan / Yga almashtirish"). */
const NOT_TARGET = `(?!${UZ_LETTERS}?ga${END}|bilan${END})${UZ_LETTERS}`;
/**
 * The system first: "SAP o'rniga" (in place of SAP), "SAPni almashtirish",
 * "an SAP replacement", "SAPdan voz kechish / o'tish" (from SAP). The target
 * of a switch never matches: "Excel o'rniga oddiy ERP", "Excelni ERP bilan /
 * ERPga almashtirish", "ERPga o'tish".
 */
const SYSTEM_THEN_VERB = [
  // "SAPni (to'liq) almashtirish", "SAP tizimini almashtirish".
  `${systemWith(`(?:${APOSTROPHE}|\\s)?ni`)}\\s+(?:${NOT_TARGET}\\s+)?almashtir\\p{L}*`,
  `${systemWith()}\\s+${UZ_LETTERS}ni\\s+(?:${NOT_TARGET}\\s+)?almashtir\\p{L}*`,
  // "SAP (tizimi) o'rniga", "an SAP (ECC) replacement".
  `${systemWith()}(?:\\s+(?!bilan${END})[\\p{L}\\p{N}${APOSTROPHE.slice(1, -1)}-]+){0,2}?\\s+(?:o${APOSTROPHE}?rniga|replacement)${END}`,
  // "SAPdan voz kechish", "SAPdan o'z tizimimizga o'tish".
  `${systemWith(`(?:${APOSTROPHE}|\\s)?dan`)}\\s+(?:${UZ_LETTERS}\\s+){0,3}?(?:voz kech\\p{L}*|o${APOSTROPHE}?t(?:ish|amiz|moqchimiz)|ko${APOSTROPHE}?ch(?:ish|amiz|moqchimiz))${END}`,
].map(source => new RegExp(source, 'giu'));
/** "A complete ERP", "полноценная ERP", "to'liq ERP" — a generic ERP, so it needs the engine floor. */
const FULL_ERP = new RegExp(
  `${START}(?:complete|full|full-scale|fully[- ]fledged|entire|whole|end-to-end|полноценн\\p{L}*|полн\\p{L}*|един\\p{L}*|to${APOSTROPHE}?liq|butun|yagona)\\s+(?:\\p{L}+\\s+)?(?:ERP|ЕРП)${END}`,
  'iu'
);

export interface CoreSystemSignal {
  /** What matched, for the audit log ("replaces SAP", "asks for a complete ERP"). */
  text: string;
  /** A generic ERP (not a named enterprise suite): counts only past BIG_IDEA_ERP_MIN_MVP_HOURS. */
  isGeneric: boolean;
}

/**
 * Does the idea ask to replace an enterprise core system (or for a complete
 * ERP)? The replaced system must be the object of the replace verb: a named
 * suite (SAP, S/4HANA, Oracle ERP, Dynamics, NetSuite, 1C:ERP) is a signal on
 * its own; a generic ERP — replaced or asked for "complete" — is returned as
 * generic and needs the engine to agree.
 */
export function coreSystemSignal(idea: string): CoreSystemSignal | null {
  const replaced = [VERB_THEN_SYSTEM, ...SYSTEM_THEN_VERB].flatMap(re =>
    Array.from(idea.matchAll(re), m => (m.groups?.system ?? '').replace(/\s+/g, ' '))
  );
  const named = replaced.find(system => NAMED_RE.test(system));
  if (named) return { text: `replaces ${named}`, isGeneric: false };
  if (replaced.length) return { text: `replaces ${replaced[0]}`, isGeneric: true };
  const full = FULL_ERP.exec(idea);
  return full ? { text: `asks for ${full[0].trim()}`, isGeneric: true } : null;
}

const NUMBER_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  два: 2,
  две: 2,
  двух: 2,
  три: 3,
  трёх: 3,
  трех: 3,
  четыре: 4,
  четырёх: 4,
  пять: 5,
  пяти: 5,
  шесть: 6,
  десять: 10,
  ikki: 2,
  uch: 3,
  "to'rt": 4,
  besh: 5,
  olti: 6,
  "o'n": 10,
};

/** "5,000" / "5 000" / "5.000" / "1.5k" / "5 тыс" / "5 ming" / "twelve" → a number (null when it is none). */
export function parseCount(raw: string): number | null {
  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[‘’ʻ`]/g, "'");
  if (text in NUMBER_WORDS) return NUMBER_WORDS[text];
  const thousands = /^(\d+(?:[.,]\d+)?)\s*(?:k|тыс\.?|тысяч\p{L}*|ming)$/u.exec(text);
  if (thousands) return Math.round(Number(thousands[1].replace(',', '.')) * 1000);
  const grouped = /^\d{1,3}(?:[\s,.  ]\d{3})+$/u.test(text) ? text.replace(/[\s,.  ]/gu, '') : text;
  const n = Number(grouped);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const COUNT = `(\\d{1,3}(?:[\\s,.\\u00a0\\u202f]\\d{3})+|\\d+(?:[.,]\\d+)?\\s*(?:k|тыс\\.?|тысяч\\p{L}*|ming)|\\d+|${Object.keys(
  NUMBER_WORDS
)
  .map(w => w.replace("'", APOSTROPHE))
  .join('|')})`;
/**
 * At most two words between a count and its noun, and only words that can
 * describe that noun ("5,000 full-time employees", "12 производственных
 * заводов"): never a preposition, conjunction or article, so the count of
 * something else ("1500 meals to …", "1,200 members and 40 …") never attaches.
 */
const GAP_WORD = `(?!(?:to|for|of|from|with|per|a|an|the|and|or|in|at|on|by|via|who|that|which|в|во|на|для|по|из|и|или|к|у|с|со|которые|uchun|va|bilan|yoki)${END})[\\p{L}-]+`;
const counted = (nouns: string, gap = `(?:${GAP_WORD}\\s+){0,2}?`) =>
  new RegExp(`${START}${COUNT}(?:\\s+(?:ta|nafar))?\\s+${gap}(?:${nouns})${END}`, 'giu');

/** Staff nouns: always a headcount. */
const EMPLOYEES = counted(`employees|staff|workers|personnel|сотрудник\\p{L}*|работник\\p{L}*|xodim\\p{L}*|ishchi\\p{L}*`);
/** "A 3,000-person bank": the company's size. */
const PERSON_COMPANY = new RegExp(
  `${START}${COUNT}[-\\s](?:person|people|employee|strong)\\s+(?:company|team|holding|organi[sz]ation|business|firm|bank|enterprise|corporation|manufacturer|group|workforce)${END}`,
  'giu'
);
/**
 * People nouns count only as staff — "5,000 people work here", "в штате 5000
 * человек", "1500 kishi ishlaydi" — never as visitors, students or customers
 * ("an online school for 5000 people", "1,200 people visit every week",
 * "kuniga 1000 kishi keladigan restoran").
 */
const PEOPLE = `people|человек|чел\\.?|kishi|odam`;
const AT_WORK = 'work|are employed|on (?:our )?(?:staff|payroll)|работа\\p{L}*|трудя\\p{L}*|в штате|ishlaydi|ishlashadi|mehnat qiladi';
const STAFF_OF = 'employ\\p{L}*|staff of|team of|workforce of|headcount of|в штате|штат(?:е)? (?:из|в)|штат(?:ом)? в';
const ABOUT = '(?:about |around |over |more than |около |более |свыше )?';
const PEOPLE_AT_WORK = [
  `${counted(PEOPLE, '').source}\\s+(?:${AT_WORK})`,
  `${START}(?:${STAFF_OF})\\s+${ABOUT}${COUNT}(?:\\s+(?:${PEOPLE}|employees|сотрудник\\p{L}*))?${END}`,
].map(source => new RegExp(source, 'giu'));
const INDUSTRIAL_SITES = counted(
  `plants|factories|mills|mines|refineries|завод\\p{L}*|фабрик\\p{L}*|комбинат\\p{L}*|zavod\\p{L}*|fabrika\\p{L}*`
);
const COUNTRIES = counted(`countries|стран\\p{L}*|davlat\\p{L}*|mamlakat\\p{L}*`);
/** Branches are the business's own; "locations" only with an owner ("our 60 locations", "a chain with 60 locations"). */
const BRANCHES = counted(`branches|филиал\\p{L}*|filial\\p{L}*`);
const OWN_LOCATIONS = new RegExp(
  `${START}(?:our|own|we (?:have|run|operate|own)|with)\\s+${COUNT}\\s+(?:own\\s+)?(?:locations|stores|restaurants|outlets)${END}|${START}${COUNT}\\s+(?:own|of our)\\s+(?:locations|stores|restaurants|outlets)${END}`,
  'giu'
);

/** The largest count the idea gives for any of these patterns (0 when none). */
function largestCount(idea: string, ...patterns: RegExp[]): number {
  const counts = patterns.flatMap(pattern => Array.from(idea.matchAll(pattern), m => parseCount(m[1]) ?? 0));
  return Math.max(0, ...counts);
}

/** Enterprise scale named in the idea: staff, plants or own branches past BIG_IDEA_SCALE (countries only alongside one). */
export function scaleSignals(idea: string): string[] {
  const signals: string[] = [];
  const employees = largestCount(idea, EMPLOYEES, PERSON_COMPANY, ...PEOPLE_AT_WORK);
  if (employees >= BIG_IDEA_SCALE.employees) signals.push(`${employees} employees`);
  const plants = largestCount(idea, INDUSTRIAL_SITES);
  if (plants >= BIG_IDEA_SCALE.industrialSites) signals.push(`${plants} plants`);
  const branches = largestCount(idea, BRANCHES, OWN_LOCATIONS);
  if (branches >= BIG_IDEA_SCALE.branches) signals.push(`${branches} branches`);
  const countries = largestCount(idea, COUNTRIES);
  if (signals.length && countries >= BIG_IDEA_SCALE.countries) signals.push(`${countries} countries`);
  return signals;
}

/* ------------------------------------------------------------------ */
/* Verdict                                                             */
/* ------------------------------------------------------------------ */

/** Big idea or not, from the (scrubbed) idea text and the engine's numbers. */
export function assessBigIdea(idea: string, size: EngineSize): BigIdeaVerdict {
  const reasons: BigIdeaReason[] = [];
  const signals: string[] = [];

  const core = coreSystemSignal(idea);
  if (core && (!core.isGeneric || size.mvpHours.max >= BIG_IDEA_ERP_MIN_MVP_HOURS)) {
    reasons.push('core_system');
    signals.push(core.text);
  }

  const scale = scaleSignals(idea);
  if (scale.length && size.mvpHours.max >= BIG_IDEA_SCALE_MIN_MVP_HOURS) {
    reasons.push('enterprise_scale');
    signals.push(...scale);
  }

  const engine: string[] = [];
  if (size.mvpHours.max >= BIG_IDEA_ENGINE_HOURS.mvpHigh) engine.push(`mvp ${size.mvpHours.max} h`);
  if (size.fullHours && size.fullHours.max >= BIG_IDEA_ENGINE_HOURS.fullHigh) engine.push(`full vision ${size.fullHours.max} h`);
  if (engine.length) {
    reasons.push('engine_size');
    signals.push(...engine);
  }

  return { isBig: reasons.length > 0, reasons, signals };
}
