import { FEATURE_BY_ID } from '@/modules/estimator/data/catalog';
import type { ProjectType } from '@/modules/estimator/types';
import { DEFAULT_UI_LANGUAGES, type BriefLocale } from '@/modules/estimator/ai-brief/constants';
import type { BriefScope, ScopeItem } from '@/modules/estimator/ai-brief/types';

/**
 * Deterministic business rules applied to the model's scope BEFORE it is
 * priced. Each fixes a failure the 2026-10 audit found in real outputs, and
 * each change is recorded as a human-readable adjustment:
 *
 *  1. Market: English pages never price Uzbekistan-only services (Payme, OFD,
 *     MyID…) unless the idea is about Uzbekistan ("soliq_ofd — not needed, US
 *     market" was priced into a Texas brief).
 *  2. Fiscal receipts: a consumer sale through Payme/Click/Uzum/Paynet in the
 *     MVP needs OFD receipts in the MVP — deferring them was legally risky
 *     advice the model gave in four briefs.
 *  3. Interest: when the policy check flags interest-based lending, installments
 *     (nasiya) never sit in the MVP.
 *  4. Telegram identifies its users: no SMS one-time codes inside a bot.
 *  5. Extra products only when the visitor asked for them: an unrequested
 *     Telegram bot or Mini App was added to seven briefs' full-vision price.
 *  6. A live operator in a Telegram bot is the bot admin, not in-app chat:
 *     `chat` is not offered for bots, so it was shown as "In-app chat — not
 *     priced" next to a bot whose handoff the wireframes drew (round 2).
 *  7. People log in to an AI tool → it is a web portal with AI features: an
 *     `ai:*` product cannot price accounts, roles, dashboards or reports, so
 *     they were listed as "not priced" next to an assistant that needs them.
 *
 *  8. The stack and the complexity flags describe what is priced: no AI models
 *     or "AI answer quality" when no AI feature can be priced for the product
 *     (an AI rate-confirmation reader dropped from a mobile app still showed
 *     "OpenAI GPT"), no Uzbek TAS-IX hosting outside Uzbekistan (an English
 *     idea that only names Uzbek as an interface language is not Uzbekistan),
 *     no cloud hosting when the idea runs on its own servers ("on-premise in
 *     three countries" was quoted with TAS-IX hosting), and one
 *     backend-as-a-service, not Firebase and Supabase side by side.
 *  9. Two kinds of users with their own screens need roles: a barbershop
 *     SaaS drew a master's cabinet, a brokerage an agent dashboard, with
 *     "Roles & permissions" priced nowhere (round-2 iteration-2 audit). A
 *     second side priced by its own feature (couriers, sellers) or an
 *     operator who works in the admin panel does not count.
 * 10. A pilot never prices the rollout: "scaling to all 12 plants and 5,000
 *     employees" sat in a 1–2 week growth phase as high-load architecture
 *     (must-not-ship). The rollout becomes a named unpriced item.
 * 11. Interface languages: a uz or ru page always prices Uzbek + Russian (2),
 *     whether or not the idea names languages, and a third only when the idea
 *     names one beyond them ("+ English") — founder decision 2026-10-10,
 *     round 4. A model answer of one language is raised to two; three with no
 *     third language in the idea are lowered to two. English pages keep the
 *     model's count.
 *
 * Rule 1 also covers Russian pages for Kazakhstan or Russia (an Almaty flower
 * shop was priced with the Uzbek Eskiz SMS gateway in round 2).
 */

const UZ_ONLY_INTEGRATIONS = new Set([
  'payme',
  'click',
  'uzum_bank',
  'paynet',
  'nasiya',
  'soliq_ofd',
  'eskiz_sms',
  'playmobile_sms',
  'billz',
  'smartup',
  'oneid',
  'myid',
  'eimzo',
  'didox',
]);

const UZ_MARKET =
  /uzbek|o['‘’ʻ`]?zbek|ўзбек|узбек|tashkent|toshkent|ташкент|samar[kq]and|самарканд|bukhara|buxoro|бухар|farg['‘’ʻ`]?ona|fergana|ферган|namangan|наманган|andij[ao]n|андижан|(?<!\p{L})so['‘’ʻ`]?m(?!\p{L})|(?<!\p{L})сум(?!\p{L})|uzcard|humo|payme/iu;

const CONSUMER_PAYMENTS = ['payme', 'click', 'uzum_bank', 'paynet'];
const SALES_FEATURES = ['cart_checkout', 'orders', 'subscriptions'];

/** What the idea must mention for an extra product of each type to count as requested. */
const EXTRA_REQUESTED: Record<ProjectType, RegExp> = {
  telegram: /telegram|телеграм|(?<!\p{L})tg(?!\p{L})|mini ?app|мини.?апп/iu,
  web: /sayt|site|сайт|veb|web|веб|browser|brauzer|браузер|portal|портал|kabinet|кабинет|dashboard|landing|лендинг/iu,
  mobile: /ilova|(?<!\p{L})apps?(?!\p{L})|application|приложени|ios|android|андроид|mobil|мобил|smartfon|смартфон/iu,
  ai: /(?<!\p{L})ai(?!\p{L})|(?<!\p{L})ии(?!\p{L})|sun['‘’ʻ`]?iy intellekt|искусственн|нейросет|gpt|llm|chatbot|чат-?бот|automat|автомат|avtomat/iu,
  desktop: /desktop|десктоп|windows|macos|kiosk|киоск|kassa|касс/iu,
  other: /integrat|интеграц|sync|синхрон|audit|аудит/iu,
};

const offeredFor = (featureId: string, type: ProjectType) => FEATURE_BY_ID.get(featureId)?.types.includes(type) ?? false;

export interface Reconciled {
  scope: BriefScope;
  adjustments: string[];
}

/** Another CIS market named outright: Kazakhstan or Russia (cities, currencies, local payment brands). */
const OTHER_CIS_MARKET =
  /kazakhstan|казахстан|qozog['‘’ʻ`]?iston|almaty|алмат|astana|астан|шымкент|караганд|тенге|(?<!\p{L})тг(?!\p{L})|₸|kaspi|каспи|russia|росси|москв|moscow|петербург|новосибирск|екатеринбург|казань|рубл|₽|yookassa|юkassa|юкасс/iu;

export function isUzMarket(idea: string, locale: BriefLocale): boolean {
  if (UZ_MARKET.test(idea)) return true;
  return locale !== 'en' && !OTHER_CIS_MARKET.test(idea);
}

function withPhase(items: ScopeItem[], id: string, phase: ScopeItem['phase']): ScopeItem[] {
  const existing = items.find(i => i.id === id);
  if (!existing) return [...items, { id, phase, note: '' }];
  return items.map(i => (i.id === id ? { ...i, phase } : i));
}

export function reconcileScope(scope: BriefScope, idea: string, locale: BriefLocale): Reconciled {
  const adjustments: string[] = [];
  let { integrations, features, extraDeliverables } = scope;

  // 1. Market
  if (!isUzMarket(idea, locale)) {
    const foreign = integrations.filter(i => UZ_ONLY_INTEGRATIONS.has(i.id));
    if (foreign.length) {
      integrations = integrations.filter(i => !UZ_ONLY_INTEGRATIONS.has(i.id));
      adjustments.push(`removed Uzbekistan-only integrations for a non-UZ market: ${foreign.map(i => i.id).join(', ')}`);
    }
  }

  // 2. Fiscal receipts with consumer payments
  const mvpIds = (items: ScopeItem[]) => new Set(items.filter(i => i.phase === 'mvp').map(i => i.id));
  const mvpIntegrations = mvpIds(integrations);
  const mvpFeatures = mvpIds(features);
  const sellsToConsumers =
    CONSUMER_PAYMENTS.some(id => mvpIntegrations.has(id)) &&
    SALES_FEATURES.some(id => mvpFeatures.has(id)) &&
    scope.product.subtype !== 'fintech';
  if (sellsToConsumers && !mvpIntegrations.has('soliq_ofd')) {
    adjustments.push(
      `integration soliq_ofd ${integrations.some(i => i.id === 'soliq_ofd') ? 'later → mvp' : 'added to mvp'} (fiscal receipts are mandatory for online sales)`
    );
    integrations = withPhase(integrations, 'soliq_ofd', 'mvp');
  }

  // 3. No interest-bearing installments in the MVP
  if (scope.policy.topics.includes('interest_lending') && mvpIntegrations.has('nasiya')) {
    integrations = withPhase(integrations, 'nasiya', 'later');
    adjustments.push('integration nasiya mvp → later (policy: interest-based lending needs the client’s confirmation first)');
  }

  // 4. SMS codes inside a Telegram bot
  if (scope.product.projectType === 'telegram' && features.some(f => f.id === 'otp_sms')) {
    features = features.filter(f => f.id !== 'otp_sms');
    adjustments.push('feature otp_sms removed (Telegram already identifies the user)');
  }

  // 5. Extras the visitor did not ask for
  const unrequested = extraDeliverables.filter(e => !EXTRA_REQUESTED[e.projectType].test(idea));
  if (unrequested.length) {
    extraDeliverables = extraDeliverables.filter(e => !unrequested.includes(e));
    adjustments.push(`removed unrequested extra products: ${unrequested.map(e => `${e.projectType}:${e.subtype}`).join(', ')}`);
  }

  // 6. A bot's live operator is the bot admin (chat is in-app chat, not offered for bots)
  const botChat = scope.product.projectType === 'telegram' ? features.find(f => f.id === 'chat') : undefined;
  if (botChat) {
    const admin = features.find(f => f.id === 'bot_admin');
    const phase = admin?.phase === 'mvp' || botChat.phase === 'mvp' ? 'mvp' : 'later';
    features = [
      ...features.filter(f => f.id !== 'chat' && f.id !== 'bot_admin'),
      { id: 'bot_admin', phase, note: admin?.note || botChat.note },
    ];
    adjustments.push(`feature chat → bot_admin (${phase}): operators answer a Telegram bot from its admin side`);
  }

  // 7. An AI tool people log in to is a web portal with AI features
  let { product } = scope;
  const appOnly =
    product.projectType === 'ai' ? features.filter(f => f.phase === 'mvp' && !offeredFor(f.id, 'ai') && offeredFor(f.id, 'web')) : [];
  if (appOnly.length) {
    product = { projectType: 'web', subtype: 'portal' };
    adjustments.push(
      `product ${scope.product.projectType}:${scope.product.subtype} → web:portal (the MVP needs ${appOnly.map(f => f.id).join(', ')})`
    );
  }

  // 9. Two user-facing roles need roles & permissions
  if (needsRoles(scope.roles, product, features)) {
    features = [...features, { id: 'roles', phase: 'mvp', note: ROLES_NOTE[locale] }];
    adjustments.push(`feature roles added to mvp (the MVP has two kinds of users: ${scope.roles.join(', ')})`);
  }

  // 10. A pilot never prices the rollout to the whole organization
  let { unpricedItems } = scope;
  let flags = scope.complexityFlags;
  if (PILOT.test(`${scope.title} ${scope.summary}`) && features.some(f => f.id === 'highload')) {
    features = features.filter(f => f.id !== 'highload');
    flags = flags.filter(f => f !== 'high_load');
    unpricedItems = [...unpricedItems, ROLLOUT_LABEL[locale]];
    adjustments.push('feature highload removed for a pilot: the rollout to the whole organization is not priced');
  }

  // 8. Stack and flags follow what is priced
  const { stack, complexityFlags } = stackAndFlags(
    { ...scope, complexityFlags: flags },
    product,
    features,
    { uzHosting: uzHostingFits(idea, locale), onPremise: ON_PREMISE.test(idea) },
    adjustments
  );

  // 11. Interface languages: Uzbek + Russian on uz/ru pages, plus a language the idea asks for on top
  let { uiLanguages } = scope;
  if (locale !== 'en') {
    const base = DEFAULT_UI_LANGUAGES[locale];
    const ruled = uiLanguages > base && !asksForExtraLanguage(idea) ? base : Math.max(uiLanguages, base);
    // A model answer of 0 means "none given": filled in silently, as the mapping's default would be.
    if (ruled !== uiLanguages && uiLanguages > 0)
      adjustments.push(
        `uiLanguages ${uiLanguages} → ${ruled} (${ruled > uiLanguages ? 'uz/ru pages always price Uzbek + Russian' : 'the idea names no language beyond Uzbek and Russian'})`
      );
    uiLanguages = ruled;
  }

  return {
    scope: { ...scope, product, integrations, features, extraDeliverables, unpricedItems, stack, complexityFlags, uiLanguages },
    adjustments,
  };
}

/**
 * A language beyond Uzbek and Russian, named in the idea in Uzbek, Russian or
 * English ("ingliz tilida ham", "+ английский", "English version"). Uzbek and
 * Russian never count here: a uz/ru page prices both anyway.
 */
const EXTRA_LANGUAGE =
  /(?<!\p{L})(?:ingliz\p{L}*|english|английск\p{L}*|qozoq\p{L}*|kazakh|казахск\p{L}*|qirg['‘’ʻ`]?iz\p{L}*|kyrgyz|кыргызск\p{L}*|киргизск\p{L}*|tojik\p{L}*|tajik|таджикск\p{L}*|turk(?:cha|\s+til)\p{L}*|turkish|турецк\p{L}*|arab(?:cha|\s+til)\p{L}*|arabic|арабск\p{L}*|xitoy\p{L}*|chinese|китайск\p{L}*|nemis\p{L}*|german|немецк\p{L}*|fransuz\p{L}*|french|французск\p{L}*|koreys\p{L}*|korean|корейск\p{L}*|ispan\p{L}*|spanish|испанск\p{L}*)/iu;
/** "Three languages", "uch tilda", "на трёх языках" — more than Uzbek + Russian without naming them. */
const THREE_LANGUAGES = /(?<!\p{L})(?:three|3|uch|три|тр[её]х)[-\s]+(?:languages?|til\p{L}*|язык\p{L}*)/iu;

/**
 * Does the idea ask for an interface language beyond Uzbek + Russian? It only
 * lets a model's third language stand (rule 11) — it never adds one, so a
 * mention that is not about the interface ("ingliz tili kurslari", Chinese
 * turnstiles) costs nothing unless the model also priced a third language.
 */
export function asksForExtraLanguage(idea: string): boolean {
  return EXTRA_LANGUAGE.test(idea) || THREE_LANGUAGES.test(idea);
}

/** Roles that work in the operator side (admin panel, CMS) rather than in an app of their own. */
const OPERATOR_ROLE =
  /admin|operator|админ|оператор|dispatch|диспетчер|manager|менеджер|menejer|boshqaruvchi|moderator|модератор|editor|редактор|muharrir|front desk|reception|ресепшн|resepshn/iu;
/** Products whose users log in to their own screens (a landing or company site has visitors, not accounts). */
const ROLE_PRODUCTS: Readonly<Partial<Record<ProjectType, readonly string[] | 'all'>>> = {
  mobile: 'all',
  web: ['ecommerce', 'saas', 'portal', 'crm'],
};
/** Features that price a second side on their own (the courier app, the sellers' cabinet). */
const SECOND_SIDE = ['courier_tracking', 'marketplace_vendors'];

const ROLES_NOTE: Record<BriefLocale, string> = {
  en: 'Separate access for each kind of user',
  ru: 'Отдельный доступ для каждого типа пользователей',
  uz: 'Har bir foydalanuvchi turi uchun alohida kirish',
};

export function needsRoles(roles: readonly string[], product: BriefScope['product'], features: readonly ScopeItem[]): boolean {
  const offered = ROLE_PRODUCTS[product.projectType];
  if (!offered || (offered !== 'all' && !offered.includes(product.subtype))) return false;
  if (features.some(f => f.id === 'roles' || (f.phase === 'mvp' && SECOND_SIDE.includes(f.id)))) return false;
  return roles.filter(r => !OPERATOR_ROLE.test(r)).length >= 2;
}

const PILOT = /(?<!\p{L})(?:pilot|пилот)/iu;
const ROLLOUT_LABEL: Record<BriefLocale, string> = {
  en: 'Rollout to the whole organization after the pilot',
  ru: 'Внедрение во всей организации после пилота',
  uz: 'Pilotdan keyin butun tashkilotga joriy etish',
};

/** The idea runs on its own servers: no cloud or hosting provider belongs in the stack. */
const ON_PREMISE =
  /on-?prem|own servers|our servers|in-house servers|self-hosted|собственн\p{L}* сервер|сво\p{L}* сервер|локальн\p{L}* сервер|o['‘’ʻ`]?z serverlar|o['‘’ʻ`]?zimizning server/iu;
const HOSTING_STACK = new Set(['local_vps', 'aws', 'gcp', 'azure', 'vercel', 'hetzner']);

/** "Uzbek" as an interface language ("in English, Russian and Uzbek") — not a place. */
const UZ_LANGUAGE_WORD = /(?<!\p{L})(?:uzbek|o['‘’ʻ`]?zbek|узбек|ўзбек)(?!iston|istan|истан|истон)\p{L}*/giu;

/** Uzbek TAS-IX hosting fits: the UZ market, and on English pages a place, currency or brand — not just the language. */
export function uzHostingFits(idea: string, locale: BriefLocale): boolean {
  if (!isUzMarket(idea, locale)) return false;
  return locale !== 'en' || UZ_MARKET.test(idea.replace(UZ_LANGUAGE_WORD, ' '));
}

const AI_FEATURES = ['ai_chatbot', 'rag_kb', 'speech', 'vision', 'recommendations', 'ai_content'];
const AI_STACK = new Set(['openai', 'claude', 'gemini', 'local_llm', 'langchain', 'whisper']);
const BAAS_STACK = ['firebase', 'supabase'];

interface Market {
  /** Uzbek TAS-IX hosting fits the idea (see `uzHostingFits`). */
  uzHosting: boolean;
  /** The idea runs on its own servers. */
  onPremise: boolean;
}

function stackAndFlags(
  scope: BriefScope,
  product: BriefScope['product'],
  features: ScopeItem[],
  market: Market,
  adjustments: string[]
): Pick<BriefScope, 'stack' | 'complexityFlags'> {
  const hasAi = product.projectType === 'ai' || features.some(f => AI_FEATURES.includes(f.id) && offeredFor(f.id, product.projectType));
  const firstBaas = scope.stack.find(id => BAAS_STACK.includes(id));
  const drop = (id: string) =>
    (!hasAi && AI_STACK.has(id)) ||
    (!market.uzHosting && id === 'local_vps') ||
    (market.onPremise && HOSTING_STACK.has(id)) ||
    (BAAS_STACK.includes(id) && id !== firstBaas);
  const stack = scope.stack.filter(id => !drop(id));
  const complexityFlags = hasAi ? scope.complexityFlags : scope.complexityFlags.filter(f => f !== 'ai_quality');
  const gone = [...scope.stack.filter(drop), ...(complexityFlags.length < scope.complexityFlags.length ? ['flag ai_quality'] : [])];
  if (gone.length) adjustments.push(`stack/flags: removed ${gone.join(', ')} (not priced for this product or market)`);
  return { stack, complexityFlags };
}
