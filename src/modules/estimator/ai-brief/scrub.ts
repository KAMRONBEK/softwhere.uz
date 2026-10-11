import { MAX_IDEA_CHARS } from '@/modules/estimator/ai-brief/constants';

/**
 * Contact-detail scrubber for the AI brief. The idea text goes to a third-party
 * model, and the brief flow never asks for contact details — so anything that
 * looks like one is replaced by a neutral placeholder BEFORE the call:
 * emails, URLs (incl. bare domains and t.me links), @handles, phone numbers,
 * and self-introductions (uz/ru/en): "my name is X", "меня зовут X", and the
 * shorter "I'm Anna, …", "Hi, this is Mike", "Я — Анна", "Men — Jasur".
 *
 * Deliberately conservative about numbers: budgets ("100 000 000 so'm"),
 * user counts, dates and years are product facts the model needs, so a digit
 * run only counts as a phone when it is shaped like one.
 */

export type RedactionKind = 'email' | 'url' | 'handle' | 'phone' | 'name';

export interface ScrubResult {
  text: string;
  redactions: Record<RedactionKind, number>;
  /**
   * The words of every name that was replaced. Server memory only — never
   * sent to the model, logged or returned: the brief uses them to keep a
   * sample name that happens to match ("Мастер Анна" for Anna's salon) off
   * the page, so a coincidence can never read as a leak.
   */
  nameWords: string[];
}

const PLACEHOLDER: Record<RedactionKind, string> = {
  email: '[email]',
  url: '[link]',
  handle: '[handle]',
  phone: '[phone]',
  name: '[name]',
};

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;

const SCHEME_URL = /\b(?:https?:\/\/|www\.)[^\s<>"'«»]+/gi;
const TLDS =
  'com|net|org|uz|ru|io|app|dev|co|me|info|biz|kz|ai|xyz|shop|store|online|site|tech|us|uk|de|tj|kg|tm|az|tr|ae|pro|link|page|tv|club|ly|gg|to|so|sh|cc|eu|su|by|ua';
const BARE_DOMAIN = new RegExp(`\\b(?:[a-z0-9-]+\\.)+(?:${TLDS})\\b(?:/[^\\s<>"'«»]*)?`, 'gi');
/** Technology names that are shaped like domains but identify nobody. */
const TECH_NAMES = new Set(['asp.net', 'ado.net', 'socket.io']);

const HANDLE = /(^|[^\p{L}\p{N}_@])@([A-Za-z0-9_]{3,32})(?![A-Za-z0-9_])/gu;

const PHONE_CANDIDATE = /\+?\(?\d[\d\s().\-]{5,22}\d/g;
/** "100 000 000", "1,000,000", "5.000.000" — thousands-grouped money/counts. */
const THOUSANDS_GROUPED = /^\d{1,3}(?:[\s.,]\d{3})+$/;
const DATE_LIKE = /^(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/;
const YEAR_RANGE = /^\d{4}\s*[-–]\s*\d{4}$/;
/** 7-digit local landline written like a phone: 123-45-67 / 123 45 67. */
const LOCAL_LANDLINE = /^\d{3}[\s-]\d{2}[\s-]\d{2}$/;
/** A number followed by one of these is a quantity, not a phone. */
const QUANTITY_AFTER =
  /^\s*(?:%|\$|€|₽|usd|eur|dollar|so['‘’ʻ`]?m|сум|сўм|руб|rub|долл|mln|million|млн|ming|тыс|thousand|users?|foydalanuvchi|пользовател|kishi|человек|odam|ta\b|шт)/i;

/** Self-introductions in en/ru/uz: the phrase is kept, the name after it is replaced. */
const NAME_INTRO =
  /(?<![\p{L}])(my name is|my name's|i am called|меня зовут|зовут меня|моё имя|мое имя|с уважением,?|mening ismim|ismim|менинг исмим|исмим|hurmat bilan,?)(\s*[:—–-]?\s+)([\p{L}'’‘ʻ`-]+(?:\s+\p{Lu}[\p{L}'’‘ʻ`-]+)?)/giu;

/**
 * Short self-introductions. The name must be Capitalized and followed by a
 * clause break (",", ".", "—", end) or a typical continuation ("and", "from",
 * "founder", "из", "владелица"…), so "I am building an app" or "Я хочу" never
 * match. "this is" only counts after a greeting ("Hi, this is Mike") — alone
 * it usually introduces a product ("This is Airbnb, but for boats").
 */
const NAME_FOLLOW = String.raw`(?=\s*(?:[,.!;:—–-]|$)|\s+(?:and|from|here|founder|co-founder|owner|ceo|the|из|и|владел\p{L}*|основател\p{L}*|директор\p{L}*|va|dan)(?!\p{L}))`;
const PERSON = String.raw`(\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+)?)`;
const SHORT_INTROS: RegExp[] = [
  new RegExp(String.raw`(?<![\p{L}])(I['’]m|I am)(\s+)${PERSON}${NAME_FOLLOW}`, 'gu'),
  // No 'i' flag anywhere: with it, \p{Lu} would match lower case too.
  new RegExp(
    String.raw`(?<![\p{L}])((?:[Hh]i|[Hh]ello|[Hh]ey|[Dd]ear \p{L}+|[Gg]ood (?:morning|afternoon|evening))[,!]?\s+(?:[Tt]his is|[Ii]t['’]s))(\s+)${PERSON}${NAME_FOLLOW}`,
    'gu'
  ),
  new RegExp(String.raw`(?<![\p{L}])([Яя])(\s*[—–-]\s*|\s+)${PERSON}${NAME_FOLLOW}`, 'gu'),
  new RegExp(String.raw`(?<![\p{L}])([Mm]en)(\s*[—–-]\s*)${PERSON}${NAME_FOLLOW}`, 'gu'),
];
/** Capitalized words after "I'm"/"Я" that are not names. */
const NOT_A_NAME = new Set([
  'A',
  'An',
  'The',
  'Not',
  'Here',
  'Uzbek',
  'Russian',
  'American',
  'British',
  'Kazakh',
  'Muslim',
  'Founder',
  'Owner',
  'Ceo',
  'Cto',
  'Дизайнер',
  'Владелец',
  'Владелица',
  'Директор',
  'Основатель',
  'Предприниматель',
  'Узбек',
  'Русский',
]);

function emptyCounts(): Record<RedactionKind, number> {
  return { email: 0, url: 0, handle: 0, phone: 0, name: 0 };
}

/** Is this digit run (plus the text right after it) shaped like a phone number? */
export function looksLikePhone(candidate: string, after = ''): boolean {
  const trimmed = candidate.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  if (trimmed.startsWith('+')) return digits.length >= 9;
  if (THOUSANDS_GROUPED.test(trimmed) || DATE_LIKE.test(trimmed) || YEAR_RANGE.test(trimmed)) return false;
  if (QUANTITY_AFTER.test(after)) return false;
  if (digits.length >= 9) return true;
  return LOCAL_LANDLINE.test(trimmed);
}

/** Strip control/bidi characters and collapse whitespace (keeps single line breaks). */
export function normalizeIdea(raw: string): string {
  return raw
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f‎‏‪-‮⁦-⁩]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Normalize and cap the idea; cuts at a word boundary when over the limit. */
export function prepareIdea(raw: string, max = MAX_IDEA_CHARS): { text: string; truncated: boolean } {
  const text = normalizeIdea(raw);
  if (text.length <= max) return { text, truncated: false };
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return { text: (lastSpace > max * 0.8 ? cut.slice(0, lastSpace) : cut).trim(), truncated: true };
}

/** Keep sentence punctuation that a greedy URL match swallowed. */
function splitTrailingPunctuation(match: string): [string, string] {
  const m = match.match(/[.,!?;:)\]]+$/);
  return m ? [match.slice(0, -m[0].length), m[0]] : [match, ''];
}

export function scrubContactDetails(input: string): ScrubResult {
  const counts = emptyCounts();
  let text = input;

  text = text.replace(EMAIL, () => {
    counts.email++;
    return PLACEHOLDER.email;
  });

  const replaceUrl = (match: string) => {
    const [url, tail] = splitTrailingPunctuation(match);
    if (!url || TECH_NAMES.has(url.toLowerCase())) return match;
    counts.url++;
    return PLACEHOLDER.url + tail;
  };
  text = text.replace(SCHEME_URL, replaceUrl);
  text = text.replace(BARE_DOMAIN, replaceUrl);

  text = text.replace(HANDLE, (_m, lead: string) => {
    counts.handle++;
    return `${lead}${PLACEHOLDER.handle}`;
  });

  text = text.replace(PHONE_CANDIDATE, (match: string, offset: number, whole: string) => {
    const after = whole.slice(offset + match.length, offset + match.length + 16);
    if (!looksLikePhone(match, after)) return match;
    counts.phone++;
    return PLACEHOLDER.phone;
  });

  const names: string[] = [];
  text = text.replace(NAME_INTRO, (_m, phrase: string, sep: string, name: string) => {
    counts.name++;
    names.push(name);
    return `${phrase}${sep}${PLACEHOLDER.name}`;
  });

  for (const intro of SHORT_INTROS) {
    text = text.replace(intro, (match: string, phrase: string, sep: string, name: string) => {
      if (NOT_A_NAME.has(name.split(/\s+/)[0])) return match;
      counts.name++;
      names.push(name);
      return `${phrase}${sep}${PLACEHOLDER.name}`;
    });
  }

  const nameWords = Array.from(new Set(names.flatMap(n => n.split(/[\s-]+/)).filter(w => w.length >= 3)));
  return { text, redactions: counts, nameWords };
}

export function totalRedactions(r: Record<RedactionKind, number>): number {
  return r.email + r.url + r.handle + r.phone + r.name;
}
