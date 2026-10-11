import { FEATURES, INTEGRATIONS } from '@/modules/estimator/data/catalog';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { brandName, featureLabel } from '@/modules/estimator/ai-brief/labels';

/**
 * Cosmetic repairs for model text a visitor will read. None of these change
 * meaning; they remove artifacts the audit found in real outputs:
 *  - raw catalog ids ("Чек через soliq_ofd", "eskiz_sms orqali") → brand or label;
 *  - scrubber placeholders and template slots ("Компания [name]", "[Провайдер]");
 *  - words mixing Latin and Cyrillic look-alike letters ("egа" with a Cyrillic а);
 *  - Uzbek apostrophe variants (o‘ / oʻ / o’) → the plain o' the site's own
 *    Uzbek copy uses, so one brief never mixes two spellings.
 */

const SNAKE_IDS = [...FEATURES.map(f => f.id), ...INTEGRATIONS.map(i => i.id)].filter(id => id.includes('_'));

/**
 * Single-word integration ids that only look wrong in lower case ("payme",
 * "myid", "onec"). Matched case-sensitively so "Payme" is left alone. Ids that
 * are also ordinary words are excluded: `nasiya` (an Uzbek word), `sheets`, and
 * `click` on English pages.
 */
const LOWERCASE_BRAND_IDS = INTEGRATIONS.map(i => i.id).filter(id => !id.includes('_') && !['nasiya', 'sheets', 'click'].includes(id));

const BOUNDARY_BEFORE = '(?<![\\p{L}\\p{N}_])';
const BOUNDARY_AFTER = '(?![\\p{L}\\p{N}_])';
const SNAKE_RE = new RegExp(`${BOUNDARY_BEFORE}(${SNAKE_IDS.join('|')})${BOUNDARY_AFTER}`, 'giu');
const LOWER_BRAND_RE = new RegExp(`${BOUNDARY_BEFORE}(${LOWERCASE_BRAND_IDS.join('|')})${BOUNDARY_AFTER}`, 'gu');
const LOWER_CLICK_RE = new RegExp(`${BOUNDARY_BEFORE}click${BOUNDARY_AFTER}`, 'gu');

export function humanizeIds(text: string, locale: BriefLocale): string {
  if (!text) return text;
  const name = (id: string) => brandName(id, locale) ?? featureLabel(id, locale);
  let out = text.replace(SNAKE_RE, (_m, id: string) => name(id.toLowerCase()));
  out = out.replace(LOWER_BRAND_RE, (_m, id: string) => name(id));
  if (locale !== 'en') out = out.replace(LOWER_CLICK_RE, 'Click');
  return out;
}

/** "[name]", "[phone]", "[Провайдер]" … — never meaningful in a visitor-facing string. */
const BRACKET_SLOT = /\s*\[[^\]\n]{1,40}\]/g;

export function stripPlaceholders(text: string): string {
  if (!text || !text.includes('[')) return text;
  return text
    .replace(BRACKET_SLOT, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s|,;:–—-]+|[\s|,;:–—-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* Look-alike letters, Cyrillic ↔ Latin. */
const CYR_TO_LAT: Record<string, string> = {
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  і: 'i',
  ј: 'j',
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  У: 'Y',
  І: 'I',
};
const LAT_TO_CYR: Record<string, string> = Object.fromEntries(
  Object.entries(CYR_TO_LAT)
    .filter(([cyr]) => !['і', 'ј', 'І', 'У'].includes(cyr))
    .map(([cyr, lat]) => [lat, cyr])
);

const LATIN = /\p{Script=Latin}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;

/** Latin → Russian Cyrillic by sound, for a Russian word whose tail drifted into Latin ("Ташkentу"). */
const LAT_TO_RU: Record<string, string> = {
  a: 'а',
  b: 'б',
  c: 'к',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'х',
  i: 'и',
  j: 'ж',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'к',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  w: 'в',
  x: 'х',
  y: 'й',
  z: 'з',
};
/** Uzbek Cyrillic → Latin, for an Uzbek word with a stray Cyrillic letter ("Toshkeнt"). */
const CYR_TO_UZ: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'x',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  ъ: "'",
  ь: '',
  ы: 'i',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ў: "o'",
  қ: 'q',
  ғ: "g'",
  ҳ: 'h',
};

function caseLike(source: string, target: string): string {
  return source !== source.toLowerCase() ? target.charAt(0).toUpperCase() + target.slice(1) : target;
}

/**
 * Repair words that mix scripts. A word whose letters are mostly Latin gets
 * its Cyrillic look-alikes swapped to Latin (and vice versa); ties follow the
 * page script. When a minority letter has no look-alike, a word that starts
 * in the page's script is transliterated into it by sound ("Ташkentу" →
 * "Ташкенту" on a Russian page — round 2 shipped it in a summary); anything
 * else is left untouched as a real mixed token.
 */
export function fixMixedScript(text: string, locale: BriefLocale): string {
  if (!text || !CYRILLIC.test(text) || !LATIN.test(text)) return text;
  return text.replace(/\p{L}+/gu, word => {
    const letters = Array.from(word);
    const latin = letters.filter(ch => LATIN.test(ch)).length;
    const cyrillic = letters.filter(ch => CYRILLIC.test(ch)).length;
    if (latin === 0 || cyrillic === 0) return word;
    const toLatin = latin > cyrillic || (latin === cyrillic && locale !== 'ru');
    const map = toLatin ? CYR_TO_LAT : LAT_TO_CYR;
    const minority = toLatin ? CYRILLIC : LATIN;
    if (letters.every(ch => !minority.test(ch) || map[ch])) return letters.map(ch => (minority.test(ch) ? map[ch] : ch)).join('');
    if (locale === 'ru' && CYRILLIC.test(letters[0]))
      return letters.map(ch => (LATIN.test(ch) ? caseLike(ch, LAT_TO_RU[ch.toLowerCase()] ?? ch) : ch)).join('');
    if (locale !== 'ru' && LATIN.test(letters[0]))
      return letters.map(ch => (CYRILLIC.test(ch) ? caseLike(ch, CYR_TO_UZ[ch.toLowerCase()] ?? ch) : ch)).join('');
    return word;
  });
}

/** Apostrophe variants inside an Uzbek word ("o‘zbek", "maʼlumot") → the plain "'" of `messages/uz.json`. */
export function normalizeUzApostrophes(text: string): string {
  return text.replace(/(?<=\p{L})[‘’ʻʼ`´](?=\p{L})/gu, "'");
}

/** Uzbek word swaps: the wrong spelling → the right one (the first letter's case is kept). */
const UZ_WORDS: [string, string][] = [
  ['platya', "ko'ylak"],
  ['padez', 'podyezd'],
  ['podezd', 'podyezd'],
  ['chappon', 'chopon'],
  ['klasik', 'klassik'],
  ['tajwid', 'tajvid'],
  ['bildirishlari', 'bildirishnomalari'],
  ['bildirishlar', 'bildirishnomalar'],
  ['yozilma', 'yozilish'],
  ['aktivlashtirish', 'faollashtirish'],
  // Round-2 iteration-1 native audit: misspellings no context makes right.
  ['nomalum', "noma'lum"],
  ['darhal', 'darhol'],
  ['chinndan', 'chindan'],
  ['bodiring', 'bodring'],
  ["o'sirish", "o'stirish"],
  ['egarlar', 'egalar'],
  ['egarlari', 'egalari'],
  ['egarlarni', 'egalarni'],
  ['egarlarga', 'egalarga'],
  // Round-2 iteration-2 native audit (no Uzbek reading makes these right).
  ['yetmab', 'yetmay'],
  ['achichuk', 'achchiq-chuchuk'],
  ['rejalangan', 'rejalashtirilgan'],
  ['promo-kod', 'promokod'],
  ['promo-kodlar', 'promokodlar'],
  ['promo-kodlari', 'promokodlari'],
  ['promo-kodni', 'promokodni'],
  ['yumurta', 'tuxum'],
  ['yumurtalar', 'tuxumlar'],
  // Russian genitive months in an Uzbek table header ("Marta | Aprela"). Not
  // "marta": it is the Uzbek for "times" ("ikki marta").
  ['yanvarya', 'yanvar'],
  ['fevralya', 'fevral'],
  ['aprela', 'aprel'],
  ['aprelya', 'aprel'],
  ['iyunya', 'iyun'],
  ['iyulya', 'iyul'],
  ['avgusta', 'avgust'],
  ['sentyabrya', 'sentyabr'],
  ['oktyabrya', 'oktyabr'],
  ['noyabrya', 'noyabr'],
  ['dekabrya', 'dekabr'],
  // Round-2 native audits, all iterations (2026-10-10 glossary pass): misspellings and
  // non-words with exactly one reading.
  ['marketring', 'marketing'],
  ['keralimi', 'kerakmi'],
  ['kiredimi', 'kiradimi'],
  ['kiraadimi', 'kiradimi'],
  ['orqilimi', 'orqalimi'],
  ["ko'rilmassa", "ko'rilmasa"],
  ['uchrashitrib', 'uchrashtirib'],
  ['darhaql', 'darhol'],
  ['bahoyingiz', 'bahoingiz'],
  ['bolanining', 'bolaning'],
  ['notabiiy', "tabiiy bo'lmagan"],
  ['yetarlimasligi', 'yetarli emasligi'],
  ['rejalash', 'rejalashtirish'],
  ['rejalashmagan', 'rejalashtirilmagan'],
  ['filiallingiz', 'filialingiz'],
  ['filiallik', 'filialli'],
  ["qo'ng'irog'ilari", "qo'ng'iroqlari"],
  ["qo'ng'irog'ilariga", "qo'ng'iroqlariga"],
  ['tilari', 'tillari'],
  ['pechanye', 'pechene'],
  ['navruz', "navro'z"],
  ['bahar', 'bahor'],
  ["bulg'or", 'bolgar'],
  ['yunusobad', 'yunusobod'],
  ['siab', 'siyob'],
  ["o'taydi", "o'tadi"],
  ['yozilingiz', 'yozilishingiz'],
  ['eganing', 'egasining'],
];
const UZ_WORD_RE = new RegExp(`(?<![\\p{L}\\p{N}'])(${UZ_WORDS.map(([w]) => w).join('|')})(?![\\p{L}\\p{N}'])`, 'giu');
const UZ_WORD_MAP = new Map(UZ_WORDS);

/**
 * Word stems that are always wrong in business Uzbek, with any suffix kept:
 * "Xisobotlar" → "Hisobotlar", "Tashkentda" → "Toshkentda", "malumotlar" →
 * "ma'lumotlar"; Russian warehouse jargon → the Uzbek term ("prixod/rasxod",
 * "otchet", "zakaz", "skidka", "sklad"). A stem ending in a vowel takes "s"
 * before a possessive "i" (zakazi → buyurtmasi), and "qoldiq" softens before a
 * vowel (qoldig'i).
 */
const UZ_STEMS: [string, string][] = [
  ['xisob', 'hisob'],
  ['malumot', "ma'lumot"],
  ['tashkent', 'toshkent'],
  ['prixod', 'kirim'],
  ['rasxod', 'chiqim'],
  ['otchet', 'hisobot'],
  ['zakaz', 'buyurtma'],
  ['skidka', 'chegirma'],
  ['sklad', 'ombor'],
  ['ostatka', 'qoldiq'],
  ['status', 'holat'],
  ['tartob', 'tartib'],
  ['organnar', 'organlar'],
  ['fiscal', 'fiskal'],
  ['kartochka', 'karta'],
  // The o'/g' apostrophe dropped where a colloquial idea dropped it ("Yolovchi", "Kocha va uy").
  ['yolovchi', "yo'lovchi"],
  ['kocha', "ko'cha"],
  ['qoyliq', "qo'yliq"],
  ['tolov', "to'lov"],
  ['qoshimcha', "qo'shimcha"],
  ['togri', "to'g'ri"],
  // Round-2 native audits (glossary pass): loans and misspelled stems with one reading.
  ['kontrakt', 'shartnoma'],
  ['murakkaylash', 'murakkablash'],
  ['dispecher', 'dispetcher'],
  ['aktual', 'dolzarb'],
  ['kariyes', 'karies'],
  ['passport', 'pasport'],
  ['tsikl', 'sikl'],
  ['moshina', 'mashina'],
  ['kastyum', 'kostyum'],
  ['koeffitsiyent', 'koeffitsient'],
  ['magazin', "do'kon"],
  ['monetizatsiya', 'daromad olish'],
];
/** Misspelled stems: wrong with any continuation ("xisobot", "xisob-kitob", "Tashkentlik", "tartobini"). */
const ANY_SUFFIX_STEMS = new Set([
  'xisob',
  'malumot',
  'tashkent',
  'tartob',
  'organnar',
  'fiscal',
  'yolovchi',
  'kocha',
  'qoyliq',
  'tolov',
  'qoshimcha',
  'togri',
  'murakkaylash',
  'dispecher',
  'aktual',
  'kariyes',
  'passport',
  'tsikl',
  'moshina',
  'kastyum',
  'koeffitsiyent',
]);
const UZ_STEM_RE = new RegExp(`(?<![\\p{L}\\p{N}'])(${UZ_STEMS.map(([w]) => w).join('|')})(\\p{L}*)`, 'giu');
const UZ_STEM_MAP = new Map(UZ_STEMS);
/** Suffixes a replaced loan may carry (anything else — "skladnoy", "zakazchik" — is a different word and stays). */
const LOAN_SUFFIX =
  /^(?:|lar|larni|lari|larga|larda|lardan|larning|larini|i|ini|iga|ida|idan|ining|si|sini|siga|sida|ni|ga|da|dan|ning|dagi|siz|li|chi|lar|ingiz|ingizni|ingizga|ingizda|ingizdan|imiz|ngiz|ngizni|ngizga|ngizda)$/u;
const VOWEL_END = /[aeiou]$/u;

/** A word written in capitals ("BAHAR", "SKIDKA"): a promo code or a label, and its fix stays in capitals. */
const isAllCaps = (word: string) => word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();

/** The fix in the source word's case: capitals stay capitals, a capital first letter stays capital. */
function inCaseOf(source: string, fixed: string): string {
  if (isAllCaps(source)) return fixed.toUpperCase();
  return source[0] === source[0].toUpperCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
}

function replaceStem(stem: string, suffix: string): string | null {
  const key = stem.toLowerCase();
  const fixed = UZ_STEM_MAP.get(key);
  if (!fixed) return null;
  // Capitals stay capitals ("XISOBOT" → "HISOBOT"); otherwise the stem keeps its first letter's case.
  const withCase = (stemOut: string, rest: string) =>
    isAllCaps(stem + suffix) ? (stemOut + rest).toUpperCase() : inCaseOf(stem, stemOut) + rest;
  if (ANY_SUFFIX_STEMS.has(key)) return withCase(fixed, suffix);
  if (!LOAN_SUFFIX.test(suffix.toLowerCase())) return null;
  // Possessive after the new stem: a vowel takes "s" (zakazi → buyurtmasi), a consonant drops it
  // (ostatkasi → qoldig'i) and a final q softens before the vowel.
  let rest = suffix;
  // "your" after the new stem: a vowel takes -ngiz/-miz (magaziningiz → do'koningiz, zakazingiz → buyurtmangiz).
  if (/^i(?:ngiz|miz)/iu.test(rest) && VOWEL_END.test(fixed)) rest = rest.slice(1);
  else if (/^n?giz|^miz/iu.test(rest) && !VOWEL_END.test(fixed)) rest = `i${rest}`;
  else if (/^si/iu.test(rest) && !VOWEL_END.test(fixed)) rest = rest.slice(1);
  else if (/^i/iu.test(rest) && VOWEL_END.test(fixed)) rest = `s${rest}`;
  const out = /^i/iu.test(rest) && fixed.endsWith('q') ? `${fixed.slice(0, -1)}g'` : fixed;
  return withCase(out, rest);
}

/** Calques the native audit found in most briefs, as fixed phrases ("ma'noga ega bo'ladi" — 14 of 40). */
/** A replacement string or function, as `String.prototype.replace` takes it. */
type Replacement = string | ((substring: string, ...groups: string[]) => string);

const UZ_PHRASES: [RegExp, Replacement][] = [
  // "Becomes useful", not "pays off": round 2 iteration 2 turned "baholar keyin
  // ma'noga ega bo'ladi" into "baholar keyin o'zini oqlaydi".
  [/ma'noga ega bo'lmaydi/giu, 'foyda bermaydi'],
  [/ma'noga ega bo'ladi/giu, "foydali bo'ladi"],
  [/ma'no kasb etadi/giu, "foydali bo'ladi"],
  [/ma'nosi bo'ladi/giu, "foydali bo'ladi"],
  [/ma'noga ega(?=\s*[.,;!?)]|\s*$)/giu, "foydali bo'ladi"],
  // A calque of "priced": "o'sish bosqichida narxlangan" → "o'sish bosqichida narxga kiritilgan".
  [/(?<![\p{L}'])narxlanmagan/gu, 'narxga kiritilmagan'],
  [/(?<![\p{L}'])narxlangan/gu, 'narxga kiritilgan'],
  [/(?<![\p{L}'])Narxlangan/gu, 'Narxga kiritilgan'],
  [/(?<![\p{L}'])(a|A)vtomat (eslatma|xabar|bildirishnoma)/gu, '$1vtomatik $2'],
  [/(?<![\p{L}'])zima(ngiz|miz|si)/gu, 'zimma$1'],
  // "Smeta" for our estimate ("bu smetaga kirmaydi"): only in that phrase — a construction "smeta" is a real document.
  [/(?<![\p{L}'])(?:smeta|baholash)(ga|da)(?=\s+(?:kir|kiritil))/giu, 'narx$1'],
  // No Uzbek word has three equal consonants in a row ("balllar" for ballar).
  [/([bdfghjklmnpqrstvxz])\1\1/giu, '$1$1'],
  [/(?<![\p{L}'])erkin (o'rin|vaqt)/gu, "bo'sh $1"],
  [/(?<![\p{L}'])Erkin (o'rin|vaqt)/gu, "Bo'sh $1"],
  [/pechat qilin/gu, 'chop etil'],
  [/pechat qil/gu, 'chop et'],
  [/Pechat qilin/gu, 'Chop etil'],
  [/Pechat qil/gu, 'Chop et'],
  // Round-2 native audits (glossary pass, 2026-10-10): calques and wrong forms with one reading.
  [/(?<![\p{L}'])qabul qilinasizmi/giu, 'qabul qilasizmi'],
  [/(?<![\p{L}'])(i|I)shchi (CRM|versiya|prototip|tizim|ilova|bot|sayt|nusxa|variant)/gu, '$1shlaydigan $2'],
  [/(?<![\p{L}'])savdogar shartnoma/gu, 'merchant shartnoma'],
  [/(?<![\p{L}'])Savdogar shartnoma/gu, 'Merchant shartnoma'],
  [/(?<![\p{L}'])growth[- ]bosqich/giu, "o'sish bosqich"],
  [/(?<![\p{L}'])web[- ]versiya/gu, 'veb-versiya'],
  [/(?<![\p{L}'])Web[- ]versiya/gu, 'Veb-versiya'],
  [/(?<![\p{L}'])jonli vaqt rejim/gu, 'real vaqt rejim'],
  [/(?<![\p{L}'])Jonli vaqt rejim/gu, 'Real vaqt rejim'],
  [/(?<![\p{L}'])Kuting,? iltimos/gu, 'Iltimos, kuting'],
  [/(?<![\p{L}'])deb oldik(?![\p{L}'])/gu, 'deb hisobladik'],
  [/(?<![\p{L}'])(a|A)ksi holda/gu, '$1ks holda'],
  [/(?<![\p{L}'])Greek salat/gu, 'Grek salat'],
  [/(?<![\p{L}'])(k|K)unjara yog'/gu, "$1unjut yog'"],
  [/(?<![\p{L}'])(o|O)'rgatish o'tkaz/gu, "$1'quv o'tkaz"],
  [/(?<![\p{L}'])top usta/gu, 'tajribali usta'],
  [/(?<![\p{L}'])(i|I)lk yordam/gu, (_m: string, i: string) => `${i === 'I' ? 'B' : 'b'}irinchi yordam`],
  [/(?<![\p{L}'])(s|S)ender nom/gu, (_m: string, s: string) => `${s === 'S' ? 'J' : 'j'}o'natuvchi nom`],
  [/qo'ng'iroq bilan tasdiqla/gu, "qo'ng'iroq qilib tasdiqla"],
  [/(?<![\p{L}'])API kalit(?![\p{L}'])/gu, 'API kaliti'],
  [/Mirzo-Ulug'bek/gu, "Mirzo Ulug'bek"],
  [/(?<![\p{L}'])narx bilan taklif ber/gu, 'narx taklif qil'],
  [/(?<![\p{L}'])iOS va Android ilova(?![\p{L}'])/gu, 'iOS va Android ilovasi'],
  [
    /(?<![\p{L}'])(q|Q)ancha (mahsulot|taom|filial|xodim|kuryer|haydovchi|foydalanuvchi|buyurtma|o'quvchi|usta|ombor)(?![\p{L}'])/gu,
    (_m: string, q: string, noun: string) => `${q === 'Q' ? 'N' : 'n'}echta ${noun}`,
  ],
  [/(?<![\p{L}'])Yandex Go ga(?![\p{L}'])/gu, "Yandex Go'ga"],
  [/(?<![\p{L}'])Telegram yozishmalar(?![\p{L}'])/gu, 'Telegram yozishmalari'],
  [/(?<![\p{L}'])qishloq xo'jalik mahsulot/gu, "qishloq xo'jaligi mahsulot"],
  [/(?<![\p{L}'])telefon raqamlar(?![\p{L}'])/gu, 'telefon raqamlari'],
  [/(?<![\p{L}'])(T|t)elefon raqam tasdiqla/gu, '$1elefon raqamini tasdiqla'],
  [/(?<![\p{L}'])taxmin hisobi(ga|da)/gu, 'narx hisob-kitobi$1'],
  [/(?<![\p{L}'])(j|J)onli bitim/gu, (_m: string, j: string) => `${j === 'J' ? 'F' : 'f'}aol bitim`],
  // "test ulanish qilamiz" → "sinov tariqasida ulaymiz" (the noun alone gave "sinov ulanishi qilamiz").
  [
    /(?<![\p{L}'])(t|T)est ulanish qil(\p{L}*)/gu,
    (_m: string, t: string, verb: string) => `${t === 'T' ? 'S' : 's'}inov tariqasida ula${qilToUla(verb)}`,
  ],
  [/(?<![\p{L}'])test ulanish(?![\p{L}'])/gu, 'sinov ulanishi'],
  [/(?<![\p{L}'])(k|K)ritik holat/gu, (_m: string, k: string) => `${k === 'K' ? 'F' : 'f'}avqulodda holat`],
  [/(?<![\p{L}'])(?<!App )store tekshiruv/gu, 'App Store va Google Play tekshiruv'],
  [/(?<![\p{L}'])admin tomonidan boshqar/gu, 'admin qismi orqali boshqar'],
  // "X bugun: 24" in a stats tile → "Bugungi x: 24".
  [/(?<![\p{L}'])(\p{Lu}\p{Ll}+) bugun(?=:)/gu, (_m: string, word: string) => `Bugungi ${word.toLowerCase()}`],
  // A definite object takes -ni: "CRM ishga tushirish" → "CRMni ishga tushirish", "boti ishga tushirish" → "botini".
  [
    /(?<![\p{L}'])(CRM|ERP|[Ss]ayt|[Bb]oti?|[Ii]lova(?:si)?|[Tt]izimi?|[Pp]latforma(?:si)?|[Pp]ortali?) ishga tushirish/gu,
    '$1ni ishga tushirish',
  ],
  // "zahoti" alone is "darhol"; "shu zahoti" and "to'lagan zahoti" are right.
  [/(?<!(?:[Ss]hu|\p{L}gan)\s+)(?<![\p{L}'])zahoti(?![\p{L}'])/gu, 'darhol'],
  [/(?<![\p{L}'])Zahoti(?![\p{L}'])/gu, 'Darhol'],
  // "strijka" (a haircut) → "soch olish", its suffix carried over.
  [
    /(?<![\p{L}'])(s|S)trijka(sini|si|ni|ga|lari|lar)?(?![\p{L}'])/gu,
    (_m: string, s: string, suffix = '') => `${s === 'S' ? 'S' : 's'}och olish${STRIJKA_SUFFIX[suffix] ?? ''}`,
  ],
  // The reader's bot is not "ours": "bizning botimizdan tashqarida" → "botdan tashqarida".
  [
    /(?<![\p{L}'])(b|B)izning (bot|sayt)imiz(\p{L}*)/gu,
    (_m: string, b: string, noun: string, rest: string) => `${b === 'B' ? noun[0].toUpperCase() + noun.slice(1) : noun}${rest}`,
  ],
  [
    /(?<![\p{L}'])(b|B)izning (ilova|platforma)miz(\p{L}*)/gu,
    (_m: string, b: string, noun: string, rest: string) => `${b === 'B' ? noun[0].toUpperCase() + noun.slice(1) : noun}${rest}`,
  ],
  // "soliq rejasi" (a tax plan) → "soliq rejimi"; "kassa rejasi" → "kassa apparati".
  [
    /(?<![\p{L}'])(soliq|Soliq|kassa|Kassa) reja(ngizni|ngizga|ngizda|ngiz|sini|si|ni|ga)?(?![\p{L}'])/gu,
    (_m: string, what: string, suffix = '') => `${what} ${/^s/i.test(what) ? 'rejim' : 'apparat'}${REJA_SUFFIX[suffix] ?? ''}`,
  ],
];

/**
 * A verb ending moved from "qil-" (a consonant stem) to "ula-" (a vowel stem):
 * qilamiz → ulaymiz, qiladi → ulaydi, qilish → ulash, qilib → ulab, qilinadi
 * → ulanadi, qilgan → ulagan.
 */
function qilToUla(ending: string): string {
  if (ending.startsWith('a')) return `y${ending.slice(1)}`;
  if (ending.startsWith('i')) return ending.slice(1);
  return ending;
}

/** "strijka" + suffix → "soch olish" + the same case. */
const STRIJKA_SUFFIX: Record<string, string> = { '': '', si: 'i', sini: 'ini', ni: 'ni', ga: 'ga', lar: 'lar', lari: 'lari' };
/** "reja" + suffix → "rejim"/"apparat" (consonant stems) + the same case. */
const REJA_SUFFIX: Record<string, string> = {
  '': '',
  si: 'i',
  sini: 'ini',
  ni: 'ni',
  ga: 'ga',
  ngiz: 'ingiz',
  ngizni: 'ingizni',
  ngizga: 'ingizga',
  ngizda: 'ingizda',
};

/** At the start of the string or of a sentence (a replacement there is capitalized). */
function atSentenceStart(text: string, offset: number): boolean {
  return /(?:^|[.!?:]\s+|^\s*[-–—•]\s*)$/u.test(text.slice(0, offset));
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * English product jargon in an Uzbek sentence, replaced by the page's own
 * words (round-2 audits: "MVPda", "Discovery suhbatida", "Discovery da"):
 * MVP → birinchi versiya, a discovery call → tanishuv suhbati, the discovery
 * stage → tahlil bosqichi. Capitalized at the start of a sentence.
 */
function replaceJargon(text: string): string {
  return text
    .replace(
      /(?<![\p{L}\p{N}])MVP(da|dan|ga|ni|ning|dagi|gacha)?(?![\p{L}\p{N}])/gu,
      (_m, suffix: string | undefined, offset: number, all: string) => {
        const out = `birinchi versiya${suffix ?? ''}`;
        return atSentenceStart(all, offset) ? capitalize(out) : out;
      }
    )
    .replace(/(?<![\p{L}'])[Dd]iscovery[- ]?suhbat/gu, (_m, offset: number, all: string) =>
      atSentenceStart(all, offset) ? 'Tanishuv suhbat' : 'tanishuv suhbat'
    )
    .replace(/(?<![\p{L}'])[Dd]iscovery(?:\s+(?:davomida|bosqichida|da)|-?da)(?![\p{L}'])/gu, (_m, offset: number, all: string) =>
      atSentenceStart(all, offset) ? 'Tahlil bosqichida' : 'tahlil bosqichida'
    )
    .replace(DOUBLE_FIRST_VERSION_PAREN, '$1')
    .replace(DOUBLE_FIRST_VERSION, '$1$2');
}

/**
 * "Birinchi versiya — MVP" became "Birinchi versiya — birinchi versiya": the
 * label and its gloss now say the same thing, so one copy (and the separator
 * between them) goes — only when both carry the same ending, so a sentence
 * that uses the phrase twice keeps both. Also "birinchi versiya (birinchi versiya)".
 */
const DOUBLE_FIRST_VERSION_PAREN = /((?<![\p{L}'])[Bb]irinchi versiya\p{L}*)\s*\(\s*birinchi versiya\p{L}*\s*\)/giu;
const DOUBLE_FIRST_VERSION = /((?<![\p{L}'])[Bb]irinchi versiya)(\p{L}*)(?:\s*[—–:/,-]\s*|\s+)birinchi versiya\2(?![\p{L}'])/giu;

/** Possessive endings after "do'kon" (a consonant) → after "ilova" (a vowel): do'koni → ilovasi, do'koningiz → ilovangiz. */
function shopToAppEnding(ending: string): string {
  if (/^i(?:ngiz|miz)/iu.test(ending)) return ending.slice(1);
  if (/^i/iu.test(ending)) return `s${ending}`;
  return ending;
}

/**
 * "Magazin uchun mobil do'kon" turned into "Do'kon uchun mobil do'kon": the
 * shop is the business, the "mobile shop" is its app. When a string already
 * names the shop, a "mobil do'kon" in it is "mobil ilova" ("Do'kon uchun
 * mobil ilova"), so a brief never says "do'kon uchun … do'kon".
 */
function fixShopForShop(text: string): string {
  const mobileShop = /(?<![\p{L}'])([Mm]obil) do'kon(\p{L}*)/gu;
  const shops = text.match(/(?<![\p{L}'])do'kon/giu)?.length ?? 0;
  const mobileShops = text.match(mobileShop)?.length ?? 0;
  if (mobileShops === 0 || shops <= mobileShops) return text;
  return text.replace(mobileShop, (_m: string, mobil: string, ending: string) => `${mobil} ilova${shopToAppEnding(ending)}`);
}

/** Whole visible strings that are a clipped label ("Bosh" in a nav bar). */
const UZ_WHOLE_LABELS: ReadonlyMap<string, string> = new Map([['Bosh', 'Bosh sahifa']]);

/** Brand and product names a suffix attaches to directly: "Telegram ga" → "Telegramga". */
const SUFFIX_HOSTS = 'Google Play|Telegram|Instagram|Excel|Payme|Click|Google|Yandex|Android|iOS|WhatsApp|Facebook';
/** An abbreviation or a CamelCase brand ("1C", "API", "amoCRM") followed by a detached case suffix. */
const DETACHED_SUFFIX = new RegExp(
  `((?<![\\p{L}\\p{N}])(?:[\\p{L}\\p{N}]*\\p{Lu}[\\p{Lu}\\p{N}]+|\\d\\p{Lu}|${SUFFIX_HOSTS}))[\\s-](ga|da|dan|ni|ning|dagi|gacha|lar|larni)(?![\\p{L}\\p{N}'])`,
  'gu'
);
/** An apostrophe before a case suffix of a longer word ("mantiq'iga", "Telegram'da") — never the tutuq belgisi. */
const APOSTROPHE_SUFFIX =
  /(?<=(?<![\p{L}'])\p{L}{3,}[^oOgG'\s])'(?=(?:i|ga|da|dan|ni|ning|iga|ida|idan|ini|ining|dagi|lar|larni)(?![\p{L}\p{N}']))/gu;

/**
 * Uzbek fixes that are always right — recurring errors of the round-2 native
 * audits that no context can make correct (a Russian loan the prompt forbids, a
 * misspelling, a calque with one meaning, an apostrophe before a suffix, a
 * suffix written apart). Anything that needs context (wrong-but-real words such
 * as "yozuv" for a booking) is left to the copy-edit, which `uzGlossary.ts`
 * points at every such term.
 */
export function polishUzbek(text: string): string {
  if (!text) return text;
  let out = text
    // A suffix after an abbreviation takes no apostrophe: MVP'da → MVPda, API'ga → APIga.
    .replace(/(?<=(?<![\p{L}\p{N}])\p{Lu}{2,}\d?)'(?=(?:da|ga|ni|ning|dan|lar|larni|lari|dagi|gacha|siz|li|ka|ta)(?![\p{L}\p{N}]))/gu, '')
    .replace(APOSTROPHE_SUFFIX, '')
    .replace(DETACHED_SUFFIX, '$1$2')
    .replace(/(?<![\p{L}\p{N}])([Aa])dmin-panel/gu, '$1dmin panel')
    .replace(/(?<![\p{L}\p{N}])([Ww])eb-?sayt/gu, (_m, w: string) => `${w === 'W' ? 'V' : 'v'}eb-sayt`)
    .replace(/(?<![\p{L}\p{N}])Telegram-(?=bildirishnoma|xabar)/gu, 'Telegram ');
  for (const [re, to] of UZ_PHRASES) out = typeof to === 'string' ? out.replace(re, to) : out.replace(re, to);
  out = replaceJargon(out);
  out = out.replace(UZ_STEM_RE, (whole: string, stem: string, suffix: string) => replaceStem(stem, suffix) ?? whole);
  out = out.replace(UZ_WORD_RE, (word: string) => inCaseOf(word, UZ_WORD_MAP.get(word.toLowerCase()) ?? word));
  out = fixShopForShop(out);
  return UZ_WHOLE_LABELS.get(out.trim()) ?? out;
}

/**
 * Prompt vocabulary that reads as jargon to the reader ("Not in the priced
 * scope") → the page's own words. "Priced separately" claims a price that
 * exists nowhere (round-2 iteration 2: "Migration and EDI are priced
 * separately" next to a list that left them out): it means not in this estimate.
 */
const JARGON: [RegExp, string][] = [
  [/(?:the|this|our) priced scope/giu, 'this estimate'],
  [/(?<!\p{L})priced scope/giu, 'estimate'],
  [
    /\b(is|are) priced separately(?: and (?:is |are )?not (?:part of|in|included in) (?:this|the) estimate)?(?: from (?:the build|this estimate))?/giu,
    '$1 not in this estimate',
  ],
  [/\bcan be priced separately\b/giu, 'can be estimated separately'],
  [/\bpriced separately(?: from (?:the build|this estimate))?/giu, 'outside this estimate'],
  [/\bThe priced (?:build|work)\b/gu, 'This estimate'],
  [/\bthe priced (?:build|work)\b/gu, 'this estimate'],
  [/\b(T|t)he priced ((?:[a-z-]+ ){0,2})(work|integration|feature|module|evaluation|connection|sync)\b/gu, '$1he $2$3 in this estimate'],
];

/** Every cosmetic repair, in a safe order. */
export function cleanVisibleText(text: string, locale: BriefLocale): string {
  if (!text) return text;
  const plain = locale === 'en' ? JARGON.reduce((out, [re, to]) => out.replace(re, to), text) : text;
  const cleaned = fixMixedScript(stripPlaceholders(humanizeIds(plain, locale)), locale);
  return locale === 'uz' ? polishUzbek(normalizeUzApostrophes(cleaned)) : cleaned;
}
