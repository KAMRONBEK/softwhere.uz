/**
 * AI brief — round 3 (founder decisions 2026-10-10), no network, no model calls.
 *
 *   npx tsx tests/ai-brief/round3.ts
 *
 * 1. Uzbek quality: the reviewers' errors as deterministic fixes (never a
 *    number, price or brand changed) and as a glossary the copy-edit reads,
 *    with each flagged string carrying a "check"; the copy-edit split into
 *    balanced parallel chunks. (Round 3 also priced one interface language on
 *    uz/ru pages; round 4 reverted that — uz/ru always price Uzbek + Russian,
 *    see the "interface languages" groups below.)
 * 2. Very large ideas: a plan without a price, decided by rule from the idea's
 *    words and the engine's numbers; no number reaches the page.
 * 3–5. Limits (per visitor unchanged; the per-instance spend cap is $3 since
 *    round 4) and pricing unchanged; the real brief in the lab's S08 slot.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BIG_IDEA_ENGINE_HOURS,
  BIG_IDEA_SCALE,
  BIG_IDEA_SCALE_MIN_MVP_HOURS,
  assessBigIdea,
  coreSystemSignal,
  parseCount,
  scaleSignals,
} from '../../src/modules/estimator/ai-brief/bigIdea';
import { cleanVisibleText } from '../../src/modules/estimator/ai-brief/cleanText';
import {
  DEFAULT_UI_LANGUAGES,
  EN_RATE_HIGH,
  EN_RATE_LOW,
  POLISH_CHAIN,
  POLISH_CHUNK_CHARS,
  POLISH_CHUNK_STRINGS,
} from '../../src/modules/estimator/ai-brief/constants';
import type { ViewSource } from '../../src/modules/estimator/ai-brief/consistency';
import type { PricedScope } from '../../src/modules/estimator/ai-brief/digest';
import { guardBriefText, guardScopeText, languageReason, switchLanguages } from '../../src/modules/estimator/ai-brief/guard';
import { buildEstimate, mapScopeToInputs, toDiscoveryEstimate } from '../../src/modules/estimator/ai-brief/mapping';
import { assembleBrief, previewOf, priceScope } from '../../src/modules/estimator/ai-brief/orchestrator';
import { chunkTexts, parsePolishJson, refuseFix } from '../../src/modules/estimator/ai-brief/polish';
import { priceForLocale } from '../../src/modules/estimator/ai-brief/pricing';
import {
  buildPolishSystemPrompt,
  buildPolishUserPrompt,
  buildScopeDigest,
  buildScopeSystemPrompt,
  buildScopedUserPrompt,
} from '../../src/modules/estimator/ai-brief/prompts';
import { asksForExtraLanguage, reconcileScope } from '../../src/modules/estimator/ai-brief/reconcile';
import {
  isPricedEstimate,
  mapPhases,
  type AiBrief,
  type BriefScope,
  type WireframeScreen,
} from '../../src/modules/estimator/ai-brief/types';
import { UZ_GLOSSARY, checkNote, glossaryChecks, glossaryPromptBlock } from '../../src/modules/estimator/ai-brief/uzGlossary';
import { checksFor, type EvalCase } from '../../scripts/lib/aiBriefEval';
import { createDailyBudget, positiveNumberOr } from '../../src/shared/utils/dailyBudget';
import { calculateEstimate, roundMoney } from '../../src/modules/estimator/utils/estimator';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-round3');
const ROOT = path.resolve(__dirname, '../..');

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function scope(patch: Partial<BriefScope> = {}): BriefScope {
  return {
    isProjectIdea: true,
    rejection: 'none',
    policy: { status: 'ok', topics: [], note: '' },
    title: 'Nonvoyxona boti',
    summary: 'Mijozlar Telegram botda non buyurtma qiladi.',
    clarity: 'clear',
    audience: [{ segment: 'Mijozlar', need: 'Tez buyurtma' }],
    roles: ['Mijoz', 'Operator'],
    product: { projectType: 'telegram', subtype: 'order_bot' },
    platforms: [],
    approach: 'cross',
    hasDesigns: false,
    uiLanguages: 2,
    urgency: 'normal',
    features: [
      { id: 'catalog', phase: 'mvp', note: '' },
      { id: 'orders', phase: 'mvp', note: '' },
      { id: 'bot_admin', phase: 'mvp', note: '' },
    ],
    integrations: [{ id: 'telegram_channel', phase: 'mvp', note: '' }],
    extraDeliverables: [],
    unpricedItems: [],
    complexityFlags: [],
    stack: ['nestjs', 'postgresql'],
    assumptions: ["Interfeys o'zbek va rus tillarida bo'ladi.", 'Bitta nonvoyxona bilan boshlaymiz.'],
    ...patch,
  };
}

/** A scope like the round-2 en-huge-erp answers: an ERP "pilot" the engine prices at ~500–850 h. */
function erpScope(): BriefScope {
  return scope({
    title: 'Manufacturing ERP pilot',
    summary: 'A pilot ERP module for production planning and inventory at one plant.',
    product: { projectType: 'web', subtype: 'crm' },
    uiLanguages: 3,
    features: [
      { id: 'auth_basic', phase: 'mvp', note: '' },
      { id: 'roles', phase: 'mvp', note: '' },
      { id: 'admin_panel', phase: 'mvp', note: '' },
      { id: 'dashboard', phase: 'mvp', note: '' },
      { id: 'reports_export', phase: 'mvp', note: '' },
      { id: 'import_export', phase: 'mvp', note: '' },
      { id: 'barcode', phase: 'later', note: '' },
      { id: 'realtime', phase: 'later', note: '' },
    ],
    integrations: [{ id: 'custom_api', phase: 'later', note: 'MES connection' }],
    unpricedItems: ['Finance and consolidation', 'HR and payroll', 'SAP data migration', 'Supplier EDI'],
    complexityFlags: ['legacy_integration', 'multi_role', 'multi_language'],
    assumptions: ['One plant first.'],
  });
}

const HUGE_ERP =
  "We are a manufacturing holding with 5,000 employees and 12 plants in three countries. We need a complete ERP replacing SAP: finance and consolidation, HR and payroll for three jurisdictions, procurement, multi-warehouse inventory, production planning (MRP), quality control, maintenance, BI dashboards, and migration of 15 years of SAP data. It must run on-premise, in English, Russian and Uzbek, and integrate with our MES and 40 suppliers' EDI.";

const PRICED: PricedScope = {
  product: { projectType: 'telegram', subtype: 'order_bot' },
  mvpRefs: ['catalog', 'orders', 'bot_admin', 'telegram_channel'],
  laterRefs: [],
  extraRefs: [],
  hasGrowth: false,
  unpriced: [],
  frames: { primary: 'chat', mvp: ['chat'], later: ['chat'] },
};

const SOURCE_UZ: ViewSource = {
  locale: 'uz',
  title: 'Nonvoyxona boti',
  roles: ['Mijoz', 'Operator'],
  integrations: [],
  languages: 2,
  platforms: [],
};

/** An English page pricing one interface language — where the one-language guard still applies. */
const SOURCE_EN_ONE: ViewSource = { ...SOURCE_UZ, locale: 'en', title: 'Bakery bot', roles: ['Customer', 'Operator'], languages: 1 };

const screen = (name: string, items: string[]): WireframeScreen => ({
  name,
  purpose: '',
  device: 'chat',
  phase: 'mvp',
  blocks: [
    { kind: 'header', label: name, items: [] },
    { kind: 'list', label: 'Menyu', items },
  ],
});

function uzBrief(patch: Partial<AiBrief['narrative']> & { deliverables?: string[]; screens?: WireframeScreen[] } = {}): AiBrief {
  const engine = buildEstimate(scope({ uiLanguages: 2 }), mapScopeToInputs(scope({ uiLanguages: 2 }), 'uz'), 'uz');
  return {
    version: 1,
    locale: 'uz',
    model: 'kimi-k3',
    models: { scope: 'kimi-k3', narrative: 'kimi-k3', screens: 'kimi-k3' },
    title: 'Nonvoyxona boti',
    summary: 'Mijozlar Telegram botda non buyurtma qiladi.',
    audience: [],
    roles: ['Mijoz', 'Operator'],
    features: [],
    integrations: [],
    stack: [],
    complexityFlags: [],
    screens: patch.screens ?? [],
    estimate: {
      ...engine,
      phases: [
        {
          id: 'mvp',
          title: 'Birinchi versiya',
          goal: 'Buyurtma botini ishga tushiramiz.',
          deliverables: patch.deliverables ?? ['Menyu va savat'],
          weeks: { min: 4, max: 5 },
        },
      ],
    },
    narrative: {
      buildFirst: { what: 'Menyu va buyurtma bilan Telegram bot.', why: 'Birinchi daromad shu yerdan keladi.' },
      canWait: [],
      risks: patch.risks ?? [],
      questions: patch.questions ?? ["Menyuda nechta mahsulot bo'ladi?", 'Buyurtmalar qaysi guruhga tushadi?', 'Yetkazib berish bormi?'],
      assumptions: [],
    },
    policy: { status: 'ok', topics: [], note: '' },
  };
}

/* ------------------------------------------------------------------ */
/* 1a. Deterministic Uzbek fixes                                       */
/* ------------------------------------------------------------------ */

s.group("uz — the reviewers' errors that have one reading are fixed outright");
{
  const cases: [string, string][] = [
    ["Naqd pul bilan to'lov ham qabul qilinasizmi?", "Naqd pul bilan to'lov ham qabul qilasizmi?"],
    ['16:30 — bolalar strijkasi', '16:30 — bolalar soch olishi'],
    ["Bolalar strijka — 45 000 so'm", "Bolalar soch olish — 45 000 so'm"],
    ["Ishchi CRM tayyor bo'ladi", "Ishlaydigan CRM tayyor bo'ladi"],
    ['Birinchi ishchi versiya', 'Birinchi ishlaydigan versiya'],
    ["Payme va Click to'lovi savdogar shartnomangizsiz ishlamaydi", "Payme va Click to'lovi merchant shartnomangizsiz ishlamaydi"],
    ['Yetkazish hududi bizning botimizdan tashqarida', 'Yetkazish hududi botdan tashqarida'],
    ["Sizning kassa rejangiz noma'lum", "Sizning kassa apparatingiz noma'lum"],
    ['Soliq rejasi qanday?', 'Soliq rejimi qanday?'],
    ["Buyurtma menejerlarga zahoti ko'rinadi", "Buyurtma menejerlarga darhol ko'rinadi"],
    ['MVPda onlayn yozilish', 'Birinchi versiyada onlayn yozilish'],
    ["Nasiya MVPdan keyin qo'shiladi", "Nasiya birinchi versiyadan keyin qo'shiladi"],
    ['Discovery suhbatida aniqlaymiz', 'Tanishuv suhbatida aniqlaymiz'],
    ['Buni Discovery da kelishamiz', 'Buni tahlil bosqichida kelishamiz'],
    ['Menyu va narxlar aktualligi', 'Menyu va narxlar dolzarbligi'],
    ['Excel-da saqlanadi, Google Play ga joylanadi', 'Excelda saqlanadi, Google Playga joylanadi'],
    ['CRM ishga tushirish', 'CRMni ishga tushirish'],
    ['Yozilish boti ishga tushirish', 'Yozilish botini ishga tushirish'],
    ['Bitta kafe uchun bitta bot deb oldik', 'Bitta kafe uchun bitta bot deb hisobladik'],
    ['Kuting iltimos', 'Iltimos, kuting'],
    ["growth bosqichida qo'shiladi", "o'sish bosqichida qo'shiladi"],
    ["Operator qo'ng'iroq bilan tasdiqlaydi", "Operator qo'ng'iroq qilib tasdiqlaydi"],
    ['Kontraktlari tayyor', 'Shartnomalari tayyor'],
    ['Dispecherlar, koeffitsiyent', 'Dispetcherlar, koeffitsient'],
    ['Haydovchilar narx bilan taklif beradi', 'Haydovchilar narx taklif qiladi'],
    ["Menyuda qancha mahsulot bo'ladi?", "Menyuda nechta mahsulot bo'ladi?"],
    ['Buyurtmalar bugun: 24', 'Bugungi buyurtmalar: 24'],
    ['Bu baholashga kirmagan', 'Bu narxga kirmagan'],
    ['Magaziningiz uchun', "Do'koningiz uchun"],
    ['Yozilingiz tasdiqlandi', 'Yozilishingiz tasdiqlandi'],
    ['Kritik holatlar', 'Favqulodda holatlar'],
    ['Jonli bitimlar', 'Faol bitimlar'],
    ['Bosh', 'Bosh sahifa'],
  ];
  for (const [from, to] of cases) s.eq(from, cleanVisibleText(from, 'uz'), to);
}

s.group('uz — fixes never touch numbers, brands or right usage');
{
  const keep = [
    "Mijoz to'lagan zahoti bot xabar beradi",
    'Shu zahoti xabar keladi',
    'Ovozli yozuv yuboriladi',
    'Telegram, Payme, Click, 1C va amoCRM bilan ishlaydi',
    "O'zbek va rus tillarida",
    'Robot ishga tushirildi',
    "Mahsulotlarni do'konlarga chiqarish",
  ];
  for (const text of keep) s.eq(`unchanged: ${text}`, cleanVisibleText(text, 'uz'), text);
  const inputs = [
    "Haydovchilar narx bilan taklif beradi: 25 000 so'm, 3 ta filial, Payme va Click",
    'Buyurtmalar bugun: 24 · 1C ga · MVPda 12 ta ekran',
    "Bolalar strijka — 45 000 so'm, Telegram-da",
  ];
  const digits = (t: string) => (t.match(/\d+/g) ?? []).join(',');
  for (const text of inputs) {
    const out = cleanVisibleText(text, 'uz');
    s.eq(`digits kept: ${text}`, digits(out), digits(text));
    for (const brand of ['Payme', 'Click', 'Telegram', '1C'].filter(b => text.includes(b)))
      s.ok(`${brand} kept in "${out}"`, out.includes(brand));
    s.eq(`idempotent: ${text}`, cleanVisibleText(out, 'uz'), out);
  }
  s.eq('other locales untouched', cleanVisibleText('MVP qabul qilinasizmi', 'ru'), 'MVP qabul qilinasizmi');
}

/* ------------------------------------------------------------------ */
/* 1b. Glossary and checks for the copy-edit                           */
/* ------------------------------------------------------------------ */

s.group("uz glossary — the reviewers' context-dependent terms");
{
  s.ok('at least 30 entries', UZ_GLOSSARY.length >= 30, String(UZ_GLOSSARY.length));
  s.eq('ids are unique', new Set(UZ_GLOSSARY.map(e => e.id)).size, UZ_GLOSSARY.length);
  const flagged = (text: string) => glossaryChecks(text).map(e => e.id);
  s.ok('a booking "yozuv" is flagged', flagged("O'z yozuvlari va ish vaqtini ko'rish").includes('yozuv'));
  s.ok('"yozuvchi" (a writer) is not', !flagged('Yozuvchi kitobi').includes('yozuv'));
  s.ok('"quramiz" for software', flagged('Ilovasini quramiz').includes('qurish'));
  s.ok("sur'at for a photo", flagged("Kiyimlarning sur'atlari").includes('surat'));
  s.ok('pozitsiya', flagged('Menyuda nechta pozitsiya bor?').includes('pozitsiya'));
  s.ok('our data entry', flagged("Menyu ma'lumotlarini kiritamiz").includes('our-data-entry'));
  s.ok("plural o'zi", flagged("Fermerlar mahsulotlarini o'zi joylaydi").includes('ozi-plural'));
  s.ok('a clean sentence carries no check', flagged('Mijoz menyudan non tanlaydi va buyurtma beradi.').length === 0);
  s.ok('curly apostrophes are normalized (sur’at)', flagged('Nonlar sur’ati').includes('surat'));
  const block = glossaryPromptBlock();
  s.ok(
    'prompt block lists every entry',
    UZ_GLOSSARY.every(e => block.includes(e.wrong))
  );
  s.ok('check note names the preferred wording', checkNote(glossaryChecks("O'z yozuvlari")).includes('yozilish'));
}

s.group('copy-edit prompt — glossary in the system prompt, checks on the strings');
{
  const system = buildPolishSystemPrompt();
  s.ok('the glossary is in the system prompt', system.includes('GLOSSARY'));
  s.ok('checks are explained', system.includes('"check"'));
  s.ok('the number/brand rule is still there', system.includes('every fact, number, price, brand'));
  const user = buildPolishUserPrompt('Sartaroshxona uchun bot', ["O'z yozuvlari", 'Mijoz ustani tanlaydi']);
  const strings = JSON.parse(user.match(/STRINGS: (\[.*\])/)![1]) as { id: number; text: string; check?: string }[];
  s.ok('a flagged string carries its check', !!strings[0].check && strings[0].check.includes('yozuv'));
  s.ok('a clean string carries none', strings[1].check === undefined);
}

s.group('copy-edit guard — numbers, prices and brands still refused');
{
  s.eq('a changed number', refuseFix("Narx 25 000 so'm", "Narx 30 000 so'm"), 'changes a number');
  s.ok('a dropped brand', (refuseFix("Payme orqali to'lov", "Onlayn to'lov") ?? '').startsWith('drops'));
  s.eq('an added duration', refuseFix('Bot tez ishga tushadi', 'Bot 2 hafta ichida ishga tushadi'), 'changes a number');
  s.eq('a language fix', refuseFix("O'z yozuvlari", "O'z yozilishlari"), null);
  const parsed = parsePolishJson(
    JSON.stringify({
      fixes: [
        { id: 2, find: 'yozuvlari', replace: 'yozilishlari' },
        { id: 1, find: '25 000', replace: '30 000' },
      ],
    }),
    ["Narx 25 000 so'm", "O'z yozuvlari"]
  );
  s.eq('chunk ids map to the chunk strings', parsed?.value.get("O'z yozuvlari"), "O'z yozilishlari");
  s.ok('the price change is refused', !parsed?.value.has("Narx 25 000 so'm"));
}

s.group('copy-edit — balanced parallel chunks, more time for the tail');
{
  s.ok('limit raised from 15 s', POLISH_CHAIN[0].timeoutMs >= 20_000, String(POLISH_CHAIN[0].timeoutMs));
  s.eq('no strings, no calls', chunkTexts([]), []);
  const few = ['a', 'b', 'c'];
  s.eq('a short part is one call', chunkTexts(few), [few]);
  // The iteration-3 live call that timed out: plan + risks, ~40 strings, ~2.5k characters.
  const narrative = Array.from({ length: 40 }, (_, i) => `Gap ${i} ${'x'.repeat(56)}`);
  const chunks = chunkTexts(narrative);
  s.ok('a 2.5k-character narrative is split', chunks.length >= 2, String(chunks.length));
  s.ok(
    'no chunk far over the character limit',
    chunks.every(c => c.join('').length <= POLISH_CHUNK_CHARS * 1.15 + 64)
  );
  s.ok(
    'no chunk over the string limit',
    chunks.every(c => c.length <= POLISH_CHUNK_STRINGS)
  );
  s.eq('order and content kept', chunks.flat(), narrative);
  const sizes = chunks.map(c => c.length);
  s.ok('balanced (sizes differ by at most 2)', Math.max(...sizes) - Math.min(...sizes) <= 2, sizes.join(','));
  // Wireframes: many short labels (p50 74 strings, ~1.7k characters) — cut by characters, not by count.
  const labels = Array.from({ length: 80 }, (_, i) => `Label ${i} ${'w'.repeat(12)}`);
  s.ok(
    '80 short wireframe labels (~1.7k characters) are at most three calls, not six',
    chunkTexts(labels).length <= 3,
    String(chunkTexts(labels).length)
  );
  const long = ['y'.repeat(POLISH_CHUNK_CHARS + 50), 'short', 'short too'];
  const split = chunkTexts(long);
  s.ok('a string over the character limit stands alone', split[0].length === 1 && split.flat().length === 3);
  const chars = chunkTexts(Array.from({ length: 10 }, () => 'z'.repeat(400)));
  s.ok('long strings split by characters', chars.length >= 3, String(chars.length));
}

/* ------------------------------------------------------------------ */
/* 1c. Interface languages — Uzbek + Russian on uz/ru pages (round 4)  */
/* ------------------------------------------------------------------ */

// Founder decision 2026-10-10 (round 4): uz AND ru pages always price an Uzbek + Russian interface, whether or
// not the idea names languages (reverting round 3's one-language default); a language asked for on top is priced.
s.group('interface languages — uz/ru pages always price Uzbek + Russian');
{
  s.eq('defaults', DEFAULT_UI_LANGUAGES, { uz: 2, ru: 2, en: 1 });
  const bakery = 'Nonvoyxonamiz uchun Telegram bot kerak';
  const silent = reconcileScope(scope({ uiLanguages: 1 }), bakery, 'uz');
  s.eq('uz idea without languages, model said 1 → 2', silent.scope.uiLanguages, 2);
  s.ok(
    'recorded',
    silent.adjustments.some(a => a.startsWith('uiLanguages 1 → 2'))
  );
  const kept = reconcileScope(scope({ uiLanguages: 2 }), bakery, 'uz');
  s.eq('uz idea without languages, model said 2 → kept', kept.scope.uiLanguages, 2);
  s.ok('nothing recorded when the model already priced two', !kept.adjustments.some(a => a.startsWith('uiLanguages')));
  const none = reconcileScope(scope({ uiLanguages: 0 }), bakery, 'uz');
  s.eq('no answer (0) → 2, silently', [none.scope.uiLanguages, none.adjustments.some(a => a.startsWith('uiLanguages'))], [2, false]);
  s.eq(
    'the idea says Uzbek only → still 2 (always)',
    reconcileScope(scope({ uiLanguages: 1 }), "Bot faqat o'zbek tilida bo'lsin", 'uz').scope.uiLanguages,
    2
  );
  s.eq(
    'ru idea without languages → 2',
    reconcileScope(scope({ uiLanguages: 1 }), 'Нужен бот для пекарни в Ташкенте', 'ru').scope.uiLanguages,
    2
  );
  s.eq(
    'ru idea naming Russian and Uzbek → 2',
    reconcileScope(scope({ uiLanguages: 2 }), 'Бот для пекарни, на русском и узбекском', 'ru').scope.uiLanguages,
    2
  );
  const third = reconcileScope(scope({ uiLanguages: 3 }), bakery, 'uz');
  s.eq('a third language nobody asked for → 2', third.scope.uiLanguages, 2);
  s.ok(
    'recorded',
    third.adjustments.some(a => a.startsWith('uiLanguages 3 → 2'))
  );
  s.eq(
    'ru: a third language nobody asked for → 2',
    reconcileScope(scope({ uiLanguages: 3 }), 'Доставка воды по Ташкенту', 'ru').scope.uiLanguages,
    2
  );
  s.eq(
    'uz + English asked → 3 priced',
    reconcileScope(scope({ uiLanguages: 3 }), `${bakery}, ingliz tilida ham bo'lsin`, 'uz').scope.uiLanguages,
    3
  );
  s.eq(
    'ru: "Языки: русский, узбекский, английский" → 3 priced',
    reconcileScope(scope({ uiLanguages: 3 }), 'Корпоративный сайт. Языки: русский, узбекский, английский.', 'ru').scope.uiLanguages,
    3
  );
  s.eq(
    'en untouched (3 asked)',
    reconcileScope(scope({ uiLanguages: 3 }), 'An ERP in English, Russian and Uzbek', 'en').scope.uiLanguages,
    3
  );
  s.eq('en untouched (1)', reconcileScope(scope({ uiLanguages: 1 }), 'A bakery bot', 'en').scope.uiLanguages, 1);
  const asks: [string, boolean][] = [
    ['Ingliz tilida ham kerak', true],
    ['Языки: русский, узбекский, английский', true],
    ['+ English version', true],
    ['на трёх языках', true],
    ['uch tilda ishlasin', true],
    ['и на казахском', true],
    ["O'zbek va rus tillarida", false],
    ["rus tilida ham bo'lsin", false],
    ['ikki tilda ishlasin', false],
    ['у нас два языка, русский и узбекский', false],
    ['для узбекского рынка', false],
    ['Доставка воды по Ташкенту', false],
    ['bitta til uchun', false],
  ];
  for (const [idea, expected] of asks) s.eq(`asks for a language beyond Uzbek + Russian: ${idea}`, asksForExtraLanguage(idea), expected);
  s.eq('engine prices two languages', mapScopeToInputs(silent.scope, 'uz').mvp.languages, 2);
  const one = calculateEstimate(mapScopeToInputs(scope({ uiLanguages: 1 }), 'en').mvp);
  const two = calculateEstimate(mapScopeToInputs(silent.scope, 'uz').mvp);
  s.ok('two languages cost more than one (the round-3 price drop is undone)', two.cost.min > one.cost.min && two.hours.max > one.hours.max);
  const prompt = buildScopeSystemPrompt('uz');
  s.ok(
    'uz prompt: Uzbek + Russian always',
    prompt.includes('Uzbek + Russian (uiLanguages 2) always') &&
      !prompt.includes('never assume a Russian interface') &&
      !prompt.includes('Uzbek only')
  );
  const ruPrompt = buildScopeSystemPrompt('ru');
  s.ok(
    'ru prompt: Russian + Uzbek always',
    ruPrompt.includes('Russian + Uzbek (uiLanguages 2) always') && !ruPrompt.includes('Russian only')
  );
  s.ok(
    'en prompt unchanged: one language unless stated',
    buildScopeSystemPrompt('en').includes('Interfaces usually have 1 language unless stated')
  );
  const digest = buildScopeDigest(silent.scope, PRICED, 'uz');
  s.ok(
    'the later calls are told: Uzbek and Russian, no third language',
    digest.includes('INTERFACE LANGUAGES: 2 — Uzbek and Russian') &&
      digest.includes('no third language') &&
      !digest.includes('no language switcher')
  );
  s.ok(
    'with English asked, the digest names it',
    buildScopeDigest({ ...silent.scope, uiLanguages: 3 }, PRICED, 'uz').includes(
      'INTERFACE LANGUAGES: 3 — Uzbek, Russian and the language the idea asks for'
    )
  );
  s.ok(
    'en, one language: no switcher',
    buildScopeDigest(scope({ uiLanguages: 1 }), PRICED, 'en').includes('INTERFACE LANGUAGES: 1 — the page language only')
  );
}

s.group('interface languages — an explicitly requested extra language is priced end to end');
{
  const idea = "Nonvoyxonamiz uchun Telegram bot kerak. Turistlar uchun ingliz tilida ham bo'lsin.";
  const asked = priceScope(scope({ uiLanguages: 3 }), idea, 'uz');
  const silent = priceScope(scope({ uiLanguages: 3 }), 'Nonvoyxonamiz uchun Telegram bot kerak', 'uz');
  s.eq('three languages priced when English is asked for', asked.mapped.mvp.languages, 3);
  s.eq('two when it is not', silent.mapped.mvp.languages, 2);
  const priceOf = (stage: typeof asked) => {
    const estimate = previewOf(stage, 'uz').estimate;
    return isPricedEstimate(estimate) ? estimate.mvp.price.max : 0;
  };
  s.ok('the third language raises the price', priceOf(asked) > priceOf(silent), `${priceOf(asked)} vs ${priceOf(silent)}`);
  s.eq('the engine config shows 3', previewOf(asked, 'uz').estimate.config.languages, 3);
}

s.group('guard — Uzbek + Russian copy stays when two languages are priced');
{
  s.eq('a bilingual statement agrees with two priced', languageReason("Interfeys o'zbek va rus tillarida bo'ladi.", 2), null);
  s.eq('…in Russian too', languageReason('Интерфейс на русском и узбекском языках.', 2), null);
  s.eq('a question stays', languageReason("Ilova o'zbek va rus tillarida bo'ladimi?", 2), null);
  s.eq(
    'not a language ("китайского производителя")',
    languageReason('Турникеты китайского производителя, SDK есть в приложении.', 2),
    null
  );
  const risks = [
    {
      title: 'Tarjima sifati',
      detail: "Bot o'zbek va rus tillarida ishlaydi. Tarjima noto'g'ri bo'lsa, mijozlar chalg'iydi.",
      mitigation: 'Matnlarni tekshiring.',
    },
    { title: 'Kuryerlar', detail: "Kuryerlar soni noma'lum.", mitigation: 'Avval bitta hududdan boshlang.' },
    { title: 'Menyu', detail: "Menyu ma'lumotlari to'liq emas.", mitigation: 'Menyuni oldindan tayyorlang.' },
  ];
  const question = "Interfeys o'zbek va rus tillarida bo'lishini oldindan qabul qildik. Boshqa til kerakmi?";
  const brief = uzBrief({
    risks,
    deliverables: ["Telegram bot o'zbek va rus tillarida", 'Menyu va savat'],
    questions: [question, 'Yetkazib berish bormi?', 'Menyuda nechta mahsulot bor?'],
    screens: [
      screen('Menyu', ["Til: O'zbek / Русский", 'Patir non', 'Shirin kulcha']),
      {
        ...screen('Operator', ['Nomi', 'Nomi rus tilida', 'Narxi']),
        blocks: [
          { kind: 'header', label: 'Operator', items: [] },
          { kind: 'form', label: 'Mahsulot', items: ['Nomi', 'Nomi rus tilida', 'Narxi'] },
          { kind: 'tabs', label: 'Til', items: ["O'zbek", 'Русский'] },
        ],
      },
    ],
  });
  const guarded = guardBriefText(brief, PRICED, SOURCE_UZ);
  const out = guarded.value;
  s.eq('the translation risk stays (3 risks)', out.narrative.risks.length, 3);
  s.eq('…with its bilingual sentence', out.narrative.risks[0].detail, risks[0].detail);
  const mvp = out.estimate.phases.find(p => p.id === 'mvp');
  s.eq('the bilingual deliverable stays', mvp?.deliverables, ["Telegram bot o'zbek va rus tillarida", 'Menyu va savat']);
  s.eq('the question stays whole', out.narrative.questions[0], question);
  s.ok('the language switch stays on the wireframe', out.screens[0].blocks[1].items.includes("Til: O'zbek / Русский"));
  s.ok('the Russian-name field stays', out.screens[1].blocks[1].items.includes('Nomi rus tilida'));
  s.eq('the Uzbek/Russian tabs stay', out.screens[1].blocks[2].items, ["O'zbek", 'Русский']);
  s.eq(
    'nothing about languages removed',
    guarded.removed.filter(r => /til|язык|language|tarjima/iu.test(r)),
    []
  );
  const scoped = guardScopeText(
    scope({
      summary: "Mijozlar Telegram botda non buyurtma qiladi. Bot o'zbek va rus tillarida ishlaydi.",
      assumptions: ["Interfeys o'zbek va rus tillarida bo'ladi.", 'Bitta nonvoyxona bilan boshlaymiz.'],
    }),
    SOURCE_UZ,
    PRICED
  );
  s.eq('the scope stage keeps the "o\'zbek va rus" assumption', scoped.value.assumptions, [
    "Interfeys o'zbek va rus tillarida bo'ladi.",
    'Bitta nonvoyxona bilan boshlaymiz.',
  ]);
  s.ok('…and the bilingual summary sentence', scoped.value.summary.includes("o'zbek va rus tillarida"));
}

s.group('guard — a language that is NOT priced still goes');
{
  s.ok('a third language with two priced', !!languageReason("Interfeys o'zbek, rus va ingliz tillarida bo'ladi.", 2));
  s.ok('…in Russian', !!languageReason('Интерфейс на русском, узбекском и английском языках.', 2));
  s.ok('three languages by count', !!languageReason('Bot uch tilda ishlaydi.', 2));
  s.ok('one language with two priced', !!languageReason("Interfeys bitta tilda bo'ladi.", 2));
  s.eq('three languages when three are priced', languageReason("Interfeys o'zbek, rus va ingliz tillarida bo'ladi.", 3), null);
  s.eq('switch: Uzbek + Russian', switchLanguages("Til: O'zbek / Русский"), ['uz', 'ru']);
  s.eq('switch: codes', switchLanguages('UZ | RU | EN'), ['uz', 'ru', 'en']);
  s.eq('switch: two scripts, no label', switchLanguages("O'zbek / Русский / English"), ['uz', 'ru', 'en']);
  s.eq('a course list is not a switch', switchLanguages('Ingliz tili / Arab tili / Rus tili'), []);
  s.eq('a course level is not a switch', switchLanguages('Ingliz tili: A2 / B1'), []);
  const scoped = guardScopeText(
    scope({
      summary: "Mijozlar Telegram botda non buyurtma qiladi. Bot o'zbek, rus va ingliz tillarida ishlaydi.",
      assumptions: ["Interfeys o'zbek, rus va ingliz tillarida bo'ladi.", 'Bitta nonvoyxona bilan boshlaymiz.'],
    }),
    SOURCE_UZ,
    PRICED
  );
  s.eq('the three-language assumption goes', scoped.value.assumptions, ['Bitta nonvoyxona bilan boshlaymiz.']);
  s.eq('the three-language summary sentence goes', scoped.value.summary, 'Mijozlar Telegram botda non buyurtma qiladi.');
  const brief = uzBrief({
    deliverables: ["Telegram bot o'zbek, rus va ingliz tillarida", 'Menyu va savat'],
    screens: [
      screen('Menyu', ["Til: O'zbek / Русский / English", 'Patir non', 'Shirin kulcha']),
      {
        ...screen('Sozlamalar', []),
        blocks: [
          { kind: 'header', label: 'Sozlamalar', items: [] },
          { kind: 'tabs', label: 'Til', items: ["O'zbek", 'Русский', 'English'] },
          { kind: 'list', label: 'Kurslar', items: ['Ingliz tili A2', 'Arab tili', 'Ingliz tili / Arab tili'] },
        ],
      },
    ],
  });
  const guarded = guardBriefText(brief, PRICED, SOURCE_UZ);
  const out = guarded.value;
  s.eq('the three-language deliverable goes', out.estimate.phases.find(p => p.id === 'mvp')?.deliverables, ['Menyu va savat']);
  s.ok('the three-language switch goes', !out.screens[0].blocks[1].items.some(i => i.includes('English')));
  s.eq('switch tabs keep Uzbek + Russian, lose English', out.screens[1].blocks[1].items, ["O'zbek", 'Русский']);
  s.eq('a course list (not a switch) stays', out.screens[1].blocks[2].items, ['Ingliz tili A2', 'Arab tili', 'Ingliz tili / Arab tili']);
  s.ok(
    'recorded as an unpriced language',
    guarded.removed.some(r => r.includes('interface language not priced'))
  );
  const enTabs = guardBriefText({ ...brief, locale: 'en', estimate: { ...brief.estimate, phases: [] } }, PRICED, {
    ...SOURCE_EN_ONE,
    languages: 2,
  }).value;
  s.eq('en, two priced: the page language first, then the order drawn', enTabs.screens[1].blocks[1].items, ["O'zbek", 'English']);
}

s.group('guard — one language priced (English pages): the round-3 rules still apply');
{
  s.ok('a bilingual statement', !!languageReason('The bot runs in English and Spanish.', 1));
  const risks = [
    {
      title: 'Translation quality',
      detail: 'The bot runs in English and Spanish. A poor translation confuses customers.',
      mitigation: 'Review the texts.',
    },
    { title: 'Couriers', detail: 'The number of couriers is unknown.', mitigation: 'Start with one area.' },
    { title: 'Menu', detail: 'The menu data is incomplete.', mitigation: 'Prepare the menu first.' },
  ];
  const brief = {
    ...uzBrief({
      risks,
      deliverables: ['Telegram bot in English and Spanish', 'Menu and cart'],
      screens: [screen('Menu', ['Language: English / Русский', 'Bagel', 'Croissant'])],
    }),
    locale: 'en' as const,
  };
  const out = guardBriefText(brief, PRICED, SOURCE_EN_ONE).value;
  s.ok(
    'the translation risk goes (3 → 2 risks)',
    out.narrative.risks.length === 2 && !out.narrative.risks.some(r => r.title === 'Translation quality')
  );
  s.eq('the bilingual deliverable goes', out.estimate.phases.find(p => p.id === 'mvp')?.deliverables, ['Menu and cart']);
  s.ok('the language switch leaves the wireframe', !out.screens[0].blocks.some(b => b.items.some(i => i.includes('Русский'))));
  const two = { ...uzBrief({ risks: risks.slice(0, 2) }), locale: 'en' as const };
  s.eq('never below two risks', guardBriefText(two, PRICED, SOURCE_EN_ONE).value.narrative.risks.length, 2);
}

/* ------------------------------------------------------------------ */
/* 2. Very large ideas                                                 */
/* ------------------------------------------------------------------ */

s.group("big idea — counts and signals from the idea's words");
{
  const counts: [string, number | null][] = [
    ['5,000', 5000],
    ['5 000', 5000],
    ['1.5k', 1500],
    ['5 тыс', 5000],
    ['3 ming', 3000],
    ['12', 12],
    ['three', 3],
    ["to'rt", 4],
    ['three-ish', null],
  ];
  for (const [raw, n] of counts) s.eq(`count "${raw}"`, parseCount(raw), n);
  s.ok('complete ERP / replacing SAP', !!coreSystemSignal(HUGE_ERP));
  s.ok('Russian: замена 1С:ERP', !!coreSystemSignal('Нужна система вместо 1С:ERP для холдинга.'));
  s.ok("Uzbek: SAP o'rniga", !!coreSystemSignal("SAP o'rniga o'z tizimimiz kerak."));
  s.eq('plain 1C exchange is not a replacement', coreSystemSignal('Нужен обмен с 1С и приложение для агентов.'), null);
  s.eq('naming SAP without replacing it', coreSystemSignal('We export orders to SAP every night.'), null);
  s.eq('scale', scaleSignals(HUGE_ERP), ['5000 employees', '12 plants', '3 countries']);
  s.eq('a 300-person holding is not enterprise scale', scaleSignals('HR-портал для холдинга на 300 сотрудников'), []);
  s.eq('countries alone are a shop that ships abroad', scaleSignals('We ship our coffee to 5 countries.'), []);
  s.eq("a distributor's 200 client shops are not its branches", scaleSignals('Доставляем напитки в 200 магазинов'), []);
  s.eq('60 own branches', scaleSignals('Bank with 60 branches across the country'), ['60 branches']);
}

s.group('big idea — the verdict (engine + words, never the model)');
{
  const small = { mvpHours: { min: 80, max: 120 }, fullHours: null };
  const mid = { mvpHours: { min: 400, max: 600 }, fullHours: { min: 500, max: 800 } };
  s.ok('en-huge-erp triggers', assessBigIdea(HUGE_ERP, mid).isBig);
  s.eq('…on its text', assessBigIdea(HUGE_ERP, mid).reasons, ['core_system', 'enterprise_scale']);
  s.ok('an ERP replacement triggers even when the model priced a small pilot', assessBigIdea(HUGE_ERP, small).isBig);
  const bank = 'We are a bank with 3,000 employees and need a landing page for a campaign.';
  s.ok("a big company's small project stays priced", !assessBigIdea(bank, small).isBig);
  s.ok(
    `…until the engine says it is big too (≥ ${BIG_IDEA_SCALE_MIN_MVP_HOURS} h)`,
    assessBigIdea(bank, { mvpHours: { min: 200, max: BIG_IDEA_SCALE_MIN_MVP_HOURS }, fullHours: null }).isBig
  );
  const engineOnly = (mvp: number, full: number | null) =>
    assessBigIdea('Marketplace for farmers', {
      mvpHours: { min: mvp / 2, max: mvp },
      fullHours: full ? { min: full / 2, max: full } : null,
    });
  s.ok('largest normal round-2 MVP (893 h) stays priced', !engineOnly(893, 1518).isBig);
  s.ok(`engine safety net: MVP ≥ ${BIG_IDEA_ENGINE_HOURS.mvpHigh} h`, engineOnly(BIG_IDEA_ENGINE_HOURS.mvpHigh, null).isBig);
  s.ok(`engine safety net: full vision ≥ ${BIG_IDEA_ENGINE_HOURS.fullHigh} h`, engineOnly(600, BIG_IDEA_ENGINE_HOURS.fullHigh).isBig);
  s.eq('thresholds', [BIG_IDEA_SCALE.employees, BIG_IDEA_SCALE.industrialSites, BIG_IDEA_SCALE.branches], [1000, 3, 50]);
  const cases = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/eval-ai-brief.cases.json'), 'utf8')) as EvalCase[];
  const triggered = cases.filter(c => coreSystemSignal(c.idea) || scaleSignals(c.idea).length).map(c => c.id);
  s.eq('of the 60 eval ideas only en-huge-erp has a big-idea signal', triggered, ['en-huge-erp']);
}

s.group('discovery brief — a plan, not one number');
{
  const stage = priceScope(erpScope(), HUGE_ERP, 'en');
  s.ok('the stage is a big idea', stage.bigIdea.isBig);
  s.ok(
    'the note names reasons only (no hours)',
    stage.adjustments.some(a => a.startsWith('big idea → discovery call')) && !stage.adjustments.some(a => /\d+ h/.test(a))
  );
  const preview = previewOf(stage, 'en');
  s.eq('preview mode', preview.estimate.mode, 'discovery');
  s.ok('no price, hours or weeks anywhere', !/"(?:price|hours|weeks|min|max|basis)"/.test(JSON.stringify(preview.estimate)));
  s.ok('the team is still there', !isPricedEstimate(preview.estimate) && preview.estimate.team.length > 0);
  const narrative = {
    buildFirst: { what: 'A pilot at one plant.', why: 'It proves the flows.' },
    canWait: [],
    phases: [
      { id: 'mvp' as const, title: 'Pilot', goal: 'Run planning at one plant.', deliverables: ['Production planning'] },
      { id: 'growth' as const, title: 'Next modules', goal: 'Add barcode scanning.', deliverables: ['Barcode scanning'] },
    ],
    risks: [{ title: 'Data', detail: 'SAP data quality is unknown.', mitigation: 'Audit a sample first.' }],
    questions: ['Which plant goes first?', 'Who owns the SAP data?', 'Which MES do you run?'],
  };
  const { brief } = assembleBrief(stage, narrative, [], { scope: 'kimi-k3', narrative: 'kimi-k3', screens: null }, 'en');
  s.eq('brief mode', brief.estimate.mode, 'discovery');
  s.ok('phases keep their plan, never a duration', brief.estimate.phases.length === 2 && brief.estimate.phases.every(p => !('weeks' in p)));
  s.ok('the whole brief carries no price', !/"(?:price|weeks)"/.test(JSON.stringify(brief)));
  const prompt = buildScopedUserPrompt(HUGE_ERP, 'en', stage.scope, stage.priced, false, undefined, [], true);
  s.ok(
    'the later calls are told: no price, no pace, no rollout promise',
    prompt.includes('SIZE:') && prompt.includes('Never promise a rollout')
  );
  s.ok('a normal brief gets no SIZE note', !buildScopedUserPrompt(HUGE_ERP, 'en', stage.scope, stage.priced).includes('SIZE:'));
  const run = {
    outcome: { status: 'ok' as const, brief },
    scope: stage.scope,
    priced: stage.priced,
    scrubbedIdea: HUGE_ERP,
    attempts: [],
  };
  const evalCase = { id: 'en-huge-erp', locale: 'en', category: 'huge', idea: HUGE_ERP, expect: { status: 'ok' } } as EvalCase;
  const check = checksFor(evalCase, run).checks.find(c => c.name.startsWith('discovery'));
  s.ok('the eval checks a discovery brief: no numbers, verdict agrees', !!check?.ok, check?.detail);
  const discovery = toDiscoveryEstimate(buildEstimate(stage.scope, stage.mapped, 'en'), ['core_system']);
  const renamed = mapPhases(discovery, p => ({ ...p, title: p.title.toUpperCase() }));
  s.ok(
    'mapPhases keeps a discovery phase weekless',
    renamed.phases.every(p => !('weeks' in p))
  );
}

s.group("normal briefs stay priced — the founder's rule unchanged");
{
  const stage = priceScope(scope({ uiLanguages: 1 }), 'Nonvoyxonamiz uchun Telegram bot kerak', 'uz');
  const preview = previewOf(stage, 'uz');
  s.ok('a bakery bot is priced', isPricedEstimate(preview.estimate) && !stage.bigIdea.isBig);
  const mapped = mapScopeToInputs(scope({ uiLanguages: 1 }), 'en');
  const est = calculateEstimate(mapped.mvp);
  const en = priceForLocale(est, 'en');
  s.eq('EN low = max(hours.min × $14, local low)', en.min, Math.max(roundMoney(est.hours.min * EN_RATE_LOW, 'down'), est.cost.min));
  s.eq('EN high = hours.max × $40', en.max, roundMoney(est.hours.max * EN_RATE_HIGH, 'up'));
  s.eq('uz/ru = the engine', priceForLocale(est, 'uz'), { currency: 'USD', min: est.cost.min, max: est.cost.max, basis: 'local_engine' });
  const priced = buildEstimate(scope({ uiLanguages: 1 }), mapped, 'en');
  s.eq(
    'mapPhases keeps engine weeks',
    mapPhases(priced, p => ({ ...p, title: 'x' })).phases.map(p => ('weeks' in p ? p.weeks : null)),
    priced.phases.map(p => p.weeks)
  );
}

/* ------------------------------------------------------------------ */
/* 3–5. Limits, the lab slot                                           */
/* ------------------------------------------------------------------ */

s.group('route limits stay as decided');
{
  // The caps moved to ai-brief/caps.ts (2026-10-11, shared with the admin page); the route builds its budgets from them.
  const route = ['src/app/api/estimate/brief/route.ts', 'src/modules/estimator/ai-brief/caps.ts']
    .map(file => fs.readFileSync(path.join(ROOT, file), 'utf8'))
    .join('\n');
  s.ok('3 requests per 10 minutes', /BURST_LIMIT = \{ count: 3, windowMs: 10 \* 60_000 \}/.test(route));
  // Founder decision 2026-10-10 (round 5): ONE free brief per visitor a day (was 5) — see tests/ai-brief/daily-limit.ts.
  s.ok('1 free brief a day per visitor', /DAILY_LIMIT_PER_IP = \{ count: 1, windowMs: 24 \* 60 \* 60_000 \}/.test(route));
  s.ok('5 attempts a day per visitor', /DAILY_ATTEMPTS_PER_IP = \{ count: 5, windowMs: 24 \* 60 \* 60_000 \}/.test(route));
  // Founder decision 2026-10-10 (round 4): the per-instance daily spend cap doubles to $3 (was $1.50).
  s.ok('$3.00 daily spend cap by default', /DEFAULT_DAILY_USD = 3;/.test(route));
  s.ok('150 calls a day by default (not the binding limit at $3)', /DEFAULT_DAILY_CALLS = 150;/.test(route));
  s.ok(
    'AI_BRIEF_DAILY_USD / _CALLS still override, through the fallback-safe parser',
    route.includes('positiveNumberOr(env.AI_BRIEF_DAILY_USD, DEFAULT_DAILY_USD)') &&
      route.includes('positiveNumberOr(env.AI_BRIEF_DAILY_CALLS, DEFAULT_DAILY_CALLS)')
  );
  const env: [string | undefined, number][] = [
    ['5', 5],
    ['0.75', 0.75],
    [undefined, 3],
    ['', 3],
    ['  ', 3],
    ['0', 3],
    ['-2', 3],
    ['abc', 3],
    ['Infinity', 3],
    ['NaN', 3],
  ];
  for (const [value, expected] of env)
    s.eq(`AI_BRIEF_DAILY_USD=${JSON.stringify(value)} → $${expected}`, positiveNumberOr(value, 3), expected);
  const reserve = Number(route.match(/const RESERVE_USD = ([\d.]+);/)?.[1]);
  const budget = createDailyBudget({ maxCalls: 150, maxUsd: 3, reserveUsd: reserve }, () => new Date('2026-10-10T10:00:00Z'));
  let inFlight = 0;
  while (budget.tryStart()) inFlight++;
  s.eq('at $3 with the $0.30 reserve, 10 briefs can run at once', inFlight, 10);
  for (let i = 0; i < inFlight; i++) budget.record(0);
  let uzBriefs = 0;
  while (budget.tryStart()) {
    budget.record(0.24); // an Uzbek brief with the copy-edit, round-3 live runs
    uzBriefs++;
  }
  s.eq('~12 Uzbek briefs a day at ~$0.24 each', uzBriefs, 12);
  s.ok('the spend cap, not the call cap, stops the day', budget.snapshot().calls < 150, JSON.stringify(budget.snapshot()));
}

s.group('lab — the real brief in section 8');
{
  const page = fs.readFileSync(path.join(ROOT, 'src/app/[locale]/_home/HomeExperience.tsx'), 'utf8');
  s.ok("the 'ai-demo' slot is the compact AI brief", /'ai-demo': <HomeAIBrief variant='compact' \/>/.test(page));
  const experience = fs.readFileSync(path.join(ROOT, 'src/modules/estimator/components/brief/AIBriefExperience.tsx'), 'utf8');
  s.ok("it reports 'ai-brief:status' (S08's network listens)", experience.includes("AI_BRIEF_STATUS_EVENT = 'ai-brief:status'"));
  for (const locale of ['en', 'ru', 'uz']) {
    const messages = JSON.parse(fs.readFileSync(path.join(ROOT, `src/messages/${locale}.json`), 'utf8')).aiBrief;
    const ok =
      !!messages.estimate.discovery?.title &&
      ['core_system', 'enterprise_scale', 'engine_size'].every(r => !!messages.estimate.discovery.reasons[r]) &&
      !!messages.cta.discoveryButton &&
      !!messages.cta.messageDiscovery &&
      !!messages.result.phases;
    s.ok(`${locale}: discovery-call copy present`, ok);
  }
}

process.exit(s.report());
