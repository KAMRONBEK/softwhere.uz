/**
 * AI brief — round 2 iteration 1 logic, no network, no model calls.
 *
 *   npx tsx tests/ai-brief/iteration.ts
 *
 * Covers what iteration 1 added around the model: the production chains,
 * the new reconcile rules (bot operator → bot admin, other CIS markets, AI
 * tools with logins → web portal), the split plan/risks parsers, the two
 * wireframe halves, the request-path consistency guard, the summary check,
 * framing leaks, sentence-boundary clipping, Uzbek fixes and template zeros.
 */
import {
  BRIEF_DEADLINE_MS,
  BRIEF_PART_CHAINS,
  BRIEF_PARTS,
  CAPS,
  LONG_IDEA_SCOPE_CHAIN,
  SCOPE_HEDGE_MS,
} from '../../src/modules/estimator/ai-brief/constants';
import { fixMixedScript, polishUzbek } from '../../src/modules/estimator/ai-brief/cleanText';
import { checkBriefConsistency, framingLeaks, type ViewSource } from '../../src/modules/estimator/ai-brief/consistency';
import type { PricedScope } from '../../src/modules/estimator/ai-brief/digest';
import { guardBriefText, guardScopeText } from '../../src/modules/estimator/ai-brief/guard';
import { clipSentences } from '../../src/modules/estimator/ai-brief/parse';
import { parsePlanJson, parseRisksJson } from '../../src/modules/estimator/ai-brief/parseNarrative';
import { buildScopeSystemPrompt, buildScreensSystemPrompt, screenParts } from '../../src/modules/estimator/ai-brief/prompts';
import { isUzMarket, reconcileScope } from '../../src/modules/estimator/ai-brief/reconcile';
import { SCOPE_JSON_SCHEMA } from '../../src/modules/estimator/ai-brief/schema';
import { mergeScreenParts, parseScreensJson, stripZeroAmounts } from '../../src/modules/estimator/ai-brief/screens';
import type { AiBrief, BriefScope, WireframeScreen } from '../../src/modules/estimator/ai-brief/types';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-iteration');

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function scope(patch: Partial<BriefScope> = {}): BriefScope {
  return {
    isProjectIdea: true,
    rejection: 'none',
    policy: { status: 'ok', topics: [], note: '' },
    title: 'Contract assistant',
    summary: 'A web tool where your team uploads contracts.',
    clarity: 'clear',
    audience: [{ segment: 'Procurement', need: 'Find key terms fast' }],
    roles: ['Procurement user', 'Admin'],
    product: { projectType: 'web', subtype: 'portal' },
    platforms: [],
    approach: 'cross',
    hasDesigns: false,
    uiLanguages: 1,
    urgency: 'normal',
    features: [
      { id: 'file_upload', phase: 'mvp', note: '' },
      { id: 'rag_kb', phase: 'mvp', note: '' },
      { id: 'admin_panel', phase: 'mvp', note: '' },
    ],
    integrations: [],
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
    product: { projectType: 'web', subtype: 'portal' },
    mvpRefs: ['file_upload', 'rag_kb', 'admin_panel'],
    laterRefs: ['email_service'],
    extraRefs: [],
    hasGrowth: true,
    unpriced: ['SharePoint integration with permission sync', 'QuickBooks Online invoice sync'],
    frames: { primary: 'browser', mvp: ['browser'], later: ['browser'] },
    ...patch,
  };
}

const SOURCE: ViewSource = {
  locale: 'en',
  title: 'Contract assistant',
  roles: ['Procurement user', 'Admin'],
  integrations: [],
  languages: 1,
  platforms: [],
};

function screen(
  name: string,
  blocks: [WireframeScreen['blocks'][number]['kind'], string, string[]?][],
  phase: 'mvp' | 'later' = 'mvp'
): WireframeScreen {
  return {
    name,
    purpose: '',
    device: 'browser',
    phase,
    blocks: blocks.map(([kind, label, items]) => ({ kind, label, items: items ?? [] })),
  };
}

function brief(patch: Partial<AiBrief> & { assumptions?: string[] } = {}): AiBrief {
  const price = { currency: 'USD' as const, min: 1000, max: 2000, basis: 'en_dual_rate' as const };
  const { assumptions = [], ...rest } = patch;
  return {
    version: 1,
    locale: 'en',
    model: 'kimi-k3',
    models: { scope: 'kimi-k3', narrative: 'kimi-k3', screens: 'kimi-k3' },
    title: 'Contract assistant',
    summary: 'A web tool where your team uploads contracts and asks questions.',
    audience: [],
    roles: ['Procurement user', 'Admin'],
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
      mvp: { price, weeks: { min: 4, max: 6 }, team: [], drivers: [] },
      fullVision: null,
      extras: [],
      phases: [
        { id: 'mvp', title: 'Launch', goal: 'Answer contract questions.', deliverables: ['Upload and search'], weeks: { min: 4, max: 6 } },
      ],
      unpricedItems: [],
      adjustments: [],
    },
    narrative: {
      buildFirst: { what: 'Upload contracts and ask questions with citations.', why: 'It proves the value fast.' },
      canWait: [],
      risks: [{ title: 'Data quality', detail: 'Scans may be poor.', mitigation: 'Test with real files.' }],
      questions: ['How many contracts?', 'Which languages?', 'Who reviews flags?', 'Where do files live?'],
      assumptions,
    },
    policy: { status: 'ok', topics: [], note: '' },
    ...rest,
  };
}

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

s.group('production chains — round 2 winner (variant c)');
{
  s.eq('every part has a chain', Object.keys(BRIEF_PART_CHAINS).sort(), [...BRIEF_PARTS].sort());
  s.eq(
    'scope: kimi-k3 at high effort first',
    [BRIEF_PART_CHAINS.scope[0].model, BRIEF_PART_CHAINS.scope[0].reasoningEffort],
    ['kimi-k3', 'high']
  );
  s.ok(
    'later calls: kimi-k3 at low effort first',
    BRIEF_PARTS.filter(p => p !== 'scope').every(
      p => BRIEF_PART_CHAINS[p][0].model === 'kimi-k3' && BRIEF_PART_CHAINS[p][0].reasoningEffort === 'low'
    )
  );
  s.ok(
    'every chain falls back to kimi-k2.6',
    BRIEF_PARTS.every(p => BRIEF_PART_CHAINS[p].at(-1)?.model === 'kimi-k2.6')
  );
  s.eq('a long idea scopes at low effort', LONG_IDEA_SCOPE_CHAIN[0].reasoningEffort, 'low');
  s.ok('the scope hedge starts before its primary times out', SCOPE_HEDGE_MS < BRIEF_PART_CHAINS.scope[0].timeoutMs);
  s.ok(
    'a hedged scope fallback still leaves the later calls their fallback timeout',
    SCOPE_HEDGE_MS + BRIEF_PART_CHAINS.scope[1].timeoutMs + BRIEF_PART_CHAINS.plan[1].timeoutMs <= BRIEF_DEADLINE_MS
  );
}

s.group('scope schema — decisions before prose');
{
  const keys = Object.keys((SCOPE_JSON_SCHEMA.schema as { properties: object }).properties);
  s.ok('summary comes after unpricedItems', keys.indexOf('summary') > keys.indexOf('unpricedItems'));
  s.ok('assumptions come after features and integrations', keys.indexOf('assumptions') > keys.indexOf('integrations'));
  s.ok('product comes before title', keys.indexOf('product') < keys.indexOf('title'));
}

s.group('prompts — reader, mapping guide, Uzbek style');
{
  const en = buildScopeSystemPrompt('en');
  s.ok('the reader is addressed as you', en.includes('Address them as "you"'));
  const framing = /A visitor described|Visitor's idea|the visitor (?:asked|said|wants)/i;
  s.ok('prompts never frame the reader as a visitor', !framing.test(en) && !framing.test(buildScreensSystemPrompt('en')));
  s.ok('Mailchimp maps to email_service', /Mailchimp[^\n]*email_service/.test(en));
  s.ok('a live bot operator maps to bot_admin', /live operator[^\n]*bot_admin/.test(en));
  s.ok('the core of the request is never unpriced', en.includes('NEVER put the core of the request into unpricedItems'));
  const uz = buildScopeSystemPrompt('uz');
  s.ok('uz carries the style guide', uz.includes('UZBEK STYLE GUIDE') && uz.includes('APIga'));
  s.ok(
    'no zero tariff templates any more',
    !buildScreensSystemPrompt('uz').includes('Tarif A') && !buildScreensSystemPrompt('en').includes('Plan A')
  );
}

/* ------------------------------------------------------------------ */
/* Reconcile                                                           */
/* ------------------------------------------------------------------ */

s.group('reconcile — new rules');
{
  const bot = scope({
    product: { projectType: 'telegram', subtype: 'support_bot' },
    features: [
      { id: 'ai_chatbot', phase: 'mvp', note: '' },
      { id: 'chat', phase: 'mvp', note: 'Live operator takes over' },
    ],
  });
  const handoff = reconcileScope(bot, 'Telegram bot for support with a live operator', 'ru');
  s.eq(
    'bot chat → bot_admin',
    handoff.scope.features.map(f => `${f.id}:${f.phase}`),
    ['ai_chatbot:mvp', 'bot_admin:mvp']
  );
  s.eq('…keeping the note', handoff.scope.features.find(f => f.id === 'bot_admin')?.note, 'Live operator takes over');
  s.ok(
    '…and recorded',
    handoff.adjustments.some(a => a.includes('bot_admin'))
  );
  const webChat = scope({ features: [{ id: 'chat', phase: 'mvp', note: '' }] });
  s.ok(
    'chat stays in a web product',
    reconcileScope(webChat, 'Portal with chat', 'en').scope.features.some(f => f.id === 'chat')
  );

  s.eq('ru page, Almaty idea: not the Uzbek market', isUzMarket('Цветочный магазин в Алматы, оплата Kaspi', 'ru'), false);
  s.eq('ru page, no country named: Uzbekistan', isUzMarket('Доставка цветов, оплата картой', 'ru'), true);
  s.eq('ru page, Tashkent named with tenge mention: Uzbekistan wins', isUzMarket('Ташкент и Алматы, цены в тенге', 'ru'), true);
  const kz = scope({
    integrations: [
      { id: 'eskiz_sms', phase: 'mvp', note: '' },
      { id: 'kaspi', phase: 'mvp', note: '' },
    ],
  });
  s.eq(
    'KZ: Eskiz removed, Kaspi kept',
    reconcileScope(kz, 'Цветы в Алматы', 'ru').scope.integrations.map(i => i.id),
    ['kaspi']
  );

  const aiTool = scope({
    product: { projectType: 'ai', subtype: 'rag' },
    features: [
      { id: 'rag_kb', phase: 'mvp', note: '' },
      { id: 'roles', phase: 'mvp', note: '' },
      { id: 'reports_export', phase: 'later', note: '' },
    ],
  });
  const portal = reconcileScope(aiTool, 'AI assistant for our team', 'en');
  s.eq('AI tool with logins → web portal', portal.scope.product, { projectType: 'web', subtype: 'portal' });
  s.ok(
    '…recorded',
    portal.adjustments.some(a => a.includes('web:portal'))
  );
  const pureAi = scope({ product: { projectType: 'ai', subtype: 'rag' }, features: [{ id: 'rag_kb', phase: 'mvp', note: '' }] });
  s.eq('a pure AI backend stays AI', reconcileScope(pureAi, 'AI over our docs', 'en').scope.product.projectType, 'ai');
  s.eq('the input scope is not mutated', aiTool.product.projectType, 'ai');
}

/* ------------------------------------------------------------------ */
/* Split parsers and the two wireframe halves                          */
/* ------------------------------------------------------------------ */

s.group('parsers — plan and risks');
{
  const ctx = { locale: 'en' as const, idea: 'Contracts', priced: priced() };
  const plan = parsePlanJson(
    JSON.stringify({
      buildFirst: { what: 'Upload and ask.', why: 'Fast value.' },
      canWait: [{ item: 'Email alerts', reason: 'After launch.', ref: 'email_service' }],
      phases: [
        { id: 'mvp', title: 'Launch', goal: 'First answers.', deliverables: [{ text: 'Upload', ref: 'file_upload' }] },
        { id: 'growth', title: 'Grow', goal: 'Alerts.', deliverables: [{ text: 'Email alerts', ref: 'email_service' }] },
      ],
    }),
    ctx
  )!;
  s.ok('a complete plan is usable', plan.usable);
  s.eq('…can-wait priced later', plan.value.canWait[0].inEstimate, true);
  const noGrowth = parsePlanJson(
    JSON.stringify({
      buildFirst: { what: 'a', why: 'b' },
      phases: [{ id: 'mvp', title: 'T', goal: 'g', deliverables: [{ text: 'x', ref: 'core' }] }],
    }),
    ctx
  )!;
  s.ok('a priced growth phase is required', !noGrowth.usable);
  const risks = parseRisksJson(
    JSON.stringify({ risks: [{ title: 'Scans', detail: 'Poor scans.', mitigation: 'Test.' }], questions: ['A?', 'B?', 'C?'] }),
    ctx
  )!;
  s.ok('risks + three questions are usable', risks.usable);
  s.ok('two questions are not', !parseRisksJson(JSON.stringify({ risks: risks.value.risks, questions: ['A?', 'B?'] }), ctx)!.usable);
}

s.group('screens — halves, merge, template zeros');
{
  const p = priced();
  const parts = screenParts(scope(), p);
  s.ok(
    'main half: the main role only',
    parts.main.startsWith("Procurement user's screens only") && parts.main.includes(`exactly ${CAPS.mainScreens}`)
  );
  s.ok(
    'rest half: the other role and the operator view, capped',
    parts.rest.includes('Admin') && parts.rest.includes('operator/admin view') === false
  );
  const solo = screenParts(
    scope({ roles: ['Customer'], features: [{ id: 'catalog', phase: 'mvp', note: '' }] }),
    priced({ mvpRefs: ['catalog'], hasGrowth: false })
  );
  s.ok(
    'one role, no operator: the journey is split',
    solo.main.includes('entry') && solo.rest.includes('follow') && solo.rest.includes('phase "mvp"')
  );

  const ctx = { locale: 'en' as const, idea: 'x', priced: p, minScreens: 2, allowLater: false };
  const half = parseScreensJson(
    JSON.stringify({
      screens: [
        {
          name: 'Upload',
          purpose: '',
          device: 'browser',
          phase: 'mvp',
          blocks: [
            { kind: 'header', label: 'Upload', items: [] },
            { kind: 'upload', label: 'PDFs', items: [] },
          ],
        },
        {
          name: 'Ask',
          purpose: '',
          device: 'browser',
          phase: 'mvp',
          blocks: [
            { kind: 'header', label: 'Ask', items: [] },
            { kind: 'chat', label: 'You and the assistant', items: [] },
          ],
        },
        {
          name: 'Alerts',
          purpose: '',
          device: 'browser',
          phase: 'later',
          blocks: [
            { kind: 'header', label: 'Alerts', items: [] },
            { kind: 'form', label: 'Email', items: [] },
          ],
        },
      ],
    }),
    ctx
  )!;
  s.eq(
    'the MVP-only half drops a later screen',
    half.value.map(sc => sc.name),
    ['Upload', 'Ask']
  );
  s.ok('two screens are enough for a half', half.usable);

  const merged = mergeScreenParts(
    [
      screen('Upload', [
        ['header', 'a'],
        ['upload', 'b'],
      ]),
      screen('Ask', [
        ['header', 'a'],
        ['chat', 'b'],
      ]),
    ],
    [
      screen('upload', [
        ['header', 'a'],
        ['list', 'b'],
      ]),
      screen(
        'Later one',
        [
          ['header', 'a'],
          ['list', 'b'],
        ],
        'later'
      ),
      screen('Admin', [
        ['header', 'a'],
        ['table', 'b'],
      ]),
      screen(
        'Later two',
        [
          ['header', 'a'],
          ['list', 'b'],
        ],
        'later'
      ),
    ]
  );
  s.eq(
    'merged: no duplicate, MVP first, one later screen',
    merged.map(sc => sc.name),
    ['Upload', 'Ask', 'Admin', 'Later one']
  );

  s.eq('"$00/mo" removed', stripZeroAmounts('Plan A — $00/mo'), 'Plan A');
  s.eq('"000 000 so\'m/oy" removed', stripZeroAmounts("Tarif A — 000 000 so'm/oy"), 'Tarif A');
  s.eq('"metric: 00" keeps the metric', stripZeroAmounts('Active members: 00'), 'Active members');
  s.eq(
    'real amounts stay',
    [stripZeroAmounts("45 000 so'm"), stripZeroAmounts('$2,000'), stripZeroAmounts('1 000 000 сум')],
    ["45 000 so'm", '$2,000', '1 000 000 сум']
  );
  s.eq(
    'times and years stay',
    [stripZeroAmounts('09:00–20:00'), stripZeroAmounts('2000-yil'), stripZeroAmounts('100 ta')],
    ['09:00–20:00', '2000-yil', '100 ta']
  );
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

s.group('text — clipping, Uzbek fixes');
{
  const long = 'Build the web app first. It lets your agents upload contracts and see every key term, in English and Russian with roles.';
  s.eq('cut at the last whole sentence', clipSentences(long, 60), 'Build the web app first.');
  s.eq('short text untouched', clipSentences('One sentence.', 60), 'One sentence.');
  s.ok('a single long sentence still ends with an ellipsis', clipSentences('word '.repeat(40), 50).endsWith('…'));

  // "MVP" itself became "birinchi versiya" in the 2026-10-10 glossary pass; the apostrophe goes first either way.
  s.eq(
    'no apostrophe before a suffix of an abbreviation',
    polishUzbek("MVP'da sinaymiz, API'ga ulanadi"),
    'Birinchi versiyada sinaymiz, APIga ulanadi'
  );
  s.eq('native apostrophes stay', polishUzbek("ma'lumot, o'zbek, g'oya"), "ma'lumot, o'zbek, g'oya");
  s.eq(
    'compounds',
    polishUzbek('Admin-panel va web-sayt, Telegram-bildirishnomalar'),
    'Admin panel va veb-sayt, Telegram bildirishnomalar'
  );
  s.eq(
    'forbidden loans and misspellings',
    polishUzbek('Yozgi platya, padez, Klasik shim, bron bildirishlari'),
    "Yozgi ko'ylak, podyezd, Klassik shim, bron bildirishnomalari"
  );
  s.eq('inside a longer word: untouched', polishUzbek('platyalar'), 'platyalar');
  s.eq(
    'a Russian word drifting into Latin is transliterated',
    fixMixedScript('Один город — Ташkent, доставка по Ташkentу', 'ru'),
    'Один город — Ташкент, доставка по Ташкенту'
  );
  s.eq('an Uzbek word with a stray Cyrillic letter', fixMixedScript('Toshkeнt va Samarqaнд', 'uz'), 'Toshkent va Samarqand');
  s.eq('look-alikes still swap first', fixMixedScript('Тashkent', 'en'), 'Tashkent');
}

/* ------------------------------------------------------------------ */
/* Consistency: summary + framing                                       */
/* ------------------------------------------------------------------ */

s.group('consistency — summary and framing');
{
  const p = priced();
  const sharepoint = brief({ summary: 'You upload contracts and ask questions. It syncs with SharePoint and keeps your permissions.' });
  const report = checkBriefConsistency(sharepoint, p);
  s.ok(
    'a summary promising an unpriced sync is an error',
    report.violations.some(v => v.kind === 'summary_unpriced' && v.where === 'summary')
  );
  const honest = brief({ summary: 'You upload contracts and ask questions. SharePoint sync is not in this estimate.' });
  s.ok('saying it is not included is fine', !checkBriefConsistency(honest, p).violations.some(v => v.kind === 'summary_unpriced'));
  const audience = brief({ audience: [{ segment: 'IT administrators', need: 'Permission-aware SharePoint integration' }] });
  s.ok(
    'audience lines are checked too',
    checkBriefConsistency(audience, p).violations.some(v => v.where === 'audience[0]')
  );

  s.ok(
    '"Visitor explicitly asked" is a leak',
    framingLeaks('Visitor explicitly asked for a web version too').some(f => f.severity === 'error')
  );
  s.ok(
    '"the visitor only said" is a leak',
    framingLeaks('but the visitor only said payments').some(f => f.severity === 'error')
  );
  s.ok(
    'uz third person is a leak',
    framingLeaks("Tashrif buyuruvchi alohida sayt ham so'radi").some(f => f.severity === 'error')
  );
  s.ok('website visitors in a product are not', framingLeaks('Analytics on website visitors and signups').length === 0);
  s.ok('a visitor booking in a clinic form is product copy', framingLeaks('Tashrif buyuruvchi yozilishi uchun forma').length === 0);
  s.ok(
    '"the idea requires" is a warning only',
    framingLeaks('The idea requires SharePoint access').every(f => f.severity === 'warn')
  );
}

/* ------------------------------------------------------------------ */
/* Guard                                                               */
/* ------------------------------------------------------------------ */

s.group('guard — scope text');
{
  const p = priced();
  const sc = scope({
    summary: 'You upload contracts and ask questions with citations. It syncs with SharePoint and keeps your permissions.',
    audience: [
      { segment: 'Procurement', need: 'Find key terms fast' },
      { segment: 'IT administrators', need: 'Permission-aware SharePoint integration' },
    ],
    assumptions: ['Contracts are English PDFs', 'QuickBooks Online invoice sync built against its API', 'One interface language'],
    extraDeliverables: [{ projectType: 'web', subtype: 'landing', reason: 'Visitor explicitly asked for a site. It presents the tool.' }],
  });
  const { value, removed } = guardScopeText(sc, SOURCE, p);
  s.eq('summary keeps the priced sentence only', value.summary, 'You upload contracts and ask questions with citations.');
  s.eq(
    'audience line about the unpriced sync dropped',
    value.audience.map(a => a.segment),
    ['Procurement']
  );
  s.eq('assumption about the unpriced sync dropped', value.assumptions, ['Contracts are English PDFs', 'One interface language']);
  s.eq('framing sentence dropped from an extra reason', value.extraDeliverables[0].reason, 'It presents the tool.');
  s.ok('every drop is recorded', removed.length === 4 && removed.every(r => r.startsWith('dropped')));
  const only = guardScopeText(scope({ summary: 'It syncs with SharePoint.' }), SOURCE, p);
  s.eq('a required text is never emptied', only.value.summary, 'It syncs with SharePoint.');
  s.ok(
    '…the finding is still recorded',
    only.removed.some(r => r.startsWith('kept'))
  );
  s.eq('the input scope is not mutated', sc.assumptions.length, 3);
}

s.group('guard — assembled brief');
{
  const p = priced();
  const b = brief({
    screens: [
      screen('Sign in', [
        ['header', 'Sign in'],
        ['text', 'Access mirrors your SharePoint permissions'],
        ['form', 'Your account', ['Email', 'Password']],
      ]),
      screen('SharePoint sync', [
        ['header', 'Sync status'],
        ['table', 'Libraries', ['Library', 'Last sync']],
      ]),
      screen(
        'Alerts',
        [
          ['header', 'Alerts'],
          ['form', 'Email', ['Recipients']],
        ],
        'later'
      ),
    ],
  });
  const withNarrative: AiBrief = {
    ...b,
    narrative: {
      ...b.narrative,
      buildFirst: { what: 'Upload contracts and ask questions. Everything syncs with SharePoint.', why: 'Fast value.' },
      risks: [{ title: 'Scope', detail: 'The visitor asked for no backend. It needs one.', mitigation: 'Explain on the call.' }],
    },
  };
  const { value, removed } = guardBriefText(withNarrative, p, SOURCE);
  s.eq(
    'a screen about unpriced work is dropped',
    value.screens.map(sc => sc.name),
    ['Sign in', 'Alerts']
  );
  s.eq(
    'unpriced copy is dropped from an MVP screen',
    value.screens[0].blocks.map(bl => bl.kind),
    ['header', 'form']
  );
  s.eq('later screens are left alone', value.screens[1].blocks.length, 2);
  s.eq('an MVP sentence promising unpriced work is dropped', value.narrative.buildFirst.what, 'Upload contracts and ask questions.');
  s.eq('framing sentence dropped from a risk', value.narrative.risks[0].detail, 'It needs one.');
  s.ok('every drop is recorded', removed.length >= 4);
  s.eq('the input brief is not mutated', withNarrative.screens.length, 3);
}

process.exit(s.report());
