/**
 * AI project brief — eval harness. Runs the REAL pipeline (scrub → Kimi →
 * parse → estimator engine) over a fixed test set and writes everything an
 * auditor needs: one JSON per run + a summary per configuration.
 *
 * Usage (from the repo root). .env.local may hold an EMPTY MOONSHOT_API_KEY,
 * so pass the key explicitly or rely on `dotenv/config` loading .env:
 *
 *   npx tsx scripts/eval-ai-brief.ts --model kimi-k3 [options]          one configuration
 *   npx tsx scripts/eval-ai-brief.ts --variant a,b,c --repeat 3 [opts]  compare configurations
 *   npx tsx scripts/eval-ai-brief.ts --recheck <dir>                    re-score saved runs, no API calls
 *   npx tsx scripts/eval-ai-brief.ts --replay <dir> --out <dir2>        re-run everything after the model on the
 *                                                                        saved model answers (parsers, rules, engine,
 *                                                                        guard, checks) — the current code, no API calls
 *   npx tsx scripts/eval-ai-brief.ts --list [--tags us]                 print the case set, no API calls
 *   npx tsx scripts/eval-ai-brief.ts --polish-test <dir> --out <dir2>   run the Uzbek copy-edit (paid, ~$0.10 a brief;
 *                                                                        --polish-model kimi-k2.6 to compare models)
 *                                                                        on the saved uz briefs of <dir>: every fix,
 *                                                                        every refused fix, cost, latency, and the
 *                                                                        consistency report after the edit
 *
 * Configuration (pick one):
 *   --model <id>          kimi-k3 | kimi-k2.6 for every call (single model, no fallback)
 *   --effort <e>          K3 reasoning effort with --model: low | high | max (default low)
 *   --chain               the production chains per call (BRIEF_PART_CHAINS: k3-high scope,
 *                         k3-low for the rest, deepseek-flash fallback — k2.6 without a DeepSeek
 *                         key) and the production deadline
 *   --variant <list>      comma-separated, each run in its own sub-directory of --out:
 *                           a  k3 effort low for every call (baseline)
 *                           b  k3 low scope + plan + risks, k2.6 wireframes
 *                           c  k3 effort high for the scope call only, low for the rest
 *                              (= production since round 2 iter 1, without the fallback)
 *                           d  the calls after the scope in parallel — already production
 *                              behaviour, so d runs as a (skipped when a is selected);
 *                              every summary reports the parallel saving it buys
 *                           kimi      current production (k3-high scope, k3-low later calls,
 *                                     deepseek-flash fallback + hedges, production deadline)
 *                           overflow  what the route serves once the Kimi daily cap is spent:
 *                                     ds-flash with no Uzbek copy-edit
 *                           ds-pro    deepseek-v4-pro for every call
 *                           ds-flash  deepseek-flash for every call
 *                           ds-mix    deepseek-v4-pro scope, deepseek-flash for everything else
 *                           kimi-flash  production Kimi scope (k3-high, long ideas k3-low, flash
 *                                     fallback + hedge) and Kimi Uzbek copy-edit; plan, risks,
 *                                     both wireframe halves and the sample content on deepseek-flash
 *                         The DeepSeek variants (`src/modules/estimator/ai-brief/chains.ts`) run
 *                         with the production deadline and NO fallback to another provider, so
 *                         their results are pure; a failed call is recorded, not rescued
 *                         (kimi-flash: the DeepSeek calls; its Kimi scope keeps production's fallback).
 *   --ds-thinking <s>[,<r>[,<h>]]  DeepSeek thinking for the scope [, the later parts
 *                         [, the helpers: samples + Uzbek copy-edit]]: off | low | high | max
 *                         (default high,off,low; a missing value repeats the one before)
 *
 * Selection and repetition:
 *   --cases <a,b,…>       only these case ids, run in this order
 *   --tags <t,…>          only cases with any of these tags (round1, us, uz-colloquial, ru, tricky)
 *   --limit <n>           only the first n selected cases
 *   --repeat <n>          run every case n times (default 1) and report price / screen /
 *                         feature variance per case
 *   --no-samples          skip the sample-content call (A/B: wireframes without shared samples)
 *   --no-polish           skip the Uzbek copy-edit (A/B)
 *
 * Budget and output:
 *   --concurrency <n>     parallel runs (default 2)
 *   --max-cost <usd>      stop launching runs once the estimated spend of THIS invocation
 *                         passes this (default 4)
 *   --min-balance <usd>   check the Moonshot balance before starting and every 30 s; stop
 *                         launching runs below it, or once the start balance minus this
 *                         run's estimated spend would be (billing lags; default 7; 0 disables)
 *   --ds-min-balance <usd>  the same guard for the DeepSeek balance when a variant uses
 *                         DeepSeek (default 3.40; its spend counts at PEAK prices)
 *   --out <dir>           output dir (default /tmp/claude-1000/ai-brief-eval/<label>/)
 *   --merge               keep other cases' results already in --out in summary.json
 *
 * Per-run JSON: input, the scrubbed text actually sent, redaction counts, every
 * model attempt (raw text, latency, tokens, cost, error, parse issues), the
 * parsed and priced scope, the final outcome, the automated checks and the
 * CONSISTENCY report (`src/modules/estimator/ai-brief/consistency.ts`).
 * summary.json: status counts, failed-check rates, consistency errors per
 * brief, latency per call, cost, and — with --repeat — per-case variance.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BigIdeaVerdict } from '../src/modules/estimator/ai-brief/bigIdea';
import { cleanVisibleText } from '../src/modules/estimator/ai-brief/cleanText';
import {
  AUX_PARTS,
  BRIEF_PART_CHAINS,
  BRIEF_PARTS,
  LONG_IDEA_SCOPE_CHAIN,
  POLISH_CHAIN,
  SAMPLES_CHAIN,
  type BriefModelStep,
} from '../src/modules/estimator/ai-brief/constants';
import { checkBriefConsistency } from '../src/modules/estimator/ai-brief/consistency';
import {
  assembleBrief,
  laterPartSpecs,
  polishSpec,
  priceScope,
  runBrief,
  screensOf,
  type BriefAttemptLog,
  type BriefCallPart,
  type BriefRun,
  type BriefRunOptions,
  type PolishLog,
} from '../src/modules/estimator/ai-brief/orchestrator';
import {
  applyFixes,
  chunkTexts,
  collectTexts,
  keepLeadingCapital,
  mapPlanTexts,
  mapRisksTexts,
  mapScopeTexts,
  mapScreensTexts,
  refuseFix,
  type TextMapper,
} from '../src/modules/estimator/ai-brief/polish';
import { buildPolishUserPrompt } from '../src/modules/estimator/ai-brief/prompts';
import {
  estimateCostUsd,
  providerOfModel,
  safeGenerateJSONWithTimeout,
  type AiAttempt,
  type DeepSeekThinking,
  type ProviderName,
} from '../src/core/ai';
import {
  briefChainSet,
  DEFAULT_DS_THINKING,
  overflowRunOptions,
  providersOf,
  type BriefChainPreset,
  type DeepSeekThinkingPlan,
} from '../src/modules/estimator/ai-brief/chains';
import { isPolicyDecline, isRejected, parseScopeJson, rejectionReason } from '../src/modules/estimator/ai-brief/parseScope';
import { prepareIdea, scrubContactDetails } from '../src/modules/estimator/ai-brief/scrub';
import { isPricedEstimate, mapEstimateText, mapPhases, type AiBrief, type BriefOutcome } from '../src/modules/estimator/ai-brief/types';
import {
  auxMs,
  callStats,
  caseVariance,
  checksFor,
  comparisonTable,
  costByProviderPeak,
  partMs,
  peakCostUsd,
  pricedOf,
  summarizeVariant,
  type CaseResult,
  type EvalCase,
  type RunView,
} from './lib/aiBriefEval';

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function parseArgs(argv: string[]): { opts: Record<string, string>; flags: Set<string> } {
  const opts: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts[key] = argv[++i];
    else flags.add(key);
  }
  return { opts, flags };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { opts, flags } = parseArgs(process.argv.slice(2));
const casesPath = path.join(path.dirname(path.resolve(process.argv[1])), 'eval-ai-brief.cases.json');
const allCases = JSON.parse(fs.readFileSync(casesPath, 'utf8')) as EvalCase[];

/* ------------------------------------------------------------------ */
/* Configurations                                                      */
/* ------------------------------------------------------------------ */

interface RunConfig {
  label: string;
  description: string;
  /** One chain for every call; absent = the production chains per call. */
  chain?: readonly BriefModelStep[];
  partChains?: BriefRunOptions['partChains'];
  samplesChain?: BriefRunOptions['samplesChain'];
  polishChain?: BriefRunOptions['polishChain'];
  /** Production deadline (only the production chain); single-model evals measure the model. */
  deadlineMs?: number;
  /** Short tag for the multi-variant output directory (default: the label's first letter). */
  short?: string;
  /** false = no Uzbek copy-edit (the overflow run); absent = production / --no-polish. */
  polish?: false;
}

/** Single-model evals measure the model, not the deadline: generous caps. */
const step = (model: string, effort?: DeepSeekThinking): BriefModelStep => {
  const isK3 = model.startsWith('kimi-k3');
  const isDeepSeek = model.startsWith('deepseek-');
  return {
    model,
    reasoningEffort: isK3 ? (effort === 'off' || !effort ? 'low' : effort) : isDeepSeek ? effort : undefined,
    timeoutMs: 180_000,
    maxTokens: isK3 || isDeepSeek ? 24_000 : 12_000,
  };
};

const THINKING_VALUES: readonly string[] = ['off', 'low', 'high', 'max'];

/** --ds-thinking high,low | off → the DeepSeek thinking plan (default: chains.ts). */
function dsThinkingFromArgs(): DeepSeekThinkingPlan {
  if (!opts['ds-thinking']) return DEFAULT_DS_THINKING;
  const [scope, rest = scope, helpers = rest] = opts['ds-thinking'].split(',').map(v => v.trim().toLowerCase());
  if (![scope, rest, helpers].every(v => THINKING_VALUES.includes(v))) fail('--ds-thinking takes off | low | high | max[,…]');
  return { scope: scope as DeepSeekThinking, rest: rest as DeepSeekThinking, helpers: helpers as DeepSeekThinking };
}

type DeepSeekPreset = Exclude<BriefChainPreset, 'kimi'>;
const DS_DESCRIPTIONS: Record<DeepSeekPreset, { short: string; text: string }> = {
  'ds-pro': { short: 'P', text: 'deepseek-v4-pro for every call' },
  'ds-flash': { short: 'F', text: 'deepseek-flash for every call' },
  'ds-mix': { short: 'M', text: 'deepseek-v4-pro scope, deepseek-flash for the other calls' },
  'kimi-flash': {
    short: 'KF',
    text: 'production Kimi scope (k3-high, long ideas k3-low, k2.6 fallback + hedge) and Kimi Uzbek copy-edit; plan, risks, wireframes + samples on deepseek-flash',
  },
};

/** A DeepSeek variant: its chains with no cross-provider fallback, the production deadline. */
function dsVariant(preset: DeepSeekPreset): RunConfig {
  const thinking = dsThinkingFromArgs();
  const isDefault = (['scope', 'rest', 'helpers'] as const).every(k => thinking[k] === DEFAULT_DS_THINKING[k]);
  const set = briefChainSet(preset, { thinking });
  return {
    label: isDefault ? preset : `${preset}@${thinking.scope}-${thinking.rest}-${thinking.helpers}`,
    short: DS_DESCRIPTIONS[preset].short,
    description: `${DS_DESCRIPTIONS[preset].text} (DeepSeek thinking: ${preset === 'kimi-flash' ? '' : `scope ${thinking.scope}, `}rest ${thinking.rest}, helpers ${thinking.helpers}; no cross-provider fallback; production deadline)`,
    ...set,
  };
}

/** Every provider a configuration can call: its explicit chains, the production chains for the rest. */
function providersOfConfig(config: RunConfig): ProviderName[] {
  const parts = BRIEF_PARTS.map(part => config.partChains?.[part] ?? config.chain ?? BRIEF_PART_CHAINS[part]);
  const longScope = config.partChains?.scope ?? config.chain ?? LONG_IDEA_SCOPE_CHAIN;
  const chains = [...parts, longScope, config.samplesChain ?? SAMPLES_CHAIN, config.polishChain ?? POLISH_CHAIN];
  return Array.from(new Set(chains.flatMap(c => providersOf(c))));
}
const SINGLE_MODEL_DEADLINE = 200_000;

const VARIANTS: Record<string, RunConfig> = {
  a: {
    label: 'a-k3low',
    description: 'k3 effort low for every call (baseline)',
    chain: [step('kimi-k3', 'low')],
    deadlineMs: SINGLE_MODEL_DEADLINE,
  },
  b: {
    label: 'b-k3low-k26screens',
    description: 'k3 low for scope + plan + risks, k2.6 for the wireframes',
    chain: [step('kimi-k3', 'low')],
    partChains: { screensMain: [step('kimi-k2.6')], screensRest: [step('kimi-k2.6')] },
    deadlineMs: SINGLE_MODEL_DEADLINE,
  },
  c: {
    label: 'c-k3high-scope',
    description: 'k3 effort high for the scope call, low for plan, risks + wireframes',
    chain: [step('kimi-k3', 'low')],
    partChains: { scope: [step('kimi-k3', 'high')] },
    deadlineMs: SINGLE_MODEL_DEADLINE,
  },
  d: {
    label: 'd-parallel',
    description: 'the calls after the scope in parallel — production behaviour already; same calls as a',
    chain: [step('kimi-k3', 'low')],
    deadlineMs: SINGLE_MODEL_DEADLINE,
  },
  kimi: {
    label: 'kimi',
    short: 'K',
    description: 'current production: k3-high scope, k3-low later calls, deepseek-flash fallback + hedges, production deadline',
  },
};

/** The route's overflow run (Kimi daily cap spent): every call on deepseek-flash, no Uzbek copy-edit. */
function overflowVariant(): RunConfig {
  return {
    label: 'overflow',
    short: 'O',
    description: 'overflow: deepseek-flash for every call, no Uzbek copy-edit, production deadline',
    ...overflowRunOptions(),
  };
}

/** A variant by key; the DeepSeek ones are built per invocation (they read --ds-thinking). */
function variantFor(key: string): RunConfig | undefined {
  if (key === 'ds-pro' || key === 'ds-flash' || key === 'ds-mix' || key === 'kimi-flash') return dsVariant(key);
  if (key === 'overflow') return overflowVariant();
  return VARIANTS[key];
}

function configsFromArgs(): RunConfig[] {
  if (opts.variant) {
    const keys = opts.variant.split(',').map(s => s.trim().toLowerCase());
    const unknown = keys.filter(k => !variantFor(k));
    if (unknown.length)
      fail(`unknown variant(s): ${unknown.join(', ')} — use a, b, c, d, kimi, overflow, ds-pro, ds-flash, ds-mix, kimi-flash`);
    if (keys.includes('d')) {
      console.log('note: variant d (the calls after the scope in parallel) is already how the orchestrator runs every brief;');
      console.log('      the "parallel saving" line of each summary measures it. d runs the same calls as a.');
    }
    // d is the same configuration as a: never pay for it twice.
    return Array.from(new Set(keys.includes('a') ? keys.filter(k => k !== 'd') : keys)).map(k => variantFor(k)!);
  }
  if (flags.has('chain'))
    return [
      {
        label: opts.label ?? 'production',
        description: 'production chains per call (k3-high scope, k3-low rest, k2.6 fallback) and deadline',
      },
    ];
  const model = opts.model;
  if (!model) fail('--model kimi-k3|kimi-k2.6|deepseek-v4-pro|deepseek-flash, --chain or --variant … is required');
  const effort = (opts.effort ?? 'low') as DeepSeekThinking;
  if (!THINKING_VALUES.includes(effort)) fail('--effort must be low | high | max (DeepSeek also: off)');
  if (effort === 'off' && !model.startsWith('deepseek-')) fail('--effort off is DeepSeek-only');
  const label = model.startsWith('kimi-k3') || model.startsWith('deepseek-') ? `${model}-${effort}` : model;
  return [{ label, description: `${label} for every call`, chain: [step(model, effort)], deadlineMs: SINGLE_MODEL_DEADLINE }];
}

function selectCases(): EvalCase[] {
  const ids = opts.cases ? new Set(opts.cases.split(',').map(s => s.trim())) : null;
  const tags = opts.tags ? opts.tags.split(',').map(s => s.trim()) : null;
  const missing = ids ? [...ids].filter(id => !allCases.some(c => c.id === id)) : [];
  if (missing.length) fail(`unknown case id(s): ${missing.join(', ')}`);
  // --cases runs in the order given (put what matters most first when the budget may stop the run).
  const order = opts.cases ? opts.cases.split(',').map(x => x.trim()) : [];
  return allCases
    .filter(c => !ids || ids.has(c.id))
    .filter(c => !tags || (c.tags ?? []).some(t => tags.includes(t)))
    .sort((a, b) => (ids ? order.indexOf(a.id) - order.indexOf(b.id) : 0))
    .slice(0, Number(opts.limit) || undefined);
}

/* ------------------------------------------------------------------ */
/* Moonshot balance guard                                              */
/* ------------------------------------------------------------------ */

async function moonshotBalance(): Promise<number | null> {
  const key = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;
  const base = process.env.AI_BASE_URL || 'https://api.moonshot.ai/v1';
  try {
    const res = await fetch(`${base}/users/me/balance`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { available_balance?: unknown } };
    return typeof body.data?.available_balance === 'number' ? body.data.available_balance : null;
  } catch {
    return null;
  }
}

/** The DeepSeek account balance in USD (null when the check fails). */
async function deepseekBalance(): Promise<number | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  const base = process.env.AI_FALLBACK_BASE_URL || 'https://api.deepseek.com';
  if (!key) return null;
  try {
    const res = await fetch(`${base}/user/balance`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { balance_infos?: { currency?: string; total_balance?: string }[] };
    const usd = body.balance_infos?.find(b => b.currency === 'USD');
    const value = Number(usd?.total_balance);
    return usd && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* One run                                                             */
/* ------------------------------------------------------------------ */

function rawFor(run: Pick<BriefRun, 'attempts'>, part: BriefCallPart): string | null {
  const tries = run.attempts.filter(a => a.part === part);
  return tries.find(a => a.usable)?.rawText ?? tries[tries.length - 1]?.rawText ?? null;
}

function resultRow(
  c: EvalCase,
  variant: string,
  repeat: number,
  run: RunView & Pick<BriefRun, 'model' | 'totalMs' | 'totalCostUsd'>
): {
  row: CaseResult;
  checks: ReturnType<typeof checksFor>;
} {
  const checks = checksFor(c, run);
  const tokens = run.attempts.reduce(
    (acc, a) => ({
      prompt: acc.prompt + (a.usage?.promptTokens ?? 0),
      completion: acc.completion + (a.usage?.completionTokens ?? 0),
      reasoning: acc.reasoning + (a.usage?.reasoningTokens ?? 0),
    }),
    { prompt: 0, completion: 0, reasoning: 0 }
  );
  const brief = run.outcome.status === 'ok' ? run.outcome.brief : null;
  const priced = brief ? pricedOf(run, brief.locale) : null;
  /** The priced estimate (null for a discovery-call brief or no brief). */
  const shown = brief && isPricedEstimate(brief.estimate) ? brief.estimate : null;
  const describe = (ch: { name: string; detail?: string }) => `${ch.name}${ch.detail ? ` (${ch.detail})` : ''}`;
  const report = checks.consistency;
  const row: CaseResult = {
    id: c.id,
    variant,
    repeat,
    locale: c.locale,
    category: c.category,
    status: run.outcome.status === 'error' ? `error:${run.outcome.code}` : run.outcome.status,
    product: brief ? `${brief.estimate.config.projectType}:${brief.estimate.config.subtype}` : null,
    model: run.model,
    ms: run.totalMs,
    partMs: partMs(run.attempts),
    costUsd: run.totalCostUsd,
    costUsdPeak: peakCostUsd(run.attempts),
    costByProviderPeak: costByProviderPeak(run.attempts),
    auxMs: auxMs(run.attempts),
    calls: callStats(run.attempts),
    cachedTokens: run.attempts.reduce((sum, a) => sum + (a.usage?.cachedTokens ?? 0), 0),
    promptTokens: tokens.prompt,
    completionTokens: tokens.completion,
    reasoningTokens: tokens.reasoning,
    failedChecks: checks.checks.filter(ch => !ch.ok && !ch.warn).map(describe),
    warnings: checks.checks.filter(ch => !ch.ok && ch.warn).map(describe),
    consistency: report
      ? { errors: report.errors, warnings: report.warnings, kinds: report.violations.map(v => v.kind), coverage: report.coverage.share }
      : null,
    consistencyBefore: run.guard?.before ?? null,
    guardRemoved: run.guard ? run.guard.removed.length : undefined,
    mvpPrice: shown ? { min: shown.mvp.price.min, max: shown.mvp.price.max } : null,
    mvpWeeks: shown ? { min: shown.mvp.weeks.min, max: shown.mvp.weeks.max } : null,
    discovery: brief && !shown ? true : undefined,
    mvpRefs: priced?.mvpRefs ?? [],
    laterRefs: priced?.laterRefs ?? [],
    screens: brief?.screens.length ?? 0,
    price: shown
      ? `$${shown.mvp.price.min}–$${shown.mvp.price.max} (${shown.mvp.price.basis})`
      : brief
        ? 'discovery call (no price)'
        : null,
    weeks: shown ? `${shown.mvp.weeks.min}–${shown.mvp.weeks.max} wk` : null,
  };
  return { row, checks };
}

/**
 * /tmp is a tmpfs with a per-user quota that other jobs fill transiently
 * (EDQUOT, "Unknown system error -122"). A paid run is never thrown away for
 * that: the write is retried a few times, sleeping in between.
 */
const WRITE_RETRIES = 8;
const WRITE_PAUSE_MS = 15_000;
function writeFileRetrying(file: string, data: string): void {
  for (let attempt = 1; ; attempt++) {
    try {
      fs.writeFileSync(file, data);
      return;
    } catch (error) {
      if (attempt >= WRITE_RETRIES) throw error;
      console.error(
        `write of ${path.basename(file)} failed (${error instanceof Error ? error.message : error}): retrying in ${WRITE_PAUSE_MS / 1000}s`
      );
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, WRITE_PAUSE_MS);
    }
  }
}

const fileFor = (dir: string, id: string, repeat: number, repeats: number) =>
  path.join(dir, repeats > 1 ? `${id}.r${repeat}.json` : `${id}.json`);

/**
 * A call lost to the provider or the network rather than the model: a dropped
 * connection, a 429 "engine overloaded", or the quota cooldown that 429 sets
 * in `src/core/ai.ts` (every later call then fails instantly with "no response").
 */
const INFRA_ERROR =
  /connection error|econnreset|etimedout|socket hang up|fetch failed|eai_again|\b50[234]\b|\b429\b|overloaded|no response/i;

/** True when the run lost a whole call (scope, plan, risks or a wireframe half) to the provider or network. */
function lostToInfra(run: Pick<BriefRun, 'attempts' | 'outcome'>): boolean {
  if (run.outcome.status === 'error' && run.outcome.code === 'ai_unavailable') return true;
  const parts = new Set(run.attempts.map(a => a.part));
  return [...parts].some(part => {
    const tries = run.attempts.filter(a => a.part === part);
    return !tries.some(a => a.usable) && tries.some(a => INFRA_ERROR.test(a.error ?? ''));
  });
}

async function evalOnce(
  c: EvalCase,
  config: RunConfig,
  repeat: number,
  repeats: number,
  dir: string
): Promise<{ row: CaseResult; infraLoss: boolean }> {
  const run = await runBrief(
    { idea: c.idea, locale: c.locale },
    {
      chain: config.chain,
      partChains: config.partChains,
      samplesChain: config.samplesChain,
      polishChain: config.polishChain,
      deadlineMs: config.deadlineMs,
      samples: flags.has('no-samples') ? false : undefined,
      polish: flags.has('no-polish') ? false : config.polish,
    }
  );
  const { row, checks } = resultRow(c, config.label, repeat, run);
  writeFileRetrying(
    fileFor(dir, c.id, repeat, repeats),
    JSON.stringify(
      {
        case: c,
        variant: config.label,
        repeat,
        chain: config.chain,
        partChains: config.partChains,
        samplesChain: config.samplesChain,
        polishChain: config.polishChain,
        input: c.idea,
        scrubbedInput: run.scrubbedIdea,
        truncated: run.truncated,
        redactions: run.redactions,
        attempts: run.attempts,
        rawOutput: Object.fromEntries([...BRIEF_PARTS, ...AUX_PARTS].map(part => [part, rawFor(run, part)])),
        parsedScope: run.scope,
        samples: run.samples,
        polish: run.polish,
        bigIdea: run.bigIdea,
        guard: run.guard,
        pricedScope: run.priced,
        outcome: run.outcome,
        checks: checks.checks,
        consistency: checks.consistency,
        latencyMs: run.totalMs,
        costUsd: run.totalCostUsd,
        result: row,
      },
      null,
      2
    )
  );
  const cons = row.consistency ? ` cons E${row.consistency.errors}/W${row.consistency.warnings}` : '';
  const tag = `${config.label}${repeats > 1 ? ` r${repeat}` : ''}`;
  console.log(
    `${row.status.padEnd(15)} ${String(row.ms).padStart(6)}ms $${row.costUsd.toFixed(4)}${cons}  ${c.id} [${tag}]${row.failedChecks.length ? `  ✗ ${row.failedChecks.join('; ')}` : ''}`
  );
  return { row, infraLoss: lostToInfra(run) };
}

/* ------------------------------------------------------------------ */
/* Summaries                                                           */
/* ------------------------------------------------------------------ */

/** Result rows already in a directory (for --merge and --recheck). */
function savedRows(dir: string, skip: Set<string>): CaseResult[] {
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json') && !['summary.json', 'compare.json'].includes(f))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).result as CaseResult | undefined)
    .filter((r): r is CaseResult => !!r && !skip.has(r.id));
}

function writeSummary(
  dir: string,
  config: Pick<RunConfig, 'label' | 'description'> & Partial<RunConfig>,
  rows: CaseResult[],
  extra: Record<string, unknown>
) {
  const order = allCases.map(c => c.id);
  const ordered = [...rows].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id) || a.repeat - b.repeat);
  const summary = summarizeVariant(config.label, ordered);
  const byCase = new Map<string, CaseResult[]>();
  for (const r of ordered) byCase.set(r.id, [...(byCase.get(r.id) ?? []), r]);
  const variance = [...byCase.values()].filter(rs => rs.length > 1).map(caseVariance);
  writeFileRetrying(
    path.join(dir, 'summary.json'),
    JSON.stringify(
      {
        label: config.label,
        description: config.description,
        chain: config.chain,
        partChains: config.partChains,
        samplesChain: config.samplesChain,
        polishChain: config.polishChain,
        ...extra,
        summary,
        variance,
        perRun: ordered,
      },
      null,
      2
    )
  );
  const c = summary.consistency;
  console.log(
    `\n[${config.label}] ${summary.briefs} brief(s): ${JSON.stringify(summary.statusCounts)} · cases with failed checks ${summary.casesWithFailedChecks}` +
      ` · consistency ${c.errorsPerBrief} errors/brief (${c.briefsWithErrors} briefs) ${c.warningsPerBrief} warnings/brief${
        c.beforeGuard
          ? ` (before the guard ${c.beforeGuard.errorsPerBrief} errors/brief, ${c.beforeGuard.briefsWithErrors} briefs; guard dropped ${c.guardRemovedPerBrief}/brief)`
          : ''
      } · p50 ${summary.latencyMs.p50}ms p90 ${summary.latencyMs.p90}ms (scope ${summary.partMsP50.scope}, then ${summary.afterScopeMsP50} for ${BRIEF_PARTS.filter(
        p => p !== 'scope'
      )
        .map(p => `${p} ${summary.partMsP50[p]}`)
        .join(' / ')}; parallel saves ${summary.parallelSavingMsP50}ms)` +
      ` · $${summary.costUsd.total} ($${summary.costUsd.perBrief}/brief${
        summary.costUsd.perBriefPeak !== null ? `, $${summary.costUsd.perBriefPeak} at peak prices` : ''
      })` +
      (summary.auxMsP50 ? ` · samples p50 ${summary.auxMsP50.samples}ms, copy-edit p50 ${summary.auxMsP50.polishMax}ms` : '') +
      (summary.calls
        ? ` · calls ${summary.calls.total}: ${summary.calls.unusable} unusable, ${summary.calls.errors} errors, ${summary.calls.truncated} truncated`
        : '')
  );
  for (const v of variance) {
    const price = v.mvpPrice ? `$${Math.round(v.mvpPrice.min)}–$${Math.round(v.mvpPrice.max)} cv ${v.mvpPrice.cv}` : 'no price';
    const unstable = Object.entries(v.mvpRefs.sometimes)
      .map(([ref, n]) => `${ref}×${n}`)
      .join(',');
    console.log(
      `  ~ ${v.id.padEnd(30)} ${JSON.stringify(v.statuses)} ${Object.keys(v.products).join('/')} · mid ${price} · screens ${v.screens.min}-${v.screens.max} · refs J=${v.mvpRefs.jaccard}${unstable ? ` (${unstable})` : ''} · consErr ${v.consistencyErrors.join(',')}`
    );
  }
  console.log(`Summary: ${path.join(dir, 'summary.json')}`);
  return summary;
}

/* ------------------------------------------------------------------ */
/* Modes                                                               */
/* ------------------------------------------------------------------ */

function listCases(cases: EvalCase[]): void {
  for (const c of cases) {
    const e = c.expect;
    const parts = [
      Array.isArray(e.status) ? e.status.join('|') : e.status,
      e.productTypes?.join('|'),
      e.subtypes && `sub:${e.subtypes.join('|')}`,
      e.mustIncludeMvp && `mvp:${e.mustIncludeMvp.map(s => (Array.isArray(s) ? s.join('|') : s)).join(',')}`,
      e.mustInclude && `incl:${e.mustInclude.map(s => (Array.isArray(s) ? s.join('|') : s)).join(',')}`,
      e.mustNotInclude && `not:${e.mustNotInclude.join(',')}`,
      e.mustLand && `land:${e.mustLand.map(l => l.label).join(',')}`,
    ].filter(Boolean);
    console.log(`${c.id.padEnd(30)} ${c.locale} ${(c.tags ?? []).join(',').padEnd(18)} ${parts.join('  ')}`);
  }
  console.log(`\n${cases.length} case(s)`);
}

/** Re-score saved runs with the current checks and cases (no API calls). */
function recheck(dir: string): void {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !['summary.json', 'compare.json'].includes(f));
  const rows: CaseResult[] = [];
  let label = path.basename(path.resolve(dir));
  for (const f of files) {
    const file = path.join(dir, f);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    const c: EvalCase = allCases.find(x => x.id === saved.case?.id) ?? saved.case;
    if (!c || !saved.outcome) continue;
    label = saved.variant ?? label;
    const run = {
      outcome: saved.outcome,
      scope: saved.parsedScope ?? null,
      priced: saved.pricedScope ?? null,
      scrubbedIdea: saved.scrubbedInput ?? '',
      attempts: saved.attempts ?? [],
      model: saved.result?.model ?? null,
      totalMs: saved.latencyMs ?? 0,
      totalCostUsd: saved.costUsd ?? 0,
      guard: saved.guard ?? null,
    };
    const repeat = Number(f.match(/\.r(\d+)\.json$/)?.[1] ?? 1);
    const { row, checks } = resultRow(c, label, repeat, run);
    fs.writeFileSync(file, JSON.stringify({ ...saved, checks: checks.checks, consistency: checks.consistency, result: row }, null, 2));
    rows.push(row);
    if (row.failedChecks.length)
      console.log(`${row.status.padEnd(15)} ${c.id}${repeat > 1 ? ` r${repeat}` : ''}  ✗ ${row.failedChecks.join('; ')}`);
  }
  writeSummary(dir, { label, description: `recheck of ${dir}` }, rows, { recheckedAt: new Date().toISOString() });
}

/**
 * Replay saved runs through the CURRENT post-model pipeline: the saved model
 * answers (one per call) are parsed, ruled, priced, guarded and scored again
 * exactly as `runBrief` would — so a parser, rule, guard or checker change is
 * measured on real outputs for $0. Answers written against a different priced
 * scope than the current rules produce are parsed as they are (refs that are
 * no longer priced get dropped, as they would be live).
 */
function replay(srcDir: string, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json') && !['summary.json', 'compare.json'].includes(f));
  const rows: CaseResult[] = [];
  let label = `${path.basename(path.resolve(srcDir))}-replay`;
  for (const f of files) {
    const saved = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8'));
    const c: EvalCase = allCases.find(x => x.id === saved.case?.id) ?? saved.case;
    if (!c || !saved.outcome) continue;
    label = `${saved.variant ?? label}-replay`;
    const raw = (saved.rawOutput ?? {}) as Partial<Record<BriefCallPart, string | null>>;
    const idea: string = saved.scrubbedInput ?? '';
    // Names the scrubber replaced, recomputed from the saved input (the run never stores them).
    const avoidNames = scrubContactDetails(prepareIdea(saved.input ?? '').text).nameWords;
    const ctx = { locale: c.locale, idea, avoidNames };
    const base = {
      scrubbedIdea: idea,
      attempts: saved.attempts ?? [],
      model: saved.result?.model ?? null,
      totalMs: saved.latencyMs ?? 0,
      totalCostUsd: saved.costUsd ?? 0,
    };
    let run: RunView & Pick<BriefRun, 'model' | 'totalMs' | 'totalCostUsd'> = {
      ...base,
      outcome: saved.outcome as BriefOutcome,
      scope: saved.parsedScope ?? null,
      priced: saved.pricedScope ?? null,
      guard: saved.guard ?? null,
    };
    let bigIdea: BigIdeaVerdict | null = null;
    const scopeParsed = raw.scope ? parseScopeJson(raw.scope, ctx) : null;
    if (scopeParsed?.usable) {
      const modelScope = scopeParsed.value;
      if (isRejected(modelScope)) {
        run = {
          ...run,
          outcome: { status: 'rejected', reason: rejectionReason(modelScope) },
          scope: modelScope,
          priced: null,
          guard: null,
        };
      } else if (isPolicyDecline(modelScope)) {
        const outcome: BriefOutcome = { status: 'declined_policy', topics: modelScope.policy.topics, note: modelScope.policy.note };
        run = { ...run, outcome, scope: modelScope, priced: null, guard: null };
      } else {
        const stage = priceScope(modelScope, idea, c.locale);
        bigIdea = stage.bigIdea;
        const specs = laterPartSpecs({ ...ctx, priced: stage.priced }, c.locale);
        const plan = raw.plan ? specs.plan.parse(raw.plan) : null;
        const risks = raw.risks ? specs.risks.parse(raw.risks) : null;
        const main = raw.screensMain ? specs.screensMain.parse(raw.screensMain) : null;
        const rest = raw.screensRest ? specs.screensRest.parse(raw.screensRest) : null;
        // The Uzbek copy-edit's recorded fixes (keyed by the original string) are re-applied as they were
        // ('polishNarrative': the first iteration-3 live run edited plan and risks in one call).
        // Keys go through the CURRENT text cleaner: a newer deterministic fix may have changed the string the
        // copy-edit saw, and its saved edit must still land (it is cleaned the same way live). Each saved fix
        // is checked again by the CURRENT guards (`refuseFix`): a fix a newer rule refuses — a question whose
        // subject flipped, a first-letter-only edit — is dropped, as it would be live.
        const polishLog = (saved.polish ?? {}) as Record<string, [string, string][] | undefined>;
        const fixesOf = (...parts: string[]) =>
          new Map(
            parts
              .flatMap(part => polishLog[part] ?? [])
              .map(([from, to]): [string, string] => {
                const original = cleanVisibleText(from, c.locale);
                return [original, keepLeadingCapital(original, cleanVisibleText(to, c.locale))];
              })
              .filter(([original, fixed]) => refuseFix(original, fixed) === null)
          );
        const screens = applyFixes(
          screensOf(main?.usable ? main.value : null, rest?.usable ? rest.value : null),
          mapScreensTexts,
          fixesOf('polishScreens')
        );
        if (plan?.usable && risks?.usable) {
          const savedBrief = saved.outcome.status === 'ok' ? (saved.outcome.brief as AiBrief) : null;
          const models = savedBrief?.models ?? { scope: base.model ?? 'kimi-k3', narrative: base.model ?? 'kimi-k3', screens: null };
          const narrative = {
            ...applyFixes(plan.value, mapPlanTexts, fixesOf('polishPlan', 'polishNarrative')),
            ...applyFixes(risks.value, mapRisksTexts, fixesOf('polishRisks', 'polishNarrative')),
          };
          const polished = { ...stage, scope: applyFixes(stage.scope, mapScopeTexts, fixesOf('polishScope')) };
          const { brief, guard } = assembleBrief(polished, narrative, screens, models, c.locale);
          run = { ...run, outcome: { status: 'ok', brief }, scope: polished.scope, priced: stage.priced, guard };
        } else {
          run = { ...run, outcome: { status: 'error', code: 'invalid_output' }, scope: stage.scope, priced: stage.priced, guard: null };
        }
      }
    }
    const repeat = Number(f.match(/\.r(\d+)\.json$/)?.[1] ?? saved.repeat ?? 1);
    const { row, checks } = resultRow(c, label, repeat, run);
    fs.writeFileSync(
      path.join(outDir, f),
      JSON.stringify(
        {
          ...saved,
          variant: label,
          replayOf: path.join(srcDir, f),
          bigIdea,
          parsedScope: run.scope,
          guard: run.guard,
          pricedScope: run.priced,
          outcome: run.outcome,
          checks: checks.checks,
          consistency: checks.consistency,
          result: row,
        },
        null,
        2
      )
    );
    rows.push(row);
  }
  writeSummary(outDir, { label, description: `replay of ${srcDir} through the current pipeline` }, rows, {
    replayedAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ */
/* Uzbek copy-edit test on saved briefs                                */
/* ------------------------------------------------------------------ */

/** The brief's scope-stage strings (what `polishScope` edits live). */
const briefScopeTexts: TextMapper<AiBrief> = (b, f) => ({
  ...b,
  title: f(b.title),
  summary: f(b.summary),
  audience: b.audience.map(a => ({ segment: f(a.segment), need: f(a.need) })),
  features: b.features.map(i => ({ ...i, note: f(i.note) })),
  integrations: b.integrations.map(i => ({ ...i, note: f(i.note) })),
  policy: { ...b.policy, note: f(b.policy.note) },
  narrative: { ...b.narrative, assumptions: b.narrative.assumptions.map(f) },
  estimate: mapEstimateText(b.estimate, f),
});

/** The plan strings (`polishPlan`). */
const briefPlanTexts: TextMapper<AiBrief> = (b, f) => ({
  ...b,
  narrative: {
    ...b.narrative,
    buildFirst: { what: f(b.narrative.buildFirst.what), why: f(b.narrative.buildFirst.why) },
    canWait: b.narrative.canWait.map(c => ({ ...c, item: f(c.item), reason: f(c.reason) })),
  },
  estimate: mapPhases(b.estimate, p => ({ ...p, title: f(p.title), goal: f(p.goal), deliverables: p.deliverables.map(f) })),
});

/** The risks and questions (`polishRisks`). */
const briefRisksTexts: TextMapper<AiBrief> = (b, f) => ({
  ...b,
  narrative: {
    ...b.narrative,
    risks: b.narrative.risks.map(r => ({ title: f(r.title), detail: f(r.detail), mitigation: f(r.mitigation) })),
    questions: b.narrative.questions.map(f),
  },
});

const briefScreensTexts: TextMapper<AiBrief> = (b, f) => ({ ...b, screens: mapScreensTexts(b.screens, f) });

const POLISH_PARTS: [keyof PolishLog, TextMapper<AiBrief>][] = [
  ['polishScope', briefScopeTexts],
  ['polishPlan', briefPlanTexts],
  ['polishRisks', briefRisksTexts],
  ['polishScreens', briefScreensTexts],
];

async function polishCall(part: keyof PolishLog, texts: string[], idea: string) {
  const spec = polishSpec(part, texts);
  // --polish-model kimi-k2.6 compares the copy editor on another model (K2.x runs without reasoning).
  const model = opts['polish-model'];
  const step: BriefModelStep = model
    ? { ...POLISH_CHAIN[0], model, reasoningEffort: model.startsWith('kimi-k3') ? POLISH_CHAIN[0].reasoningEffort : undefined }
    : POLISH_CHAIN[0];
  const calls: AiAttempt[] = [];
  const call1 = () =>
    safeGenerateJSONWithTimeout(buildPolishUserPrompt(idea, texts), `ai-brief-${part}-uz`, {
      system: spec.system,
      jsonSchema: spec.schema,
      model: step.model,
      reasoningEffort: step.reasoningEffort,
      timeout: step.timeoutMs,
      maxTokens: step.maxTokens,
      provider: providerOfModel(step.model) ?? 'kimi',
      firstOnly: true,
      maxRetries: 0,
      onAttempt: a => calls.push(a),
    });
  // One retry on a dropped connection, as in production (CONNECTION_RETRIES).
  const res = (await call1()) ?? (INFRA_ERROR.test(calls[calls.length - 1]?.error ?? '') ? await call1() : null);
  const call = calls[calls.length - 1];
  const parsed = res ? spec.parse(res.text) : null;
  const attempt: BriefAttemptLog = {
    part,
    step: 0,
    model: step.model,
    ms: call?.ms ?? 0,
    ok: !!res,
    error: call?.error,
    usage: call?.usage,
    costUsd: estimateCostUsd(step.model, call?.usage),
    rawText: res?.text,
  };
  return { attempt, fixes: parsed?.value ?? new Map<string, string>(), issues: parsed?.issues ?? ['no response'] };
}

/** Run the copy-edit on every saved uz brief of `srcDir` (paid) and write what it changed. */
async function polishTest(srcDir: string, outDir: string): Promise<void> {
  if (!process.env.MOONSHOT_API_KEY && !process.env.KIMI_API_KEY) fail('MOONSHOT_API_KEY is not set');
  fs.mkdirSync(outDir, { recursive: true });
  const minBalance = opts['min-balance'] !== undefined ? Number(opts['min-balance']) : 7;
  const maxCost = Number(opts['max-cost']) || 1;
  const startBalance = await moonshotBalance();
  console.log(`Moonshot balance: ${startBalance === null ? 'unknown' : `$${startBalance.toFixed(2)}`} (floor $${minBalance})`);
  if (startBalance !== null && startBalance < minBalance) fail('balance is below --min-balance: not starting');
  const ids = opts.cases ? new Set(opts.cases.split(',').map(x => x.trim())) : null;
  const files = fs
    .readdirSync(srcDir)
    .filter(f => f.endsWith('.json') && !['summary.json', 'compare.json'].includes(f))
    .filter(f => !ids || ids.has(f.replace(/(\.r\d+)?\.json$/, '')));
  let spent = 0;
  const rows: { id: string; fixes: number; refused: number; ms: number; costUsd: number; consBefore: number; consAfter: number }[] = [];
  for (const f of files) {
    const saved = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8'));
    if (saved.case?.locale !== 'uz' || saved.outcome?.status !== 'ok') continue;
    if (spent >= maxCost) {
      console.log(`max cost $${maxCost} reached — stopping`);
      break;
    }
    if (startBalance !== null && startBalance - spent < minBalance) {
      console.log(
        `start balance $${startBalance.toFixed(2)} − estimated $${spent.toFixed(2)} is below the $${minBalance} floor — stopping`
      );
      break;
    }
    const brief = saved.outcome.brief as AiBrief;
    const idea: string = saved.scrubbedInput ?? '';
    // Each part in the production chunks, all calls in parallel (as `polishValue` runs them live).
    const calls = await Promise.all(
      POLISH_PARTS.flatMap(([part, map]) =>
        chunkTexts(collectTexts(brief, map)).map(async chunk => ({ part, map, ...(await polishCall(part, chunk, idea)) }))
      )
    );
    const results = POLISH_PARTS.map(([part, map]) => {
      const mine = calls.filter(c => c.part === part);
      return {
        part,
        map,
        fixes: new Map(mine.flatMap(c => Array.from(c.fixes.entries()))),
        issues: mine.flatMap(c => c.issues),
        attempts: mine.map(c => c.attempt),
      };
    });
    let polished = brief;
    for (const r of results) polished = applyFixes(polished, r.map, r.fixes);
    const before = checkBriefConsistency(brief, saved.pricedScope);
    const after = checkBriefConsistency(polished, saved.pricedScope);
    const costUsd = calls.reduce((sum, c) => sum + c.attempt.costUsd, 0);
    spent += costUsd;
    const ms = Math.max(0, ...calls.map(c => c.attempt.ms));
    const fixes = Object.fromEntries(results.map(r => [r.part, Array.from(r.fixes.entries())]));
    const refused = results.flatMap(r => r.issues.map(i => `${r.part}: ${i}`));
    fs.writeFileSync(
      path.join(outDir, f),
      JSON.stringify(
        {
          case: saved.case,
          polishOf: path.join(srcDir, f),
          attempts: calls.map(c => c.attempt),
          fixes,
          refused,
          consistency: { before: before.violations, after: after.violations },
          costUsd,
          ms,
          brief: polished,
        },
        null,
        2
      )
    );
    const count = results.reduce((n, r) => n + r.fixes.size, 0);
    rows.push({
      id: saved.case.id,
      fixes: count,
      refused: refused.length,
      ms,
      costUsd,
      consBefore: before.errors,
      consAfter: after.errors,
    });
    console.log(
      `${saved.case.id.padEnd(28)} fixes ${String(count).padStart(2)} refused ${refused.length} ${ms}ms $${costUsd.toFixed(4)} cons E${before.errors}→E${after.errors}`
    );
    for (const r of results) for (const [from, to] of r.fixes) console.log(`    ${r.part}: "${from}" → "${to}"`);
    for (const line of refused) console.log(`    ✗ ${line}`);
  }
  const msSorted = rows.map(r => r.ms).sort((a, b) => a - b);
  const summary = {
    briefs: rows.length,
    fixesPerBrief: rows.length ? Number((rows.reduce((n, r) => n + r.fixes, 0) / rows.length).toFixed(2)) : 0,
    refused: rows.reduce((n, r) => n + r.refused, 0),
    msP50: msSorted[Math.floor(msSorted.length / 2)] ?? 0,
    msMax: msSorted[msSorted.length - 1] ?? 0,
    costUsd: { total: Number(spent.toFixed(4)), perBrief: rows.length ? Number((spent / rows.length).toFixed(4)) : 0 },
    consistencyErrors: { before: rows.reduce((n, r) => n + r.consBefore, 0), after: rows.reduce((n, r) => n + r.consAfter, 0) },
    rows,
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  const endBalance = await moonshotBalance();
  console.log(`\n${JSON.stringify({ ...summary, rows: undefined })}`);
  console.log(
    `Estimated spend $${spent.toFixed(4)}${startBalance !== null && endBalance !== null ? ` · balance $${startBalance.toFixed(2)} → $${endBalance.toFixed(2)}` : ''}`
  );
}

interface Job {
  c: EvalCase;
  config: RunConfig;
  repeat: number;
  /** How many times this run was re-queued after losing a call to the provider or network. */
  retries?: number;
}

/**
 * A run that lost a call to the provider or network is re-queued once the
 * quota cooldown that a 429 sets in `src/core/ai.ts` (60 s) has cleared —
 * otherwise one "engine overloaded" drains the whole queue in milliseconds.
 */
const INFRA_RETRIES = 3;
const INFRA_PAUSE_MS = 65_000;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runEvals(): Promise<void> {
  const configs = configsFromArgs();
  const used = new Set(configs.flatMap(providersOfConfig));
  const usesKimi = used.has('kimi');
  const usesDeepSeek = used.has('deepseek');
  if (usesKimi && !process.env.MOONSHOT_API_KEY && !process.env.KIMI_API_KEY)
    fail('MOONSHOT_API_KEY is not set (check .env, or pass it explicitly)');
  if (usesDeepSeek && !process.env.DEEPSEEK_API_KEY) fail('DEEPSEEK_API_KEY is not set (it lives in .env.local — pass it explicitly)');
  const cases = selectCases();
  const repeats = Math.max(1, Number(opts.repeat) || 1);
  const concurrency = Math.max(1, Number(opts.concurrency) || 2);
  const maxCost = Number(opts['max-cost']) || 4;
  const minBalance = usesKimi ? (opts['min-balance'] !== undefined ? Number(opts['min-balance']) : 7) : 0;
  const dsMinBalance = usesDeepSeek ? (opts['ds-min-balance'] !== undefined ? Number(opts['ds-min-balance']) : 3.4) : 0;
  const multi = configs.length > 1;
  const runLabel = multi ? `variants-${configs.map(c => c.short ?? c.label[0]).join('')}` : configs[0].label;
  const baseDir = path.resolve(opts.out ?? `/tmp/claude-1000/ai-brief-eval/${runLabel}/`);
  const dirFor = (config: RunConfig) => (multi ? path.join(baseDir, config.label) : baseDir);
  for (const config of configs) fs.mkdirSync(dirFor(config), { recursive: true });

  // Interleave so every configuration sees the same API conditions; repeat-major, so a run the
  // budget stops early still holds whole passes over the case set (r1 of every case before any r2).
  const jobs: Job[] = Array.from({ length: repeats }, (_, r) =>
    cases.flatMap(c => configs.map(config => ({ c, config, repeat: r + 1 })))
  ).flat();
  console.log(
    `AI brief eval — ${configs.map(c => c.label).join(', ')} · ${cases.length} case(s) × ${repeats} repeat(s) = ${jobs.length} run(s), concurrency ${concurrency}, max cost $${maxCost} → ${baseDir}`
  );
  for (const config of configs) console.log(`  ${config.label}: ${config.description}`);

  const startBalance = minBalance > 0 ? await moonshotBalance() : null;
  if (minBalance > 0) {
    console.log(
      `Moonshot balance: ${startBalance === null ? 'unknown (check failed)' : `$${startBalance.toFixed(2)}`} (floor $${minBalance})`
    );
    if (startBalance !== null && startBalance < minBalance) fail('balance is below --min-balance: not starting');
  }
  const dsStartBalance = dsMinBalance > 0 ? await deepseekBalance() : null;
  if (dsMinBalance > 0) {
    console.log(
      `DeepSeek balance: ${dsStartBalance === null ? 'unknown (check failed)' : `$${dsStartBalance.toFixed(2)}`} (floor $${dsMinBalance})`
    );
    if (dsStartBalance === null) fail('DeepSeek balance check failed: not starting (the floor is a hard budget)');
    if (dsStartBalance < dsMinBalance) fail('DeepSeek balance is below --ds-min-balance: not starting');
  }
  console.log('');

  const startedAt = new Date();
  const rows: CaseResult[] = [];
  let spent = 0;
  /** Kimi spend of this invocation (what the Moonshot balance floor guards). */
  let kimiSpent = 0;
  /** DeepSeek spend of this invocation at PEAK prices (the balance guard's upper bound). */
  let dsSpentPeak = 0;
  let next = 0;
  let stopReason: string | null = null;
  let lastCheck = Date.now();
  let infraRequeues = 0;

  const worker = async () => {
    while (next < jobs.length && !stopReason) {
      if (spent >= maxCost) {
        stopReason = `max cost $${maxCost} reached`;
        return;
      }
      // The balance API lags billing by 10+ minutes (iteration 3 ended $0.09 under its floor although
      // every check passed): this run's own estimated spend counts against the floor too.
      if (minBalance > 0 && startBalance !== null && startBalance - kimiSpent < minBalance) {
        stopReason = `start balance $${startBalance.toFixed(2)} − this run's estimated Kimi $${kimiSpent.toFixed(2)} is below the $${minBalance} floor`;
        return;
      }
      if (dsMinBalance > 0 && dsStartBalance !== null && dsStartBalance - dsSpentPeak < dsMinBalance) {
        stopReason = `DeepSeek start balance $${dsStartBalance.toFixed(2)} − this run's estimated $${dsSpentPeak.toFixed(2)} (peak) is below the $${dsMinBalance} floor`;
        return;
      }
      if ((minBalance > 0 || dsMinBalance > 0) && Date.now() - lastCheck > 30_000) {
        lastCheck = Date.now();
        const balance = minBalance > 0 ? await moonshotBalance() : null;
        if (balance !== null && balance < minBalance) {
          stopReason = `balance $${balance.toFixed(2)} below the $${minBalance} floor`;
          return;
        }
        const dsBalance = dsMinBalance > 0 ? await deepseekBalance() : null;
        if (dsBalance !== null && dsBalance < dsMinBalance) {
          stopReason = `DeepSeek balance $${dsBalance.toFixed(2)} below the $${dsMinBalance} floor`;
          return;
        }
      }
      const job = jobs[next++];
      const retries = job.retries ?? 0;
      const requeue = async (why: string) => {
        infraRequeues++;
        console.log(
          `↻ ${job.c.id} [${job.config.label} r${job.repeat}] ${why}: re-queued (${retries + 1}/${INFRA_RETRIES}) after a ${INFRA_PAUSE_MS / 1000}s pause`
        );
        await pause(INFRA_PAUSE_MS);
        jobs.push({ ...job, retries: retries + 1 });
      };
      try {
        const { row, infraLoss } = await evalOnce(job.c, job.config, job.repeat, repeats, dirFor(job.config));
        spent += row.costUsd;
        dsSpentPeak += row.costByProviderPeak?.deepseek ?? 0;
        kimiSpent += row.costByProviderPeak?.kimi ?? 0;
        if (infraLoss && retries < INFRA_RETRIES) {
          await requeue('lost a call to the provider or network');
          continue;
        }
        rows.push(row);
      } catch (error) {
        console.error(`✗ ${job.c.id} [${job.config.label} r${job.repeat}] crashed:`, error instanceof Error ? error.message : error);
        if (retries < INFRA_RETRIES) await requeue('crashed');
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (stopReason) console.log(`\nStopped launching runs: ${stopReason} (${jobs.length - next} run(s) not started)`);

  const summaries = configs.map(config => {
    const ran = rows.filter(r => r.variant === config.label);
    const kept = flags.has('merge') ? savedRows(dirFor(config), new Set(ran.map(r => r.id))) : [];
    return writeSummary(dirFor(config), config, [...ran, ...kept], {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      repeats,
      stopReason,
      infraRequeues,
      rerun: flags.has('merge') ? ran.map(r => r.id) : undefined,
    });
  });
  if (multi) {
    fs.writeFileSync(
      path.join(baseDir, 'compare.json'),
      JSON.stringify({ startedAt: startedAt.toISOString(), repeats, cases: cases.map(c => c.id), summaries }, null, 2)
    );
    console.log(`\n${comparisonTable(summaries)}\nCompare: ${path.join(baseDir, 'compare.json')}`);
  }

  const endBalance = minBalance > 0 ? await moonshotBalance() : null;
  console.log(
    `\nEstimated spend (list prices; DeepSeek at the hour's rate): $${spent.toFixed(4)}${
      startBalance !== null && endBalance !== null
        ? ` · Moonshot balance $${startBalance.toFixed(2)} → $${endBalance.toFixed(2)} (Δ $${(startBalance - endBalance).toFixed(2)}, billing may lag)`
        : ''
    }`
  );
  if (dsMinBalance > 0) {
    const dsEnd = await deepseekBalance();
    console.log(
      `DeepSeek estimated $${dsSpentPeak.toFixed(4)} at peak prices${
        dsStartBalance !== null && dsEnd !== null
          ? ` · balance $${dsStartBalance.toFixed(2)} → $${dsEnd.toFixed(2)} (Δ $${(dsStartBalance - dsEnd).toFixed(2)}, billing may lag)`
          : ''
      }`
    );
  }
}

async function main(): Promise<void> {
  if (flags.has('list')) return listCases(selectCases());
  if (opts.recheck) return recheck(path.resolve(opts.recheck));
  if (opts.replay) {
    if (!opts.out) fail('--replay needs --out <dir> (never overwrite the saved runs)');
    return replay(path.resolve(opts.replay), path.resolve(opts.out));
  }
  if (opts['polish-test']) {
    if (!opts.out) fail('--polish-test needs --out <dir>');
    return polishTest(path.resolve(opts['polish-test']), path.resolve(opts.out));
  }
  return runEvals();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
