/**
 * AI brief provider plumbing — no paid calls. Two local fake endpoints stand
 * in for Moonshot (Kimi) and DeepSeek, so the suite checks what each provider
 * is actually SENT (model, thinking params, response_format, schema in the
 * prompt) and that a pinned call never falls through to the other provider.
 *
 *   npx tsx tests/ai-brief/providers.ts
 */
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Suite } from '../estimator/harness';

interface Captured {
  host: 'kimi' | 'deepseek';
  body: Record<string, unknown>;
}

/** A fake OpenAI-compatible endpoint: records each request, answers per `reply`. */
/** > 0: the fake DeepSeek sends its headers (and a keep-alive byte) at once, the body this much later. */
let slowBodyMs = 0;

function fakeEndpoint(host: Captured['host'], captured: Captured[], reply: () => { status: number; body: unknown }) {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      captured.push({ host, body: JSON.parse(raw || '{}') });
      const { status, body } = reply();
      res.writeHead(status, { 'Content-Type': 'application/json' });
      if (host === 'deepseek' && slowBodyMs > 0) {
        res.write('\n');
        setTimeout(() => res.end(JSON.stringify(body)), slowBodyMs);
        return;
      }
      res.end(JSON.stringify(body));
    });
  });
  return new Promise<{ url: string; close: () => void }>(resolve =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    })
  );
}

const completion = (content: string, usage: Record<string, unknown>) => ({
  id: 'x',
  object: 'chat.completion',
  created: 0,
  model: 'm',
  choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  usage,
});

async function main(): Promise<number> {
  const captured: Captured[] = [];
  let deepseekStatus = 200;
  const kimi = await fakeEndpoint('kimi', captured, () => ({
    status: 200,
    body: completion('{"ok":true}', { prompt_tokens: 100, completion_tokens: 10 }),
  }));
  const deepseek = await fakeEndpoint('deepseek', captured, () =>
    deepseekStatus === 200
      ? {
          status: 200,
          body: completion('{"ok":true}', {
            prompt_tokens: 1000,
            completion_tokens: 500,
            prompt_tokens_details: { cached_tokens: 0 },
            prompt_cache_hit_tokens: 800,
            prompt_cache_miss_tokens: 200,
            completion_tokens_details: { reasoning_tokens: 300 },
          }),
        }
      : { status: deepseekStatus, body: { error: { message: 'boom' } } }
  );

  // core/ai reads its provider config at import time.
  process.env.MOONSHOT_API_KEY = 'test-kimi';
  process.env.DEEPSEEK_API_KEY = 'test-deepseek';
  process.env.AI_BASE_URL = kimi.url;
  process.env.AI_FALLBACK_BASE_URL = deepseek.url;
  delete process.env.AI_MODEL;
  delete process.env.AI_FALLBACK_MODEL;

  const ai = await import('../../src/core/ai');
  const chains = await import('../../src/modules/estimator/ai-brief/chains');
  const constants = await import('../../src/modules/estimator/ai-brief/constants');

  const s = new Suite('ai-brief-providers');

  s.group('model → provider');
  s.eq('deepseek-v4-pro → deepseek', ai.providerOfModel('deepseek-v4-pro'), 'deepseek');
  s.eq('deepseek-flash → deepseek', ai.providerOfModel('deepseek-flash'), 'deepseek');
  s.eq('kimi-k3 → kimi', ai.providerOfModel('kimi-k3'), 'kimi');
  s.eq('unknown → undefined', ai.providerOfModel('gpt-x'), undefined);
  const kimiP = { name: 'kimi', model: 'kimi-k2.6' };
  const dsP = { name: 'deepseek', model: 'deepseek-v4-pro' };
  s.eq('kimi override applies to kimi', ai.modelFor(kimiP, 'kimi-k3'), 'kimi-k3');
  s.eq('kimi override never reaches deepseek', ai.modelFor(dsP, 'kimi-k3'), 'deepseek-v4-pro');
  s.eq('deepseek override applies to deepseek', ai.modelFor(dsP, 'deepseek-flash'), 'deepseek-flash');
  s.eq('deepseek override never reaches kimi', ai.modelFor(kimiP, 'deepseek-flash'), 'kimi-k2.6');
  s.eq('unknown override counts as kimi (legacy)', ai.modelFor(kimiP, 'moonshot-x'), 'moonshot-x');
  s.eq('no override → configured model', ai.modelFor(dsP), 'deepseek-v4-pro');

  s.group('request params');
  s.eq('deepseek without thinking: temperature only (legacy blog calls)', ai.deepseekRequestParams(undefined, 1.3), { temperature: 1.3 });
  s.eq('deepseek off: thinking disabled + temperature', ai.deepseekRequestParams('off', 0.6), {
    thinking: { type: 'disabled' },
    temperature: 0.6,
  });
  s.eq('deepseek high: thinking enabled + reasoning_effort, no temperature', ai.deepseekRequestParams('high', 0.6), {
    thinking: { type: 'enabled' },
    reasoning_effort: 'high',
  });
  s.eq('kimi k3 params unchanged', ai.kimiRequestParams('kimi-k3', 'low'), { reasoning_effort: 'low' });

  s.group('JSON contract per provider');
  const schema = { name: 'demo', schema: { type: 'object', properties: { ok: { type: 'boolean' } } } };
  s.eq('kimi: system prompt untouched', ai.systemPromptFor('kimi', 'SYS', schema), 'SYS');
  const dsSystem = ai.systemPromptFor('deepseek', 'SYS', schema) ?? '';
  s.ok('deepseek: system keeps the original prompt first', dsSystem.startsWith('SYS\n\n'), dsSystem.slice(0, 40));
  s.ok('deepseek: schema appended verbatim', dsSystem.includes(JSON.stringify(schema.schema)), dsSystem);
  s.eq('deepseek without a schema: untouched', ai.systemPromptFor('deepseek', 'SYS'), 'SYS');
  s.ok('deepseek without a system: the schema alone', (ai.systemPromptFor('deepseek', undefined, schema) ?? '').includes('"demo"'));
  s.eq(
    'kimi gets strict json_schema',
    (ai.responseFormatFor('kimi', { jsonSchema: schema }).response_format as { type: string }).type,
    'json_schema'
  );
  s.eq('deepseek gets json_object', ai.responseFormatFor('deepseek', { jsonSchema: schema }), { response_format: { type: 'json_object' } });
  s.eq('plain text: no response_format', ai.responseFormatFor('deepseek', {}), {});

  s.group('usage and cost');
  const usage = ai.readUsage({
    prompt_tokens: 1000,
    completion_tokens: 500,
    prompt_tokens_details: { cached_tokens: 0 },
    prompt_cache_hit_tokens: 800,
  });
  s.eq('deepseek cache hits read from prompt_cache_hit_tokens', usage?.cachedTokens, 800);
  const peak = new Date('2026-10-12T07:30:00Z'); // Monday 07:30 UTC
  const offPeak = new Date('2026-10-11T07:30:00Z'); // Sunday
  s.ok('Mon 07:30 UTC is peak', ai.isDeepSeekPeak(peak));
  s.ok('Mon 04:00 UTC is off-peak', !ai.isDeepSeekPeak(new Date('2026-10-12T04:00:00Z')));
  s.ok('Mon 00:59 UTC is off-peak', !ai.isDeepSeekPeak(new Date('2026-10-12T00:59:00Z')));
  s.ok('Fri 09:59 UTC is peak', ai.isDeepSeekPeak(new Date('2026-10-16T09:59:00Z')));
  s.ok('weekend is off-peak', !ai.isDeepSeekPeak(offPeak));
  const m = { promptTokens: 1_000_000, completionTokens: 1_000_000, reasoningTokens: 0, cachedTokens: 0 };
  // DeepSeek prices are list × 1.2 (real spend ran ~20% above the estimate).
  s.eq('DeepSeek margin is 20%', ai.DEEPSEEK_PRICE_MARGIN, 1.2);
  s.eq('v4-pro peak: ($1.32 in + $3.96 out) × 1.2', Number(ai.estimateCostUsd('deepseek-v4-pro', m, peak).toFixed(4)), 6.336);
  s.eq('v4-pro off-peak: half', Number(ai.estimateCostUsd('deepseek-v4-pro', m, offPeak).toFixed(4)), 3.168);
  s.eq('v4-pro without a time: peak (upper bound)', Number(ai.estimateCostUsd('deepseek-v4-pro', m).toFixed(4)), 6.336);
  s.eq('flash peak: ($0.30 + $1.20) × 1.2', Number(ai.estimateCostUsd('deepseek-flash', m, peak).toFixed(4)), 1.8);
  s.eq('flash off-peak: half (peak doubles it)', Number(ai.estimateCostUsd('deepseek-flash', m, offPeak).toFixed(4)), 0.9);
  const cached = { ...m, completionTokens: 0, cachedTokens: 800_000 };
  s.eq(
    'cache hits at the cache price',
    Number(ai.estimateCostUsd('deepseek-v4-pro', cached, peak).toFixed(4)),
    Number(((0.2 * 1.32 + 0.8 * 0.044) * 1.2).toFixed(4))
  );
  s.eq('kimi ignores cache hits (upper bound) and time', ai.estimateCostUsd('kimi-k3', { ...m, cachedTokens: 900_000 }, offPeak), 18);

  s.group('chain presets');
  s.eq('kimi preset: production defaults (empty set)', chains.briefChainSet('kimi'), {});
  const pro = chains.briefChainSet('ds-pro');
  const allPro = Object.values(pro.partChains ?? {}).flat();
  s.ok(
    'ds-pro: every part on deepseek-v4-pro',
    Object.keys(pro.partChains ?? {}).length === 5 && allPro.every(st => st.model === 'deepseek-v4-pro')
  );
  s.eq('ds-pro: helpers on v4-pro', [pro.samplesChain?.[0].model, pro.polishChain?.[0].model], ['deepseek-v4-pro', 'deepseek-v4-pro']);
  s.eq(
    'ds-pro: scope thinks high, later parts off, helpers low',
    [pro.partChains?.scope?.[0].reasoningEffort, pro.partChains?.plan?.[0].reasoningEffort, pro.polishChain?.[0].reasoningEffort],
    ['high', 'off', 'low']
  );
  const flash = chains.briefChainSet('ds-flash');
  s.ok(
    'ds-flash: every call on deepseek-flash',
    [...Object.values(flash.partChains ?? {}).flat(), ...(flash.samplesChain ?? [])].every(st => st.model === 'deepseek-flash')
  );
  const mix = chains.briefChainSet('ds-mix');
  s.eq(
    'ds-mix: v4-pro scope, flash for the rest',
    [mix.partChains?.scope?.[0].model, mix.partChains?.screensMain?.[0].model, mix.polishChain?.[0].model],
    ['deepseek-v4-pro', 'deepseek-flash', 'deepseek-flash']
  );
  s.ok(
    'no cross-provider step without the fallback flag',
    Object.values(mix.partChains ?? {}).every(c => chains.providersOf(c).join() === 'deepseek')
  );
  const kf = chains.briefChainSet('kimi-flash');
  s.eq('kimi-flash: no scope or copy-edit chain (production Kimi)', [kf.partChains?.scope, kf.polishChain], [undefined, undefined]);
  s.eq(
    'kimi-flash: later parts on flash, thinking off then low',
    kf.partChains?.screensRest?.map(st => `${st.model}@${st.reasoningEffort ?? '-'}`),
    ['deepseek-flash@off', 'deepseek-flash@low']
  );
  s.eq(
    'kimi-flash: samples on flash (low)',
    kf.samplesChain?.map(st => `${st.model}@${st.reasoningEffort}`),
    ['deepseek-flash@low']
  );
  s.eq(
    'later parts: same-model retry that thinks, never another provider',
    mix.partChains?.risks?.map(st => `${st.model}@${st.reasoningEffort ?? '-'}`),
    ['deepseek-flash@off', 'deepseek-flash@low']
  );
  const off = chains.briefChainSet('ds-flash', { thinking: { scope: 'off', rest: 'off', helpers: 'high' } });
  s.eq('thinking plan honoured', [off.partChains?.scope?.[0].reasoningEffort, off.samplesChain?.[0].reasoningEffort], ['off', 'high']);

  s.group('production chains: Kimi K3 first, deepseek-flash fallback');
  const prod = constants.BRIEF_PART_CHAINS;
  const describe = (chain: readonly import('../../src/modules/estimator/ai-brief/constants').BriefModelStep[]) =>
    chain.map(st => `${st.model}@${st.reasoningEffort ?? '-'}`);
  s.eq('scope: k3 high → flash high', describe(prod.scope), ['kimi-k3@high', 'deepseek-flash@high']);
  s.eq('long-idea scope: k3 low → flash high', describe(constants.LONG_IDEA_SCOPE_CHAIN), ['kimi-k3@low', 'deepseek-flash@high']);
  for (const part of ['plan', 'risks', 'screensMain', 'screensRest'] as const)
    s.eq(`${part}: k3 low → flash off → flash low (retry)`, describe(prod[part]), [
      'kimi-k3@low',
      'deepseek-flash@off',
      'deepseek-flash@low',
    ]);
  s.ok(
    'every part starts on kimi-k3 (Kimi stays the default)',
    Object.values(prod).every(c => c[0].model === 'kimi-k3')
  );
  s.eq('samples stay on Kimi only', describe(constants.SAMPLES_CHAIN), ['kimi-k3@low']);
  s.eq('the Uzbek copy-edit stays on Kimi only (no flash fallback)', chains.providersOf(constants.POLISH_CHAIN), ['kimi']);
  s.ok(
    'flash fallback fits the deadline after the scope hedge',
    constants.SCOPE_HEDGE_MS + prod.scope[1].timeoutMs + prod.plan[1].timeoutMs <= constants.BRIEF_DEADLINE_MS - 2_000
  );
  s.ok(
    'every flash step names its k2.6 stand-in',
    [prod.scope[1], prod.plan[1], prod.plan[2]].every(st => st.ifUnavailable?.model === 'kimi-k2.6')
  );

  s.group('usable chain per configured keys');
  s.eq('both keys: unchanged', describe(chains.usableChain(prod.plan, ['kimi', 'deepseek'])), describe(prod.plan));
  s.eq('no DeepSeek key: k3 → k2.6 as before', describe(chains.usableChain(prod.plan, ['kimi'])), ['kimi-k3@low', 'kimi-k2.6@-']);
  s.eq(
    'no DeepSeek key: scope k3 → k2.6 (40 s)',
    chains.usableChain(prod.scope, ['kimi']).map(st => `${st.model}/${st.timeoutMs}`),
    ['kimi-k3/60000', 'kimi-k2.6/40000']
  );
  s.eq('no Kimi key: flash only', describe(chains.usableChain(prod.plan, ['deepseek'])), ['deepseek-flash@off', 'deepseek-flash@low']);
  s.eq('no key: empty', chains.usableChain(prod.scope, []), []);

  s.group('overflow (Kimi daily cap spent)');
  const overflow = chains.overflowRunOptions();
  s.ok(
    'every part and the samples on deepseek-flash',
    [...Object.values(overflow.partChains ?? {}).flat(), ...(overflow.samplesChain ?? [])].every(st => st.model === 'deepseek-flash')
  );
  s.eq('all five parts routed', Object.keys(overflow.partChains ?? {}).sort(), [...constants.BRIEF_PARTS].sort());
  s.eq('no Uzbek copy-edit', overflow.polish, false);
  s.eq('scope thinks high', overflow.partChains?.scope?.[0].reasoningEffort, 'high');

  s.group('requests on the wire (fake endpoints)');
  const attempts: import('../../src/core/ai').AiAttempt[] = [];
  const ds = await ai.safeGenerateJSONWithTimeout('idea', 'test', {
    system: 'SYS',
    jsonSchema: schema,
    model: 'deepseek-flash',
    provider: 'deepseek',
    reasoningEffort: 'low',
    maxTokens: 123,
    onAttempt: a => attempts.push(a),
  });
  const dsReq = captured.find(c => c.host === 'deepseek')?.body ?? {};
  s.eq('deepseek call answered by deepseek', ds?.provider, 'deepseek');
  s.eq('sent model', dsReq.model, 'deepseek-flash');
  s.eq('sent thinking enabled', dsReq.thinking, { type: 'enabled' });
  s.eq('sent reasoning_effort', dsReq.reasoning_effort, 'low');
  s.eq('no temperature while thinking', dsReq.temperature, undefined);
  s.eq('sent json_object', dsReq.response_format, { type: 'json_object' });
  const sentSystem = ((dsReq.messages as { role: string; content: string }[]) ?? [])[0];
  s.ok('schema in the system prompt', sentSystem?.role === 'system' && sentSystem.content.includes('"demo"'), JSON.stringify(sentSystem));
  s.eq('max_tokens passed', dsReq.max_tokens, 123);
  s.eq('usage: cache hits', ds?.usage?.cachedTokens, 800);
  s.eq('usage: reasoning tokens', ds?.usage?.reasoningTokens, 300);
  s.ok('attempt carries its start time', typeof attempts[0]?.startedAt === 'number');

  captured.length = 0;
  const k = await ai.safeGenerateJSONWithTimeout('idea', 'test', {
    system: 'SYS',
    jsonSchema: schema,
    model: 'kimi-k3',
    provider: 'kimi',
    reasoningEffort: 'high',
  });
  const kReq = captured.find(c => c.host === 'kimi')?.body ?? {};
  s.eq('kimi call answered by kimi', k?.provider, 'kimi');
  s.eq('kimi sent strict json_schema', (kReq.response_format as { type?: string })?.type, 'json_schema');
  s.eq('kimi system untouched', ((kReq.messages as { content: string }[]) ?? [])[0]?.content, 'SYS');
  s.eq('kimi k3 effort', kReq.reasoning_effort, 'high');

  captured.length = 0;
  deepseekStatus = 500;
  const failed = await ai.safeGenerateJSONWithTimeout('idea', 'test', { model: 'deepseek-v4-pro', provider: 'deepseek', firstOnly: false });
  s.eq('pinned deepseek failure → null', failed, null);
  s.eq('… and kimi is never called', captured.filter(c => c.host === 'kimi').length, 0);

  // DeepSeek sends its headers at once and the body only when done: the timeout must cover the body.
  deepseekStatus = 200;
  slowBodyMs = 3_000;
  const slowAttempts: import('../../src/core/ai').AiAttempt[] = [];
  const t0 = Date.now();
  const slow = await ai.safeGenerateJSONWithTimeout('idea', 'test', {
    model: 'deepseek-flash',
    provider: 'deepseek',
    timeout: 500,
    onAttempt: a => slowAttempts.push(a),
  });
  const took = Date.now() - t0;
  s.eq('slow body past the timeout → null', slow, null);
  s.ok('aborted near the timeout, not when the body lands', took < 2_000, `${took}ms`);
  s.ok('recorded as a timeout', /timed out/i.test(slowAttempts[0]?.error ?? ''), slowAttempts[0]?.error);

  kimi.close();
  deepseek.close();
  return s.report();
}

main().then(
  code => process.exit(code),
  error => {
    console.error(error);
    process.exit(1);
  }
);
