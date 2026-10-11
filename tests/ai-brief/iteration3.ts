/**
 * AI brief — round 2 iteration 3 logic, no network, no model calls.
 *
 *   npx tsx tests/ai-brief/iteration3.ts
 *
 * Covers what iteration 3 added, each from an auditor finding: roles priced
 * when the MVP has two kinds of users, a pilot that never prices the rollout,
 * hosting that follows "on-premise", "priced separately" jargon, the Uzbek
 * fixes that are always right, the Uzbek copy-edit's guards, shared sample
 * content and one price per item across the wireframe halves, third-party
 * screens, checker false positives, and the in-flight spend reservation.
 */
import { cleanVisibleText } from '../../src/modules/estimator/ai-brief/cleanText';
import { checkBriefConsistency, tokensMatch } from '../../src/modules/estimator/ai-brief/consistency';
import { CONCEPTS } from '../../src/modules/estimator/ai-brief/consistencyLexicon';
import { AUX_PARTS, CAPS, SAMPLE_PRODUCTS } from '../../src/modules/estimator/ai-brief/constants';
import type { PricedScope } from '../../src/modules/estimator/ai-brief/digest';
import { screensOf } from '../../src/modules/estimator/ai-brief/orchestrator';
import {
  applyFixes,
  collectTexts,
  mapPlanTexts,
  mapRisksTexts,
  mapScopeTexts,
  mapScreensTexts,
  parsePolishJson,
  refuseFix,
  replaceSpan,
} from '../../src/modules/estimator/ai-brief/polish';
import {
  buildPlanSystemPrompt,
  buildPolishSystemPrompt,
  buildPolishUserPrompt,
  buildSamplesSystemPrompt,
  buildScopeSystemPrompt,
  buildScopedUserPrompt,
  buildScreensSystemPrompt,
} from '../../src/modules/estimator/ai-brief/prompts';
import { needsRoles, reconcileScope, uzHostingFits } from '../../src/modules/estimator/ai-brief/reconcile';
import { parseSamplesJson } from '../../src/modules/estimator/ai-brief/samples';
import { guardScreens, harmonizeSamplePrices, isThirdPartyScreen } from '../../src/modules/estimator/ai-brief/screens';
import type { AiBrief, BriefScope, WireframeScreen } from '../../src/modules/estimator/ai-brief/types';
import { createDailyBudget } from '../../src/shared/utils/dailyBudget';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-iteration3');

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function scope(patch: Partial<BriefScope> = {}): BriefScope {
  return {
    isProjectIdea: true,
    rejection: 'none',
    policy: { status: 'ok', topics: [], note: '' },
    title: 'Barbershop booking',
    summary: 'Customers book a barber in a few taps.',
    clarity: 'clear',
    audience: [{ segment: 'Customers', need: 'Book a haircut' }],
    roles: ['Customer', 'Barber', 'Admin'],
    product: { projectType: 'mobile', subtype: 'booking' },
    platforms: ['ios', 'android'],
    approach: 'cross',
    hasDesigns: false,
    uiLanguages: 1,
    urgency: 'normal',
    features: [
      { id: 'auth_basic', phase: 'mvp', note: '' },
      { id: 'orders', phase: 'mvp', note: '' },
      { id: 'admin_panel', phase: 'mvp', note: '' },
    ],
    integrations: [],
    extraDeliverables: [],
    unpricedItems: [],
    complexityFlags: [],
    stack: ['flutter', 'nestjs', 'postgresql'],
    assumptions: [],
    ...patch,
  };
}

const screen = (name: string, blocks: WireframeScreen['blocks'], phase: WireframeScreen['phase'] = 'mvp'): WireframeScreen => ({
  name,
  purpose: '',
  device: 'phone',
  phase,
  blocks,
});

function priced(patch: Partial<PricedScope> = {}): PricedScope {
  return {
    product: { projectType: 'web', subtype: 'portal' },
    mvpRefs: ['catalog', 'search', 'custom_api', 'admin_panel'],
    laterRefs: [],
    extraRefs: [],
    hasGrowth: false,
    unpriced: ['Follow Up Boss CRM connection'],
    frames: { primary: 'browser', mvp: ['browser'], later: ['browser'] },
    ...patch,
  };
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

s.group('reconcile — roles when the MVP has two kinds of users');
{
  const out = reconcileScope(scope(), 'Barbershop booking app', 'en');
  s.ok(
    'a customer and a barber → roles priced in the MVP',
    out.scope.features.some(f => f.id === 'roles' && f.phase === 'mvp')
  );
  s.ok(
    'the change is recorded',
    out.adjustments.some(a => a.startsWith('feature roles added'))
  );
  s.ok(
    'an admin is the operator, not a second side',
    !needsRoles(['Customer', 'Admin'], { projectType: 'mobile', subtype: 'booking' }, [])
  );
  s.ok('front desk staff work in the admin panel', !needsRoles(['Patient', 'Front Desk'], { projectType: 'web', subtype: 'portal' }, []));
  s.ok(
    'couriers priced by their own feature',
    !needsRoles(['Customer', 'Courier'], { projectType: 'mobile', subtype: 'delivery' }, [
      { id: 'courier_tracking', phase: 'mvp', note: '' },
    ])
  );
  s.ok('a Telegram bot has no roles feature', !needsRoles(['Mijoz', 'Xodim'], { projectType: 'telegram', subtype: 'order_bot' }, []));
  s.ok(
    'a company site has visitors, not accounts',
    !needsRoles(['Visitor', 'Editor', 'Client'], { projectType: 'web', subtype: 'corporate' }, [])
  );
  const already = reconcileScope(scope({ features: [{ id: 'roles', phase: 'later', note: '' }] }), 'Barbershop booking app', 'en');
  s.eq('roles already in the scope stays as the model placed it', already.scope.features.filter(f => f.id === 'roles').length, 1);
}

s.group('reconcile — a pilot never prices the rollout');
{
  const erp = scope({
    title: 'ERP pilot: procurement and inventory',
    summary: 'A pilot for one plant.',
    product: { projectType: 'web', subtype: 'crm' },
    roles: ['Warehouse manager', 'Admin'],
    features: [
      { id: 'dashboard', phase: 'mvp', note: '' },
      { id: 'highload', phase: 'later', note: 'Scale to all plants' },
    ],
    complexityFlags: ['high_load', 'multi_role'],
    unpricedItems: ['Finance module'],
    stack: ['nextjs', 'nestjs', 'postgresql', 'local_vps', 'aws'],
  });
  const idea = 'Manufacturing holding, 12 plants in three countries, ERP replacing SAP, on-premise, in English, Russian and Uzbek.';
  const out = reconcileScope(erp, idea, 'en');
  s.ok('highload removed', !out.scope.features.some(f => f.id === 'highload'));
  s.ok('high_load flag removed', !out.scope.complexityFlags.includes('high_load'));
  s.ok(
    'the rollout is named as not priced',
    out.scope.unpricedItems.some(u => /rollout/i.test(u))
  );
  s.ok('on-premise: no cloud or TAS-IX hosting in the stack', !out.scope.stack.some(t => ['local_vps', 'aws'].includes(t)));
  const noPilot = reconcileScope({ ...erp, title: 'ERP', summary: 'A full ERP.' }, 'ERP for 12 plants', 'en');
  s.ok(
    'no pilot → highload stays',
    noPilot.scope.features.some(f => f.id === 'highload')
  );
}

s.group('reconcile — Uzbek hosting needs Uzbekistan, not the Uzbek language');
{
  s.ok('EN: "in English, Russian and Uzbek" is not Uzbekistan', !uzHostingFits('An ERP in English, Russian and Uzbek', 'en'));
  s.ok('EN: a Tashkent business is', uzHostingFits('An app for our shop in Tashkent', 'en'));
  s.ok('EN: Uzbekistan named outright is', uzHostingFits('We sell across Uzbekistan', 'en'));
  s.ok('uz page: the default market', uzHostingFits('Kafe uchun bot', 'uz'));
  s.ok('ru page for Almaty: not', !uzHostingFits('Цветочный магазин в Алматы', 'ru'));
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

s.group('uzbek — always-right fixes from the iteration-2 native audit');
{
  const pairs: [string, string][] = [
    ['mahsulot yetmab qolganda', 'mahsulot yetmay qolganda'],
    ["Ko'rsatkich | Aprela | Avgusta", "Ko'rsatkich | Aprel | Avgust"],
    ['Sotuvdan fiscal chek majburiy', 'Sotuvdan fiskal chek majburiy'],
    ['Kocha va uy', "Ko'cha va uy"],
    ['Yolovchi notanish haydovchi bilan', "Yo'lovchi notanish haydovchi bilan"],
    ['Kontent kiritish sizning zimangizda', 'Kontent kiritish sizning zimmangizda'],
    ['promo-kodlar', 'promokodlar'],
    ['Yumurta — 300 dona', 'Tuxum — 300 dona'],
    ['Mijoz kartochkasi', 'Mijoz kartasi'],
    ["baholar keyin ma'noga ega bo'ladi", "baholar keyin foydali bo'ladi"],
    ["o'sish bosqichida narxlangan", "o'sish bosqichida narxga kiritilgan"],
    ['avtomat eslatmalar', 'avtomatik eslatmalar'],
    ['ikkinchi bosqichga rejalangan', 'ikkinchi bosqichga rejalashtirilgan'],
    ['tarjima bu smetaga kirmaydi', 'tarjima bu narxga kirmaydi'],
    ["So'nggi balllar", "So'nggi ballar"],
  ];
  for (const [from, to] of pairs) s.eq(`${from} → ${to}`, cleanVisibleText(from, 'uz'), to);
  for (const same of ['ikki marta tekshiramiz', 'smeta tuzish xizmati', "to'lov qabul qilinadi", 'Telegram guruhi']) {
    s.eq(`unchanged: ${same}`, cleanVisibleText(same, 'uz'), same);
  }
}

s.group('english — "priced separately" means not in this estimate');
{
  const pairs: [string, string][] = [
    ['Migration and EDI are priced separately.', 'Migration and EDI are not in this estimate.'],
    ['the Follow Up Boss connection is priced separately', 'the Follow Up Boss connection is not in this estimate'],
    ['a US SMS provider priced separately from the build', 'a US SMS provider outside this estimate'],
    ['The priced build includes separate workspaces', 'This estimate includes separate workspaces'],
    ['the priced evaluation work tests answers', 'the evaluation work in this estimate tests answers'],
  ];
  for (const [from, to] of pairs) s.eq(`${from} → ${to}`, cleanVisibleText(from, 'en'), to);
  s.eq('Russian pages untouched', cleanVisibleText('priced separately', 'ru'), 'priced separately');
}

/* ------------------------------------------------------------------ */
/* Uzbek copy-edit                                                     */
/* ------------------------------------------------------------------ */

s.group('copy-edit — spans, refusals, application');
{
  s.eq('exact span', replaceSpan('safar emas, balki summa', 'safar emas, balki ', ''), 'summa');
  s.eq('span with a curly apostrophe', replaceSpan("yo'lovchi kutadi", 'yo’lovchi', 'yolovchi'), 'yolovchi kutadi');
  s.eq('missing span → null', replaceSpan('abc', 'xyz', 'q'), null);
  s.eq('a fixed suffix is fine', refuseFix('integratsiya APIini taqdim etadimi?', 'integratsiya APIni taqdim etadimi?'), null);
  s.eq('brand case may change', refuseFix('AmoCRM ulanishi', 'amoCRM ulanishi'), null);
  s.eq('MVP may become "birinchi versiya"', refuseFix('MVPda mijozlar yoziladi', 'Birinchi versiyada mijozlar yoziladi'), null);
  s.eq('a number may not change', refuseFix("Patir — 12 000 so'm", "Patir — 15 000 so'm"), 'changes a number');
  s.eq('a brand may not go', refuseFix('Telegramga xabar yuboriladi', 'xabar yuboriladi'), 'drops Telegram');
  s.eq('no Cyrillic', refuseFix('Menyu', 'Меню'), 'Cyrillic');
  s.eq('no new duration', refuseFix('Tez ishga tushadi', 'Ikki haftada ishga tushadi'), 'adds a price or duration');
  s.ok(
    'no rewrite of everything',
    refuseFix('Qisqa matn', "Butunlay boshqa, ancha uzun va yangi ma'lumot qo'shilgan matn bu yerda turibdi") === 'rewrites too much'
  );

  const texts = ['Rahbar uchun KPI: konversiya, safar emas, balki summa?', 'Yozuvingiz qabul qilindi', "Patir — 12 000 so'm"];
  const parsed = parsePolishJson(
    JSON.stringify({
      fixes: [
        { id: 1, find: 'safar emas, balki ', replace: 'yoki ' },
        { id: 2, find: 'Yozuvingiz', replace: 'Yozilishingiz' },
        { id: 3, find: '12 000', replace: '15 000' },
        { id: 9, find: 'x', replace: 'y' },
      ],
    }),
    texts
  );
  s.ok('parses', !!parsed?.usable);
  s.eq('fix 1 applied', parsed?.value.get(texts[0]), 'Rahbar uchun KPI: konversiya, yoki summa?');
  s.eq('fix 2 applied', parsed?.value.get(texts[1]), 'Yozilishingiz qabul qilindi');
  s.ok('a price change refused', !parsed?.value.has(texts[2]) && !!parsed?.issues.some(i => i.includes('changes a number')));
  s.ok('an unknown id reported', !!parsed?.issues.some(i => i.includes('unknown string')));
  s.ok('"no fixes" is a complete answer', parsePolishJson('{"fixes":[]}', texts)?.usable === true);

  const sc = scope({ summary: 'Mijoz yoziladi.', assumptions: ['Mijoz yoziladi.', 'Egasi boshqaradi'] });
  s.eq('distinct strings only', collectTexts(sc, mapScopeTexts).filter(t => t === 'Mijoz yoziladi.').length, 1);
  const fixed = applyFixes(sc, mapScopeTexts, new Map([['Mijoz yoziladi.', 'Mijoz bron qiladi.']]));
  s.ok('every occurrence fixed', fixed.summary === 'Mijoz bron qiladi.' && fixed.assumptions[0] === 'Mijoz bron qiladi.');
  s.eq('the input is not mutated', sc.summary, 'Mijoz yoziladi.');
  s.eq('roles are never edited (they split the wireframes)', collectTexts(sc, mapScopeTexts).includes('Barber'), false);
  const plan = { buildFirst: { what: 'A', why: 'B' }, canWait: [{ item: 'C', reason: 'D', inEstimate: true }], phases: [] };
  s.eq('plan strings', collectTexts(plan, mapPlanTexts), ['A', 'B', 'C', 'D']);
  s.eq('risks strings', collectTexts({ risks: [{ title: 'T', detail: 'E', mitigation: 'M' }], questions: ['Q'] }, mapRisksTexts), [
    'T',
    'E',
    'M',
    'Q',
  ]);
  s.ok('copy-edit parts are named', AUX_PARTS.includes('polishPlan') && AUX_PARTS.includes('polishRisks'));
  const prompt = buildPolishUserPrompt('kafe uchun bot', ['bir', 'ikki']);
  s.ok('strings numbered from 1', prompt.includes('{"id":1,"text":"bir"}') && prompt.includes('{"id":2,"text":"ikki"}'));
  s.ok('the copy editor carries the style guide', buildPolishSystemPrompt().includes('UZBEK STYLE GUIDE'));
}

/* ------------------------------------------------------------------ */
/* Samples and the wireframe halves                                    */
/* ------------------------------------------------------------------ */

s.group('samples — one set of items, prices and places for both halves');
{
  const ctx = { locale: 'uz' as const, idea: 'Nonvoyxona uchun bot', avoidNames: ['Dilnoza'] };
  const parsed = parseSamplesJson(
    JSON.stringify({
      samples: [
        "Patir — 12 000 so'm",
        "Patir — 12 000 so'm",
        'Dilnoza opa pishiriqlari',
        '+998 90 123 45 67',
        "1 250 000 so'm — to'y non to'plami",
        '2005-yildan beri ishlaymiz',
        'Chilonzor filiali',
      ],
    }),
    ctx
  );
  s.ok('usable', !!parsed?.usable);
  // 'Chilonzor filiali' goes too since 2026-10-11: one bakery has no branches (`specifics.ts`).
  s.eq('deduped, no names, phones, claims or invented branches; a big price is not a phone', parsed?.value, [
    "Patir — 12 000 so'm",
    "1 250 000 so'm — to'y non to'plami",
  ]);
  s.eq(
    'a branch stays when the idea has several',
    parseSamplesJson(JSON.stringify({ samples: ["Patir — 12 000 so'm", 'Chilonzor filiali'] }), {
      ...ctx,
      idea: 'Uchta filialli nonvoyxona uchun bot',
    })?.value,
    ["Patir — 12 000 so'm", 'Chilonzor filiali']
  );
  s.ok('capped', CAPS.samples === 8);
  s.ok('one sample is not enough', parseSamplesJson('{"samples":["Patir"]}', ctx)?.usable === false);

  const sc = scope();
  const pr = priced({ product: { projectType: 'mobile', subtype: 'booking' } });
  const screensPrompt = buildScopedUserPrompt('idea', 'en', sc, pr, false, 'exactly 3 MVP screens', ['Haircut — $25', 'Downtown']);
  s.ok('the wireframe halves get SAMPLE DATA', screensPrompt.includes('SAMPLE DATA: Haircut — $25; Downtown'));
  s.ok('plan and risks do not', !buildScopedUserPrompt('idea', 'en', sc, pr, false, undefined, ['Haircut — $25']).includes('SAMPLE DATA'));
  s.ok(
    'samples only for customer-facing products',
    !!SAMPLE_PRODUCTS.mobile?.includes('delivery') && !SAMPLE_PRODUCTS.web?.includes('crm')
  );
  s.ok('no samples for AI tools', !SAMPLE_PRODUCTS.ai);
  s.ok(
    "samples prompt forbids the software's own prices",
    buildSamplesSystemPrompt('uz').includes('plans, licences and prices of the software itself')
  );

  const main = [
    screen('Menyu', [
      { kind: 'card-grid', label: 'Nonlar', items: ["Patir — 12 000 so'm", "Obi non — 6 000 so'm"] },
      { kind: 'button', label: 'Savatga', items: [] },
    ]),
    screen('Savat', [
      { kind: 'cart', label: 'Savat', items: ["Patir — 12 000 so'm", "Jami: 18 000 so'm"] },
      { kind: 'button', label: 'Buyurtma', items: [] },
    ]),
  ];
  const rest = [
    screen('Admin', [
      { kind: 'list', label: 'Mahsulotlar', items: ["Patir — 15 000 so'm", "Obi non: 6 000 so'm", "Jami: 240 000 so'm"] },
      { kind: 'button', label: 'Saqlash', items: [] },
    ]),
  ];
  const issues: string[] = [];
  const merged = screensOf(main, rest, issues);
  s.eq('the second price of an item follows the first', merged[2].blocks[0].items[0], "Patir — 12 000 so'm");
  s.eq('a different separator keeps its own form', merged[2].blocks[0].items[1], "Obi non: 6 000 so'm");
  s.eq('totals are never harmonized', merged[2].blocks[0].items[2], "Jami: 240 000 so'm");
  s.ok(
    'the change is logged',
    issues.some(i => i.startsWith('harmonized'))
  );
  s.eq('nothing to harmonize → same screens', harmonizeSamplePrices(main), main);
}

s.group('screens — our product only');
{
  s.ok('"… in Zendesk" is Zendesk\'s own screen', isThirdPartyScreen('Agent handoff queue in Zendesk'));
  s.ok('"amoCRM ichida" too', isThirdPartyScreen('amoCRM ichida bitimlar'));
  s.ok('importing from amoCRM is ours', !isThirdPartyScreen("amoCRMdagi ma'lumotlarni ko'chirish"));
  s.ok('exporting to QuickBooks is ours', !isThirdPartyScreen('Export to QuickBooks'));
  s.ok('Russian "в 1С" (into 1C) is ours', !isThirdPartyScreen('Выгрузка в 1С'));
  const issues: string[] = [];
  const out = guardScreens(
    [
      screen('Handoff to a human agent', [
        { kind: 'chat', label: 'Handoff', items: ['Connecting you with an agent'] },
        { kind: 'text', label: 'You are in the queue', items: [] },
      ]),
      screen('Agent handoff queue in Zendesk', [
        { kind: 'table', label: 'Queue', items: ['Chat', 'Language'] },
        { kind: 'button', label: 'Take over chat', items: [] },
      ]),
    ],
    {
      locale: 'en',
      idea: 'AI support bot with Zendesk handoff',
      priced: priced({ product: { projectType: 'ai', subtype: 'ai_integration' }, mvpRefs: ['rag_kb', 'custom_api'] }),
    },
    issues
  );
  s.eq(
    'the Zendesk screen is dropped, ours stays',
    out.map(x => x.name),
    ['Handoff to a human agent']
  );
}

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

s.group('prompts — nothing to copy, consistency rules');
{
  const uz = buildPlanSystemPrompt('uz');
  s.ok('no sample date in the uz guide', !uz.includes('15-mart'));
  s.ok('no sample price in the uz screens prompt', !buildScreensSystemPrompt('uz').includes('45 000'));
  s.ok('no "safar" word list entry to leak', !uz.includes('safar'));
  s.ok('the guide is vocabulary, not content', uz.includes('It is vocabulary, not content'));
  // 2026-10-10 glossary pass: the reviewers' term ("merchant shartnomasi"), also what polishUzbek writes for "savdogar shartnomasi".
  s.ok('merchant agreement in Uzbek', uz.includes('merchant shartnomasi') && uz.includes('never savdogar shartnomasi'));
  s.ok('MVP is not kept as a term in uz sentences', !uz.includes('(MVP, backend'));
  const plan = buildPlanSystemPrompt('en');
  s.ok('never "priced separately"', plan.includes('never "priced separately"'));
  s.ok('document AI includes loading the documents', plan.includes('includes loading the documents they provide'));
  s.ok('a pilot never includes the rollout', plan.includes('A PILOT never includes the rollout'));
  const screens = buildScreensSystemPrompt('en');
  s.ok('no third-party screens', screens.includes('never draw the screens of a system it connects to'));
  s.ok(
    'nav and stats follow the MVP',
    screens.includes('Navigation items, tabs, KPI tiles, statuses and table columns name only what the MVP prices')
  );
  const scopePrompt = buildScopeSystemPrompt('en');
  s.ok(
    'online payment only when the idea needs it',
    scopePrompt.includes('a short, vague ordering, booking or ride idea takes payment in person first')
  );
  s.ok('everything outside goes to unpricedItems', scopePrompt.includes('never into an assumption ("priced separately")'));
}

/* ------------------------------------------------------------------ */
/* Checker false positives                                             */
/* ------------------------------------------------------------------ */

s.group('consistency checker — fewer false positives');
{
  s.ok('"main" is not "maintenance"', !tokensMatch('main', 'maintenance'));
  s.ok('"card" is still "cards"', tokensMatch('card', 'cards'));
  s.ok('5+ letter stems keep their reach', tokensMatch('booking', 'bookings'));
  const map = CONCEPTS.find(c => c.id === 'map');
  s.ok('"route unresolved chats" is not a map', !map?.re.test('Route unresolved chats to your Zendesk agents'));
  s.ok('"Delivery routes" still is', !!map?.re.test('Delivery routes'));

  const brief = {
    version: 1,
    locale: 'en',
    model: 'kimi-k3',
    models: { scope: 'kimi-k3', narrative: 'kimi-k3', screens: null },
    title: 'Brokerage site',
    summary: 'Buyers browse listings from the IDX feed.',
    audience: [],
    roles: ['Buyer'],
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
        subtype: 'portal',
        platforms: [],
        approach: 'cross',
        tier: 'mvp',
        design: 'custom',
        languages: 1,
        urgency: 'normal',
        screens: 10,
      },
      mvp: {
        price: { currency: 'USD', min: 1, max: 2, basis: 'en_dual_rate' },
        weeks: { min: 1, max: 2 },
        team: [],
        drivers: [],
      },
      fullVision: null,
      extras: [],
      phases: [],
      unpricedItems: ['Follow Up Boss CRM connection'],
      adjustments: [],
    },
    narrative: {
      buildFirst: { what: '', why: '' },
      canWait: [],
      risks: [],
      questions: [],
      assumptions: [
        'Lead forms store submissions; the Follow Up Boss connection is not in this estimate.',
        'Text reminders run through a US SMS provider outside this estimate.',
      ],
    },
    policy: { status: 'ok', topics: [], note: '' },
  } as unknown as AiBrief;
  const report = checkBriefConsistency(brief, priced());
  s.ok('a negated unpriced brand does not negate the priced IDX feed', !report.violations.some(v => v.kind === 'assumption_negates_mvp'));
  s.ok('"outside this estimate" is not a promise', !report.violations.some(v => v.kind === 'assumption_not_in_scope'));
}

/* ------------------------------------------------------------------ */
/* Spend cap                                                           */
/* ------------------------------------------------------------------ */

s.group('daily budget — briefs in flight hold their reserve');
{
  const budget = createDailyBudget({ maxCalls: 100, maxUsd: 0.5, reserveUsd: 0.2 }, () => new Date('2026-10-10T10:00:00Z'));
  s.ok('first brief starts', budget.tryStart());
  s.ok('second brief starts (2 × 0.20 ≤ 0.50)', budget.tryStart());
  s.ok('a third parallel brief is refused before any cost is recorded', !budget.tryStart());
  s.eq('two in flight', budget.snapshot().inFlight, 2);
  budget.record(0.09);
  s.ok('a finished brief releases its reserve (0.09 + 2 × 0.20 ≤ 0.50)', budget.tryStart());
  budget.record(0);
  budget.record(0.1);
  s.eq('nothing in flight after every record', budget.snapshot().inFlight, 0);
  s.ok('spent counts only real cost', Math.abs(budget.snapshot().spentUsd - 0.19) < 1e-9);
}

/* ------------------------------------------------------------------ */
/* Text mappers keep wireframes intact                                 */
/* ------------------------------------------------------------------ */

s.group('copy-edit on wireframes');
{
  const screens = [screen('Menyu', [{ kind: 'list', label: 'Taomlar', items: ["Shashlik mol go'sht", 'Osh'] }])];
  const out = applyFixes(screens, mapScreensTexts, new Map([["Shashlik mol go'sht", "Mol go'shtli shashlik"]]));
  s.eq('item fixed', out[0].blocks[0].items[0], "Mol go'shtli shashlik");
  s.eq('shape kept', out[0].blocks[0].kind, 'list');
  s.eq('input not mutated', screens[0].blocks[0].items[0], "Shashlik mol go'sht");
}

process.exit(s.report());
