import { configuredProviders, estimateCostUsd, safeGenerateJSONWithTimeout, type AiAttempt, type JsonSchemaSpec } from '@/core/ai';
import { logger } from '@/core/logger';
import { TECH_BY_ID } from '@/modules/estimator/data/catalog';
import {
  BRIEF_DEADLINE_MS,
  BRIEF_PART_CHAINS,
  CAPS,
  LATER_HEDGE_MS,
  LONG_IDEA_CHARS,
  LONG_IDEA_SCOPE_CHAIN,
  POLISH_CHAIN,
  SAMPLES_CHAIN,
  SCOPE_HEDGE_MS,
  CONNECTION_RETRIES,
  MIN_ATTEMPT_MS,
  MIN_IDEA_CHARS,
  SAMPLE_PRODUCTS,
  UZ_POLISH_ENABLED,
  type AuxPart,
  type BriefCallPart,
  type BriefLocale,
  type BriefModelStep,
  type BriefPart,
} from '@/modules/estimator/ai-brief/constants';
import { checkBriefConsistency, type ViewSource } from '@/modules/estimator/ai-brief/consistency';
import { pricedScopeOf, type PricedScope } from '@/modules/estimator/ai-brief/digest';
import { guardBriefText, guardScopeText } from '@/modules/estimator/ai-brief/guard';
import { assessBigIdea, type BigIdeaReason, type BigIdeaVerdict } from '@/modules/estimator/ai-brief/bigIdea';
import { buildEstimate, engineSize, mapScopeToInputs, toDiscoveryEstimate, type MappedScope } from '@/modules/estimator/ai-brief/mapping';
import type { TextContext } from '@/modules/estimator/ai-brief/parse';
import {
  parsePlanJson,
  parseRisksJson,
  type BriefPlan,
  type BriefRisks,
  type NarrativeContext,
} from '@/modules/estimator/ai-brief/parseNarrative';
import { isPolicyDecline, isRejected, parseScopeJson, rejectionReason } from '@/modules/estimator/ai-brief/parseScope';
import {
  applyFixes,
  chunkTexts,
  collectTexts,
  mapPlanTexts,
  mapRisksTexts,
  mapScopeTexts,
  mapScreensTexts,
  parsePolishJson,
  type TextMapper,
} from '@/modules/estimator/ai-brief/polish';
import {
  buildPlanSystemPrompt,
  buildPolishSystemPrompt,
  buildPolishUserPrompt,
  buildRisksSystemPrompt,
  buildSamplesSystemPrompt,
  buildScopeSystemPrompt,
  buildScopedUserPrompt,
  buildScreensSystemPrompt,
  buildUserPrompt,
  screenParts,
} from '@/modules/estimator/ai-brief/prompts';
import { reconcileScope } from '@/modules/estimator/ai-brief/reconcile';
import { parseSamplesJson } from '@/modules/estimator/ai-brief/samples';
import {
  PLAN_JSON_SCHEMA,
  POLISH_JSON_SCHEMA,
  RISKS_JSON_SCHEMA,
  SAMPLES_JSON_SCHEMA,
  SCOPE_JSON_SCHEMA,
  SCREENS_JSON_SCHEMA,
} from '@/modules/estimator/ai-brief/schema';
import { harmonizeSamplePrices, mergeScreenParts, parseScreensJson } from '@/modules/estimator/ai-brief/screens';
import { prepareIdea, scrubContactDetails, type RedactionKind } from '@/modules/estimator/ai-brief/scrub';
import type {
  AiBrief,
  BriefErrorCode,
  BriefNarrative,
  BriefOutcome,
  BriefPreview,
  BriefProgress,
  BriefScope,
  Parsed,
  WireframeScreen,
} from '@/modules/estimator/ai-brief/types';

/**
 * AI project brief pipeline:
 *
 *   idea ─ normalize/cap ─ scrub contact details
 *     └▶ call 1: scope (catalog ids, strict schema) ── rejected / policy decline → done
 *          └▶ rules (reconcile.ts) ─▶ estimator engine: every hour, week and dollar
 *               └▶ guard: summary / audience / assumptions vs the priced scope ─▶ preview streams
 *                    ├▶ plan      (build first, can wait, phases) ─┐
 *                    ├▶ risks     (risks, discovery questions)    ├▶ guard: MVP copy ─▶ brief
 *                    ├▶ screens A (the main user's journey)       │
 *                    └▶ screens B (other roles, operator, later) ─┘
 *     ∥ samples: sample content both wireframe halves reuse (in parallel with call 1)
 *
 * Uzbek pages add a copy-edit of each part's visible text (`polish.ts`): the
 * scope's while calls 2–5 run, the narrative's and the wireframes' as soon as
 * their calls are back. Both helpers are optional — a failed one leaves the
 * brief as it would have been without it.
 *
 * Why this shape: calls 2–5 all see the PRICED scope (still without a single
 * number) and their parsers drop anything that points outside it, so the
 * explanation and the wireframes cannot contradict the quote. They run in
 * parallel: decoding speed (~35 tokens/s on kimi-k3) made the wall clock
 * proportional to the longest answer, so the 2026-10 round-2 design (one
 * narrative ∥ one wireframe call, ~1.1–1.2k tokens each, p50 61 s with the
 * high-effort scope) is split into four answers of ~0.4–0.7k tokens. A
 * rejection or decline never pays for them.
 *
 * Fallback: each call walks its chain in BRIEF_PART_CHAINS (kimi-k3 →
 * kimi-k2.6) while the shared deadline allows; an unusable answer counts as a
 * failure, and a dropped connection is retried once on the same model. The
 * high-effort scope has a long tail, so its fallback is hedged: it starts in
 * parallel once the primary has run SCOPE_HEDGE_MS. Late in the deadline a
 * step that cannot run its full timeout yields to the faster fallback. When
 * the primary model is down, the later calls start at the fallback too. A
 * long, detailed idea scopes at low effort (LONG_IDEA_CHARS).
 * Wireframes are an enhancement (the brief ships with `screens: []` without
 * the main half); scope, plan and risks are required.
 */

const LOG = 'AI_BRIEF';
const DEADLINE_MARGIN_MS = 2_000;
const CONNECTION_ERROR = /connection error|econnreset|etimedout|socket hang up|fetch failed|eai_again|\b50[234]\b|overloaded/i;
/** Screens each wireframe half must deliver to count (the merged set still needs `CAPS.screensMin`). */
export const MAIN_SCREENS_MIN = CAPS.mainScreens - 1;
export const REST_SCREENS_MIN = 1;

export type { BriefPart, BriefCallPart };

export interface BriefAttemptLog {
  part: BriefCallPart;
  step: number;
  model: string;
  ms: number;
  ok: boolean;
  error?: string;
  finishReason?: string | null;
  usage?: AiAttempt['usage'];
  costUsd: number;
  usable?: boolean;
  parseIssues?: string[];
  /** Raw model text (eval/debug only — the route never returns it). */
  rawText?: string;
}

/** What the consistency guard did to a brief (eval/audit only). */
export interface BriefGuardLog {
  /** Every sentence, line or wireframe text it dropped (or had to keep), with the reason. */
  removed: string[];
  /** The deterministic consistency report of the brief BEFORE the guard. */
  before: { errors: number; warnings: number; kinds: string[] };
}

/** The Uzbek copy-edit's accepted fixes per part, as [original, fixed] pairs (eval/replay only). */
export type PolishLog = Partial<Record<Extract<AuxPart, `polish${string}`>, [string, string][]>>;

export interface BriefRun {
  outcome: BriefOutcome;
  /** Exactly what was sent to the model. */
  scrubbedIdea: string;
  truncated: boolean;
  redactions: Record<RedactionKind, number>;
  attempts: BriefAttemptLog[];
  /** The scope as priced (after the deterministic rules and the guard) — eval/audit only. */
  scope: BriefScope | null;
  /** The priced scope the narrative and wireframes were written against — eval/audit only. */
  priced: PricedScope | null;
  guard: BriefGuardLog | null;
  /** The sample content the wireframe halves were given (null: none arrived in time). */
  samples: string[] | null;
  polish: PolishLog | null;
  /** The big-idea verdict with its signals (eval/audit only; the page gets the reasons alone). */
  bigIdea: BigIdeaVerdict | null;
  model: string | null;
  totalCostUsd: number;
  totalMs: number;
}

export interface BriefRunOptions {
  /** One chain for every call (single-model evals); default: the production chains per part. */
  chain?: readonly BriefModelStep[];
  /**
   * Per-call chains (eval experiments: a cheaper model for the wireframes, a
   * higher effort for the scope). A call listed here walks its own chain from
   * the start instead of `chain` / the production chain.
   */
  partChains?: Partial<Record<BriefPart, readonly BriefModelStep[]>>;
  /** Eval switches for the helper calls; default: samples on, the Uzbek copy-edit per UZ_POLISH_ENABLED. */
  samples?: boolean;
  polish?: boolean;
  deadlineMs?: number;
  /**
   * Milestones while the brief is built (the route streams them to the page).
   * Called synchronously; a throwing listener is logged and ignored, never
   * allowed to fail the brief.
   */
  onProgress?: (progress: BriefProgress) => void;
}

export interface PartSpec<T> {
  part: BriefCallPart;
  system: string;
  schema: JsonSchemaSpec;
  parse: (text: string) => Parsed<T> | null;
}

interface PartResult<T> {
  result: { value: T; model: string } | null;
  log: BriefAttemptLog[];
}

/** Text left once placeholders are removed — "[phone] [email]" is not an idea. */
function meaningfulLength(text: string): number {
  return text
    .replace(/\[(?:email|link|handle|phone|name)\]/g, '')
    .replace(/\s+/g, ' ')
    .trim().length;
}

async function attempt<T>(
  spec: PartSpec<T>,
  prompt: string,
  locale: BriefLocale,
  step: BriefModelStep,
  index: number,
  timeout: number
): Promise<{ entry: BriefAttemptLog; parsed: Parsed<T> | null; model: string }> {
  const calls: AiAttempt[] = [];
  const res = await safeGenerateJSONWithTimeout(prompt, `ai-brief-${spec.part}-${locale}`, {
    system: spec.system,
    jsonSchema: spec.schema,
    model: step.model,
    reasoningEffort: step.reasoningEffort,
    timeout,
    maxTokens: step.maxTokens,
    prefer: 'kimi',
    firstOnly: true,
    maxRetries: 0,
    onAttempt: a => calls.push(a),
  });
  const call = calls[calls.length - 1];
  const model = res?.model ?? call?.model ?? step.model;
  const parsed = res ? spec.parse(res.text) : null;
  const entry: BriefAttemptLog = {
    part: spec.part,
    step: index,
    model,
    ms: call?.ms ?? 0,
    ok: !!res,
    error: call?.error ?? (res ? undefined : 'no response'),
    finishReason: call?.finishReason,
    usage: call?.usage,
    costUsd: estimateCostUsd(model, call?.usage),
    rawText: res?.text,
    ...(res && { usable: !!parsed?.usable, parseIssues: parsed?.issues ?? ['not a JSON object'] }),
  };
  return { entry, parsed, model };
}

/**
 * One part of the brief through its model chain. Returns the first usable
 * parsed value (and its model) plus the log of every attempt.
 */
async function runPart<T>(
  spec: PartSpec<T>,
  prompt: string,
  locale: BriefLocale,
  chain: readonly BriefModelStep[],
  deadline: number,
  log: BriefAttemptLog[] = []
): Promise<PartResult<T>> {
  for (const [index, step] of chain.entries()) {
    for (let retry = 0; retry <= CONNECTION_RETRIES; retry++) {
      const remaining = deadline - Date.now() - DEADLINE_MARGIN_MS;
      if (remaining < MIN_ATTEMPT_MS) {
        log.push({ part: spec.part, step: index, model: step.model, ms: 0, ok: false, costUsd: 0, error: 'skipped: deadline' });
        return { result: null, log };
      }
      // Late in the deadline (the scope fell back): a step that cannot run its
      // full timeout yields to the faster fallback after it rather than being cut.
      if (remaining < step.timeoutMs && index < chain.length - 1) {
        log.push({ part: spec.part, step: index, model: step.model, ms: 0, ok: false, costUsd: 0, error: 'skipped: too little time left' });
        break;
      }
      const { entry, parsed, model } = await attempt(spec, prompt, locale, step, index, Math.min(step.timeoutMs, remaining));
      log.push(entry);
      if (parsed?.usable) return { result: { value: parsed.value, model }, log };

      const dropped = !entry.ok && CONNECTION_ERROR.test(entry.error ?? '');
      logger.warn(
        `Brief ${spec.part} attempt on ${step.model} ${entry.ok ? 'unusable' : `failed: ${entry.error}`}${dropped && retry < CONNECTION_RETRIES ? ' — retrying' : ''}`,
        undefined,
        LOG
      );
      if (!dropped) break;
    }
  }
  return { result: null, log };
}

/**
 * A part whose primary model has a long tail (the high-effort scope): when the
 * primary has not answered after `hedgeAfterMs`, the rest of the chain starts
 * in parallel and the first usable answer wins. A primary that fails before
 * then falls back at once, as in `runPart`.
 * Both write their attempts to `log` as they settle, so a slow loser's cost is
 * still counted if it lands before the brief is done.
 */
async function runHedgedPart<T>(
  spec: PartSpec<T>,
  prompt: string,
  locale: BriefLocale,
  chain: readonly BriefModelStep[],
  deadline: number,
  hedgeAfterMs: number,
  log: BriefAttemptLog[]
): Promise<PartResult<T>> {
  if (chain.length < 2) return runPart(spec, prompt, locale, chain, deadline, log);
  const backup = () => runPart(spec, prompt, locale, chain.slice(1), deadline, log);
  const primary = runPart(spec, prompt, locale, chain.slice(0, 1), deadline, log);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hedgeDue = new Promise<'hedge'>(resolve => {
    timer = setTimeout(() => resolve('hedge'), hedgeAfterMs);
  });
  const first = await Promise.race([primary, hedgeDue]);
  if (first !== 'hedge') {
    clearTimeout(timer);
    return first.result ? first : backup();
  }
  logger.warn(
    `Brief ${spec.part} still running on ${chain[0].model} after ${hedgeAfterMs}ms — starting the fallback in parallel`,
    undefined,
    LOG
  );
  const fallback = backup();
  const settled = await Promise.race([
    primary.then(run => ({ from: 'primary' as const, run })),
    fallback.then(run => ({ from: 'fallback' as const, run })),
  ]);
  if (settled.run.result) return settled.run;
  const other = await (settled.from === 'primary' ? fallback : primary);
  return other.result ? other : { result: null, log };
}

function failureCode(attempts: BriefAttemptLog[]): BriefErrorCode {
  if (attempts.some(a => a.ok && a.usable === false)) return 'invalid_output';
  if (attempts.some(a => /timed? ?out|timeout|deadline/i.test(a.error ?? ''))) return 'timeout';
  return 'ai_unavailable';
}

interface CoreParts {
  scope: BriefScope;
  mapped: MappedScope;
  adjustments: string[];
  phases?: BriefNarrative['phases'];
  /** A very large idea: the reasons it gets a discovery call instead of a price (`bigIdea.ts`); null = priced. */
  discovery?: BigIdeaReason[] | null;
}

interface BriefParts extends CoreParts {
  narrative: BriefNarrative;
  screens: WireframeScreen[];
  models: AiBrief['models'];
}

/**
 * Everything the engine and the scope fix — the same object streams early as
 * the preview and ends up in the brief. A very large idea keeps its plan but
 * loses every number (`toDiscoveryEstimate`).
 */
function briefCore({ scope, mapped, adjustments, phases, discovery }: CoreParts, locale: BriefLocale): BriefPreview {
  const engine = buildEstimate(scope, mapped, locale, phases);
  const withRuleNotes = { ...engine, adjustments: [...adjustments, ...engine.adjustments] };
  const estimate = discovery?.length ? toDiscoveryEstimate(withRuleNotes, discovery) : withRuleNotes;
  // Only items the engine actually priced; anything it had to drop is listed
  // as not priced instead of being shown as included.
  const pricedFeatures = new Set(mapped.full.features);
  const pricedIntegrations = new Set(mapped.full.integrations);
  return {
    locale,
    title: scope.title,
    summary: scope.summary,
    audience: scope.audience,
    roles: scope.roles,
    features: scope.features.filter(f => pricedFeatures.has(f.id)).map(f => ({ ...f, labelKey: `feature.${f.id}` })),
    integrations: scope.integrations.filter(i => pricedIntegrations.has(i.id)).map(i => ({ ...i, labelKey: `integration.${i.id}` })),
    stack: scope.stack.map(id => ({ id, label: TECH_BY_ID.get(id)?.label ?? id })),
    complexityFlags: scope.complexityFlags,
    estimate,
    policy: scope.policy,
  };
}

function buildBrief(parts: BriefParts, locale: BriefLocale): AiBrief {
  const { scope, narrative, screens, models } = parts;
  const { buildFirst, canWait, risks, questions } = narrative;
  return {
    version: 1,
    model: models.scope,
    models,
    ...briefCore({ ...parts, phases: narrative.phases }, locale),
    screens,
    narrative: { buildFirst, canWait, risks, questions, assumptions: scope.assumptions },
  };
}

/** Report a milestone without ever letting the listener break the pipeline. */
function notify(listener: BriefRunOptions['onProgress'], progress: BriefProgress): void {
  if (!listener) return;
  try {
    listener(progress);
  } catch (error) {
    logger.warn(`Brief progress listener failed at ${progress.stage}`, error instanceof Error ? error.message : undefined, LOG);
  }
}

/**
 * The chain a call walks: an explicit per-part chain from its start; otherwise
 * `chain` or the production chain — from `startModel` when the scope found the
 * primary model unavailable (no point retrying a model that is down; a scope
 * that merely timed out at high effort says nothing about the later calls).
 */
function chainFor(part: BriefPart, options: BriefRunOptions, startModel?: string, idea = ''): readonly BriefModelStep[] {
  const explicit = options.partChains?.[part];
  if (explicit) return explicit;
  const production = part === 'scope' && idea.length > LONG_IDEA_CHARS ? LONG_IDEA_SCOPE_CHAIN : BRIEF_PART_CHAINS[part];
  const chain = options.chain ?? production;
  if (!startModel) return chain;
  const from = chain.findIndex(s => s.model === startModel);
  return from > 0 ? chain.slice(from) : chain;
}

/** The model the later calls start from: the scope's model only when the primary failed without timing out. */
function laterStartModel(log: BriefAttemptLog[], scopeModel: string): string | undefined {
  const primary = log.filter(a => a.model !== scopeModel);
  const down = primary.length > 0 && primary.every(a => !a.ok && !/timed? ?out|timeout/i.test(a.error ?? ''));
  return down ? scopeModel : undefined;
}

/**
 * Merge the two wireframe halves (one price per sample item across them);
 * without the main user's half, or with too few screens, there are no wireframes.
 */
export function screensOf(main: WireframeScreen[] | null, rest: WireframeScreen[] | null, issues: string[] = []): WireframeScreen[] {
  if (!main) return [];
  const merged = mergeScreenParts(main, rest ?? [], issues);
  return merged.length >= CAPS.screensMin ? harmonizeSamplePrices(merged, issues) : [];
}

/**
 * The scope after the deterministic rules, priced by the engine, with its
 * visible text guarded — what calls 2–5 are written against. Pure (no model
 * call), so the eval harness can replay saved model answers through it.
 */
export interface PricedStage {
  /** The scope as the rules left it (before the text guard) — the "before" side of the consistency report. */
  ruledScope: BriefScope;
  /** The scope with contradicting summary, audience and assumption text dropped. */
  scope: BriefScope;
  mapped: MappedScope;
  adjustments: string[];
  priced: PricedScope;
  source: ViewSource;
  removed: string[];
  /** Very large idea or not — from the idea's words and the engine's numbers, never the model (`bigIdea.ts`). */
  bigIdea: BigIdeaVerdict;
}

export function priceScope(modelScope: BriefScope, idea: string, locale: BriefLocale): PricedStage {
  const { scope: ruledScope, adjustments: ruleNotes } = reconcileScope(modelScope, idea, locale);
  const mapped = mapScopeToInputs(ruledScope, locale);
  const priced = pricedScopeOf(ruledScope, mapped, locale);
  const bigIdea = assessBigIdea(idea, engineSize(mapped));
  // The note names the reasons only: an engine-size signal carries hours, and a discovery brief carries no number.
  const adjustments = bigIdea.isBig ? [...ruleNotes, `big idea → discovery call, no price (${bigIdea.reasons.join(', ')})`] : ruleNotes;
  const { integrations, estimate } = briefCore({ scope: ruledScope, mapped, adjustments }, locale);
  const source: ViewSource = {
    locale,
    title: ruledScope.title,
    roles: ruledScope.roles,
    integrations,
    languages: estimate.config.languages,
    platforms: estimate.config.platforms,
  };
  const guarded = guardScopeText(ruledScope, source, priced);
  return { ruledScope, scope: guarded.value, mapped, adjustments, priced, source, removed: guarded.removed, bigIdea };
}

/** The discovery reasons of a stage (null: a normal, priced brief). */
const discoveryOf = (stage: Pick<PricedStage, 'bigIdea'>) => (stage.bigIdea.isBig ? stage.bigIdea.reasons : null);

/** The preview that streams once the scope is priced. */
export function previewOf(stage: PricedStage, locale: BriefLocale): BriefPreview {
  return briefCore({ scope: stage.scope, mapped: stage.mapped, adjustments: stage.adjustments, discovery: discoveryOf(stage) }, locale);
}

/** Calls 2–5 as specs: system prompt, schema and the parser that checks each answer against the priced scope. */
export function laterPartSpecs(scoped: NarrativeContext, locale: BriefLocale) {
  const screensSystem = buildScreensSystemPrompt(locale);
  return {
    plan: {
      part: 'plan',
      system: buildPlanSystemPrompt(locale),
      schema: PLAN_JSON_SCHEMA,
      parse: (t: string) => parsePlanJson(t, scoped),
    } satisfies PartSpec<BriefPlan>,
    risks: {
      part: 'risks',
      system: buildRisksSystemPrompt(locale),
      schema: RISKS_JSON_SCHEMA,
      parse: (t: string) => parseRisksJson(t, scoped),
    } satisfies PartSpec<BriefRisks>,
    screensMain: {
      part: 'screensMain',
      system: screensSystem,
      schema: SCREENS_JSON_SCHEMA,
      parse: (t: string) => parseScreensJson(t, { ...scoped, minScreens: MAIN_SCREENS_MIN, allowLater: false }),
    } satisfies PartSpec<WireframeScreen[]>,
    screensRest: {
      part: 'screensRest',
      system: screensSystem,
      schema: SCREENS_JSON_SCHEMA,
      parse: (t: string) => parseScreensJson(t, { ...scoped, minScreens: REST_SCREENS_MIN }),
    } satisfies PartSpec<WireframeScreen[]>,
  };
}

/** The sample-content call (in parallel with the scope). */
export function samplesSpec(ctx: TextContext, locale: BriefLocale): PartSpec<string[]> {
  return { part: 'samples', system: buildSamplesSystemPrompt(locale), schema: SAMPLES_JSON_SCHEMA, parse: t => parseSamplesJson(t, ctx) };
}

/** One Uzbek copy-edit call over the given strings. */
export function polishSpec(part: Extract<AuxPart, `polish${string}`>, texts: readonly string[]): PartSpec<Map<string, string>> {
  return { part, system: buildPolishSystemPrompt(), schema: POLISH_JSON_SCHEMA, parse: t => parsePolishJson(t, texts) };
}

/**
 * The finished brief from the priced stage and the parsed answers of calls
 * 2–5: the MVP narrative and wireframes guarded against the priced scope, and
 * the consistency report of the unguarded brief for the audit log. Pure.
 */
export function assembleBrief(
  stage: PricedStage,
  narrative: BriefNarrative,
  screens: WireframeScreen[],
  models: AiBrief['models'],
  locale: BriefLocale
): { brief: AiBrief; guard: BriefGuardLog } {
  const { ruledScope, scope, mapped, adjustments, priced, source } = stage;
  const discovery = discoveryOf(stage);
  const rawBrief = buildBrief({ scope: ruledScope, mapped, narrative, screens, adjustments, models, discovery }, locale);
  const finalGuard = guardBriefText(
    buildBrief({ scope, mapped, narrative, screens, adjustments, models, discovery }, locale),
    priced,
    source
  );
  const before = checkBriefConsistency(rawBrief, priced);
  return {
    brief: finalGuard.value,
    guard: {
      removed: [...stage.removed, ...finalGuard.removed],
      before: { errors: before.errors, warnings: before.warnings, kinds: before.violations.map(v => v.kind) },
    },
  };
}

export async function runBrief(request: { idea: string; locale: BriefLocale }, options: BriefRunOptions = {}): Promise<BriefRun> {
  const startedAt = Date.now();
  const deadline = startedAt + (options.deadlineMs ?? BRIEF_DEADLINE_MS);
  const { locale } = request;

  const prepared = prepareIdea(request.idea);
  const scrubbed = scrubContactDetails(prepared.text);
  const attempts: BriefAttemptLog[] = [];

  const finish = (
    outcome: BriefOutcome,
    extra: Partial<Pick<BriefRun, 'scope' | 'priced' | 'model' | 'guard' | 'samples' | 'polish' | 'bigIdea'>> = {}
  ): BriefRun => ({
    outcome,
    scrubbedIdea: scrubbed.text,
    truncated: prepared.truncated,
    redactions: scrubbed.redactions,
    // A copy: a hedged call that lost may still land in `attempts` later.
    attempts: [...attempts],
    scope: extra.scope ?? null,
    priced: extra.priced ?? null,
    guard: extra.guard ?? null,
    samples: extra.samples ?? null,
    polish: extra.polish ?? null,
    bigIdea: extra.bigIdea ?? null,
    model: extra.model ?? null,
    totalCostUsd: attempts.reduce((sum, a) => sum + a.costUsd, 0),
    totalMs: Date.now() - startedAt,
  });

  if (meaningfulLength(scrubbed.text) < MIN_IDEA_CHARS) return finish({ status: 'rejected', reason: 'too_short' });
  if (!configuredProviders().includes('kimi')) {
    logger.warn('AI brief requested but no Kimi key is configured', undefined, LOG);
    return finish({ status: 'error', code: 'ai_unavailable' });
  }

  const ctx: TextContext = { locale, idea: scrubbed.text, avoidNames: scrubbed.nameWords };
  const ideaPrompt = buildUserPrompt(scrubbed.text, locale, prepared.truncated);

  // Sample content for the wireframes, in parallel with the scope (never awaited past a short grace).
  const samplesRun =
    options.samples === false ? null : runPart(samplesSpec(ctx, locale), ideaPrompt, locale, SAMPLES_CHAIN, deadline, attempts);
  const samplesNow = async (): Promise<string[] | null> => {
    if (!samplesRun) return null;
    const run = await Promise.race([samplesRun, delay(SAMPLES_GRACE_MS)]);
    return run?.result?.value ?? null;
  };

  // Call 1 — scope (its attempts land straight in `attempts`, a hedged loser's included).
  const scopeRun = await runHedgedPart(
    { part: 'scope', system: buildScopeSystemPrompt(locale), schema: SCOPE_JSON_SCHEMA, parse: t => parseScopeJson(t, ctx) },
    ideaPrompt,
    locale,
    chainFor('scope', options, undefined, scrubbed.text),
    deadline,
    SCOPE_HEDGE_MS,
    attempts
  );
  if (!scopeRun.result) {
    await samplesNow(); // its cost belongs to this brief
    return finish({ status: 'error', code: failureCode(attempts.filter(a => a.part === 'scope')) });
  }

  const { value: modelScope, model: scopeModel } = scopeRun.result;
  if (isRejected(modelScope) || isPolicyDecline(modelScope)) await samplesNow();
  if (isRejected(modelScope))
    return finish({ status: 'rejected', reason: rejectionReason(modelScope) }, { scope: modelScope, model: scopeModel });
  if (isPolicyDecline(modelScope)) {
    return finish(
      { status: 'declined_policy', topics: modelScope.policy.topics, note: modelScope.policy.note },
      { scope: modelScope, model: scopeModel }
    );
  }

  // Rules, then the engine prices the final scope, then the scope text is guarded against it.
  const stage = priceScope(modelScope, scrubbed.text, locale);
  const { scope, priced } = stage;
  notify(options.onProgress, { stage: 'scoped', preview: previewOf(stage, locale) });

  // The Uzbek copy-edit: each part's strings, as soon as that part is final.
  const polishLog: PolishLog = {};
  const polishing = locale === 'uz' && (options.polish ?? UZ_POLISH_ENABLED);
  const polish = <T>(part: Extract<AuxPart, `polish${string}`>, value: T, map: TextMapper<T>): Promise<T> =>
    polishing ? polishValue(part, value, map, scrubbed.text, deadline, attempts, polishLog) : Promise.resolve(value);
  const scopePolished = polish('polishScope', scope, mapScopeTexts);

  // Calls 2–5, in parallel (each walks its chain; its attempts land straight in `attempts`).
  const samples = SAMPLE_PRODUCTS[scope.product.projectType]?.includes(scope.product.subtype) ? await samplesNow() : null;
  const specs = laterPartSpecs({ ...ctx, priced }, locale);
  const userPrompt = (part?: string) =>
    buildScopedUserPrompt(scrubbed.text, locale, scope, priced, prepared.truncated, part, samples ?? [], stage.bigIdea.isBig);
  const parts = screenParts(scope, priced);
  const startModel = laterStartModel(
    attempts.filter(a => a.part === 'scope'),
    scopeModel
  );
  const run = <T>(spec: PartSpec<T>, prompt: string) =>
    runHedgedPart(spec, prompt, locale, chainFor(spec.part as BriefPart, options, startModel), deadline, LATER_HEDGE_MS, attempts);

  // Each narrative part is copy-edited as soon as it is back (the two edits overlap the other calls).
  const planDone = run(specs.plan, userPrompt()).then(async plan =>
    plan.result ? { value: await polish('polishPlan', plan.result.value, mapPlanTexts), model: plan.result.model } : null
  );
  const risksDone = run(specs.risks, userPrompt()).then(async risks =>
    risks.result ? await polish('polishRisks', risks.result.value, mapRisksTexts) : null
  );
  const narrativeDone = Promise.all([planDone, risksDone]).then(([plan, risks]) => {
    if (!plan || !risks) return null;
    notify(options.onProgress, { stage: 'narrative' });
    return { parts: { plan: plan.value, risks }, model: plan.model };
  });
  const screensDone = Promise.all([run(specs.screensMain, userPrompt(parts.main)), run(specs.screensRest, userPrompt(parts.rest))]).then(
    async ([main, rest]) => {
      const merged = screensOf(main.result?.value ?? null, rest.result?.value ?? null);
      if (merged.length) notify(options.onProgress, { stage: 'screens', screens: merged });
      return {
        screens: merged.length ? await polish('polishScreens', merged, mapScreensTexts) : merged,
        model: main.result?.model ?? null,
      };
    }
  );
  const [narrativeParts, screensPart, polishedScope] = await Promise.all([narrativeDone, screensDone, scopePolished]);

  if (!narrativeParts) {
    const failed = attempts.filter(a => a.part === 'plan' || a.part === 'risks');
    return finish({ status: 'error', code: failureCode(failed) }, { scope, priced, model: scopeModel, samples, bigIdea: stage.bigIdea });
  }
  const { screens } = screensPart;
  if (!screens.length) logger.warn('Brief screens unavailable; returning the brief without wireframes', undefined, LOG);

  const narrative: BriefNarrative = { ...narrativeParts.parts.plan, ...narrativeParts.parts.risks };
  const models: AiBrief['models'] = { scope: scopeModel, narrative: narrativeParts.model, screens: screensPart.model };
  const { brief, guard } = assembleBrief({ ...stage, scope: polishedScope }, narrative, screens, models, locale);
  if (guard.removed.length) logger.info(`Brief consistency guard dropped ${guard.removed.length} text(s)`, undefined, LOG);
  return finish(
    { status: 'ok', brief },
    { scope: polishedScope, priced, model: scopeModel, guard, samples, polish: polishing ? polishLog : null, bigIdea: stage.bigIdea }
  );
}

/** How long the scope waits for the sample content once it is itself done (the samples call usually finished long before). */
const SAMPLES_GRACE_MS = 2_000;
const delay = (ms: number) => new Promise<null>(resolve => setTimeout(() => resolve(null), ms));

/**
 * One Uzbek copy-edit: the value's distinct strings to the copy editor in
 * parallel chunks, the accepted fixes applied (and recorded in `log`). Any
 * failure keeps the strings it covered as they were.
 */
async function polishValue<T>(
  part: Extract<AuxPart, `polish${string}`>,
  value: T,
  map: TextMapper<T>,
  idea: string,
  deadline: number,
  attempts: BriefAttemptLog[],
  log: PolishLog
): Promise<T> {
  const texts = collectTexts(value, map);
  if (texts.length === 0) return value;
  // Balanced chunks in parallel: a chunk that fails or times out keeps its strings as they were.
  const runs = await Promise.all(
    chunkTexts(texts).map(chunk =>
      runPart(polishSpec(part, chunk), buildPolishUserPrompt(idea, chunk), 'uz', POLISH_CHAIN, deadline, attempts)
    )
  );
  const fixes = new Map(runs.flatMap(run => Array.from(run.result?.value ?? new Map<string, string>())));
  if (!fixes.size) return value;
  log[part] = Array.from(fixes.entries());
  return applyFixes(value, map, fixes);
}
