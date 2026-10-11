import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { mentionsPriceOrDuration } from '@/modules/estimator/ai-brief/textGuards';
import type { ProductRef } from '@/modules/estimator/ai-brief/types';

/**
 * Invented specifics and template leakage — deterministic checks every model
 * failed in the 2026-10-11 blind audits (Kimi K3 and DeepSeek alike). The
 * prompts forbid all of it; these checks catch what slips through, on the
 * request path (`guard.ts` drops the text) and in the eval (`consistency.ts`
 * scores it). They never rewrite and never touch a number or a price.
 *
 * Invented specifics (`inventedDetail`):
 *  - an English brief showing Uzbek places, personal names or so'm the idea
 *    never mentioned ("Chilonzor branch", "Dilnoza", "45 000 so'm");
 *  - branches (filial, филиал) when the idea describes one location;
 *  - a city the idea does not name — on uz/ru pages any city but Tashkent (the
 *    market default), and Tashkent's districts when the idea is set elsewhere.
 * Template leakage (`templateLeak`):
 *  - delivery and couriers in a product that has none (a taxi, a school);
 *  - App Store / Google Play risks on a product with no mobile app, and
 *    in-app-purchase or store-commission risks on physical goods or in-person
 *    services (the stores exempt them);
 *  - a "budget and timeline" risk or question when the idea names neither.
 */

export interface SpecificsContext {
  locale: BriefLocale;
  /** The idea as the model saw it (scrubbed). */
  idea: string;
  product?: ProductRef;
  /** Feature + integration ids priced anywhere (MVP or later). */
  refs?: readonly string[];
  /** Extra products (`type:subtype`), priced for the growth phase. */
  extraRefs?: readonly string[];
}

const A = "['‘’ʻʼ`]?";
/** Whole word, any inflection after the stem (Uzbek and Russian suffixes). */
const stem = (source: string) => new RegExp(`(?<![\\p{L}])(?:${source})`, 'iu');

/** Tashkent's districts and landmarks: a default the uz/ru prompts allow, invented on an English page. */
const TASHKENT_DISTRICTS = stem(
  [
    'chilonzor',
    'chilanzar',
    'чиланзар',
    'yunusobod',
    'yunusabad',
    'юнусабад',
    `mirzo[ -]?ulu${A}g${A}bek`,
    'мирзо[ -]?улугбек',
    'yakkasaroy',
    'yakkasaray',
    'яккасара',
    'shayxontohur',
    'shaykhantakhur',
    'шайхантахур',
    'sergeli',
    'сергел',
    'olmazor',
    'almazar',
    'алмазар',
    'mirobod',
    'mirabad',
    'мирабад',
    'uchtepa',
    'учтепа',
    'bektemir',
    'бектемир',
    'yashnobod',
    'yashnabad',
    'яшнабад',
    'yangihayot',
    'янгихаёт',
    'chorsu',
    'чорсу',
    'oloy bozori',
    'алайск',
  ].join('|')
);

const TASHKENT = stem(`toshkent|tashkent|ташкент|тошкент`);

/** Cities a brief must not add on its own: each entry is one city, every spelling. */
const CITIES: readonly RegExp[] = [
  stem('samarqand|samarkand|самарканд|самарқанд'),
  stem('buxoro|bukhara|buxara|бухар'),
  stem('namangan|наманган'),
  stem('andijon|andijan|андижан'),
  stem(`farg${A}ona|fergana|ferghana|фергана|фарғона`),
  stem(`qo${A}qon|kokand|коканд`),
  stem(`marg${A}ilon|margilan|маргилан`),
  stem('qarshi|karshi|карши'),
  stem('nukus|нукус'),
  stem('urganch|urgench|ургенч'),
  stem('xiva|khiva|хива'),
  stem('jizzax|jizzakh|джизак'),
  stem('termiz|termez|термез'),
  // Not the poet: "парк имени Навои", "Navoiy nomidagi".
  new RegExp(`(?<![\\p{L}])(?<!имени\\s)(?:navoiy|navoi|навои)(?!\\s+nomidagi)`, 'iu'),
  stem('guliston|gulistan|гулистан'),
  stem('chirchiq|chirchik|чирчик'),
  stem('olmaliq|almalyk|алмалык'),
  stem('almat[yi]|алмат'),
  stem('astana|астан'),
  stem('bishkek|бишкек'),
  stem('dushanbe|душанбе'),
  stem('moscow|moskva|москв'),
];

/** Common Uzbek given names: in an English brief they are invented sample people. */
const UZ_PERSON_NAMES = new RegExp(
  `(?<![\\p{L}])(?:${[
    'azizbek',
    'aziz',
    'bobur',
    'botir',
    'dilnoza',
    'dilshod',
    'feruza',
    'gulnora',
    'jasur',
    'javlon',
    'jamshid',
    'kamola',
    'laylo',
    'madina',
    'malika',
    'nilufar',
    'nodira',
    'otabek',
    'rustam',
    'sardor',
    'sevara',
    'shahzoda',
    'sherzod',
    'sitora',
    'sanjar',
    'umid',
    `ulu${A}g${A}bek`,
    'zarina',
    'akmal',
    'anvar',
    'farrux',
    'farrukh',
    'shoxrux',
    'shokhrukh',
    'nigora',
    'mohira',
    'dildora',
    'zilola',
  ].join('|')})(?![\\p{L}])`,
  'iu'
);

/** so'm / сум / UZS — the Uzbek currency on an English page. */
const UZ_CURRENCY = new RegExp(`(?<![\\p{L}])(?:so${A}m|сум|сўм|uzs)(?![\\p{L}])`, 'iu');

/** A branch of the business (filial, филиал, branch). */
const BRANCH = /(?<![\p{L}])(?:filial\p{L}*|филиал\p{L}*|branch(?:es)?)(?![\p{L}])/iu;
/** The idea has several locations (or names branches itself). */
const SEVERAL_LOCATIONS =
  /filial|филиал|branch|outlet|chain|network of|several (?:locations|stores|shops|cafes|restaurants|clinics|points)|multiple (?:locations|stores|shops|clinics)|locations|сеть|точк\p{L}* продаж|несколько (?:точек|магазинов|кафе|ресторанов|клиник|салонов)|tarmoq|bir nechta (?:do['‘’ʻ`]?kon|kafe|restoran|klinika|nuqta|joy)|nuqtalar|do['‘’ʻ`]?konlar(?:imiz)?/iu;

const QUESTION = /\?\s*$/u;
const NO_BRANCHES =
  /без (?:сети )?филиал|no (?:other )?branches|without branches|one (?:location|branch)|filiallarsiz|filialsiz|bitta (?:\p{L}+ )?filial|один филиал|одн\p{L}+ (?:салон|клуб|точк|филиал|магазин|кафе)|keyinroq|позже|later/iu;

/** The idea is set in Uzbekistan: Uzbek places, names and so'm are its own world, even on an English page. */
const UZ_SETTING = /uzbek|o['‘’ʻ`]?zbek|узбек|ўзбек|tashkent|toshkent|ташкент/iu;

/**
 * A company or brand name the model made up: "Willamette Candle Co.", "ООО
 * «СтройПро»", "Жилой комплекс «Ташкент Сити»", "Welcome to HandyLink", or
 * our own name on the client's screens. Kept when the idea has the name.
 */
const COMPANY_SUFFIX = /(\p{Lu}[\p{L}&'’.-]*(?:\s+\p{Lu}[\p{L}&'’.-]*){0,3})\s+(?:Co\.|LLC|Inc\.?|Ltd\.?|GmbH|MChJ)(?![\p{L}])/u;
const QUOTED_COMPANY =
  /(?:ООО|ЖК|комплекс|компани\p{L}*|магазин\p{L}*|бренд\p{L}*|MChJ|kompaniya\p{L}*|brend\p{L}*|do['‘’ʻ`]?kon\p{L}*|kafe|restoran|klinika)\s*[«"“]([^»"”]{2,40})[»"”]/iu;
const WELCOME_TO = /(?:[Ww]elcome to|[Дд]обро пожаловать в)\s+(\p{Lu}[\p{L}]+(?:\s+\p{Lu}[\p{L}]+)?)/u;
const OWN_NAME = /softwhere/iu;

function inventedBrand(text: string, idea: string, prose: boolean): string | null {
  // In prose SoftWhere is who builds it ("SoftWhere prepares the store listing"); on a screen it is the client's product.
  if (!prose && OWN_NAME.test(text) && !OWN_NAME.test(idea)) return 'our own name on the product';
  for (const re of [COMPANY_SUFFIX, QUOTED_COMPANY, WELCOME_TO]) {
    const name = text.match(re)?.[1]?.trim();
    if (name && !idea.toLowerCase().includes(name.toLowerCase())) return `a company or brand name the idea does not give ("${name}")`;
  }
  return null;
}

/**
 * Why sample copy or a sentence holds a detail the idea never gave (null: it
 * does not). `prose`: a summary, plan or risk sentence — there, unlike in the
 * wireframes' sample data, Tashkent itself is invented when the idea names no
 * city (the uz/ru wireframes may use it as the market default).
 */
export function inventedDetail(text: string, ctx: SpecificsContext, prose = false): string | null {
  if (!text) return null;
  const { locale, idea } = ctx;
  // A question about future branches is a fair discovery question; "without branches" says there are none.
  if (BRANCH.test(text) && !SEVERAL_LOCATIONS.test(idea) && !QUESTION.test(text) && !NO_BRANCHES.test(text))
    return 'branches the idea does not have';
  const city = CITIES.find(re => re.test(text) && !re.test(idea));
  if (city) return `a city the idea does not name (${text.match(city)?.[0]})`;
  const brand = inventedBrand(text, idea, prose);
  if (brand) return brand;
  if (locale === 'en') {
    if (UZ_SETTING.test(idea)) return null;
    if (TASHKENT.test(text)) return 'Tashkent in an English brief the idea does not set there';
    if (TASHKENT_DISTRICTS.test(text)) return 'an Uzbek district in an English brief';
    if (UZ_PERSON_NAMES.test(text) && !UZ_PERSON_NAMES.test(idea)) return 'an Uzbek personal name in an English brief';
    if (UZ_CURRENCY.test(text) && !UZ_CURRENCY.test(idea)) return "so'm in an English brief";
    return null;
  }
  // uz/ru wireframes default to Tashkent (its districts too), unless the idea is set in another city.
  const ideaCity = CITIES.some(re => re.test(idea));
  if (ideaCity && !TASHKENT.test(idea) && (TASHKENT_DISTRICTS.test(text) || TASHKENT.test(text)))
    return 'Tashkent when the idea is set in another city';
  if (prose && !QUESTION.test(text) && !ideaCity && TASHKENT.test(text) && !TASHKENT.test(idea))
    return 'Tashkent, a city the idea does not name';
  return null;
}

/* ------------------------------------------------------------------ */
/* Template leakage                                                    */
/* ------------------------------------------------------------------ */

/**
 * Delivery and couriers, as a brief writes them ("Yetkazildi", "Доставлен по
 * адресу", "Out for delivery") — not the delivery of a message, an SMS or an
 * e-mail ("email delivery of form submissions", "xabarni yetkazadi").
 */
const MESSAGE_WORDS = '(?:xabar|sms|смс|bildirishnoma|eslatma|email|e-mail|xat)';
const DELIVERY_TEXT = new RegExp(
  [
    '(?<![\\p{L}])couriers?(?![\\p{L}])',
    'out for delivery',
    '(?<![\\p{L}])(?:home|food|order|parcel|same-day|doorstep|grocery)\\s+deliver\\p{L}*',
    '(?<![\\p{L}])deliver(?:y|ies)\\s+(?:address|fee|time|zone|status|tracking|driver|slot)',
    '(?:status:?\\s*)delivered|^\\s*delivered\\s*$',
    '(?<![\\p{L}])курьер\\p{L}*',
    '(?<![\\p{L}])достав\\p{L}*(?![\\p{L}])(?<!(?:sms|смс|уведомлени\\p{L}*|сообщени\\p{L}*)\\s+достав\\p{L}*)(?!\\s+(?:sms|смс|уведомл|сообщ|писем|email|код))',
    '(?<![\\p{L}])kuryer\\p{L}*',
    // Not the verb alone: a taxi "brings the driver" (haydovchini yetkazish) and the passenger (manzilga yetkazish).
    `(?<!${MESSAGE_WORDS}\\p{L}*\\s+(?:\\p{L}+\\s+)?)(?<![\\p{L}])(?:yetkazib\\s+ber\\p{L}*|yetkazildi|yetkazish\\s+zona\\p{L}*)`,
  ].join('|'),
  'iu'
);
/** The idea itself is about delivery or couriers. */
const DELIVERY_IDEA = /deliver|courier|shipping|ship to|курьер|достав|kuryer|yetkaz|dostavka|eltib/iu;
/** Refs that price delivery — in a taxi they price the driver's live location instead. */
const DELIVERY_REFS: readonly string[] = ['courier_tracking', 'delivery_zones'];
const TAXI_IDEA =
  /tax[iy]|taksi|такси|(?<![\p{L}])rides?(?![\p{L}])|ride-hailing|попутк|эвакуатор|tow truck|evakuator|yo['‘’ʻ`]?lovchi|пассажир|passenger/iu;
const SCHOOL_IDEA =
  /school|maktab|школ|o['‘’ʻ`]?quv markaz|учебн\p{L}* центр|tutor|repetitor|репетитор|o['‘’ʻ`]?quvchi|ученик|students?(?![\p{L}])/iu;
/** Products that never deliver anything unless the idea says so. */
const NO_DELIVERY_SUBTYPES: readonly string[] = ['edtech', 'booking', 'social', 'fintech', 'landing', 'support_bot', 'info_bot'];

function deliveryIsForeign(ctx: SpecificsContext): boolean {
  if (DELIVERY_IDEA.test(ctx.idea)) return false;
  if (TAXI_IDEA.test(ctx.idea)) return true;
  if (ctx.refs?.some(r => DELIVERY_REFS.includes(r))) return false;
  return SCHOOL_IDEA.test(ctx.idea) || NO_DELIVERY_SUBTYPES.includes(ctx.product?.subtype ?? '');
}

/** Text about messages (SMS, notifications, e-mail): its "delivery" is the message's, only couriers count. */
const MESSAGE_CONTEXT = /sms|смс|уведомл|сообщени|xabar|bildirishnoma|e-?mail|push/iu;
const COURIER_TEXT = /(?<![\p{L}])(?:couriers?|курьер\p{L}*|kuryer\p{L}*)(?![\p{L}])/iu;

/**
 * Why `text` (any visible copy) carries words from another kind of product. A
 * question is left alone: "only rides, or deliveries too?" is a fair one.
 */
export function templateLeak(text: string, ctx: SpecificsContext): string | null {
  if (!text || QUESTION.test(text)) return null;
  const delivery = MESSAGE_CONTEXT.test(text) ? COURIER_TEXT : DELIVERY_TEXT;
  if (delivery.test(text) && deliveryIsForeign(ctx)) return 'delivery in a product that delivers nothing';
  return null;
}

const STORE =
  /app\s?store|google\s?play|play\s?market|store review|app review|apple(?:'s)? review|(?:apple|google)\s+(?:may|can|might|could)\s+reject|магазин\p{L}* приложений|apple и google|ilova do['‘’ʻ`]?kon|telegram (?:bot )?review|bot review|telegram (?:may|can|might|could) reject/iu;
const IN_APP_PURCHASE =
  /in-app (?:purchase|payment)s?|(?<![\p{L}])iap(?![\p{L}])|(?:apple|google|store)(?:'s)? (?:commission|fee|cut|\d+\s?%)|встроенн\p{L}* (?:покуп|платеж)|комисси\p{L}* (?:apple|google|магазин)|ilova ichidagi (?:xarid|to['‘’ʻ`]?lov)|(?:apple|google)\s+komissiya/iu;
/** Sells goods or in-person services: the stores exempt them from in-app purchase rules. */
const GOODS_OR_SERVICES: readonly string[] = ['ecommerce', 'delivery', 'booking', 'order_bot', 'miniapp', 'bot_miniapp', 'pos_kiosk'];

/** A budget, timeline or "scope and deadline" topic ("Сроки и объём", "Byudjet va muddat", "Launch timeline pressure"). */
const BUDGET_TEXT =
  /(?<![\p{L}])(?:budget|timeline|deadline|бюджет\p{L}*|дедлайн\p{L}*|срок\p{L}*|byudjet\p{L}*|budjet\p{L}*|muddat(?!li)\p{L}*)(?![\p{L}])/iu;
const BUDGET_IDEA =
  /budget|deadline|asap|urgent|by (?:january|february|march|april|may|june|july|august|september|october|november|december|new year)|бюджет|дедлайн|срок|срочно|до нового года|byudjet|budjet|muddat|tezda|shoshilinch|yangi yilgacha/iu;

/** The idea names a budget or a deadline (an amount, a duration or the words). */
export function ideaNamesBudget(idea: string): boolean {
  return BUDGET_IDEA.test(idea) || mentionsPriceOrDuration(idea);
}

const BUDGET_ONLY = /(?<![\p{L}])(?:budget|бюджет\p{L}*|byudjet\p{L}*|budjet\p{L}*)(?![\p{L}])/iu;

/**
 * A budget/timeline topic the idea never raised — filler in a risk title. A
 * discovery question about the launch date is fair; `budgetOnly` (questions)
 * flags the budget alone.
 */
export function budgetFiller(text: string, ctx: SpecificsContext, budgetOnly = false): string | null {
  const re = budgetOnly ? BUDGET_ONLY : BUDGET_TEXT;
  return text && re.test(text) && !ideaNamesBudget(ctx.idea) ? 'a budget or timeline topic the idea never raised' : null;
}

/**
 * Why a risk (its title, or the whole risk) is template filler for this idea:
 * a store risk with no mobile app, an in-app-purchase risk on goods or
 * in-person services, or the delivery leak of `templateLeak`. A budget or
 * timeline risk is `budgetFiller` on its title.
 */
export function fillerRisk(text: string, ctx: SpecificsContext): string | null {
  if (!text) return null;
  const leak = templateLeak(text, ctx);
  if (leak) return leak;
  const type = ctx.product?.projectType;
  const hasMobile = type === 'mobile' || !!ctx.extraRefs?.some(r => r.startsWith('mobile:'));
  if (type && STORE.test(text) && !hasMobile) return 'an app-store risk for a product with no mobile app';
  if (IN_APP_PURCHASE.test(text) && GOODS_OR_SERVICES.includes(ctx.product?.subtype ?? ''))
    return 'an in-app purchase rule that physical goods and in-person services are exempt from';
  return null;
}
