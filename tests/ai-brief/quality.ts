/**
 * AI brief — quality fixes from the 2026-10-11 blind audits (every model,
 * Kimi K3 and DeepSeek alike). No network, no model calls.
 *
 *   npx tsx tests/ai-brief/quality.ts
 *
 * Covers: Uzbek letters oʻ/gʻ in the uz brief; invented specifics (branches,
 * cities, brands, Uzbek places/names/so'm on English pages); template leakage
 * (delivery in a taxi or a school, app-store risks without an app,
 * in-app-purchase risks on goods, budget/timeline filler); the stronger
 * wireframe guard (a block kind the MVP does not price, a 'later' screen
 * showing what no price covers); the same checks in the consistency report.
 */
import { checkBriefConsistency, type ViewSource } from '../../src/modules/estimator/ai-brief/consistency';
import type { PricedScope } from '../../src/modules/estimator/ai-brief/digest';
import { guardBriefText } from '../../src/modules/estimator/ai-brief/guard';
import { buildRisksSystemPrompt, buildSamplesSystemPrompt, buildScreensSystemPrompt } from '../../src/modules/estimator/ai-brief/prompts';
import { parseSamplesJson } from '../../src/modules/estimator/ai-brief/samples';
import {
  budgetFiller,
  fillerRisk,
  inventedDetail,
  templateLeak,
  type SpecificsContext,
} from '../../src/modules/estimator/ai-brief/specifics';
import type { AiBrief, WireframeScreen } from '../../src/modules/estimator/ai-brief/types';
import { mapBriefTexts, toUzbekLetters, UZ_OKINA, UZ_TUTUQ, withUzbekLetters } from '../../src/modules/estimator/ai-brief/uzLetters';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-quality');

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function priced(patch: Partial<PricedScope> = {}): PricedScope {
  return {
    product: { projectType: 'web', subtype: 'ecommerce' },
    mvpRefs: ['catalog', 'cart_checkout', 'orders', 'admin_panel', 'stripe'],
    laterRefs: ['loyalty', 'map_view'],
    extraRefs: [],
    hasGrowth: true,
    unpriced: ['Wholesale price lists'],
    unpricedRefs: [],
    frames: { primary: 'browser', mvp: ['browser'], later: ['browser'] },
    ...patch,
  };
}

const source = (idea: string | undefined, patch: Partial<ViewSource> = {}): ViewSource => ({
  locale: 'en',
  title: 'Candle shop',
  roles: ['Customer', 'Manager'],
  integrations: [],
  languages: 1,
  platforms: [],
  idea,
  ...patch,
});

const screen = (name: string, items: string[], phase: WireframeScreen['phase'] = 'mvp', extra: WireframeScreen['blocks'] = []) => ({
  name,
  purpose: 'Browse and buy',
  device: 'browser' as const,
  phase,
  blocks: [{ kind: 'header' as const, label: name, items: [] }, { kind: 'list' as const, label: 'Items', items }, ...extra],
});

function brief(patch: Partial<AiBrief> = {}, narrative: Partial<AiBrief['narrative']> = {}): AiBrief {
  const price = { currency: 'USD' as const, min: 1000, max: 2000, basis: 'en_dual_rate' as const };
  return {
    version: 1,
    locale: 'en',
    model: 'kimi-k3',
    models: { scope: 'kimi-k3', narrative: 'kimi-k3', screens: 'kimi-k3' },
    title: 'Candle shop',
    summary: 'An online candle shop for your customers.',
    audience: [],
    roles: ['Customer', 'Manager'],
    features: [],
    integrations: [],
    stack: [],
    complexityFlags: [],
    screens: [],
    estimate: {
      mode: 'priced',
      basis: 'en_dual_rate',
      confidence: 'medium',
      config: {
        projectType: 'web',
        subtype: 'ecommerce',
        platforms: [],
        approach: 'cross',
        tier: 'mvp',
        design: 'custom',
        languages: 1,
        urgency: 'normal',
        screens: 10,
      },
      mvp: { price, weeks: { min: 4, max: 6 }, team: [], drivers: [] },
      fullVision: null,
      extras: [],
      phases: [
        { id: 'mvp', title: 'Launch', goal: 'Take paid orders online.', deliverables: ['Catalog and checkout'], weeks: { min: 4, max: 6 } },
      ],
      unpricedItems: [],
      adjustments: [],
    },
    narrative: {
      buildFirst: { what: 'A shop where customers order and pay by card.', why: 'It earns from day one.' },
      canWait: [],
      risks: [
        { title: 'Payment setup', detail: 'Stripe verifies the business.', mitigation: 'Start verification early.' },
        { title: 'Product photos', detail: 'Photos sell candles.', mitigation: 'Shoot them before launch.' },
      ],
      questions: ['How many products?', 'Do you ship nationwide?', 'Who updates stock?'],
      assumptions: [],
      ...narrative,
    },
    policy: { status: 'ok', topics: [], note: '' },
    ...patch,
  };
}

const allText = (b: AiBrief) => {
  const out: string[] = [];
  mapBriefTexts(b, t => {
    out.push(t);
    return t;
  });
  return out.join(' | ');
};

/* ------------------------------------------------------------------ */
/* 1. Uzbek letters                                                    */
/* ------------------------------------------------------------------ */

s.group('Uzbek letters — oʻ/gʻ (U+02BB) and the tutuq belgisi (U+02BC)');
s.eq("o'/g' become oʻ/gʻ", toUzbekLetters("Oʻzbekiston bo'ylab to'lov, g'oya"), 'Oʻzbekiston boʻylab toʻlov, gʻoya');
s.eq('capital letters too', toUzbekLetters("O'quvchi G'ALABA"), `O${UZ_OKINA}quvchi G${UZ_OKINA}ALABA`);
s.eq('every apostrophe variant', toUzbekLetters('o‘zbek o’zbek o`zbek'), 'oʻzbek oʻzbek oʻzbek');
s.eq(
  "the tutuq belgisi after other letters (ma'lumot, e'lon)",
  toUzbekLetters("ma'lumot va e'lon"),
  `ma${UZ_TUTUQ}lumot va e${UZ_TUTUQ}lon`
);
s.eq("so'm keeps its number", toUzbekLetters("45 000 so'm"), '45 000 soʻm');
s.eq("English possessives untouched (McDonald's, Domino's)", toUzbekLetters("McDonald's va Domino's"), "McDonald's va Domino's");
s.eq('quotes at word edges untouched', toUzbekLetters("'Bazaviy' tarif"), "'Bazaviy' tarif");
s.eq('digits untouched', toUzbekLetters("5'000"), "5'000");
s.eq('URLs and handles untouched', toUzbekLetters("https://shop.uz/o'z @do'kon"), "https://shop.uz/o'z @do'kon");
s.eq('idempotent', toUzbekLetters(toUzbekLetters("bo'lim ma'lumot")), toUzbekLetters("bo'lim ma'lumot"));
{
  const uz = brief(
    {
      locale: 'uz',
      title: "Do'kon",
      screens: [screen("To'lov", ["Naqd to'lov", "Bog'lanish"])],
    },
    { questions: ["Qaysi to'lov usullari kerak?", "Mahsulotlar soni qancha bo'ladi?", 'Kim boshqaradi?'] }
  );
  const converted = withUzbekLetters('uz', uz, mapBriefTexts);
  const text = allText(converted);
  s.ok("no plain o'/g' left anywhere in a uz brief", !/[OoGg]'/u.test(text), text);
  s.ok('screens, questions and title converted', text.includes('Doʻkon') && text.includes('Naqd toʻlov') && text.includes('boʻladi'));
  s.eq('numbers and prices untouched', converted.estimate, uz.estimate.mode === 'priced' ? converted.estimate : uz.estimate);
  s.eq('an English brief is not touched', withUzbekLetters('en', uz, mapBriefTexts), uz);
  s.ok('input not mutated', uz.title === "Do'kon");
}

/* ------------------------------------------------------------------ */
/* 2. Invented specifics                                               */
/* ------------------------------------------------------------------ */

s.group('invented specifics — branches, cities, brands, off-locale samples');
const en = (idea: string, patch: Partial<SpecificsContext> = {}): SpecificsContext => ({ locale: 'en', idea, ...patch });
const uzCtx = (idea: string): SpecificsContext => ({ locale: 'uz', idea });
const ruCtx = (idea: string): SpecificsContext => ({ locale: 'ru', idea });
s.ok('en: a Tashkent district', !!inventedDetail('Pickup: Chilonzor', en('A bakery ordering site')));
s.ok('en: Uzbek personal names', !!inventedDetail('Dilnoza Rakhimova', en('A photo club app')));
s.ok("en: so'm", !!inventedDetail("Latte — 25 000 so'm", en('A coffee shop app')));
s.ok('en: Tashkent itself', !!inventedDetail('Supplier: Tashkent Steel Supply', en('An ERP for our steel plant')));
s.ok('en: Samarkand warehouse', !!inventedDetail('Bearing 6205 — Samarkand warehouse', en('An ERP for our plant')));
s.eq(
  'en: Uzbek details are fine when the idea is set in Uzbekistan',
  inventedDetail('Pickup: Chilonzor', en('A bakery app in Tashkent')),
  null
);
s.eq('en: a generic US place is fine', inventedDetail('Pickup: Downtown, Main St', en('A bakery ordering site')), null);
s.ok('uz: branches when the idea has one business', !!inventedDetail('Chilonzor filiali', uzCtx('Bitta avtoservis uchun yozilish boti')));
s.eq('uz: branches the idea names stay', inventedDetail('Chilonzor filiali', uzCtx('3 ta filialimiz bor, yozilish boti kerak')), null);
s.ok('en: a "Downtown Studio Branch"', !!inventedDetail('Downtown Studio Branch — $60', en('A yoga studio booking app')));
s.ok('ru: a city the idea does not name', !!inventedDetail('Межгород: Ташкент — Самарканд', ruCtx('Нужно приложение для эвакуатора')));
s.eq('uz wireframes: Tashkent districts are the market default', inventedDetail('Qayerdan: Chilonzor', uzCtx('Taksi ilovasi kerak')), null);
s.ok(
  'uz prose: Tashkent the idea never named',
  !!inventedDetail('Ilova Toshkent shahrida ishga tushiriladi.', uzCtx('Taksi ilovasi kerak'), true)
);
s.ok('uz: Tashkent districts when the idea is set in Samarkand', !!inventedDetail('Chilonzor tumani', uzCtx('Samarqandda taksi ilovasi')));
s.ok('a company suffix (Willamette Candle Co.)', !!inventedDetail('Willamette Candle Co.', en('A candle shop on Shopify')));
s.ok('a quoted company (ООО «СтройПро»)', !!inventedDetail('ООО «СтройПро»', ruCtx('Сайт для строительной компании')));
s.ok(
  'a residential complex as the client portfolio',
  !!inventedDetail('Жилой комплекс «Ташкент Сити»', ruCtx('Сайт для строительной компании'))
);
s.ok('"Welcome to HandyLink"', !!inventedDetail('Welcome to HandyLink', en('A marketplace for home services')));
s.ok('our own name on the client screens', !!inventedDetail('SoftWhere Landing', en('A landing page for my app')));
s.eq('a brand the idea gives stays', inventedDetail('Welcome to HandyLink', en('HandyLink: a marketplace for home services')), null);
{
  const samples = parseSamplesJson(
    '{"samples":["Chilonzor filiali","Lavash — 32 000 so\'m","Yunusobod filiali","Shaurma — 28 000 so\'m"]}',
    {
      locale: 'uz',
      idea: 'Bitta kafe uchun buyurtma boti',
    }
  );
  s.eq('samples: invented branches dropped, the menu stays', samples?.value, ["Lavash — 32 000 so'm", "Shaurma — 28 000 so'm"]);
}

/* ------------------------------------------------------------------ */
/* 3. Template leakage                                                 */
/* ------------------------------------------------------------------ */

s.group('template leakage — delivery, app stores, budget filler');
const taxi: SpecificsContext = {
  locale: 'uz',
  idea: "Yandex Go ga o'xshash taksi ilovasi kerak",
  product: { projectType: 'mobile', subtype: 'delivery' },
  refs: ['courier_tracking', 'delivery_zones'],
};
s.ok('taxi: "Yetkazildi" status (delivery subtype leaked)', !!templateLeak('Holat: Yetkazildi', taxi));
s.ok('taxi: a "Yetkazib berish" tariff', !!templateLeak('Yetkazib berish — 15 000 so‘m', taxi));
s.ok(
  'tow truck: "Доставлен по адресу"',
  !!templateLeak('Доставлен по адресу', { ...taxi, locale: 'ru', idea: 'Приложение для вызова эвакуатора' })
);
s.ok(
  'school: couriers',
  !!templateLeak('Kuryer holati', {
    locale: 'uz',
    idea: "Maktab uchun o'quvchilar davomati",
    product: { projectType: 'web', subtype: 'crm' },
  })
);
s.eq(
  'a delivery idea keeps its delivery',
  templateLeak('Yetkazib berish manzili', { ...taxi, idea: 'Ovqat yetkazib berish ilovasi' }),
  null
);
s.eq(
  'a shop keeps its delivery address',
  templateLeak('Delivery address', { locale: 'en', idea: 'An online candle shop', product: { projectType: 'web', subtype: 'ecommerce' } }),
  null
);
const landing: SpecificsContext = { locale: 'en', idea: 'A landing page for my SaaS', product: { projectType: 'web', subtype: 'landing' } };
s.eq('not a leak: e-mail delivery of form submissions', templateLeak('Email delivery of form submissions.', landing), null);
s.eq(
  'not a leak: "доставка SMS"',
  templateLeak('Доставка SMS зависит от провайдера', { ...landing, locale: 'ru', idea: 'Сайт-визитка' }),
  null
);
s.eq(
  'not a leak: "xabarni avtomatik yetkazadi"',
  templateLeak('ota-onalarga xabarni avtomatik yetkazadi', { ...taxi, idea: "O'quv markaz uchun CRM" }),
  null
);
s.eq(
  'not a leak: an SMS risk ("сбои доставки")',
  templateLeak('Доставка SMS-кодов: сбои доставки возможны', { ...landing, locale: 'ru', idea: 'Запись в салон' }),
  null
);
s.eq('taxi: bringing the driver is not delivery', templateLeak('Haydovchini yetkazish jarayonini ishga tushirish.', taxi), null);
s.ok('taxi: "yetkazish zonalari" is', !!templateLeak("Yetkazish zonalari bo'yicha tarif", taxi));
s.eq('a question about adding delivery is fair', templateLeak("Faqat taksi, yoki yetkazib berish ham qo'shiladimi?", taxi), null);
s.eq('"Bitta avtoservis filiali" is one location', inventedDetail('Bitta avtoservis filiali uchun', uzCtx('Avtoservis uchun bot')), null);
s.eq('Navoi the poet is not the city', inventedDetail('Субботник в парке имени Навои', ruCtx('HR-портал')), null);
s.eq('a question about future branches is fair', inventedDetail('Do you plan more branches later?', en('A yoga studio app'), true), null);
s.eq(
  '"without branches" is not an invented branch',
  inventedDetail('Первый запуск — один клуб, без сети филиалов.', ruCtx('Фитнес-клуб')),
  null
);
s.eq('SoftWhere in prose is who builds it', inventedDetail('SoftWhere prepares the store listing.', en('A fitness app'), true), null);
const web: SpecificsContext = { locale: 'en', idea: 'An online candle shop', product: { projectType: 'web', subtype: 'ecommerce' } };
s.ok('web shop: an App Store review risk', !!fillerRisk('Store review delays: App Store review can take weeks', web));
s.ok(
  'Telegram bot: a "bot review" risk',
  !!fillerRisk('Telegram bot review may delay launch', { ...web, product: { projectType: 'telegram', subtype: 'order_bot' } })
);
s.eq(
  'mobile app: a store risk is real',
  fillerRisk('App Store review', { ...web, product: { projectType: 'mobile', subtype: 'social' } }),
  null
);
s.eq('web now, mobile app later: a store risk is real', fillerRisk('App Store review', { ...web, extraRefs: ['mobile:ecommerce'] }), null);
s.ok(
  'goods on mobile: an in-app purchase risk',
  !!fillerRisk('Apple may require in-app purchases', { ...web, product: { projectType: 'mobile', subtype: 'ecommerce' } })
);
s.eq(
  'digital subscriptions: an in-app purchase risk is real',
  fillerRisk('Apple may require in-app purchases', { ...web, product: { projectType: 'mobile', subtype: 'edtech' } }),
  null
);
s.ok('no budget in the idea: a budget/timeline risk title is filler', !!budgetFiller('Small budget or tight timeline', web));
s.ok('ru: "Сроки и объём"', !!budgetFiller('Сроки и объём', { ...web, locale: 'ru', idea: 'Сайт для клиники' }));
s.ok('uz: "Byudjet va muddat"', !!budgetFiller('Byudjet va muddat', { ...web, locale: 'uz', idea: 'Nonvoyxona uchun bot' }));
s.eq('a budget the idea gives makes it real', budgetFiller('Budget fit', { ...web, idea: 'A candle shop, budget $3,000' }), null);
s.eq('a deadline the idea gives makes it real', budgetFiller('Tight timeline', { ...web, idea: 'A candle shop live in 3 weeks' }), null);
s.eq('questions: a launch-date question is fair', budgetFiller('When do you want to launch? Any deadline?', web, true), null);
s.ok('questions: a budget question is not', !!budgetFiller('What is your budget?', web, true));

s.group('prompts — the same rules up front');
s.ok(
  'risks: no store risk without an app, no budget filler',
  /no App Store or Google Play risk for a website/.test(buildRisksSystemPrompt('en')) &&
    /no budget or timeline risk when the idea names no budget/.test(buildRisksSystemPrompt('en'))
);
s.ok("risks: other products' words", /THIS PRODUCT ONLY/.test(buildRisksSystemPrompt('uz')));
s.ok('screens: no other cities, branches or brands', /never other cities; no branches unless/.test(buildScreensSystemPrompt('ru')));
s.ok(
  'screens: a later screen never shows NOT PRICED',
  /A 'later' screen shows LATER items or EXTRA PRODUCTS only/.test(buildScreensSystemPrompt('en'))
);
s.ok(
  "en samples: never Uzbek places, names or so'm",
  /Never Uzbek or other CIS cities, districts, personal names or currency/.test(buildSamplesSystemPrompt('en'))
);

/* ------------------------------------------------------------------ */
/* 4. The guard on the request path                                    */
/* ------------------------------------------------------------------ */

s.group('guard — invented specifics and leakage dropped from the brief');
{
  const idea = 'An online candle shop for my small business';
  const dirty = brief(
    {
      summary: 'An online candle shop. Customers in Tashkent order for pickup.',
      screens: [
        screen('Catalog', ['Lavender candle — $18', 'Chilonzor branch', 'Cedar candle — $22']),
        screen('Orders', ['Order #1043 — $40', 'Dilnoza Rakhimova', 'Order #1044 — $18']),
      ],
    },
    {
      risks: [
        { title: 'Payment setup', detail: 'Stripe verifies the business.', mitigation: 'Start verification early.' },
        { title: 'Store review delays', detail: 'App Store review can take a week.', mitigation: 'Submit early.' },
        { title: 'Small budget or tight timeline', detail: 'A small budget limits scope.', mitigation: 'We talk on the call.' },
      ],
      questions: ['How many products?', 'What is your budget?', 'Who updates stock?'],
    }
  );
  const out = guardBriefText(dirty, priced(), source(idea));
  const text = allText(out.value);
  s.ok('Uzbek district and name dropped from the wireframes', !/Chilonzor|Dilnoza/.test(text), text);
  s.ok('the rest of the block stays', text.includes('Lavender candle — $18') && text.includes('Order #1043 — $40'));
  s.eq(
    'store and budget filler risks dropped',
    out.value.narrative.risks.map(r => r.title),
    ['Payment setup']
  );
  s.eq('the budget question dropped', out.value.narrative.questions, ['How many products?', 'Who updates stock?']);
  s.ok(
    'every removal logged',
    out.removed.filter(r => /Chilonzor|Dilnoza|Store review|budget/i.test(r)).length >= 5,
    out.removed.join('\n')
  );
  const legacy = guardBriefText(dirty, priced(), source(undefined));
  s.ok('without the idea (saved runs): no specifics check', allText(legacy.value).includes('Chilonzor branch'));
  s.eq(
    'a filler risk never takes the brief below one risk',
    guardBriefText(brief({}, { risks: [dirty.narrative.risks[1]] }), priced(), source(idea)).value.narrative.risks.length,
    1
  );
}
{
  const idea = "Yandex Go ga o'xshash taksi ilovasi kerak";
  const taxiPriced = priced({
    product: { projectType: 'mobile', subtype: 'delivery' },
    mvpRefs: ['courier_tracking', 'orders', 'admin_panel'],
    laterRefs: ['payme'],
    frames: { primary: 'phone', mvp: ['phone', 'browser'], later: ['phone', 'browser'] },
  });
  const taxiBrief = brief({
    locale: 'uz',
    screens: [screen('Haydovchi buyurtmalari', ["Chilonzor — Yunusobod, 42 000 so'm", 'Holat: Yetkazildi', 'Ekonom tarifi'])],
  });
  const out = guardBriefText(taxiBrief, taxiPriced, source(idea, { locale: 'uz', languages: 2 }));
  const items = out.value.screens[0]?.blocks[1]?.items ?? [];
  s.eq('taxi: the delivery status dropped, the ride stays (Tashkent districts are the uz default)', items, [
    "Chilonzor — Yunusobod, 42 000 so'm",
    'Ekonom tarifi',
  ]);
}

s.group('guard — wireframes show only what is priced');
{
  const idea = 'An online candle shop';
  const withMap = brief({
    screens: [
      screen('Catalog', ['Lavender candle — $18', 'Cedar candle — $22'], 'mvp', [
        { kind: 'map', label: 'Pickup points on the map', items: [] },
      ]),
      screen('Later: growth', ['Wholesale price lists', 'Loyalty points'], 'later'),
    ],
  });
  const out = guardBriefText(withMap, priced(), source(idea));
  const mvp = out.value.screens.find(sc => sc.name === 'Catalog');
  s.ok(
    'an MVP map block dropped when maps are priced only for later',
    !!mvp && !mvp.blocks.some(b => b.kind === 'map'),
    JSON.stringify(mvp?.blocks)
  );
  const later = out.value.screens.find(sc => sc.phase === 'later');
  s.ok(
    'a later screen loses the item no price covers',
    !!later && !allText(brief({ screens: [later] })).includes('Wholesale price lists'),
    JSON.stringify(later)
  );
  s.ok('… and keeps the LATER item', !!later && allText(brief({ screens: [later] })).includes('Loyalty points'));
}

/* ------------------------------------------------------------------ */
/* 5. The consistency report (eval)                                    */
/* ------------------------------------------------------------------ */

s.group('consistency report — the same findings, scored');
{
  const dirty = brief(
    { screens: [screen('Catalog', ['Lavender candle — $18', 'Chilonzor branch'])] },
    {
      risks: [{ title: 'App Store review', detail: 'Apple may reject.', mitigation: 'Submit early.' }],
    }
  );
  const report = checkBriefConsistency(dirty, priced(), 'An online candle shop');
  const kinds = report.violations.map(v => v.kind);
  s.ok('invented_detail reported', kinds.includes('invented_detail'), kinds.join());
  s.ok('template_leak reported', kinds.includes('template_leak'), kinds.join());
  s.eq(
    'without the idea: neither',
    checkBriefConsistency(dirty, priced()).violations.filter(v => v.kind === 'invented_detail' || v.kind === 'template_leak').length,
    0
  );
  const uzBrief = withUzbekLetters('uz', brief({ locale: 'uz', screens: [screen("To'lov", ['Chilonzor filiali'])] }), mapBriefTexts);
  s.ok(
    'checks still match after the oʻ/gʻ conversion',
    checkBriefConsistency(uzBrief, priced(), 'Bitta kafe uchun bot').violations.some(v => v.kind === 'invented_detail')
  );
}

process.exit(s.report());
