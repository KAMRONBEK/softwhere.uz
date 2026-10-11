/**
 * AI brief — one free brief per visitor a day, and no hours or hourly rates
 * on the page (founder feedback 2026-10-10). No network, no model calls.
 *
 *   npx tsx tests/ai-brief/daily-limit.ts
 *
 * Covers the server allowance (hold, give back, window), the route wiring,
 * the page's quota state (reducer + browser storage), the "today / tomorrow"
 * line, the hour-free estimate payload end to end, and the visible copy in
 * all three locales (no rate or hour count, the range note, the limit card).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createTranslator } from 'use-intl/core';
import { createBriefAllowance } from '../../src/modules/estimator/ai-brief/allowance';
import { pickBriefLane } from '../../src/modules/estimator/ai-brief/lanes';
import { createDailyBudget } from '../../src/shared/utils/dailyBudget';
import { buildEstimate, engineSize, mapScopeToInputs } from '../../src/modules/estimator/ai-brief/mapping';
import { previewOf, priceScope } from '../../src/modules/estimator/ai-brief/orchestrator';
import type { AiBrief, BriefScope } from '../../src/modules/estimator/ai-brief/types';
import {
  briefReducer,
  INITIAL_BRIEF_STATE,
  type BriefAction,
  type BriefRunState,
} from '../../src/modules/estimator/components/brief/briefState';
import { DAY_MS, loadBrief, loadNextFree, saveBrief, saveNextFree } from '../../src/modules/estimator/components/brief/briefStorage';
import { nextFreeDay, timeFormatter } from '../../src/modules/estimator/components/brief/format';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-daily-limit');
const ROOT = path.resolve(__dirname, '../..');
const HOUR_MS = 60 * 60_000;
const LOCALES = ['en', 'ru', 'uz'] as const;

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

/** An in-memory Storage (the browser's localStorage in tests). */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

/** Storage that throws on every call (blocked site data, sandboxed frames). */
const blockedStorage = new Proxy({} as Storage, {
  get() {
    return () => {
      throw new Error('SecurityError');
    };
  },
});

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
    uiLanguages: 0,
    urgency: 'normal',
    features: [
      { id: 'catalog', phase: 'mvp', note: '' },
      { id: 'cart_checkout', phase: 'mvp', note: '' },
      { id: 'orders', phase: 'mvp', note: '' },
      { id: 'admin_panel', phase: 'mvp', note: '' },
      { id: 'loyalty', phase: 'later', note: '' },
    ],
    integrations: [
      { id: 'payme', phase: 'mvp', note: '' },
      { id: 'onec', phase: 'later', note: '' },
    ],
    extraDeliverables: [{ projectType: 'web', subtype: 'landing', reason: 'Marketing site' }],
    unpricedItems: [],
    complexityFlags: ['payments'],
    stack: ['flutter'],
    assumptions: ['One city first'],
    ...patch,
  };
}

const brief = {
  version: 1,
  locale: 'en',
  title: 'Yoga Studio App',
  estimate: { mode: 'priced', phases: [] },
} as unknown as AiBrief;

const run = (actions: BriefAction[], from: BriefRunState = INITIAL_BRIEF_STATE) => actions.reduce(briefReducer, from);
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/* ------------------------------------------------------------------ */
/* 1. Server allowance                                                 */
/* ------------------------------------------------------------------ */

s.group('allowance — one free brief per visitor a day');
{
  let now = Date.UTC(2026, 9, 10, 18, 0);
  const clock = () => now;
  const allowance = createBriefAllowance({ count: 1, windowMs: DAY_MS }, clock);

  s.eq('a new visitor may start', allowance.retryAfter('1.1.1.1'), 0);
  s.ok('the first brief is held', allowance.take('1.1.1.1'));
  s.ok('a second, parallel brief is refused while the first runs', !allowance.take('1.1.1.1'));
  s.eq('…and the visitor is told to wait the whole window', allowance.retryAfter('1.1.1.1'), DAY_MS / 1000);
  s.ok('another visitor is not affected', allowance.take('2.2.2.2'));

  allowance.refund('1.1.1.1'); // the idea was "too vague": no brief delivered
  s.eq('a run without a brief gives it back', allowance.retryAfter('1.1.1.1'), 0);
  now += 2 * HOUR_MS;
  s.ok('the visitor can try again', allowance.take('1.1.1.1'));
  s.eq('the window starts with the brief that was delivered', allowance.retryAfter('1.1.1.1'), DAY_MS / 1000);

  now += 23 * HOUR_MS;
  s.eq('one hour before the window ends', allowance.retryAfter('1.1.1.1'), HOUR_MS / 1000);
  s.ok('still refused', !allowance.take('1.1.1.1'));
  now += HOUR_MS;
  s.eq('24 hours after the delivered brief, the next one opens', allowance.retryAfter('1.1.1.1'), 0);
  s.ok('…and can be taken', allowance.take('1.1.1.1'));

  allowance.refund('9.9.9.9');
  s.eq('refunding an unknown visitor is a no-op', allowance.retryAfter('9.9.9.9'), 0);

  const two = createBriefAllowance({ count: 2, windowMs: DAY_MS }, clock);
  s.ok('count 2: first', two.take('x'));
  s.ok('count 2: second', two.take('x'));
  s.ok('count 2: third refused', !two.take('x'));
  two.refund('x');
  s.ok('count 2: one given back, one more allowed', two.take('x'));
}

s.group('route — the allowance is wired in the right order');
{
  const route = read('src/app/api/estimate/brief/route.ts');
  const at = (needle: string) => route.indexOf(needle);
  s.ok('one free brief a day per IP', /DAILY_LIMIT_PER_IP = \{ count: 1, windowMs: 24 \* 60 \* 60_000 \}/.test(route));
  s.ok('the allowance is created from it', route.includes('createBriefAllowance(DAILY_LIMIT_PER_IP)'));
  s.ok(
    'a visitor who has today’s brief hears so before any attempt is counted',
    at('allowance.retryAfter(ip)') > -1 && at('allowance.retryAfter(ip)') < at('rateLimit(`brief:burst:')
  );
  s.ok(
    'the brief is held only after the body is valid, before the budget',
    at('allowance.take(ip)') > at("fail(400, 'too_long'") && at('allowance.take(ip)') < at('pickBriefLane(')
  );
  s.ok('a busy day (main and overflow spent) gives the held brief back', /if \(!lane\) \{\s*allowance\.refund\(ip\);/.test(route));
  s.ok(
    'the overflow only runs with a DeepSeek key',
    route.includes("pickBriefLane(budget, overflowBudget, configuredProviders().includes('deepseek'))")
  );
  s.ok(
    'the overflow cap is its own env var, $1 by default',
    /AI_BRIEF_OVERFLOW_DAILY_USD, DEFAULT_OVERFLOW_DAILY_USD/.test(route) && /DEFAULT_OVERFLOW_DAILY_USD = 1;/.test(route)
  );
  s.ok(
    'each run is recorded on the budget of its lane',
    route.includes('lane.budget.record(run.totalCostUsd)') && !/\n\s*budget\.record\(/.test(route)
  );
  s.ok(
    'the lane options reach both run paths',
    route.includes('runBrief({ idea, locale }, lane.options)') && route.includes('...lane.options, onProgress')
  );
  s.ok("a run that is not 'ok' gives it back", route.includes("if (run?.outcome.status !== 'ok') allowance.refund(ip);"));
  s.eq('settled on both paths (stream + JSON, success + throw)', route.match(/settleAllowance\(ip, /g)?.length, 4);
  s.ok("429 'daily_limit' with Retry-After", /fail\(429, 'daily_limit'[\s\S]{0,160}'Retry-After'/.test(route));
}

s.group('lanes — main budget first, then the deepseek-flash overflow');
{
  const budgetOf = (maxUsd: number) => createDailyBudget({ maxCalls: 100, maxUsd, reserveUsd: 0.3 });
  const main = budgetOf(0.6); // room for two reserves
  const overflow = createDailyBudget({ maxCalls: 100, maxUsd: 0.1, reserveUsd: 0.05 });
  const first = pickBriefLane(main, overflow, true);
  const second = pickBriefLane(main, overflow, true);
  s.eq('briefs run on the main lane while its cap allows', [first?.name, second?.name], ['main', 'main']);
  s.eq('the main lane runs the production chains (no overrides)', first?.options, {});
  const third = pickBriefLane(main, overflow, true);
  s.eq('main cap reached → overflow lane', third?.name, 'overflow');
  s.ok(
    'the overflow runs every call on deepseek-flash',
    Object.values(third?.options.partChains ?? {})
      .flat()
      .every(step => step.model === 'deepseek-flash') && Object.keys(third?.options.partChains ?? {}).length === 5
  );
  s.eq('the overflow skips the Uzbek copy-edit', third?.options.polish, false);
  s.eq('overflow reserve held on the overflow budget only', [main.snapshot().inFlight, overflow.snapshot().inFlight], [2, 1]);
  s.eq(
    'overflow cap reached too → null (resting for today)',
    [pickBriefLane(main, overflow, true), pickBriefLane(main, overflow, true)].map(l => l?.name ?? null),
    ['overflow', null]
  );
  const noKeyMain = budgetOf(0.3);
  const noKeyOverflow = budgetOf(1);
  pickBriefLane(noKeyMain, noKeyOverflow, false);
  s.eq('without a DeepSeek key there is no overflow', pickBriefLane(noKeyMain, noKeyOverflow, false), null);
  s.eq('… and its budget is never touched', noKeyOverflow.snapshot().calls, 0);
  main.record(0); // a brief that failed before any paid call
  s.eq('a finished main brief frees its reserve for the main lane again', pickBriefLane(main, overflow, true)?.name, 'main');
}

/* ------------------------------------------------------------------ */
/* 2. The page's quota state                                           */
/* ------------------------------------------------------------------ */

s.group('reducer — when the next free brief opens');
{
  s.eq('nothing known at first', INITIAL_BRIEF_STATE.nextFreeAt, null);
  const done = run([
    { type: 'start', idea: 'Yoga app', at: 1_000 },
    { type: 'outcome', outcome: { status: 'ok', brief }, at: 50_000 },
  ]);
  s.eq('a delivered brief: the next opens a day after it started', done.nextFreeAt, 1_000 + DAY_MS);

  const rejected = run([
    { type: 'start', idea: 'x', at: 1_000 },
    { type: 'outcome', outcome: { status: 'rejected', reason: 'too_vague' }, at: 9_000 },
  ]);
  s.eq('a rejected idea uses nothing', rejected.nextFreeAt, null);
  const failed = run([
    { type: 'start', idea: 'x', at: 1_000 },
    { type: 'fail', failure: { code: 'failed' }, at: 9_000 },
  ]);
  s.eq('a failed run uses nothing', failed.nextFreeAt, null);

  const limited = run([
    { type: 'start', idea: 'Second idea', at: 1_000 },
    { type: 'fail', failure: { code: 'daily_limit', retryAfterSec: 3_600 }, at: 2_000 },
  ]);
  s.eq(
    'the server says today’s is used → status error, code daily_limit',
    [limited.status, limited.failure?.code],
    ['error', 'daily_limit']
  );
  s.eq('…next free = now + Retry-After', limited.nextFreeAt, 2_000 + 3_600_000);

  s.eq('a reset keeps it (no new run is offered)', briefReducer(done, { type: 'reset' }).nextFreeAt, done.nextFreeAt);
  s.eq('a new run keeps it', briefReducer(done, { type: 'start', idea: 'y', at: 60_000 }).nextFreeAt, done.nextFreeAt);
  s.eq(
    'a restored brief keeps it',
    briefReducer(limited, { type: 'restore', idea: 'Yoga app', brief, elapsedMs: 40_000 }).nextFreeAt,
    limited.nextFreeAt
  );
  const later = run(
    [
      { type: 'start', idea: 'z', at: 5_000 },
      { type: 'fail', failure: { code: 'daily_limit', retryAfterSec: 1 }, at: 6_000 },
    ],
    done
  );
  s.eq('an earlier signal never reopens a brief that is still closed', later.nextFreeAt, done.nextFreeAt);
  s.eq('storage sets it', briefReducer(INITIAL_BRIEF_STATE, { type: 'quota', nextFreeAt: 123 }).nextFreeAt, 123);
  s.eq('the timer clears it', briefReducer(done, { type: 'quota', nextFreeAt: null }).nextFreeAt, null);
}

s.group('storage — the saved brief and the next free time (localStorage)');
{
  const store = new MemoryStorage();
  const now = Date.UTC(2026, 9, 10, 12, 0);
  saveBrief(store, 'en', { idea: 'Yoga app', brief, elapsedMs: 41_000, savedAt: now });
  s.eq('a saved brief comes back', loadBrief(store, 'en', now + HOUR_MS)?.idea, 'Yoga app');
  s.eq('not on another locale’s page', loadBrief(store, 'ru', now), null);
  s.ok('still there after 6 days', loadBrief(store, 'en', now + 6 * DAY_MS) !== null);
  s.eq('gone after 7 days', loadBrief(store, 'en', now + 7 * DAY_MS + 1), null);
  s.eq('…and removed from storage', store.length, 0);

  store.setItem('ai-brief:brief:en', '{not json');
  s.eq('malformed JSON → nothing', loadBrief(store, 'en', now), null);
  store.setItem('ai-brief:brief:en', JSON.stringify({ v: 2, idea: 'x', savedAt: now, brief: { version: 1, locale: 'ru', estimate: {} } }));
  s.eq('a brief of another locale under this key → nothing', loadBrief(store, 'en', now), null);
  store.setItem('ai-brief:brief:en', JSON.stringify({ v: 1, idea: 'x', brief }));
  s.eq('an old-format save → nothing', loadBrief(store, 'en', now), null);

  saveNextFree(store, now + 5 * HOUR_MS);
  s.eq('the next free time comes back', loadNextFree(store, now), now + 5 * HOUR_MS);
  saveNextFree(store, now + HOUR_MS);
  s.eq('an earlier time never moves it earlier', loadNextFree(store, now), now + 5 * HOUR_MS);
  s.eq('once it has passed: open (null)', loadNextFree(store, now + 5 * HOUR_MS), null);
  s.eq('…and removed', store.getItem('ai-brief:next-free'), null);
  store.setItem('ai-brief:next-free', JSON.stringify({ v: 1, at: now + 3 * DAY_MS }));
  s.eq('more than a day ahead is not trusted', loadNextFree(store, now), null);

  s.eq('blocked storage: nothing saved or loaded, no throw', loadBrief(blockedStorage, 'en', now), null);
  saveBrief(blockedStorage, 'en', { idea: 'x', brief, elapsedMs: null, savedAt: now });
  saveNextFree(blockedStorage, now);
  s.eq('blocked storage: no next free time', loadNextFree(blockedStorage, now), null);
  s.eq('no storage at all', [loadBrief(null, 'en', now), loadNextFree(null, now)], [null, null]);
}

s.group('format — "today" or "tomorrow", in the visitor’s calendar');
{
  const evening = new Date(2026, 9, 10, 21, 15).getTime();
  const morning = new Date(2026, 9, 11, 8, 0).getTime();
  const nightBefore = new Date(2026, 9, 10, 23, 0).getTime();
  s.eq('a brief at 21:15 → next one tomorrow', nextFreeDay(evening + DAY_MS, evening), 'tomorrow');
  s.eq('seen the next morning → today', nextFreeDay(evening + DAY_MS, morning), 'today');
  s.eq('seen just before midnight → tomorrow', nextFreeDay(evening + DAY_MS, nightBefore), 'tomorrow');
  s.eq('uz/ru: 24-hour clock', timeFormatter('uz')(evening), '21:15');
  s.ok('en: 12-hour clock', /^9:15\s?PM$/.test(timeFormatter('en')(evening)), timeFormatter('en')(evening));
}

/* ------------------------------------------------------------------ */
/* 3. No hours or hourly rates reach the page                          */
/* ------------------------------------------------------------------ */

s.group('payload — price ranges and weeks, never hours');
{
  for (const locale of LOCALES) {
    const sc = scope();
    const est = buildEstimate(sc, mapScopeToInputs(sc, locale), locale);
    s.ok(`${locale}: no hours in the estimate`, !/"hours"\s*:/.test(JSON.stringify(est)));
    s.ok(`${locale}: the range and weeks are there`, est.mvp.price.max > est.mvp.price.min && est.mvp.weeks.max >= est.mvp.weeks.min);
    s.ok(`${locale}: the full vision has a price and weeks, no hours`, !!est.fullVision && !('hours' in est.fullVision));

    const stage = priceScope(sc, 'A delivery app for our restaurant chain with a marketing site', locale);
    const preview = JSON.stringify(previewOf(stage, locale));
    s.ok(`${locale}: the streamed preview carries no hours`, !/"hours"\s*:/.test(preview));
    s.ok(`${locale}: …but the big-idea rule still sees the engine size`, engineSize(stage.mapped).mvpHours.max > 0);
  }
}

s.group('components — nothing renders an hour count or a rate');
{
  const dir = 'src/modules/estimator/components/brief';
  const sources = fs
    .readdirSync(path.join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter(f => /\.tsx?$/.test(f))
    .map(f => [f, read(path.join(dir, f))] as const);
  for (const [file, src] of sources) {
    s.ok(`${file}: no .hours`, !/\.hours\b/.test(src));
    s.ok(`${file}: no rate messages`, !/rateEn|rateLocal|t\('hours'/.test(src));
  }
}

s.group('copy — no rate or hour count; the range note; the limit card');
{
  const messages = Object.fromEntries(LOCALES.map(l => [l, JSON.parse(read(`src/messages/${l}.json`))]));
  const RATE_OR_HOURS = [
    /\$\s?\d+\s?\/\s?(?:h|ч|soat)/i,
    /\bper hour\b|в час\b|soatiga/i,
    /\{hours/,
    /hours of work|часов работы|soat ish/i,
  ];
  for (const locale of LOCALES) {
    const ab = messages[locale].aiBrief;
    const text = JSON.stringify(ab);
    for (const pattern of RATE_OR_HOURS) s.ok(`${locale}: nothing matches ${pattern}`, !pattern.test(text));
    s.ok(`${locale}: hours / rate keys are gone`, !('hours' in ab.estimate) && !('rateEn' in ab.estimate) && !('rateLocal' in ab.estimate));
    s.ok(`${locale}: the range note is there`, typeof ab.estimate.rangeNote === 'string' && ab.estimate.rangeNote.length > 40);
    s.eq(`${locale}: limit keys match en`, Object.keys(ab.limit).sort(), Object.keys(messages.en.aiBrief.limit).sort());
    s.ok(`${locale}: one-free-plan note on the composer`, !!ab.composer.freeNote);
    s.ok(`${locale}: rate-limited copy for a long wait`, !!ab.errors.rate_limited_later);

    const t = createTranslator({ locale, messages: messages[locale], namespace: 'aiBrief.limit' });
    for (const kind of ['next', 'usedNote'] as const) {
      const today = t(kind, { day: 'today', time: '21:15' });
      const tomorrow = t(kind, { day: 'tomorrow', time: '21:15' });
      s.ok(
        `${locale}: ${kind} renders both days with the time`,
        today !== tomorrow && today.includes('21:15') && tomorrow.includes('21:15')
      );
    }
    s.ok(`${locale}: the contact message carries the idea`, t('message', { idea: 'IDEA' }).includes('IDEA'));
  }
  s.ok(
    'en: the range note says the exact price follows the specification',
    /technical specification/.test(messages.en.aiBrief.estimate.rangeNote)
  );
  s.ok('ru: …', /техническое задание/.test(messages.ru.aiBrief.estimate.rangeNote));
  s.ok('uz: …', /texnik topshiriq/.test(messages.uz.aiBrief.estimate.rangeNote));
}

process.exit(s.report());
