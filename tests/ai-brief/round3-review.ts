/**
 * AI brief — round 3 review must-fixes (2026-10-10), no network, no model calls.
 *
 *   npx tsx tests/ai-brief/round3-review.ts
 *
 * 1. Very large ideas: a core system counts only as the object of the replace
 *    verb (a generic ERP needs the engine floor), and "people" count only as
 *    staff — so normal SMB ideas at 300+ engine hours stay priced.
 * 2. Uzbek text fixes: no "birinchi versiya — birinchi versiya", no "do'kon
 *    uchun mobil do'kon", capitals kept, "test ulanish qil-" as a verb.
 * 3. The copy-edit: no first-letter-only edits, no question whose subject
 *    flips, the data-entry glossary aimed at the promise — the bakery pair.
 * 4. The lab's S08 with the real brief: a slot-aware height floor and static
 *    composer ids (no hydration mismatch).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BIG_IDEA_ERP_MIN_MVP_HOURS,
  BIG_IDEA_SCALE_MIN_MVP_HOURS,
  assessBigIdea,
  coreSystemSignal,
  scaleSignals,
  type EngineSize,
} from '../../src/modules/estimator/ai-brief/bigIdea';
import { cleanVisibleText } from '../../src/modules/estimator/ai-brief/cleanText';
import { engineSize, mapScopeToInputs } from '../../src/modules/estimator/ai-brief/mapping';
import { previewOf, priceScope } from '../../src/modules/estimator/ai-brief/orchestrator';
import {
  applyFixes,
  keepLeadingCapital,
  mapPlanTexts,
  mapRisksTexts,
  parsePolishJson,
  refuseFix,
} from '../../src/modules/estimator/ai-brief/polish';
import type { BriefPlan, BriefRisks } from '../../src/modules/estimator/ai-brief/parseNarrative';
import { buildPolishSystemPrompt } from '../../src/modules/estimator/ai-brief/prompts';
import { isPricedEstimate, type BriefScope } from '../../src/modules/estimator/ai-brief/types';
import { UZ_GLOSSARY, glossaryChecks } from '../../src/modules/estimator/ai-brief/uzGlossary';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-round3-review');
const ROOT = path.resolve(__dirname, '../..');

/** The largest engine MVP (high end) of any normal round-2/3 brief. */
const LARGEST_NORMAL_MVP_HOURS = 893;
const HUGE_ERP =
  'We are a manufacturing holding with 5,000 employees and 12 plants in three countries. We need a complete ERP replacing SAP: finance and consolidation, HR and payroll for three jurisdictions, procurement, multi-warehouse inventory, production planning (MRP), quality control, maintenance, BI dashboards, and migration of 15 years of SAP data.';

const size = (mvpHigh: number): EngineSize => ({ mvpHours: { min: Math.round(mvpHigh * 0.6), max: mvpHigh }, fullHours: null });
/** Engine sizes a normal SMB brief reaches: from the scale floor to the largest normal round-2 MVP. */
const NORMAL_SIZES = [BIG_IDEA_SCALE_MIN_MVP_HOURS, 600, LARGEST_NORMAL_MVP_HOURS];

/** A web CRM-like scope the engine prices at several hundred hours (an SMB "ERP"). */
function smbErpScope(): BriefScope {
  return {
    isProjectIdea: true,
    rejection: 'none',
    policy: { status: 'ok', topics: [], note: '' },
    title: 'Simple ERP',
    summary: 'Orders, stock and invoices in one web system.',
    clarity: 'clear',
    audience: [{ segment: 'Staff', need: 'One place for orders and stock' }],
    roles: ['Manager', 'Staff'],
    product: { projectType: 'web', subtype: 'crm' },
    platforms: [],
    approach: 'cross',
    hasDesigns: false,
    uiLanguages: 1,
    urgency: 'normal',
    features: [
      { id: 'auth_basic', phase: 'mvp', note: '' },
      { id: 'roles', phase: 'mvp', note: '' },
      { id: 'admin_panel', phase: 'mvp', note: '' },
      { id: 'dashboard', phase: 'mvp', note: '' },
      { id: 'reports_export', phase: 'mvp', note: '' },
      { id: 'import_export', phase: 'mvp', note: '' },
    ],
    integrations: [],
    extraDeliverables: [],
    unpricedItems: [],
    complexityFlags: ['multi_role'],
    stack: ['nestjs', 'postgresql'],
    assumptions: [],
  };
}

/* ------------------------------------------------------------------ */
/* 1. Very large ideas                                                 */
/* ------------------------------------------------------------------ */

s.group('big idea — the replaced system is the object of the verb');
{
  const smbIdeas = [
    'Our bakery tracks everything in Excel. We want to replace Excel with a simple ERP for orders, recipes and stock.',
    'We need a small ERP for our 3 shops: stock, purchases and sales.',
    'Нужна ERP для швейного цеха на 15 человек: заказы, раскрой, склад, зарплата.',
    "Kichik do'kon uchun Excel o'rniga ERP kerak: qoldiq, kirim, chiqim.",
    'Full-scale ERP integration with our 1C for a 20-person distributor.',
    'We want a full ERP for a 12-person workshop.',
    'Migrate our booking app from Oracle DB to Postgres.',
    'Мини-ERP вместо таблиц для небольшого магазина.',
    "Excel o'rniga oddiy ERP kerak.",
  ];
  for (const idea of smbIdeas) {
    const priced = NORMAL_SIZES.every(hours => !assessBigIdea(idea, size(hours)).isBig);
    s.ok(`stays priced up to ${LARGEST_NORMAL_MVP_HOURS} h: ${idea.slice(0, 60)}`, priced, JSON.stringify(coreSystemSignal(idea)));
  }
  const targets = [
    'replace Excel with a simple ERP',
    "Excel o'rniga oddiy ERP",
    'Мини-ERP вместо таблиц',
    'заменить таблицы на ERP',
    'Excelni ERP bilan almashtirish',
    'Excelni ERPga almashtiramiz',
    "ERPga o'tamiz",
    'instead of Excel we want an ERP',
    'Migrate from Oracle DB to Postgres',
    'Replace SAP Business One for our 10-person shop',
    'We export orders to SAP every night.',
  ];
  for (const idea of targets) s.eq(`no replaced core system: "${idea}"`, coreSystemSignal(idea), null);
  const named: [string, string][] = [
    ['We need a complete ERP replacing SAP.', 'SAP'],
    ['We want to move off Oracle E-Business Suite.', 'Oracle E-Business Suite'],
    ['Нужна система вместо 1С:ERP для холдинга.', '1С:ERP'],
    ['Переход с SAP на собственную систему.', 'SAP'],
    ["SAP o'rniga o'z tizimimiz kerak.", 'SAP'],
    ["SAPni to'liq almashtirish kerak.", 'SAP'],
    ["SAPdan o'z tizimimizga o'tish.", 'SAP'],
    ['Replacing Microsoft Dynamics NAV across the group.', 'Microsoft Dynamics'],
    ['An SAP replacement for our plants.', 'SAP'],
    ['Migrate from NetSuite to our own platform.', 'NetSuite'],
  ];
  for (const [idea, system] of named) {
    s.eq(`named suite replaced: "${idea}"`, coreSystemSignal(idea), { text: `replaces ${system}`, isGeneric: false });
  }
  s.ok(
    `the generic-ERP floor is past every normal MVP (${LARGEST_NORMAL_MVP_HOURS} h)`,
    BIG_IDEA_ERP_MIN_MVP_HOURS > LARGEST_NORMAL_MVP_HOURS
  );
  for (const idea of ['We want a full ERP for a 12-person workshop.', 'Replace our old ERP with a custom one.']) {
    s.ok(`generic ERP below the floor stays priced: ${idea}`, !assessBigIdea(idea, size(BIG_IDEA_ERP_MIN_MVP_HOURS - 1)).isBig);
    s.eq(`…a discovery call at the floor: ${idea}`, assessBigIdea(idea, size(BIG_IDEA_ERP_MIN_MVP_HOURS)).reasons, ['core_system']);
  }
  for (const hours of [120, 518, 857]) {
    const verdict = assessBigIdea(HUGE_ERP, size(hours));
    s.ok(
      `en-huge-erp still triggers at ${hours} h (a named suite needs no floor)`,
      verdict.isBig && verdict.reasons.includes('core_system')
    );
  }
}

s.group("big idea — people count only as staff, locations only as one's own");
{
  const visitors = [
    'Онлайн-школа на 5000 человек: курсы, тесты, оплата.',
    'A gym where 1,200 people visit every week needs a booking app.',
    'We deliver 1500 meals to people in offices every day.',
    'Kuniga 1000 kishi keladigan restoran uchun buyurtma ilovasi.',
    'A delivery app covering 60 locations for partner restaurants.',
    'We deliver 1500 meals for employees of nearby offices.',
    'A club with 1,200 members and 40 employees.',
  ];
  for (const idea of visitors) {
    s.eq(`no scale signal: ${idea}`, scaleSignals(idea), []);
    s.ok(
      `…priced at an MVP of ${BIG_IDEA_SCALE_MIN_MVP_HOURS}–${LARGEST_NORMAL_MVP_HOURS} h`,
      NORMAL_SIZES.every(h => !assessBigIdea(idea, size(h)).isBig)
    );
  }
  const staff: [string, string][] = [
    ['5,000 people work in our company.', '5000 employees'],
    ['В штате 1500 человек.', '1500 employees'],
    ['Zavodimizda 1500 kishi ishlaydi.', '1500 employees'],
    ['We employ about 2,000 people.', '2000 employees'],
    ['We are a 3,000-person bank.', '3000 employees'],
    ['We have 5,000 full-time employees.', '5000 employees'],
    ['1500 nafar xodim.', '1500 employees'],
    ['A restaurant chain with 60 locations.', '60 branches'],
    ['Our 60 locations need one loyalty app.', '60 branches'],
    ['Bank with 60 branches across the country.', '60 branches'],
  ];
  for (const [idea, signal] of staff) s.eq(`counts: ${idea}`, scaleSignals(idea), [signal]);
}

s.group('big idea — end to end: SMB ideas at 300+ engine hours keep their price');
{
  const scope = smbErpScope();
  const { mvpHours } = engineSize(mapScopeToInputs(scope, 'en'));
  s.ok(`the fixture is a 300+ h MVP (${mvpHours.max} h)`, mvpHours.max >= BIG_IDEA_SCALE_MIN_MVP_HOURS);
  const ideas = [
    'Our bakery tracks everything in Excel. We want to replace Excel with a simple ERP for orders, recipes and stock.',
    'We want a full ERP for a 12-person workshop.',
    'A gym where 1,200 people visit every week needs member management.',
    'A delivery app covering 60 locations for partner restaurants.',
  ];
  for (const idea of ideas) {
    const stage = priceScope(scope, idea, 'en');
    s.ok(
      `priced: ${idea.slice(0, 60)}`,
      !stage.bigIdea.isBig && isPricedEstimate(previewOf(stage, 'en').estimate),
      stage.bigIdea.signals.join('; ')
    );
  }
}

/* ------------------------------------------------------------------ */
/* 2. Uzbek text fixes                                                 */
/* ------------------------------------------------------------------ */

s.group('uz text — one "birinchi versiya", never a "do\'kon uchun … do\'kon"');
{
  const cases: [string, string][] = [
    ['Birinchi versiya — MVP', 'Birinchi versiya'],
    ['MVP — birinchi versiya', 'Birinchi versiya'],
    ['Birinchi versiya (MVP)', 'Birinchi versiya'],
    ['MVP: birinchi versiya', 'Birinchi versiya'],
    ['Bosqich 1. Birinchi versiya — MVP', 'Bosqich 1. Birinchi versiya'],
    ["Magazin uchun mobil do'kon", "Do'kon uchun mobil ilova"],
    ["Magazin uchun mobil do'koni", "Do'kon uchun mobil ilovasi"],
    ["Do'konimiz uchun mobil do'konimiz", "Do'konimiz uchun mobil ilovamiz"],
    // One "do'kon" only: nothing to disambiguate.
    ["Mobil do'kon ilovasi", "Mobil do'kon ilovasi"],
  ];
  for (const [from, to] of cases) s.eq(`"${from}"`, cleanVisibleText(from, 'uz'), to);
  const twice = cleanVisibleText('MVPda birinchi versiya tayyor', 'uz');
  s.ok(
    'a sentence that uses the phrase twice with different endings keeps both',
    (twice.match(/birinchi versiya/giu) ?? []).length === 2,
    twice
  );
  for (const idea of ["Magazin uchun mobil do'kon", "magazin uchun mobil do'kon kerak", "Magazinimiz uchun mobil do'kon"]) {
    const out = cleanVisibleText(idea, 'uz');
    s.ok(`no "do'kon uchun … do'kon": ${idea}`, !/do'kon\p{L}* uchun .*do'kon/iu.test(out), out);
  }
}

s.group('uz text — capitals stay capitals; "test ulanish qil-" is a verb');
{
  const cases: [string, string][] = [
    ['BAHAR', 'BAHOR'],
    ['BAHAR promokodi bilan 10% chegirma', 'BAHOR promokodi bilan 10% chegirma'],
    ['Bahar chegirmasi', 'Bahor chegirmasi'],
    ['bahar', 'bahor'],
    ['SKIDKA', 'CHEGIRMA'],
    ['XISOBOTLAR', 'HISOBOTLAR'],
    ['Xisobotlar', 'Hisobotlar'],
    ['ZAKAZI', 'BUYURTMASI'],
    ['Payme bilan test ulanish qilamiz', 'Payme bilan sinov tariqasida ulaymiz'],
    ['Test ulanish qilish kerak', 'Sinov tariqasida ulash kerak'],
    ["test ulanish qilib ko'ramiz", "sinov tariqasida ulab ko'ramiz"],
    ['test ulanish qilinadi', 'sinov tariqasida ulanadi'],
    ['Payme bilan test ulanish', 'Payme bilan sinov ulanishi'],
  ];
  for (const [from, to] of cases) s.eq(`"${from}"`, cleanVisibleText(from, 'uz'), to);
  s.ok('never "ulanishi qil-"', !/ulanishi qil/u.test(cleanVisibleText('Click bilan test ulanish qilamiz va tekshiramiz', 'uz')));
}

/* ------------------------------------------------------------------ */
/* 3. The copy-edit                                                    */
/* ------------------------------------------------------------------ */

s.group('copy-edit — the first letter is not an edit');
{
  s.eq('Martdagi → martdagi is refused', refuseFix('Martdagi buyurtmalar', 'martdagi buyurtmalar'), "only the first letter's case");
  s.eq('…and the other way round', refuseFix('martdagi buyurtmalar', 'Martdagi buyurtmalar'), "only the first letter's case");
  s.eq("a brand's own spelling is a fix (AmoCRM → amoCRM)", refuseFix('AmoCRM ulanishi', 'amoCRM ulanishi'), null);
  s.eq('…and keeps its lower-case start', keepLeadingCapital('AmoCRM ulanishi', 'amoCRMga ulanish'), 'amoCRMga ulanish');
  s.eq(
    'a lowercased first letter next to a real fix keeps its capital',
    keepLeadingCapital('Martdagi zakazlar', 'martdagi buyurtmalar'),
    'Martdagi buyurtmalar'
  );
  const texts = ['Martdagi buyurtmalar soni', 'Yetkazish zonalari'];
  const parsed = parsePolishJson(
    '{"fixes":[{"id":1,"find":"Martdagi","replace":"martdagi"},{"id":2,"find":"Yetkazish","replace":"yetkazib berish"}]}',
    texts
  );
  s.eq('end to end: the case-only fix is dropped, the real fix keeps the capital', Array.from(parsed?.value ?? []), [
    ['Yetkazish zonalari', 'Yetkazib berish zonalari'],
  ]);
  s.ok('the prompt tells the editor too', buildPolishSystemPrompt().includes('Never change only the case of a string'));
}

s.group('copy-edit — a question keeps its subject (the bakery pair)');
{
  // Round 3 live, uz-tgbot-bakery: the plan promised "we update the menu" (an unpriced service), and the
  // copy-edit flipped a question into "will YOU enter them?" — the two then contradicted each other.
  const canWait = "Birinchi vaqtda menyuni biz yangilab turamiz, keyin o'zingiz botdan boshqarasiz.";
  const question = "Menyudagi mahsulotlar va narxlar qanchalik tez-tez o'zgaradi; birinchi versiyada ularni biz kiritamizmi?";
  const plan: BriefPlan = {
    buildFirst: { what: "Buyurtma va to'lov boti.", why: 'Eng kichik ishlaydigan jarayon.' },
    canWait: [{ item: 'Bot uchun admin panel', reason: canWait, inEstimate: true }],
    phases: [],
  };
  const risks: BriefRisks = { risks: [], questions: ['Payme va Click uchun merchant shartnomalaringiz bormi?', question] };

  const flagged = UZ_GLOSSARY.find(entry => entry.id === 'our-data-entry');
  s.ok(
    'the glossary flags the promise…',
    glossaryChecks(canWait).some(entry => entry.id === 'our-data-entry')
  );
  s.ok('…never the question', !glossaryChecks(question).some(entry => entry.id === 'our-data-entry'));
  s.ok(
    "…and its advice aims at the promise, keeping a question's subject",
    !!flagged && /never change who a question asks about/.test(flagged.right)
  );
  s.eq(
    'a flipped question is refused',
    refuseFix(question, question.replace('biz kiritamizmi', 'siz kiritasizmi')),
    'flips who a question is about'
  );
  s.eq('…in either direction', refuseFix('Logotipingiz bormi?', 'Logotipimiz bormi?'), 'flips who a question is about');
  s.eq('a fix inside a question is still fine', refuseFix('Naqd pul ham qabul qilinasizmi?', 'Naqd pul ham qabul qilasizmi?'), null);
  s.ok('the prompt says so', buildPolishSystemPrompt().includes('A question to the client keeps its subject'));

  /** Who a clause says does it: "biz" (we), "siz" (you) or nobody named. */
  const subject = (clause: string): 'biz' | 'siz' | null => {
    if (/(?<![\p{L}'])biz(?![\p{L}'])|\p{L}+amiz(?:mi)?(?![\p{L}'])/u.test(clause)) return 'biz';
    if (/(?<![\p{L}'])(?:siz|o'zingiz)(?![\p{L}'])|\p{L}+asiz(?:mi)?(?![\p{L}'])/u.test(clause)) return 'siz';
    return null;
  };
  /** The plan says WE keep the menu up to date while the question asks whether YOU enter it. */
  const contradicts = (reason: string, questionText: string) =>
    subject(reason.split(',')[0]) === 'biz' && subject(questionText.split(';').pop() ?? questionText) === 'siz';

  const polishPair = (planAnswer: string, risksAnswer: string) => {
    const planTexts = [plan.buildFirst.what, plan.buildFirst.why, 'Bot uchun admin panel', canWait];
    const risksTexts = [...risks.questions];
    const planFixes = parsePolishJson(planAnswer, planTexts)?.value ?? new Map<string, string>();
    const risksFixes = parsePolishJson(risksAnswer, risksTexts)?.value ?? new Map<string, string>();
    const polishedPlan = applyFixes(plan, mapPlanTexts, planFixes);
    const polishedRisks = applyFixes(risks, mapRisksTexts, risksFixes);
    return { reason: polishedPlan.canWait[0].reason, question: polishedRisks.questions[1] };
  };

  // The live answers, as the copy-edit returned them.
  const live = polishPair(
    '{"fixes":[{"id":4,"find":"Birinchi vaqtda","replace":"Dastlab"}]}',
    '{"fixes":[{"id":2,"find":"ularni biz kiritamizmi?","replace":"ularni siz kiritasizmi?"}]}'
  );
  s.eq('live: the plan fix lands', live.reason, "Dastlab menyuni biz yangilab turamiz, keyin o'zingiz botdan boshqarasiz.");
  s.eq('live: the question keeps "biz kiritamizmi"', live.question, question);
  s.ok(
    'live: the plan and the question no longer contradict',
    !contradicts(live.reason, live.question),
    `${live.reason} / ${live.question}`
  );

  // What the new glossary asks for: the promise rewritten, the question left alone (or its flip refused).
  const aimed = polishPair(
    '{"fixes":[{"id":4,"find":"Birinchi vaqtda menyuni biz yangilab turamiz","replace":"Dastlab menyuni siz admin panel orqali kiritasiz"}]}',
    '{"fixes":[{"id":2,"find":"ularni biz kiritamizmi?","replace":"ularni siz kiritasizmi?"}]}'
  );
  s.eq(
    "aimed: the promise becomes the reader's own step",
    aimed.reason,
    "Dastlab menyuni siz admin panel orqali kiritasiz, keyin o'zingiz botdan boshqarasiz."
  );
  s.eq('aimed: the question is unchanged', aimed.question, question);
  s.ok('aimed: no contradiction', !contradicts(aimed.reason, aimed.question), `${aimed.reason} / ${aimed.question}`);
  s.ok(
    'the check helper sees the live contradiction it guards against',
    contradicts(canWait, question.replace('biz kiritamizmi', 'siz kiritasizmi'))
  );
}

/* ------------------------------------------------------------------ */
/* 4. The lab's S08 slot                                               */
/* ------------------------------------------------------------------ */

s.group('lab — S08 with the real brief: its own floor, static ids');
{
  const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
  const registry = read('src/modules/home/sections/registry.ts');
  const heights = read('src/modules/home/sections/heights.css');
  const shell = read('src/modules/home/LabShell.tsx');
  s.ok("the registry gives 'ai-demo' a slot floor", /'ai-demo': 'var\(--lab-h-ai-demo-slot\)'/.test(registry));
  const floors = Array.from(heights.matchAll(/--lab-h-ai-demo-slot: max\(100svh, (?:min\()?(\d+)px/g), m => Number(m[1]));
  const demo = Array.from(heights.matchAll(/--lab-h-ai-demo: max\(100svh, (?:min\()?(\d+)px/g), m => Number(m[1]));
  s.ok(
    'heights.css defines the slot floor at every 08 breakpoint',
    floors.length === demo.length && floors.length >= 5,
    `${floors} / ${demo}`
  );
  s.ok('…well below the scripted demo on phones (the 900 px blank band is gone)', floors[0] <= demo[0] - 800, `${floors[0]} vs ${demo[0]}`);
  s.ok('the shell swaps the floor in only when the slot is filled', /withSlotFloor/.test(shell) && /meta\.slotMinHeight/.test(shell));
  const composer = read('src/modules/estimator/components/brief/Composer.tsx');
  const experience = read('src/modules/estimator/components/brief/AIBriefExperience.tsx');
  s.ok('the composer takes static ids (no useId mismatch inside the lab)', /idPrefix \?\? generatedId/.test(composer));
  s.ok('…which the brief derives from its variant', /idPrefix = `ai-brief-\$\{variant\}`/.test(experience));
}

process.exit(s.report());
