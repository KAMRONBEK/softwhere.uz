/**
 * Prices and timelines in a brief come from the estimator engine only. The
 * prompt forbids the model from writing them, and this guard enforces it: any
 * sentence of model prose that states a money amount or a week/month duration
 * is dropped before the brief leaves the server, so an invented "$5,000" or
 * "3 months" can never sit next to the engine's numbers.
 *
 * The same pass drops invented statistics: a percentage the visitor did not
 * write ("removes 60-70% of routine requests") is a made-up number. A
 * percentage taken from the idea ("we take a 15% commission") is a fact and
 * stays.
 *
 * Days and hours are intentionally not matched — "a 14-day trial" or "24 hours
 * support" are product facts, not schedule claims.
 */

const MONEY =
  /(?:[$€£₽]\s?\d)|(?:\d[\d\s.,]*\s?(?:k|mln|million|млн|ming|тыс\.?|thousand)?\s?(?:\$|usd\b|dollars?|so['‘’ʻ`]?m\b|сум(?!\p{L})|сўм(?!\p{L})|руб|rub\b|₽|долл|eur\b|euro|€))/iu;

const SPELLED_DURATION =
  /\b(?:one|two|three|four|five|six|eight|ten|twelve|a few|a couple of|several)\s+(?:weeks?|months?)\b|(?<!\p{L})(?:одн[ауой]+|два|две|двух|три|тр[её]х|четыре|четыр[её]х|пять|пяти|шесть|шести|восемь|десять|нескольк\p{L}*)\s+(?:недел|месяц)|\b(?:bir|ikki|uch|to['‘’ʻ`]rt|besh|olti|sakkiz|o['‘’ʻ`]n|bir necha)\s+(?:hafta|oy)(?:da|ga|dan|lik|ni)?\b/iu;

const NUMERIC_DURATION =
  /\d+(?:\s?[-–—]\s?\d+)?\s?(?:weeks?\b|wks?\b|months?\b|недел|месяц|мес(?!\p{L})|hafta|oy\b|oyda\b|oylik\b|oyga\b)/iu;

/** "30%", "60-70 %", "15 процентов", "20 foiz". */
const PERCENT = /(\d+(?:[.,]\d+)?)(?:\s?[-–—]\s?(\d+(?:[.,]\d+)?))?\s?(?:%|процент|foiz)/giu;

export function mentionsPriceOrDuration(text: string): boolean {
  return MONEY.test(text) || NUMERIC_DURATION.test(text) || SPELLED_DURATION.test(text);
}

function percentNumbers(text: string): string[] {
  const numbers: string[] = [];
  for (const m of text.matchAll(PERCENT)) {
    numbers.push(m[1].replace(',', '.'));
    if (m[2]) numbers.push(m[2].replace(',', '.'));
  }
  return numbers;
}

/** A percentage in `text` that the visitor's own idea does not contain. */
export function mentionsUnsupportedPercent(text: string, idea = ''): boolean {
  const used = percentNumbers(text);
  if (used.length === 0) return false;
  const given = new Set(percentNumbers(idea));
  return used.some(n => !given.has(n));
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+|\n+/);
}

/** Drop every sentence that states a price or a duration. Returns the cleaned text and how many sentences went. */
export function stripPriceAndDurationClaims(text: string): { text: string; removed: number } {
  if (!text || !mentionsPriceOrDuration(text)) return { text, removed: 0 };
  const sentences = splitSentences(text);
  const kept = sentences.filter(sentence => !mentionsPriceOrDuration(sentence));
  return { text: kept.join(' ').trim(), removed: sentences.length - kept.length };
}

/** Drop every sentence with a price, a duration or a percentage the visitor did not give. */
export function stripUnsupportedClaims(text: string, idea = ''): { text: string; removed: number } {
  const offends = (s: string) => mentionsPriceOrDuration(s) || mentionsUnsupportedPercent(s, idea);
  if (!text || !offends(text)) return { text, removed: 0 };
  const sentences = splitSentences(text);
  const kept = sentences.filter(sentence => !offends(sentence));
  return { text: kept.join(' ').trim(), removed: sentences.length - kept.length };
}

/**
 * Sample wireframe copy must not state facts about the visitor's business or
 * effects of the product: no "since 2005", no "12 years on the market", no
 * "all doctors have 10+ years of experience", no invented percentages
 * ("conversion 8.3%", "returns +6.4%"). A wireframe text matching any of these
 * is dropped (the block keeps its shape). Allowed: a percentage the visitor
 * gave ("we take a 15% commission"), a discount in a sample promo ("−10% on 3
 * bottles") and plain sample dates ("12.03.2024").
 */
const CLIENT_CLAIM =
  /(?:since|founded|established|основан\p{L}*|с|©)\s*(?:19[5-9]\d|20[0-4]\d)(?!\d)|(?<!\d)(?:19[5-9]\d|20[0-4]\d)\s*-?\s*yildan|лет на рынке|лет опыта|сдано объектов|years? (?:in business|on the market|of experience)|projects? (?:completed|delivered)|yil(?:lik)? tajriba|tajribaga ega|yildan beri|yildan ortiq|loyiha(?:lar)? (?:bajarilgan|topshirilgan)/iu;

/** Discount wording: a percentage next to it is a sample offer, not a statistic. */
const DISCOUNT = /скидк|chegirma|discount|(?<!\p{L})off(?!\p{L})|aksiya|акци|promo|промо|кэшбэк|cashback|keshbek/iu;

export function isClaimLike(text: string, idea = ''): boolean {
  return CLIENT_CLAIM.test(text) || (!DISCOUNT.test(text) && mentionsUnsupportedPercent(text, idea));
}
