import { providerOfModel, type DeepSeekThinking, type ProviderName } from '@/core/ai';
import { DS_FLASH, type BriefModelStep, type BriefPart } from '@/modules/estimator/ai-brief/constants';

/**
 * Named model-chain presets for the brief: which model (and so which
 * provider) answers each call. 'kimi' is production — the chains in
 * `constants.ts` (Kimi K3, deepseek-flash fallback). The DeepSeek presets
 * exist to compare providers (eval `--variant`); 'ds-flash' is also the
 * OVERFLOW run the route serves once the day's Kimi budget is spent
 * (`overflowRunOptions`).
 *
 * DeepSeek models (account `/models` list, 2026-10-11): 'deepseek-v4-pro'
 * (DeepSeek-V4-Pro) and 'deepseek-flash' (DeepSeek-V4.1-Flash). Both are
 * hybrid thinking models (default: thinking on at 'high'); no strict
 * json_schema, so they run json_object with the schema in the system prompt
 * and the same validators/repair as Kimi (`src/core/ai.ts`).
 */
export const BRIEF_CHAIN_PRESETS = ['kimi', 'ds-pro', 'ds-flash', 'ds-mix', 'kimi-flash'] as const;
export type BriefChainPreset = (typeof BRIEF_CHAIN_PRESETS)[number];

export const DS_PRO = 'deepseek-v4-pro';
export { DS_FLASH };

/** Every call a preset can route: the five brief parts plus the two helpers. */
export interface BriefChainSet {
  /** Per-part chains; absent = the production chain for that part. */
  partChains?: Partial<Record<BriefPart, readonly BriefModelStep[]>>;
  /** The sample-content call; absent = SAMPLES_CHAIN. */
  samplesChain?: readonly BriefModelStep[];
  /** The Uzbek copy-edit; absent = POLISH_CHAIN. */
  polishChain?: readonly BriefModelStep[];
}

/**
 * DeepSeek thinking per call: the scope, the four later parts, and the helpers
 * (sample content + Uzbek copy-edit).
 *
 * Smoke 2026-10-11 (3 cases × ds-pro/ds-flash): even 'low' effort reasons
 * 1–6k tokens a call (Kimi K3-low: ~300), at ~120–150 tok/s on v4-pro and
 * ~200–250 tok/s on flash — so thinking IS the latency. With the later parts
 * at 'low', ds-pro took 95 s p50 (one 118 s); at 'off' they answer in 3–5 s
 * with the same JSON reliability (0 unusable of 56 calls) and no consistency
 * errors. The copy-edit is the exception: without thinking it found 1–2 fixes
 * in an Uzbek brief instead of 6–11, so the helpers keep 'low'. The scope
 * keeps 'high' (where a wrong call contaminates everything after it).
 * 60-case runs + blind audit (2026-10-11): later parts at 'off' answered in
 * 3 s p50 / 5 s p90 (max 21 s) with ~1% unusable; ds-flash scored ~3.97/5
 * against Kimi's 4.37 — good enough for a fallback and the overflow.
 */
export interface DeepSeekThinkingPlan {
  scope: DeepSeekThinking;
  rest: DeepSeekThinking;
  /** Sample content + Uzbek copy-edit. */
  helpers: DeepSeekThinking;
}
export const DEFAULT_DS_THINKING: DeepSeekThinkingPlan = { scope: 'high', rest: 'off', helpers: 'low' };

/**
 * Timeouts sized like the Kimi chains (DeepSeek decodes faster; the deadline
 * is the same 110 s). Caps leave room for the reasoning tokens, which bill and
 * count as output.
 */
const DS_SCOPE_TIMEOUT_MS = 75_000;
/** A later part without thinking (max seen 21 s); with thinking it reasons 1–6k tokens first. */
const DS_LATER_FAST_TIMEOUT_MS = 20_000;
const DS_LATER_TIMEOUT_MS = 50_000;
const DS_RETRY_TIMEOUT_MS = 30_000;
const DS_HELPER_TIMEOUT_MS = 30_000;
const DS_MAX_TOKENS = 16_000;
/** A low-effort copy-edit reasoned up to 6k tokens and was cut there once (smoke 2026-10-11). */
const DS_HELPER_MAX_TOKENS = 12_000;

const dsStep = (model: string, thinking: DeepSeekThinking, timeoutMs: number, maxTokens = DS_MAX_TOKENS): BriefModelStep => ({
  model,
  reasoningEffort: thinking,
  timeoutMs,
  maxTokens,
});

export interface ChainSetOptions {
  thinking?: DeepSeekThinkingPlan;
}

/**
 * The chains of one preset, with no fallback to another provider (pure
 * single-provider runs). 'kimi' returns an empty set: the orchestrator's
 * production defaults apply unchanged. 'kimi-flash' keeps the production Kimi
 * scope and Uzbek copy-edit and moves the four later parts and the sample
 * content to deepseek-flash.
 */
export function briefChainSet(preset: BriefChainPreset, options: ChainSetOptions = {}): BriefChainSet {
  if (preset === 'kimi') return {};
  const thinking = options.thinking ?? DEFAULT_DS_THINKING;
  const scopeModel = preset === 'ds-flash' ? DS_FLASH : DS_PRO;
  const restModel = preset === 'ds-pro' ? DS_PRO : DS_FLASH;
  // A same-model retry for the later parts: without a strict schema a fast
  // no-thinking answer can be valid JSON yet unusable (smoke 2026-10-11: a
  // ds-flash plan without its growth phase failed the whole brief). The retry
  // thinks ('low' when the first step did not) — never another provider.
  const retryThinking: DeepSeekThinking = thinking.rest === 'off' ? 'low' : thinking.rest;
  const firstTimeout = thinking.rest === 'off' ? DS_LATER_FAST_TIMEOUT_MS : DS_LATER_TIMEOUT_MS;
  const later = [dsStep(restModel, thinking.rest, firstTimeout), dsStep(restModel, retryThinking, DS_RETRY_TIMEOUT_MS)];
  const laterChains = { plan: later, risks: later, screensMain: later, screensRest: later };
  // Helpers are optional (a failure keeps the brief as it was): no fallback.
  const helper = [dsStep(restModel, thinking.helpers, DS_HELPER_TIMEOUT_MS, DS_HELPER_MAX_TOKENS)];
  if (preset === 'kimi-flash') return { partChains: laterChains, samplesChain: helper };
  const partChains: Record<BriefPart, readonly BriefModelStep[]> = {
    scope: [dsStep(scopeModel, thinking.scope, DS_SCOPE_TIMEOUT_MS)],
    ...laterChains,
  };
  return { partChains, samplesChain: helper, polishChain: helper };
}

export function isBriefChainPreset(value: string | undefined): value is BriefChainPreset {
  return !!value && (BRIEF_CHAIN_PRESETS as readonly string[]).includes(value);
}

/**
 * The overflow brief: every call on deepseek-flash, served once the day's Kimi
 * spend cap is reached (`src/app/api/estimate/brief/route.ts`), never by
 * default. No Uzbek copy-edit: on flash it timed out on ~10% of chunks (p90
 * 20–30 s against Kimi's ~13 s p50), and Kimi is what the cap stopped; the
 * deterministic Uzbek fixes still apply.
 */
export function overflowRunOptions(): BriefChainSet & { polish: false } {
  const { partChains, samplesChain } = briefChainSet('ds-flash');
  return { partChains, samplesChain, polish: false };
}

/** The providers a chain needs, in order of first use. */
export function providersOf(chain: readonly BriefModelStep[]): ProviderName[] {
  return Array.from(new Set(chain.map(step => providerOfModel(step.model) ?? 'kimi')));
}

/**
 * The chain as this deployment can run it: a step whose provider has no API
 * key becomes its `ifUnavailable` step (a flash fallback turns back into
 * kimi-k2.6 without a DeepSeek key) or is dropped; consecutive steps on the
 * same model collapse into the first (flash + its thinking retry → one k2.6).
 */
export function usableChain(chain: readonly BriefModelStep[], configured: readonly ProviderName[]): BriefModelStep[] {
  const canRun = (step: BriefModelStep) => configured.includes(providerOfModel(step.model) ?? 'kimi');
  return chain
    .map(step => (canRun(step) ? step : step.ifUnavailable && canRun(step.ifUnavailable) ? step.ifUnavailable : null))
    .filter((step): step is BriefModelStep => step !== null)
    .filter((step, i, steps) => i === 0 || steps[i - 1] !== step);
}

/**
 * Who writes the briefs — the admin's switch (`/admin/ai-demo`, stored in
 * `ai_brief_settings`):
 *  - 'kimi'     — production: Kimi K3, deepseek-flash as the fallback
 *                 (blind audit 4.37/5, ~$0.05–0.26 a brief, ~40–70 s);
 *  - 'deepseek' — deepseek-flash for every call, Kimi K3 (low effort) as the
 *                 fallback when flash fails (audit ~3.97/5, ~$0.01–0.03 a
 *                 brief, ~25 s).
 * Either way the overflow lane stays on deepseek-flash.
 */
export const BRIEF_PROVIDERS = ['kimi', 'deepseek'] as const;
export type BriefProvider = (typeof BRIEF_PROVIDERS)[number];
export const DEFAULT_BRIEF_PROVIDER: BriefProvider = 'kimi';

export function isBriefProvider(value: unknown): value is BriefProvider {
  return typeof value === 'string' && (BRIEF_PROVIDERS as readonly string[]).includes(value);
}

/** Kimi as the fallback of a DeepSeek-first brief: the production later-call settings. */
const KIMI_SCOPE_FALLBACK: BriefModelStep = { model: 'kimi-k3', reasoningEffort: 'low', timeoutMs: 50_000, maxTokens: 16_000 };
const KIMI_LATER_FALLBACK: BriefModelStep = { model: 'kimi-k3', reasoningEffort: 'low', timeoutMs: 35_000, maxTokens: 8_000 };

/**
 * The chains for the admin's provider choice. 'kimi' = the production
 * defaults (an empty set). 'deepseek' = the 'ds-flash' preset (incl. the
 * flash Uzbek copy-edit it was audited with) with a Kimi step after each
 * part's flash steps; without a Kimi key `usableChain` drops that step.
 */
export function providerChainSet(provider: BriefProvider): BriefChainSet {
  if (provider === 'kimi') return {};
  const { partChains = {}, samplesChain, polishChain } = briefChainSet('ds-flash');
  const withKimi = Object.fromEntries(
    Object.entries(partChains).map(([part, chain]) => [part, [...chain, part === 'scope' ? KIMI_SCOPE_FALLBACK : KIMI_LATER_FALLBACK]])
  ) as Partial<Record<BriefPart, readonly BriefModelStep[]>>;
  return { partChains: withKimi, samplesChain, polishChain };
}
