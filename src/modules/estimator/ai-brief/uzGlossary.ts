/**
 * Uzbek glossary — the term-level errors the round-2 native Uzbek audits
 * quoted again and again (matrix, iterations 1–3: 676 distinct "wrong →
 * right" pairs over 200 audited briefs), as preferred terms.
 *
 * Two uses, both deterministic:
 *  - the copy-edit's system prompt lists every entry (`glossaryPromptBlock`),
 *    so the editor knows the reviewers' preferred words;
 *  - `glossaryChecks` flags each string that contains a listed term, and the
 *    copy-edit receives the flag next to that string ("check: yozuv → …"), so
 *    the model looks at exactly the spots a reviewer would have marked.
 *
 * A flagged term is not always wrong — "ovozli yozuv" is a voice recording,
 * "yozuv" for a booking is the error — so these terms are only checks for the
 * copy editor. Errors no context can make right are fixed outright in
 * `cleanText.ts` (`polishUzbek`), never here.
 */

export interface GlossaryEntry {
  /** Short id (tests, eval reports). */
  id: string;
  /** What the reviewers flagged, as shown to the copy editor. */
  wrong: string;
  /** The preferred wording. */
  right: string;
  /** Finds the term in a visible string (case-insensitive, Uzbek apostrophes normalized to '). */
  find: RegExp;
}

/** Not preceded by a letter or an apostrophe (so "o'z" never matches "z…"). */
const B = "(?<![\\p{L}'])";
/** Not followed by a letter or an apostrophe. */
const E = "(?![\\p{L}'])";
const re = (source: string) => new RegExp(source, 'iu');

export const UZ_GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: 'yozuv',
    wrong: 'yozuv (a booking: "O\'z yozuvlari", "Yozuvingiz qabul qilindi")',
    right: 'yozilish or bron — yozuv is only a written or voice record ("ovozli yozuv")',
    find: re(`${B}yozuv(?!chi)\\p{L}*`),
  },
  {
    id: 'qurish',
    wrong: 'quramiz / quriladi / qurmaymiz (software)',
    right: 'ishlab chiqamiz / ishlab chiqiladi / ishlab chiqmaymiz',
    find: re(`${B}(?:quramiz|quriladi|qurilad\\p{L}+|qurmaymiz|qurmaydigan|quriladigan)${E}`),
  },
  {
    id: 'yopish',
    wrong: 'yopadi / yopiladi for covering a need ("ishini yopadigan", "SMS bilan yopiladi")',
    right: 'hal qiladi / qamrab oladi / amalga oshiriladi (a deal that closes stays "yopiladi")',
    find: re(`${B}yop(?:adi|adigan|iladi|iladimi|ilgan)${E}`),
  },
  {
    id: 'ogriq',
    wrong: "og'riqli joy / og'riq (a pain point)",
    right: 'muammo, asosiy muammo',
    find: re(`og'riq(?:li)?\\s+(?:joy|nuqta|ish)\\p{L}*|og'rig'i\\p{L}*`),
  },
  {
    id: 'qiymat',
    wrong: 'qiymat for value ("asosiy qiymati", "birinchi qiymat")',
    right: 'foyda or mohiyat — qiymat is a number or a price',
    find: re(`${B}qiymat\\p{L}*`),
  },
  {
    id: 'surat',
    wrong: 'sur\'at for a photo ("kiyimlarning sur\'atlari")',
    right: "surat or fotosurat — sur'at is speed",
    find: re(`${B}sur'at\\p{L}*`),
  },
  {
    id: 'zahoti',
    wrong: 'zahoti on its own ("menejerlarga zahoti ko\'rinadi")',
    right: 'darhol ("shu zahoti" and "to\'lagan zahoti" are correct)',
    find: re(`(?<!(?:[Ss]hu|\\p{L}gan)\\s+)${B}zahoti${E}`),
  },
  {
    id: 'savdogar',
    wrong: 'savdogar, savdogar shartnomasi',
    right: 'tadbirkor; merchant shartnomasi (Payme/Click bilan shartnoma)',
    find: re(`${B}savdogar\\p{L}*`),
  },
  {
    id: 'pozitsiya',
    wrong: 'pozitsiya (a menu or catalog item)',
    right: 'taom, mahsulot or tovar turi',
    find: re(`${B}pozitsiya\\p{L}*`),
  },
  {
    id: 'soch-turmagi',
    wrong: 'soch turmagi / styling for a haircut',
    right: 'soch olish (soch turmaklash is styling)',
    find: re(`soch\\s+turmag\\p{L}*|${B}styling${E}`),
  },
  {
    id: 'band',
    wrong: 'bandlov, bandlar, bandingiz (a booking)',
    right: 'bron, bronlarim, broningiz',
    find: re(`${B}band(?:lov\\p{L}*|lar|larim|lari|ingiz|im)${E}`),
  },
  {
    id: 'reader-third-person',
    wrong: 'the reader in the third person ("Mijoz aytdi", "Tashrif buyuruvchi so\'radi")',
    right: "Siz aytdingiz / Siz so'ragansiz",
    find: re(`${B}(?:mijoz|tashrif buyuruvchi)\\s+(?:aytdi|so'radi|so'ragan|so'rashi bo'yicha)`),
  },
  {
    // A statement only: a question that asks who will enter the data ("…ni biz kiritamizmi?") is a real
    // question to the client, and flipping its subject contradicted the plan (round 3, the bakery brief).
    id: 'our-data-entry',
    wrong:
      'a promise that we keep entering or updating the reader\'s own data or content ("Dastlab menyuni biz yangilab turamiz") — a service no estimate includes',
    right:
      'the reader does it: "Dastlab menyuni siz admin panel orqali kiritasiz" (or "o\'zingiz yangilab turasiz" when there is no admin panel yet); never change who a question asks about ("…ni biz kiritamizmi?" stays)',
    find: re(
      `(?:ma'lumot|kontent|menyu|narx|e'lon)\\p{L}*\\s+(?:\\p{L}+\\s+)?(?:kiritamiz|to'ldiramiz|kiritib qo'yamiz|yangilab turamiz|yangilaymiz|joylaymiz)${E}`
    ),
  },
  {
    id: 'sikl',
    wrong: 'halqa, aylana, sikl for a workflow ("eng kichik ishlaydigan halqa")',
    right: 'jarayon ("eng kichik ishlaydigan jarayon")',
    find: re(`${B}(?:halqa|aylana|t?sikl)\\p{L}*`),
  },
  {
    id: 'store',
    wrong: '"store chiqarilishi", "do\'konlarga chiqarish" (the app stores)',
    right: 'App Store va Google Playga joylash',
    find: re(`${B}store\\s+(?:chiqar|tekshiruv)\\p{L}*|do'konlar(?:ga|da)\\s+(?:chiqar|joyla)\\p{L}*`),
  },
  {
    id: 'release',
    wrong: 'release, relizdan',
    right: 'ishga tushirish, chiqarish',
    find: re(`${B}(?:release|reliz)\\p{L}*`),
  },
  {
    id: 'our-estimate',
    wrong: 'smeta / baholash / taxmin for our estimate ("bu baholashga kirmagan")',
    right: 'narx, hisob-kitob ("bu narxga kirmaydi")',
    find: re(`${B}(?:smeta\\p{L}*|baholash(?:ga|da)|taxmin hisob\\p{L}*)`),
  },
  {
    id: 'multi-tenant',
    wrong: 'multi-tenant',
    right: 'har bir mijoz alohida ishlaydigan xizmat',
    find: re(`multi-?tenant`),
  },
  {
    id: 'ozi-plural',
    wrong: 'o\'zi after a plural subject ("fermerlar … o\'zi joylaydi")',
    right: "o'zlari",
    find: re(`\\p{L}+lar\\p{L}*\\s+(?:\\p{L}+\\s+){0,3}o'zi${E}`),
  },
  {
    id: 'izofa-object',
    wrong: 'a definite object without -ni ("Buyurtma tasdiqlash xabari", "Telefon raqam tasdiqlash")',
    right: 'Buyurtmani tasdiqlash xabari, Telefon raqamini tasdiqlash',
    find: re(`${B}(?:buyurtma|telefon raqam|to'lov|bron)\\s+(?:tasdiqlash|bekor qilish|qabul qilish)${E}`),
  },
  {
    id: 'desert',
    wrong: 'Desertlar, Cappuccino (menu Latin spellings)',
    right: 'Shirinliklar, Kapuchino',
    find: re(`${B}(?:desert\\p{L}*|cappuccino)`),
  },
  {
    id: 'kritik',
    wrong: 'kritik holatlar, dublikat yozilishlar',
    right: 'favqulodda holatlar; bir vaqtga ikki yozilish',
    find: re(`${B}(?:kritik|dublikat)\\p{L}*`),
  },
  {
    id: 'slot',
    wrong: 'slot, vaqt slotlari',
    right: "bo'sh vaqt, vaqt oralig'i",
    find: re(`${B}slot\\p{L}*`),
  },
  {
    id: 'sinxron',
    wrong: 'sinxroni, sinxron chastotasi, "1C sinxroni"',
    right: 'sinxronlash ("1C bilan sinxronlash")',
    find: re(`${B}sinxron(?:i|ni|\\s+chastota\\p{L}*)${E}`),
  },
  {
    id: 'monetizatsiya',
    wrong: 'monetizatsiya, birinchi pulni topasiz',
    right: 'daromad olish, birinchi daromadni olasiz',
    find: re(`${B}monetizatsiya\\p{L}*|pulni topasiz`),
  },
  {
    id: 'yuklama',
    wrong: 'yuklama (staff workload)',
    right: 'bandlik darajasi',
    find: re(`${B}yuklama\\p{L}*`),
  },
  {
    id: 'saralash',
    wrong: 'saralaydi for filtering',
    right: 'filtrlaydi (saralash is sorting)',
    find: re(`${B}saralay\\p{L}*`),
  },
  {
    id: 'qaytaruvchi',
    wrong: 'qaytaruvchi xaridorlar (repeat customers)',
    right: 'doimiy mijozlar, qayta xarid qiladigan mijozlar',
    find: re(`${B}qaytaruvchi\\p{L}*`),
  },
  {
    id: 'hisobingizga',
    wrong: 'hisobingizga for "registered in your name"',
    right: 'sizning nomingizga',
    find: re(`${B}hisobingizga\\s+ro'yxat`),
  },
  {
    id: 'siyosiy',
    wrong: 'siyosiy (a company rule or the policy)',
    right: 'qoida or siyosat (siyosiy is political)',
    find: re(`${B}siyosiy${E}`),
  },
  {
    id: 'maydon',
    wrong: 'onlayn maydon, veb-maydon',
    right: 'onlayn platforma',
    find: re(`(?:onlayn|veb-?)\\s*maydon\\p{L}*`),
  },
  {
    id: 'jonli',
    wrong: 'jonli bitimlar, jonli vaqt',
    right: 'faol bitimlar, real vaqt',
    find: re(`${B}jonli\\s+(?:bitim|vaqt)\\p{L}*`),
  },
  {
    id: 'sandbox',
    wrong: 'sandbox, test ulanish',
    right: 'sinov rejimi, sinov ulanishi',
    find: re(`${B}sandbox\\p{L}*|${B}test\\s+ulanish\\p{L}*`),
  },
  {
    id: 'avvalgi',
    wrong: 'avvalgi for initial ("avvalgi yo\'nalishlar")',
    right: 'dastlabki',
    find: re(`${B}avvalgi\\s+(?:yo'nalish|bosqich|versiya|filial)\\p{L}*`),
  },
  {
    id: 'top-usta',
    wrong: 'top usta, yumshoq odam (a review)',
    right: 'tajribali usta, xushmuomala usta',
    find: re(`${B}yumshoq\\s+odam`),
  },
];

/** Uzbek apostrophe variants → the plain ' the site uses (the strings are already normalized; the idea may not be). */
const plain = (text: string) => text.replace(/(?<=\p{L})[‘’ʻʼ`´](?=\p{L})/gu, "'");

/** The glossary entries a visible string contains (each once, in glossary order). */
export function glossaryChecks(text: string): GlossaryEntry[] {
  if (!text) return [];
  const normalized = plain(text);
  return UZ_GLOSSARY.filter(entry => entry.find.test(normalized));
}

/** One line per entry for the copy-edit's system prompt. */
export function glossaryPromptBlock(): string {
  return `GLOSSARY — errors our native Uzbek reviewers marked in earlier briefs, with the preferred wording:
${UZ_GLOSSARY.map(entry => `- ${entry.wrong} → ${entry.right}`).join('\n')}`;
}

/** The check a string carries to the copy editor: the flagged terms and their preferred wording. */
export function checkNote(entries: readonly GlossaryEntry[]): string {
  return entries.map(entry => `${entry.id}: ${entry.right}`).join('; ');
}
