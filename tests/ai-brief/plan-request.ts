/**
 * AI plan "send request" — no network, no browser, no database.
 *
 *   npx tsx tests/ai-brief/plan-request.ts
 *
 * Covers what may reach the browser in each price mode, the owner's quote, the
 * sealed plan token, request validation, the owner's text, and delivery when
 * the database or Telegram fails.
 */
import * as path from 'path';
import { spawnSync } from 'child_process';
import { parseContact } from '../../src/modules/estimator/ai-brief/contact';
import type { BriefLocale } from '../../src/modules/estimator/ai-brief/constants';
import { assembleBrief, previewOf, priceScope, type BriefRun } from '../../src/modules/estimator/ai-brief/orchestrator';
import {
  deliverRequest,
  ownerLines,
  ownerNotice,
  parsePlanRequest,
  planToken,
  PLAN_LEAD_SOURCE,
  PLAN_SPAM_SOURCE,
  requestId,
  type PlanRequest,
  type RequestDeps,
} from '../../src/modules/estimator/ai-brief/planRequest';
import { parsePriceMode } from '../../src/modules/estimator/ai-brief/priceMode';
import { publicOutcome, publicProgress, type Audience } from '../../src/modules/estimator/ai-brief/publicBrief';
import { ownerQuote } from '../../src/modules/estimator/ai-brief/quote';
import { openPlan, REQUEST_TOKEN_TTL_MS, sealPlan } from '../../src/modules/estimator/ai-brief/requestToken';
import { encodeBriefEvent } from '../../src/modules/estimator/ai-brief/stream';
import type { BriefScope } from '../../src/modules/estimator/ai-brief/types';
import { loadBrief, saveBrief } from '../../src/modules/estimator/components/brief/briefStorage';
import { briefReducer, INITIAL_BRIEF_STATE } from '../../src/modules/estimator/components/brief/briefState';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-plan-request');
const ROOT = path.resolve(__dirname, '../..');
const SECRET = 'test-secret-test-secret-test-secret-1';
const NOW = Date.UTC(2026, 10, 25, 9, 0);
const IDEA = 'A delivery app for a chain of 20 restaurants in Tashkent with couriers, plus a marketing landing page.';
const HUGE =
  'We are a manufacturing holding with 5,000 employees and 12 plants. We need a complete ERP replacing SAP: finance, HR and payroll, inventory and MRP.';
const chr = String.fromCharCode;

function scope(patch: Partial<BriefScope> = {}): BriefScope {
  return {
    isProjectIdea: true,
    rejection: 'none',
    policy: { status: 'ok', topics: [], note: '' },
    title: 'Food delivery',
    summary: 'Delivery app for a restaurant chain.',
    clarity: 'clear',
    audience: [{ segment: 'Families', need: 'Hot food fast' }],
    roles: ['Customer', 'Operator'],
    product: { projectType: 'mobile', subtype: 'delivery' },
    platforms: ['ios', 'android'],
    approach: 'cross',
    hasDesigns: false,
    uiLanguages: 2,
    urgency: 'normal',
    features: [
      { id: 'catalog', phase: 'mvp', note: '' },
      { id: 'cart_checkout', phase: 'mvp', note: '' },
      { id: 'orders', phase: 'mvp', note: '' },
      { id: 'loyalty', phase: 'later', note: '' },
    ],
    integrations: [
      { id: 'payme', phase: 'mvp', note: '' },
      { id: 'onec', phase: 'later', note: '' },
    ],
    extraDeliverables: [{ projectType: 'web', subtype: 'landing', reason: 'Marketing site' }],
    unpricedItems: ['Courier hardware'],
    complexityFlags: ['payments'],
    stack: ['flutter'],
    assumptions: ['One city first'],
    ...patch,
  };
}

function runOf(locale: BriefLocale, idea = IDEA): BriefRun {
  const stage = priceScope(scope(), idea, locale);
  const narrative = {
    buildFirst: { what: 'Ordering.', why: 'It proves demand.' },
    canWait: [],
    phases: [{ id: 'mvp' as const, title: 'First version', goal: 'Order food.', deliverables: ['Catalog'] }],
    risks: [],
    questions: [],
  };
  const { brief } = assembleBrief(stage, narrative, [], { scope: 'm', narrative: 'm', screens: null }, locale);
  return {
    outcome: { status: 'ok', brief },
    scrubbedIdea: idea,
    quote: ownerQuote(stage.scope, stage.mapped),
  } as unknown as BriefRun;
}

const RANGE: Audience = { mode: 'range', knowsPlan: true };
const REQUEST: Audience = { mode: 'request', knowsPlan: true };
const OLD_TAB: Audience = { mode: 'request', knowsPlan: false };
const PRICE_KEYS = /"(?:price|basis|drivers|confidence|hours|rate|quote|cost|currency)"/;

/* ------------------------------------------------------------------ */
s.group('price mode — off unless asked for');
for (const value of [undefined, '', 'range', 'Request', 'none']) s.eq(`"${value}" is range`, parsePriceMode(value), 'range');
s.eq('"request" is request', parsePriceMode('request'), 'request');
{
  const build = (env: Record<string, string>) =>
    spawnSync(process.execPath, ['-e', "import('./next.config.mjs').then(()=>process.exit(0),()=>process.exit(3))"], {
      cwd: ROOT,
      env: { ...process.env, BRIEF_TOKEN_SECRET: '', ...env },
    }).status;
  s.eq('a request build without the secret is refused', build({ NEXT_PUBLIC_BRIEF_PRICE_MODE: 'request' }), 3);
  s.eq('with a secret it builds', build({ NEXT_PUBLIC_BRIEF_PRICE_MODE: 'request', BRIEF_TOKEN_SECRET: SECRET }), 0);
  s.eq('a range build needs none', build({ NEXT_PUBLIC_BRIEF_PRICE_MODE: 'range' }), 0);
}

/* ------------------------------------------------------------------ */
s.group('what reaches the browser');
for (const locale of ['uz', 'ru', 'en'] as const) {
  const run = runOf(locale);
  if (run.outcome.status !== 'ok') throw new Error('fixture');
  const { brief } = run.outcome;
  const scoped = { stage: 'scoped' as const, preview: previewOf(priceScope(scope(), IDEA, locale), locale) };
  s.ok(`${locale}: the fixture has a later phase and an extra product`, !!run.quote?.full && brief.estimate.extras.length === 1);
  s.eq(`${locale}: range mode changes nothing`, [publicOutcome(run.outcome, RANGE), publicProgress(scoped, RANGE)], [run.outcome, scoped]);
  const audiences: [string, Audience][] = [
    ['request', REQUEST],
    ['old tab', OLD_TAB],
  ];
  for (const [name, audience] of audiences) {
    const wire =
      encodeBriefEvent({ type: 'progress', progress: publicProgress(scoped, audience) }) +
      encodeBriefEvent({ type: 'result', data: publicOutcome(run.outcome, audience) });
    s.ok(`${locale}, ${name}: no price key on the wire`, !PRICE_KEYS.test(wire), wire.match(PRICE_KEYS)?.[0]);
    const numbers = [run.quote?.mvp, run.quote?.full].flatMap(q => (q ? [q.local.min, q.local.max, q.en.min, q.en.max] : []));
    s.ok(
      `${locale}, ${name}: no engine price on the wire`,
      numbers.every(n => !wire.split(/\D+/).includes(String(n)))
    );
  }
  const shown = publicOutcome(run.outcome, REQUEST);
  const old = publicOutcome(run.outcome, OLD_TAB);
  const weeks = shown.status === 'ok' && shown.brief.estimate.mode === 'plan' ? shown.brief.estimate.weeks : null;
  s.eq(`${locale}: a plan keeps its weeks`, weeks, run.quote?.mvp.weeks);
  s.eq(`${locale}: an old tab gets the discovery shape`, old.status === 'ok' && old.brief.estimate.mode, 'discovery');
  s.eq(`${locale}: the pipeline's brief is untouched`, brief.estimate.mode, 'priced');
}

/* ------------------------------------------------------------------ */
s.group("the owner's quote");
{
  const stage = priceScope(scope(), IDEA, 'en');
  const quote = ownerQuote(stage.scope, stage.mapped);
  const shownIn = (locale: BriefLocale) => {
    const { estimate } = previewOf(priceScope(scope(), IDEA, locale), locale);
    if (estimate.mode !== 'priced') throw new Error('fixture');
    return { min: estimate.mvp.price.min, max: estimate.mvp.price.max };
  };
  s.eq('en range = what the en page shows', quote.mvp.en, shownIn('en'));
  s.eq('local range = what the uz page shows', quote.mvp.local, shownIn('uz'));
  s.ok('full vision costs more', (quote.full?.local.min ?? 0) > quote.mvp.local.min);
  const big = priceScope(scope({ product: { projectType: 'web', subtype: 'crm' } }), HUGE, 'en');
  s.ok('a very large idea still gives the owner a number', big.bigIdea.isBig && ownerQuote(big.scope, big.mapped).mvp.local.min > 0);
}

/* ------------------------------------------------------------------ */
s.group('the sealed plan');
const token = planToken(runOf('ru'), 'ru', SECRET, NOW) ?? '';
{
  const plan = openPlan(token, SECRET, NOW);
  s.ok('opens', plan !== null && plan.idea === IDEA && plan.quote.mvp.local.min > 0);
  s.eq(
    'scope by phase',
    [plan?.mvp, plan?.later],
    [
      ['catalog', 'cart_checkout', 'orders', 'payme', 'soliq_ofd'],
      ['loyalty', 'onec'],
    ]
  );
  s.ok('unreadable', !Buffer.from(token.slice(3), 'base64url').toString('latin1').includes('delivery'));
  const flip = (at: number) => token.slice(0, at) + (token[at] === 'A' ? 'B' : 'A') + token.slice(at + 1);
  for (const at of [5, 25, 60, token.length - 3]) s.eq(`tampered at ${at}`, openPlan(flip(at), SECRET, NOW), null);
  s.eq('another key', openPlan(token, `${SECRET}x`, NOW), null);
  s.eq('expired', openPlan(token, SECRET, NOW + REQUEST_TOKEN_TTL_MS + 1), null);
  s.ok('last moment', openPlan(token, SECRET, NOW + REQUEST_TOKEN_TTL_MS) !== null);
  s.eq('from the future', openPlan(token, SECRET, NOW - 3_600_000), null);
  for (const junk of [undefined, null, 7, '', 'v1.', 'v1.AAAA', `v2.${token.slice(3)}`, {}])
    s.eq(`junk ${String(junk).slice(0, 8)}`, openPlan(junk, SECRET, NOW), null);
  if (plan) s.eq('a short secret seals nothing', [sealPlan(plan, 'short'), sealPlan(plan, undefined)], [null, null]);
  s.ok('two seals differ', planToken(runOf('ru'), 'ru', SECRET, NOW) !== token);
  const rejected = { outcome: { status: 'rejected', reason: 'too_short' } } as unknown as BriefRun;
  s.eq('a rejected run has no token', planToken(rejected, 'en', SECRET, NOW), null);
  const longest = planToken(runOf('ru', chr(0x44f).repeat(3000)), 'ru', SECRET, NOW) ?? '';
  s.ok('the longest idea fits the request body cap', longest.length + 12_000 < 64 * 1024, `${longest.length}`);
}

/* ------------------------------------------------------------------ */
s.group('contact');
const CONTACTS: [string, string | null][] = [
  ['+998 90 123-45-67', '+998 90 123-45-67'],
  ['901234567', '901234567'],
  ['@some_user', '@some_user'],
  ['https://t.me/some_user', '@some_user'],
  ['t.me/some_user/', '@some_user'],
  [' a.b@example.com ', 'a.b@example.com'],
  ['12345', null],
  ['1234567890123456', null],
  ['@ab', null],
  ['call me', null],
  ['a@b', null],
  ['javascript:alert(1)', null],
  ['', null],
];
for (const [value, out] of CONTACTS) s.eq(`"${value}"`, parseContact(value), out);

/* ------------------------------------------------------------------ */
s.group('the request');
const BODY = { token, idea: 'browser text', name: 'Ali', contact: '@some_user', comment: 'Soon', locale: 'ru' };
const parse = (body: unknown): PlanRequest => {
  const parsed = parsePlanRequest(body, SECRET, NOW);
  if (!parsed.ok) throw new Error(`rejected: ${parsed.field}`);
  return parsed.value;
};
const fieldOf = (body: unknown) => {
  const parsed = parsePlanRequest(body, SECRET, NOW);
  return parsed.ok ? 'ok' : parsed.field;
};
{
  for (const body of [null, 'x', 7, []]) s.eq(`body ${JSON.stringify(body)}`, fieldOf(body), 'body');
  s.eq('no name', fieldOf({ ...BODY, name: ` ${chr(0)}${chr(0x202e)} ` }), 'name');
  s.eq('bad contact', fieldOf({ ...BODY, contact: 'nope' }), 'contact');
  s.eq('no token, no idea', fieldOf({ ...BODY, token: null, idea: ' ' }), 'idea');
  s.eq('a valid token carries its own idea', parse(BODY).idea, IDEA);
  const bad = parse({ ...BODY, token: 'v1.forged' });
  s.ok('a forged token keeps the idea', bad.plan === null && bad.idea === 'browser text');
  const lied = parse({ ...BODY, price: 1, plan: { quote: { mvp: { local: { min: 1, max: 2 } } } }, quote: 1 });
  s.eq('prices in the body are ignored', ownerLines(lied), ownerLines(parse(BODY)));
  s.eq('unknown locale', parse({ ...BODY, locale: 'de' }).locale, 'en');
  const forged = parse({ ...BODY, name: `Ali${chr(10)}Engine price: $1`, comment: `x${chr(0x2028)}Contact: @evil` });
  s.ok('a name or comment cannot forge a line', ![chr(10), chr(0x2028)].some(c => (forged.name + forged.comment).includes(c)));
  s.eq('an emoji is never cut in half', parse({ ...BODY, name: `${'a'.repeat(119)}😀` }).name, 'a'.repeat(119));
  s.ok('the id is a uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId(parse(BODY), NOW)));
  s.eq('a double click is one lead', requestId(parse(BODY), NOW), requestId(parse(BODY), NOW + 86_400_000));
  s.ok('a new comment is a new lead', requestId(parse(BODY), NOW) !== requestId(parse({ ...BODY, comment: 'More' }), NOW));
  const ideaOnly = parse({ ...BODY, token: null });
  s.ok('without a token, tomorrow is a new lead', requestId(ideaOnly, NOW) !== requestId(ideaOnly, NOW + 86_400_000));
}

/* ------------------------------------------------------------------ */
s.group("the owner's text");
{
  const request = parse(BODY);
  if (!request.plan) throw new Error('fixture');
  const text = ownerLines(request).join('\n');
  const { min, max } = request.plan.quote.mvp.local;
  s.ok('has the engine price', text.includes(`$${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}`), text);
  s.ok(
    'has idea, scope and comment',
    [IDEA, 'catalog', 'loyalty', 'Courier hardware', 'Soon'].every(part => text.includes(part))
  );
  s.ok(
    'idea only says so',
    ownerLines(parse({ ...BODY, token: null }))
      .join('\n')
      .includes('no engine price')
  );
  const long = parse({ ...BODY, token: null, idea: '😀&<'.repeat(900), comment: '&'.repeat(1000), name: '&'.repeat(120) });
  s.ok('the Telegram text stays under the limit', ownerNotice(long, true, 'https://x/en/admin/leads').length < 4096);
  s.ok('a notice without a saved lead says so', ownerNotice(request, false, 'x').includes('NOT SAVED'));
}

/* ------------------------------------------------------------------ */
async function delivery() {
  s.group('delivery — lost only when both fail');
  const world = (over: Partial<RequestDeps> = {}) => {
    const stored: Parameters<RequestDeps['store']>[0][] = [];
    const sent: string[] = [];
    const marked: boolean[] = [];
    const tasks: (() => Promise<void>)[] = [];
    const deps: RequestDeps = {
      store: async lead => {
        stored.push(lead);
        return { isNew: true, notified: 'pending' };
      },
      notify: async text => {
        sent.push(text);
        return true;
      },
      markNotified: async (_id, ok) => void marked.push(ok),
      later: task => void tasks.push(task),
      onStoreError: () => undefined,
      adminUrl: 'https://x/en/admin/leads',
      now: NOW,
      ...over,
    };
    return { stored, sent, marked, tasks, deps };
  };
  const request = parse(BODY);
  const down = async () => {
    throw new Error('db down');
  };

  const ok = world();
  s.ok('stored', await deliverRequest(request, ok.deps));
  s.eq('answered before Telegram', ok.sent.length, 0);
  for (const task of ok.tasks) await task();
  s.eq('then announced and marked', [ok.sent.length, ok.marked], [1, [true]]);
  s.eq('source and contact', [ok.stored[0].source, ok.stored[0].phone], [PLAN_LEAD_SOURCE, '@some_user']);

  const tgFails = world({ notify: down });
  s.ok('Telegram down: still stored', await deliverRequest(request, tgFails.deps));
  for (const task of tgFails.tasks) await task();
  s.eq('marked failed', tgFails.marked, [false]);

  const dbFails = world({ store: down });
  s.ok('database down: Telegram takes it', await deliverRequest(request, dbFails.deps));
  s.ok('and says it is not saved', dbFails.sent[0].includes('NOT SAVED'));
  s.eq('both down: the visitor is told', await deliverRequest(request, world({ store: down, notify: async () => false }).deps), false);

  const again = world({ store: async () => ({ isNew: false, notified: 'sent' }) });
  s.ok('a repeat succeeds', await deliverRequest(request, again.deps));
  s.eq('without a second alert', again.tasks.length, 0);
  const retry = world({ store: async () => ({ isNew: false, notified: 'failed' }) });
  await deliverRequest(request, retry.deps);
  s.eq('a repeat after a failed alert sends it', retry.tasks.length, 1);

  const spam = world();
  s.ok('a filled honeypot gets a success', await deliverRequest(parse({ ...BODY, website: 'x' }), spam.deps));
  s.eq('kept apart, no alert', [spam.stored[0].source, spam.tasks.length], [PLAN_SPAM_SOURCE, 0]);
}

/* ------------------------------------------------------------------ */
function client() {
  s.group('the page');
  const map = new Map<string, string>();
  const store = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  } as unknown as Storage;
  const run = runOf('ru');
  if (run.outcome.status !== 'ok') throw new Error('fixture');
  const { brief } = run.outcome;
  saveBrief(store, 'ru', { idea: IDEA, brief, requestToken: token, elapsedMs: 1, savedAt: NOW });
  s.eq('range: a saved brief comes back as saved', loadBrief(store, 'ru', NOW, 'range')?.brief, JSON.parse(JSON.stringify(brief)));
  const hidden = loadBrief(store, 'ru', NOW, 'request');
  s.ok(
    'request: a brief saved with a price loses it',
    hidden?.brief.estimate.mode === 'plan' && !PRICE_KEYS.test(JSON.stringify(hidden.brief))
  );
  s.eq('the token survives', hidden?.requestToken, token);
  const started = briefReducer(INITIAL_BRIEF_STATE, { type: 'start', idea: IDEA, at: 1 });
  const done = briefReducer(started, { type: 'event', event: { type: 'result', data: run.outcome, requestToken: token }, at: 2 });
  s.eq('the result carries the token', done.requestToken, token);
  s.eq('a reset drops it', briefReducer(done, { type: 'reset' }).requestToken, null);
}

void delivery().then(() => {
  client();
  process.exit(s.report());
});
