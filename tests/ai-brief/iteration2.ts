/**
 * AI brief — round 2 iteration 2 logic, no network, no model calls.
 *
 *   npx tsx tests/ai-brief/iteration2.ts
 *
 * Covers what iteration 2 added around the model, each from an auditor
 * finding: the timeline keeps the core flow and the named integrations
 * (deliverables picked by kind, one per ref), "build first" rebuilt instead of
 * a leftover fragment, words put in the reader's mouth stripped, search
 * fields only with priced search, Mailchimp/Twilio priced through their
 * catalog ids, stack and flags that follow the priced scope, not-offered items
 * named by the reader's note, the Uzbek polish, the catch-all subtype label
 * and the replayable pipeline stages.
 */
import { FEATURE_BY_ID } from '../../src/modules/estimator/data/catalog';
import { cleanVisibleText, polishUzbek } from '../../src/modules/estimator/ai-brief/cleanText';
import { checkBriefConsistency, framingLeaks, type ViewSource } from '../../src/modules/estimator/ai-brief/consistency';
import type { PricedScope } from '../../src/modules/estimator/ai-brief/digest';
import { pricedScopeOf } from '../../src/modules/estimator/ai-brief/digest';
import { firstVersionLine, guardBriefText, stripAttributions } from '../../src/modules/estimator/ai-brief/guard';
import { buildEstimate, mapScopeToInputs, priceDrivers, productLabelKey } from '../../src/modules/estimator/ai-brief/mapping';
import { assembleBrief, laterPartSpecs, priceScope, screensOf } from '../../src/modules/estimator/ai-brief/orchestrator';
import { parsePlanJson, pickDeliverables } from '../../src/modules/estimator/ai-brief/parseNarrative';
import { scrubContactDetails } from '../../src/modules/estimator/ai-brief/scrub';
import { buildPlanSystemPrompt, buildScopeSystemPrompt, buildScreensSystemPrompt } from '../../src/modules/estimator/ai-brief/prompts';
import { reconcileScope } from '../../src/modules/estimator/ai-brief/reconcile';
import { mergeScreenParts, parseScreensJson } from '../../src/modules/estimator/ai-brief/screens';
import { isPricedEstimate, type AiBrief, type BriefScope, type WireframeScreen } from '../../src/modules/estimator/ai-brief/types';
import { calculateEstimate } from '../../src/modules/estimator/utils/estimator';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-iteration2');

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function scope(patch: Partial<BriefScope> = {}): BriefScope {
  return {
    isProjectIdea: true,
    rejection: 'none',
    policy: { status: 'ok', topics: [], note: '' },
    title: 'Taco ordering',
    summary: 'Online ordering for your two restaurants.',
    clarity: 'clear',
    audience: [{ segment: 'Customers', need: 'Order for pickup' }],
    roles: ['Customer', 'Manager'],
    product: { projectType: 'web', subtype: 'ecommerce' },
    platforms: [],
    approach: 'cross',
    hasDesigns: false,
    uiLanguages: 1,
    urgency: 'normal',
    features: [
      { id: 'catalog', phase: 'mvp', note: '' },
      { id: 'cart_checkout', phase: 'mvp', note: '' },
      { id: 'orders', phase: 'mvp', note: '' },
      { id: 'admin_panel', phase: 'mvp', note: '' },
    ],
    integrations: [
      { id: 'stripe', phase: 'mvp', note: '' },
      { id: 'custom_api', phase: 'mvp', note: 'Orders into Toast POS' },
    ],
    extraDeliverables: [],
    unpricedItems: [],
    complexityFlags: [],
    stack: [],
    assumptions: [],
    ...patch,
  };
}

function priced(patch: Partial<PricedScope> = {}): PricedScope {
  return {
    product: { projectType: 'web', subtype: 'ecommerce' },
    mvpRefs: ['catalog', 'cart_checkout', 'orders', 'admin_panel', 'stripe', 'custom_api'],
    laterRefs: ['loyalty'],
    extraRefs: [],
    hasGrowth: true,
    unpriced: ['Telegram customer messaging'],
    unpricedRefs: [],
    frames: { primary: 'browser', mvp: ['browser'], later: ['browser'] },
    ...patch,
  };
}

const SOURCE: ViewSource = {
  locale: 'en',
  title: 'Taco ordering',
  roles: ['Customer', 'Manager'],
  integrations: [],
  languages: 1,
  platforms: [],
};
const EN = { locale: 'en' as const, idea: 'Online ordering for our two taco restaurants' };

function brief(patch: Partial<AiBrief> = {}, narrative: Partial<AiBrief['narrative']> = {}, mvpDeliverables?: string[]): AiBrief {
  const price = { currency: 'USD' as const, min: 1000, max: 2000, basis: 'en_dual_rate' as const };
  return {
    version: 1,
    locale: 'en',
    model: 'kimi-k3',
    models: { scope: 'kimi-k3', narrative: 'kimi-k3', screens: 'kimi-k3' },
    title: 'Taco ordering',
    summary: 'Online ordering for your two restaurants.',
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
        {
          id: 'mvp',
          title: 'Launch',
          goal: 'Take paid orders online.',
          deliverables: mvpDeliverables ?? ['Menu and checkout', 'Card payments through Stripe', 'Orders into Toast POS'],
          weeks: { min: 4, max: 6 },
        },
      ],
      unpricedItems: [],
      adjustments: [],
    },
    narrative: {
      buildFirst: { what: 'A website where customers order and pay by card.', why: 'It earns from day one.' },
      canWait: [],
      risks: [{ title: 'Toast access', detail: 'Toast approves partners.', mitigation: 'Apply for partner access early.' }],
      questions: ['How many menu items?', 'Pickup only first?', 'Who updates the menu?'],
      assumptions: [],
      ...narrative,
    },
    policy: { status: 'ok', topics: [], note: '' },
    ...patch,
  };
}

/* ------------------------------------------------------------------ */
/* Timeline: deliverables picked by kind                                */
/* ------------------------------------------------------------------ */

s.group('timeline — the core flow and the named integrations survive the cap');
{
  const tenInCatalogOrder = [
    { text: 'Website foundation', ref: 'core' },
    { text: 'Sign-up and login', ref: 'auth_basic' },
    { text: 'Roles for staff', ref: 'roles' },
    { text: 'Customer profiles', ref: 'profiles' },
    { text: 'Menu catalog', ref: 'catalog' },
    { text: 'Cart and checkout', ref: 'cart_checkout' },
    { text: 'Order statuses', ref: 'orders' },
    { text: 'Card payments through Stripe', ref: 'stripe' },
    { text: 'Orders into Toast POS', ref: 'custom_api' },
    { text: 'Order emails', ref: 'email_service' },
  ];
  const picked = pickDeliverables(tenInCatalogOrder, 5).map(d => d.ref);
  s.eq('five kept', picked.length, 5);
  s.ok('payments kept', picked.includes('stripe'), picked.join(','));
  s.ok('the named system (Toast) kept', picked.includes('custom_api'), picked.join(','));
  s.ok('setup lines go first', !picked.some(r => ['auth_basic', 'roles', 'profiles'].includes(r)), picked.join(','));
  s.eq(
    'model order kept among the picked',
    picked,
    [...picked].sort((a, b) => tenInCatalogOrder.findIndex(d => d.ref === a) - tenInCatalogOrder.findIndex(d => d.ref === b))
  );
  s.eq('five or fewer pass through untouched', pickDeliverables(tenInCatalogOrder.slice(0, 3), 5).length, 3);

  const plan = parsePlanJson(
    JSON.stringify({
      buildFirst: { what: 'Ordering website.', why: 'Earns first.' },
      canWait: [],
      phases: [
        {
          id: 'mvp',
          title: 'Launch',
          goal: 'Take orders.',
          deliverables: [
            { text: 'Sign-up and login', ref: 'auth_basic' },
            { text: 'Sign-up with Google', ref: 'auth_basic' },
            { text: 'Menu catalog', ref: 'catalog' },
          ],
        },
        { id: 'growth', title: 'Grow', goal: 'Repeat orders.', deliverables: [{ text: 'Loyalty', ref: 'loyalty' }] },
      ],
    }),
    { ...EN, priced: priced({ mvpRefs: ['auth_basic', 'catalog'] }) }
  );
  const mvp = plan?.value.phases.find(p => p.id === 'mvp');
  s.eq('one line per ref (a repeated sign-up line dropped)', mvp?.deliverables, ['Sign-up and login', 'Menu catalog']);
  s.ok('the drop is recorded', !!plan?.issues.some(i => i.includes('repeats auth_basic')));
}

/* ------------------------------------------------------------------ */
/* Guard: build first, attribution, fallbacks                          */
/* ------------------------------------------------------------------ */

s.group('guard — "build first" is rebuilt, never left as a fragment');
{
  const leadFails = brief(
    {},
    { buildFirst: { what: 'A website with Telegram customer messaging built in. The interface ships in English.', why: 'Earns first.' } }
  );
  const out = guardBriefText(leadFails, priced(), SOURCE);
  s.eq(
    'lead sentence failing → rebuilt from the MVP deliverables',
    out.value.narrative.buildFirst.what,
    'First version: Menu and checkout; Card payments through Stripe; Orders into Toast POS.'
  );
  s.ok(
    'the rebuild is recorded',
    out.removed.some(r => r.startsWith('rebuilt buildFirst.what'))
  );

  const tailFails = brief(
    {},
    {
      buildFirst: {
        what: 'A website where customers order and pay by card. Telegram customer messaging comes with it.',
        why: 'Earns first.',
      },
    }
  );
  s.eq(
    'a failing later sentence is just dropped',
    guardBriefText(tailFails, priced(), SOURCE).value.narrative.buildFirst.what,
    'A website where customers order and pay by card.'
  );
  s.eq(
    'first-version line, uz',
    firstVersionLine(['Menyu', "Payme orqali to'lov."], 'uz'),
    "Birinchi versiya: Menyu; Payme orqali to'lov."
  );
  s.eq('first-version line, nothing to list', firstVersionLine([], 'ru'), '');
}

s.group("guard — words put in the reader's mouth");
{
  s.ok(
    '"the module you confirmed as first" is a framing error',
    framingLeaks('the module you confirmed as first').some(f => f.severity === 'error')
  );
  s.ok('"as you said yourself" is a framing error', framingLeaks('IFTA can wait, as you said yourself.').length > 0);
  s.ok('uz: "Siz o\'zingiz aytdingiz" is a framing error', framingLeaks("Siz o'zingiz aytdingiz: avval veb-sayt").length > 0);
  s.ok('ru: "как вы сами сказали" is a framing error', framingLeaks('Как вы сами сказали, сначала сайт.').length > 0);
  s.eq('"once you have confirmed the menu" is fine', framingLeaks('Once you have confirmed the menu, we start.'), []);
  s.eq('uz: "tasdiqlaganingizdan keyin" is fine', framingLeaks('Menyuni tasdiqlaganingizdan keyin boshlaymiz.'), []);

  s.eq(
    'trailing clause stripped',
    stripAttributions('Not in this estimate; it is a separate tool, as you said yourself.'),
    'Not in this estimate; it is a separate tool.'
  );
  s.eq(
    'leading clause stripped, the rest capitalized',
    stripAttributions("Siz o'zingiz aytdingiz: avval veb-sayt, ilova keyingi bosqichda."),
    'Avval veb-sayt, ilova keyingi bosqichda.'
  );
  s.eq(
    'mid-sentence clause after a semicolon',
    stripAttributions('Not in this estimate; as you confirmed, they follow later.'),
    'Not in this estimate; they follow later.'
  );

  const out = guardBriefText(
    brief(
      {},
      {
        buildFirst: { what: 'A website where customers order and pay by card.', why: 'It is the module you confirmed as first.' },
        canWait: [{ item: 'Loyalty', reason: 'You confirmed it waits.', inEstimate: true }],
      }
    ),
    priced(),
    SOURCE
  );
  s.ok(
    'a why that only leaks framing is replaced',
    !framingLeaks(out.value.narrative.buildFirst.why).length && !!out.value.narrative.buildFirst.why
  );
  s.eq('a can-wait item whose only reason leaks framing is dropped', out.value.narrative.canWait, []);
}

/* ------------------------------------------------------------------ */
/* Wireframes: search only with priced search                          */
/* ------------------------------------------------------------------ */

s.group('wireframes — a search field needs "Search & filters"');
{
  const answer = (device: string, blocks: object[]) =>
    JSON.stringify({ screens: [{ name: 'Menu', purpose: 'Browse', device, phase: 'mvp', blocks }] });
  const blocks = [
    { kind: 'header', label: 'Menu', items: [] },
    { kind: 'search', label: 'Search tacos', items: [] },
    { kind: 'filters', label: 'Filters', items: ['Spicy', 'Vegan'] },
    { kind: 'card-grid', label: 'Tacos', items: ['Al pastor', 'Carnitas'] },
  ];
  const ctx = (p: Partial<PricedScope> = {}) => ({ ...EN, priced: priced(p), minScreens: 1 });
  const kinds = (text: string, c: ReturnType<typeof ctx>) => parseScreensJson(text, c)?.value[0]?.blocks.map(b => b.kind) ?? [];
  s.eq('dropped without search priced', kinds(answer('browser', blocks), ctx()), ['header', 'card-grid']);
  s.eq('kept with search priced', kinds(answer('browser', blocks), ctx({ mvpRefs: [...priced().mvpRefs, 'search'] })), [
    'header',
    'search',
    'filters',
    'card-grid',
  ]);
  const mobile = priced({
    product: { projectType: 'mobile', subtype: 'delivery' },
    frames: { primary: 'phone', mvp: ['phone', 'browser'], later: ['phone', 'browser'] },
  });
  s.eq(
    'an operator view on the admin frame keeps its filters',
    kinds(answer('browser', blocks), { ...EN, priced: mobile, minScreens: 1 }),
    ['header', 'search', 'filters', 'card-grid']
  );
  const address = [
    { kind: 'header', label: 'Where to', items: [] },
    { kind: 'search', label: 'Enter delivery address', items: [] },
    { kind: 'map', label: 'Your location', items: [] },
  ];
  const withMap = priced({ mvpRefs: [...priced().mvpRefs, 'address_picker'] });
  s.eq('an address search over a priced map stays', kinds(answer('browser', address), { ...EN, priced: withMap, minScreens: 1 }), [
    'header',
    'search',
    'map',
  ]);
}

s.group('privacy — a scrubbed name never shows up as sample copy');
{
  const scrubbed = scrubContactDetails('Здравствуйте! Меня зовут Анна Петрова, я владелица салона красоты.');
  s.eq('the scrubber keeps the replaced name words (server memory only)', scrubbed.nameWords, ['Анна', 'Петрова']);
  s.ok('…and the text the model sees has no name', !scrubbed.text.includes('Анна'));
  const answer = JSON.stringify({
    screens: [
      {
        name: 'Запись',
        purpose: 'Клиент выбирает мастера',
        device: 'browser',
        phase: 'mvp',
        blocks: [
          { kind: 'header', label: 'Запись к мастеру', items: [] },
          { kind: 'list', label: 'Мастера', items: ['Анна — сегодня 14:00', 'Дилноза — 16:30'] },
          { kind: 'text', label: 'Мастер Анна, оплата в салоне', items: [] },
          { kind: 'button', label: 'Записаться', items: [] },
        ],
      },
    ],
  });
  const ctx = { locale: 'ru' as const, idea: scrubbed.text, avoidNames: scrubbed.nameWords, priced: priced(), minScreens: 1 };
  const out = JSON.stringify(parseScreensJson(answer, ctx)?.value ?? []);
  s.ok('a wireframe text with the name is dropped', !out.includes('Анна'), out);
  s.ok('the rest of the screen stays', out.includes('Дилноза') && out.includes('Записаться'));
}

s.group('wireframes — the same screen drawn by both halves is kept once');
{
  const sc = (name: string, phase: 'mvp' | 'later' = 'mvp'): WireframeScreen => ({
    name,
    purpose: '',
    device: 'browser',
    phase,
    blocks: [
      { kind: 'header', label: name, items: [] },
      { kind: 'table', label: 'Terms', items: ['Party', 'Term'] },
    ],
  });
  const merged = mergeScreenParts(
    [sc('Upload'), sc('Contract review'), sc('Ask a question')],
    [sc('Contract Review with Risk Flags'), sc('Admin users')]
  );
  s.eq(
    'a near-duplicate from the second half is dropped',
    merged.map(m => m.name),
    ['Upload', 'Contract review', 'Ask a question', 'Admin users']
  );
  const roles = mergeScreenParts([sc('Orders'), sc('Order details')], [sc('Courier orders')]);
  s.eq('a one-word overlap is not a duplicate', roles.length, 3);
}

/* ------------------------------------------------------------------ */
/* Lexicon: brands priced through their catalog ids                    */
/* ------------------------------------------------------------------ */

s.group('consistency — Mailchimp and Twilio are priced through their catalog ids');
{
  const mvpText = (text: string, mvpRefs: string[]) =>
    checkBriefConsistency(brief({}, {}, [text]), priced({ mvpRefs, unpriced: [], laterRefs: [] })).violations.filter(v =>
      v.where.startsWith('phases.mvp')
    );
  s.eq('Mailchimp with the email service priced: no finding', mvpText('Signups sent to your Mailchimp list', ['email_service']), []);
  s.ok('Mailchimp with nothing priced: a finding', mvpText('Signups sent to your Mailchimp list', ['catalog']).length > 0);
  s.eq('Twilio texts with the SMS feature priced: no finding', mvpText('Order-ready texts through Twilio', ['otp_sms']), []);
  s.eq('"Sign in with Microsoft" with social login priced: no finding', mvpText('Sign in with Microsoft', ['social_login']), []);
}

/* ------------------------------------------------------------------ */
/* Reconcile: stack and flags follow the priced scope                   */
/* ------------------------------------------------------------------ */

s.group('reconcile — stack and flags follow what is priced');
{
  const mobileAi = scope({
    product: { projectType: 'mobile', subtype: 'business' },
    features: [{ id: 'ai_content', phase: 'mvp', note: 'reads broker rate confirmations' }],
    stack: ['flutter', 'openai', 'firebase', 'supabase', 'local_vps'],
    complexityFlags: ['ai_quality', 'geo_tracking'],
  });
  s.ok('fixture: ai_content is not offered for mobile', !FEATURE_BY_ID.get('ai_content')?.types.includes('mobile'));
  const { scope: ruled, adjustments } = reconcileScope(mobileAi, 'Dispatch app for our trucks in Dallas', 'en');
  s.eq('AI model, a second BaaS and UZ hosting dropped', ruled.stack, ['flutter', 'firebase']);
  s.eq('ai_quality dropped with no AI priced', ruled.complexityFlags, ['geo_tracking']);
  s.ok(
    'recorded as an adjustment',
    adjustments.some(a => a.startsWith('stack/flags'))
  );

  const uzWeb = scope({
    features: [{ id: 'ai_chatbot', phase: 'later', note: '' }],
    stack: ['nextjs', 'openai', 'local_vps'],
    complexityFlags: ['ai_quality'],
  });
  const kept = reconcileScope(uzWeb, "Toshkentdagi do'kon uchun sayt", 'uz').scope;
  s.eq('an AI feature priced later keeps the AI stack; UZ hosting stays for Uzbekistan', kept.stack, ['nextjs', 'openai', 'local_vps']);
  s.eq('…and the flag', kept.complexityFlags, ['ai_quality']);
}

/* ------------------------------------------------------------------ */
/* Not-offered items named by the reader's note                         */
/* ------------------------------------------------------------------ */

s.group('not priced — an item the product cannot price keeps its note');
{
  const mobileAi = scope({
    product: { projectType: 'mobile', subtype: 'business' },
    platforms: ['ios', 'android'],
    features: [
      { id: 'orders', phase: 'mvp', note: '' },
      { id: 'ai_content', phase: 'mvp', note: 'reads broker rate confirmations' },
    ],
    integrations: [],
  });
  const mapped = mapScopeToInputs(mobileAi, 'en');
  const p = pricedScopeOf(mobileAi, mapped, 'en');
  s.eq('unpriced label = catalog label + note', p.unpriced, ['AI content generation: reads broker rate confirmations']);
  s.eq('the id is carried for the checker', p.unpricedRefs, ['ai_content']);
  s.eq('the estimate lists the same text', buildEstimate(mobileAi, mapped, 'en').unpricedItems, [
    'AI content generation: reads broker rate confirmations',
  ]);
}

/* ------------------------------------------------------------------ */
/* Catch-all subtype label                                             */
/* ------------------------------------------------------------------ */

s.group('labels — a catch-all subtype is named by its service');
{
  s.eq('custom_app → "Mobile app"', productLabelKey('mobile', 'custom_app'), 'service.mobile');
  s.eq('a real subtype keeps its label', productLabelKey('web', 'ecommerce'), 'subtype.ecommerce');
  const custom = scope({
    product: { projectType: 'mobile', subtype: 'custom_app' },
    platforms: ['ios', 'android'],
    features: [],
    integrations: [],
  });
  const est = calculateEstimate(mapScopeToInputs(custom, 'en').mvp);
  const base = priceDrivers(est, 'mobile').find(d => d.id === 'base');
  s.eq('the base cost driver reads "Mobile app", not "Something else"', base?.labelKey, 'service.mobile');
}

/* ------------------------------------------------------------------ */
/* Uzbek polish                                                        */
/* ------------------------------------------------------------------ */

s.group('uzbek — always-right fixes from the native audit');
{
  const cases: [string, string][] = [
    ['Xisobotlar va otchetlar', 'Hisobotlar va hisobotlar'],
    ["hisob-kitob mantiq'iga", 'hisob-kitob mantiqiga'],
    ["Telegram'da", 'Telegramda'],
    ['1C ga ulanish, amoCRM dagi mijozlar', 'amoCRMdagi'],
    ['prixod, rasxod va ostatkalar', 'kirim, chiqim va qoldiqlar'],
    ['ostatkasi', "qoldig'i"],
    ['zakazi', 'buyurtmasi'],
    ['skladnoy', 'skladnoy'],
    // Iteration 3: "becomes useful", not "pays off" (the native audit flagged "baholar keyin o'zini oqlaydi").
    ["Bonus dasturi keyin ma'noga ega bo'ladi.", "Bonus dasturi keyin foydali bo'ladi."],
    ["Erkin o'rinlar: 5", "Bo'sh o'rinlar: 5"],
    ['Nakladnoyni pechat qilish', 'Nakladnoyni chop etish'],
    ['tayyor egarlar bazasi', 'tayyor egalar bazasi'],
    ['1C konfiguratsiyasi nomalum', "1C konfiguratsiyasi noma'lum"],
    ['Tashkentda', 'Toshkentda'],
    ["Bonus taklif qilish ma'noga ega.", "Bonus taklif qilish foydali bo'ladi."],
    ['Buyurtmalar statusi va statuslar', 'Buyurtmalar holati va holatlar'],
    ['bekor qilish tartobini belgilang', 'bekor qilish tartibini belgilang'],
    ['Soliq organnariga', 'Soliq organlariga'],
  ];
  for (const [input, expected] of cases) {
    const out = polishUzbek(input);
    s.ok(`${input} → ${expected}`, out === expected || (expected === 'amoCRMdagi' && out.includes(expected) && out.includes('1Cga')), out);
  }
  const native = "ma'lumot, san'at, e'lon, mas'uliyat, qal'a, Qur'on, sun'iy, mash'al, iste'mol, va'da, jur'ati";
  s.eq('the tutuq belgisi of native words is untouched', polishUzbek(native), native);
  s.eq('an English page keeps "Tashkent"', cleanVisibleText('Delivery in Tashkent', 'en'), 'Delivery in Tashkent');
  s.eq(
    "en: prompt jargon reads as the page's words",
    cleanVisibleText('Not in the priced scope; it can wait.', 'en'),
    'Not in this estimate; it can wait.'
  );
}

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

s.group('prompts — iteration 2 rules');
{
  const scopeEn = buildScopeSystemPrompt('en');
  s.ok('scope: text messages → otp_sms', scopeEn.includes('text messages to users') && scopeEn.includes('→ otp_sms'));
  s.ok('scope: a CRM Telegram inbox → chat + telegram_channel', scopeEn.includes('chat (the inbox) plus telegram_channel'));
  s.ok('scope: a huge idea is priced as a pilot', scopeEn.includes('PILOT'));
  s.ok('scope: never claim the reader confirmed anything', scopeEn.includes('never claim they said, confirmed or agreed'));
  const plan = buildPlanSystemPrompt('en');
  s.ok('plan: at most 5 deliverables, most important first', plan.includes('AT MOST 5 deliverables, most important first'));
  s.ok('plan: who does what', plan.includes('WHO DOES WHAT'));
  s.ok(
    'screens: search only with Search & filters',
    buildScreensSystemPrompt('en').includes('A search field or filter chips only when Search & filters')
  );
  const uz = buildPlanSystemPrompt('uz');
  s.ok('uz guide: booking is yozilish, never yozuv', uz.includes('yozilish or bron (a booking — yozuv is a written record)'));
  s.ok('uz guide: suffixes attach directly', uz.includes('1Cga'));
  s.ok('en prompts carry no Uzbek guide', !plan.includes('UZBEK STYLE GUIDE'));
}

/* ------------------------------------------------------------------ */
/* Replayable stages                                                   */
/* ------------------------------------------------------------------ */

s.group('pipeline stages — the same brief from saved answers, no model');
{
  const modelScope = scope();
  const stage = priceScope(modelScope, EN.idea, 'en');
  s.ok(
    'the priced scope prices the MVP refs',
    ['catalog', 'stripe', 'custom_api'].every(r => stage.priced.mvpRefs.includes(r))
  );
  const specs = laterPartSpecs({ ...EN, priced: stage.priced }, 'en');
  const plan = specs.plan.parse(
    JSON.stringify({
      buildFirst: { what: 'An ordering website with card payments.', why: 'It earns from the first order.' },
      canWait: [{ item: 'Loyalty', reason: 'After repeat orders.', ref: 'loyalty' }],
      phases: [{ id: 'mvp', title: 'Launch', goal: 'Take orders.', deliverables: [{ text: 'Menu and checkout', ref: 'cart_checkout' }] }],
    })
  );
  const risks = specs.risks.parse(
    JSON.stringify({
      risks: [{ title: 'Toast access', detail: 'Toast approves partners.', mitigation: 'Apply early.' }],
      questions: ['How many items?', 'Pickup only?', 'Who updates the menu?'],
    })
  );
  const screens: WireframeScreen[] = screensOf(null, null);
  s.eq('no main wireframe half → no wireframes', screens, []);
  s.ok('plan and risks parse', !!plan?.usable && !!risks?.usable);
  if (plan?.usable && risks?.usable) {
    const { brief: out, guard } = assembleBrief(
      stage,
      { ...plan.value, ...risks.value },
      [],
      { scope: 'kimi-k3', narrative: 'kimi-k3', screens: null },
      'en'
    );
    s.eq('assembled brief prices with the engine', isPricedEstimate(out.estimate) ? out.estimate.mvp.price.basis : null, 'en_dual_rate');
    s.ok('guard log has the before report', typeof guard.before.errors === 'number');
  }
}

process.exit(s.report());
