/**
 * AI brief — the admin's provider switch and the usage/spend rows behind
 * `/admin/ai-demo` (founder request 2026-10-11). No network, no database.
 *
 *   npx tsx tests/ai-brief/admin.ts
 *
 * Covers the 'kimi' / 'deepseek' chains (and how they degrade without a key),
 * the lane wiring, the stats row of a run (spend per provider, tokens, the
 * backup flag), the anonymous visitor hash, the caps, and the route/admin
 * wiring (auth on both admin methods, nothing recorded before the checks).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BRIEF_PROVIDERS,
  DEFAULT_BRIEF_PROVIDER,
  isBriefProvider,
  providerChainSet,
  usableChain,
} from '../../src/modules/estimator/ai-brief/chains';
import { briefCaps, DEFAULT_DAILY_USD, DEFAULT_OVERFLOW_DAILY_USD } from '../../src/modules/estimator/ai-brief/caps';
import { BRIEF_PARTS } from '../../src/modules/estimator/ai-brief/constants';
import { pickBriefLane } from '../../src/modules/estimator/ai-brief/lanes';
import type { BriefAttemptLog, BriefRun } from '../../src/modules/estimator/ai-brief/orchestrator';
import { briefRunRecord, busyRecord, visitorHash } from '../../src/modules/estimator/ai-brief/runRecord';
import { createDailyBudget } from '../../src/shared/utils/dailyBudget';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-admin');
const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const NOW = () => new Date('2026-10-11T10:00:00Z');

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function attempt(model: string, ok: boolean, costUsd: number, prompt = 1000, completion = 500): BriefAttemptLog {
  return {
    part: 'scope',
    step: 0,
    model,
    ms: 1000,
    ok,
    costUsd,
    usage: { promptTokens: prompt, completionTokens: completion, reasoningTokens: 0, cachedTokens: 0 },
  };
}

function run(attempts: BriefAttemptLog[], status: 'ok' | 'rejected' | 'error' = 'ok'): BriefRun {
  const outcome = status === 'error' ? { status, code: 'timeout' } : { status };
  return {
    outcome,
    attempts,
    model: attempts[0]?.model ?? null,
    totalCostUsd: attempts.reduce((sum, a) => sum + a.costUsd, 0),
    totalMs: 41_234.6,
  } as unknown as BriefRun;
}

/* ------------------------------------------------------------------ */
/* The switch                                                          */
/* ------------------------------------------------------------------ */

s.group('provider choices');
s.eq('two choices', [...BRIEF_PROVIDERS], ['kimi', 'deepseek']);
s.eq('Kimi is the default', DEFAULT_BRIEF_PROVIDER, 'kimi');
s.ok('known values pass', isBriefProvider('kimi') && isBriefProvider('deepseek'));
s.ok('anything else is refused', ![undefined, null, '', 'Kimi', 'ds-flash', 'openai', 1, {}].some(v => isBriefProvider(v)));

s.group("'kimi' = the production chains untouched");
s.eq('an empty chain set (orchestrator defaults apply)', providerChainSet('kimi'), {});

s.group("'deepseek' = flash first, Kimi as the backup");
{
  const set = providerChainSet('deepseek');
  for (const part of BRIEF_PARTS) {
    const chain = set.partChains?.[part] ?? [];
    s.ok(`${part}: starts on deepseek-flash`, chain[0]?.model === 'deepseek-flash', JSON.stringify(chain.map(c => c.model)));
    s.ok(`${part}: ends on kimi-k3`, chain[chain.length - 1]?.model === 'kimi-k3', JSON.stringify(chain.map(c => c.model)));
    s.eq(
      `${part}: Kimi only after every flash step`,
      chain.findIndex(c => c.model === 'kimi-k3'),
      chain.length - 1
    );
  }
  s.eq('the scope thinks hard on flash', set.partChains?.scope?.[0]?.reasoningEffort, 'high');
  s.eq('the Kimi scope backup has room for a full scope', set.partChains?.scope?.at(-1)?.maxTokens, 16_000);
  s.eq('sample content on flash', set.samplesChain?.map(c => c.model), ['deepseek-flash']);
  s.eq('Uzbek copy-edit on flash (as audited)', set.polishChain?.map(c => c.model), ['deepseek-flash']);

  const scope = set.partChains?.scope ?? [];
  s.eq('without a DeepSeek key: Kimi alone writes the scope', usableChain(scope, ['kimi']).map(c => c.model), ['kimi-k3']);
  s.eq('without a Kimi key: flash alone', usableChain(scope, ['deepseek']).map(c => c.model), ['deepseek-flash']);
  const plan = set.partChains?.plan ?? [];
  s.eq(
    'with both keys the plan runs flash, flash (thinking retry), Kimi',
    usableChain(plan, ['kimi', 'deepseek']).map(c => c.model),
    ['deepseek-flash', 'deepseek-flash', 'kimi-k3']
  );
}

s.group('lanes carry the choice');
{
  const main = createDailyBudget({ maxCalls: 10, maxUsd: 1, reserveUsd: 0.3 }, NOW);
  const overflow = createDailyBudget({ maxCalls: 10, maxUsd: 1, reserveUsd: 0.05 }, NOW);
  const ds = providerChainSet('deepseek');
  const lane = pickBriefLane(main, overflow, true, ds);
  s.eq('the main lane runs the chosen chains', lane?.options, ds);
  s.eq('without a choice the main lane runs the defaults', pickBriefLane(main, overflow, true)?.options, {});
  pickBriefLane(main, overflow, true, ds); // the third $0.30 reserve no longer fits under $1
  const spill = pickBriefLane(main, overflow, true, ds);
  s.eq('a spent main cap spills to the overflow', spill?.name, 'overflow');
  s.ok('the overflow keeps its own flash-only chains', spill?.options.polish === false && spill?.options.partChains?.scope?.[0]?.model === 'deepseek-flash');
}

/* ------------------------------------------------------------------ */
/* Stats rows                                                          */
/* ------------------------------------------------------------------ */

s.group('the stats row of a run');
{
  const mixed = run([attempt('kimi-k3', true, 0.05, 2000, 800), attempt('deepseek-flash', true, 0.004, 1500, 300), attempt('kimi-k3', false, 0.01, 100, 0)]);
  const row = briefRunRecord(mixed, { locale: 'uz', provider: 'kimi', lane: 'main', visitor: 'abc' });
  s.eq('locale, provider choice, lane', [row.locale, row.mode, row.lane], ['uz', 'kimi', 'main']);
  s.eq('status', row.status, 'ok');
  s.eq('no error code on success', row.errorCode, null);
  s.ok('total = the run total', Math.abs((row.costUsd ?? 0) - 0.064) < 1e-9);
  s.ok('Kimi spend includes failed calls (they bill)', Math.abs((row.kimiCostUsd ?? 0) - 0.06) < 1e-9);
  s.ok('DeepSeek spend', Math.abs((row.deepseekCostUsd ?? 0) - 0.004) < 1e-9);
  s.eq('input tokens summed', row.inputTokens, 3600);
  s.eq('output tokens summed', row.outputTokens, 1100);
  s.eq('calls counted', row.calls, 3);
  s.eq('ms rounded', row.ms, 41_235);
  s.eq('a DeepSeek answer in Kimi mode is a backup', row.fallbackUsed, true);
  s.eq('the visitor hash as given', row.visitorHash, 'abc');

  const kimiOnly = briefRunRecord(run([attempt('kimi-k3', true, 0.05)]), { locale: 'en', provider: 'kimi', lane: 'main', visitor: 'v' });
  s.eq('all-Kimi in Kimi mode: no backup', kimiOnly.fallbackUsed, false);

  const overflow = briefRunRecord(run([attempt('deepseek-flash', true, 0.01)]), { locale: 'ru', provider: 'kimi', lane: 'overflow', visitor: 'v' });
  s.eq('flash in the overflow lane is by design, not a backup', overflow.fallbackUsed, false);

  const dsFailedKimi = briefRunRecord(run([attempt('deepseek-flash', true, 0.01), attempt('kimi-k3', false, 0.02)]), {
    locale: 'en',
    provider: 'deepseek',
    lane: 'main',
    visitor: 'v',
  });
  s.eq('a Kimi call that failed did not answer: no backup', dsFailedKimi.fallbackUsed, false);

  const failed = briefRunRecord(run([attempt('kimi-k3', false, 0.02)], 'error'), { locale: 'uz', provider: 'kimi', lane: 'main', visitor: 'v' });
  s.eq('an error keeps its code', [failed.status, failed.errorCode], ['error', 'timeout']);

  const noUsage = briefRunRecord(run([{ ...attempt('kimi-k3', false, 0), usage: null }]), { locale: 'uz', provider: 'kimi', lane: 'main', visitor: 'v' });
  s.eq('a call without usage adds no tokens', [noUsage.inputTokens, noUsage.outputTokens], [0, 0]);

  const busy = busyRecord({ locale: 'en', provider: 'deepseek', visitor: 'v' });
  s.eq('a "cap reached" row: no lane, no cost fields set', [busy.status, busy.lane, busy.costUsd], ['busy', null, undefined]);
  s.ok('no row carries idea text or an IP field', !Object.keys({ ...row, ...busy }).some(k => /idea|ip|text|prompt/i.test(k)));
}

s.group('anonymous visitor hash');
{
  const a = visitorHash('203.0.113.7', 'k1');
  s.ok('24 hex characters', /^[0-9a-f]{24}$/.test(a), a);
  s.eq('stable for the same visitor', visitorHash('203.0.113.7', 'k1'), a);
  s.ok('different visitors differ', visitorHash('203.0.113.8', 'k1') !== a);
  s.ok('keyed: another key gives another hash', visitorHash('203.0.113.7', 'k2') !== a);
  s.ok('the IP is not in it', !a.includes('203.0.113.7'));
}

s.group('caps');
{
  s.eq('defaults', briefCaps({}), { mainUsd: DEFAULT_DAILY_USD, mainCalls: 150, overflowUsd: DEFAULT_OVERFLOW_DAILY_USD, overflowCalls: 150 });
  s.eq('$3 main, $1 overflow by default', [DEFAULT_DAILY_USD, DEFAULT_OVERFLOW_DAILY_USD], [3, 1]);
  s.eq('env overrides', briefCaps({ AI_BRIEF_DAILY_USD: '5', AI_BRIEF_OVERFLOW_DAILY_USD: '0.5' }).mainUsd, 5);
  s.eq('junk never lifts a cap', briefCaps({ AI_BRIEF_DAILY_USD: 'abc', AI_BRIEF_OVERFLOW_DAILY_USD: '-1' }), briefCaps({}));
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

s.group('brief route wiring');
{
  const route = read('src/app/api/estimate/brief/route.ts');
  const at = (needle: string) => route.indexOf(needle);
  s.ok('the provider is read after the free brief is held', at('allowance.take(ip)') > -1 && at('allowance.take(ip)') < at('getBriefProvider()'));
  s.ok('and feeds the main lane', route.includes('providerChainSet(provider)'));
  s.ok('a "cap reached" request is recorded', /if \(!lane\) \{[\s\S]{0,120}recordBriefRun\(busyRecord\(/.test(route));
  s.ok('every finished run is recorded', route.includes('recordBriefRun(briefRunRecord(run,'));
  s.ok('the IP is only ever stored hashed', (route.match(/visitor: visitorHash\((ctx\.)?ip\)/g) ?? []).length === 2 && !/visitor: ip\b/.test(route));
  s.ok('the stream sends the result before awaiting the row', at("send(run.outcome.status === 'error'") < at('await recorded;'));
  s.ok('a daily-limit 429 is not recorded (no write per refused request)', at('dailyLimit(usedFor)') < at('recordBriefRun(busyRecord'));
}

s.group('admin wiring');
{
  const api = read('src/app/api/admin/ai-brief/route.ts');
  const methods = api.split(/export async function /).slice(1);
  s.eq(
    'GET and PUT',
    methods.map(m => m.slice(0, 3)),
    ['GET', 'PUT']
  );
  s.ok(
    'both require an admin first',
    methods.every(m => /^\w+\(request: NextRequest\) \{\s*const authError = await requireAdmin\(request\);\s*if \(authError\) return authError;/.test(m))
  );
  s.ok('PUT validates the provider', api.includes('if (!isBriefProvider(provider))'));
  s.ok('never cached', (api.match(/headers: NO_STORE/g) ?? []).length >= 4);
  const layout = read('src/app/[locale]/(site)/admin/layout.tsx');
  s.ok('the admin nav links the page', layout.includes('/admin/ai-demo') && layout.includes('AI demo'));
  s.ok('the page exists', fs.existsSync(path.join(ROOT, 'src/app/[locale]/(site)/admin/ai-demo/page.tsx')));
  const sqlFile = read('drizzle/0001_ai_brief_admin.sql');
  s.ok('the migration is additive and re-runnable', !/drop|alter|delete|truncate/i.test(sqlFile) && (sqlFile.match(/IF NOT EXISTS/g) ?? []).length === 3);
}

process.exit(s.report());
