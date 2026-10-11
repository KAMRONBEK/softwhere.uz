import OpenAI from 'openai';
import { logger } from './logger';

const CONTEXT = 'AI';
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 2;
// Kimi K2.6 sampling is fixed by the API (temperature 0.6 non-thinking, top_p
// 0.95); non-default values are rejected, so tuned temperatures apply to the
// DeepSeek path only. DeepSeek's own docs recommend ~1.3-1.5 for prose and
// ~1.0 for analysis/JSON.
const KIMI_TEMPERATURE = 0.6;
const DEFAULT_TEMPERATURE = 0.6;
// Blog bodies get a deliberately generous completion budget: the previous
// 8000 hard cap was itself what truncated live UZ posts mid-word. Verified
// July 2026: Kimi K2.6 allows up to ~256K-minus-prompt output and DeepSeek V4
// (flash and pro) up to 384K, so 32K costs nothing extra unless used and no
// realistic post ever hits it. Env-overridable.
const BLOG_MAX_TOKENS = Number(process.env.BLOG_MAX_TOKENS) || 32_000;
// Server-side $web_search rounds are bounded so a runaway tool loop can't
// spend unbounded searches ($0.005 each) or wall-clock.
const MAX_SEARCH_ROUNDS = 6;

/**
 * Provider config. Primary = Kimi K2.6 (Moonshot, OpenAI-compatible — note the
 * international host api.moonshot.ai/v1; the .cn host 401s foreign keys).
 * Fallback = DeepSeek. Everything is env-overridable so switching providers is
 * one env var. If only one key is set, that provider is used alone.
 */
interface Provider {
  name: string;
  baseURL: string;
  apiKey?: string;
  model: string;
}

const KIMI: Provider = {
  name: 'kimi',
  baseURL: process.env.AI_BASE_URL || 'https://api.moonshot.ai/v1',
  apiKey: process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY,
  model: process.env.AI_MODEL || 'kimi-k2.6',
};

const DEEPSEEK: Provider = {
  name: 'deepseek',
  baseURL: process.env.AI_FALLBACK_BASE_URL || 'https://api.deepseek.com',
  // The legacy 'deepseek-chat' alias is discontinued in late July 2026;
  // 'deepseek-v4-flash' is what it currently maps to (launched 2026-04-24).
  apiKey: process.env.DEEPSEEK_API_KEY,
  // V4 Pro everywhere (owner decision 2026-07: best quality, cost is
  // negligible at ~$0.87/M output post-May price cut). Set AI_FALLBACK_MODEL
  // to 'deepseek-v4-flash' to trade quality for latency again.
  model: process.env.AI_FALLBACK_MODEL || 'deepseek-v4-pro',
};

/** Configured providers in preference order (Kimi, then DeepSeek by default).
 *  `prefer` moves the named provider to the front when it is configured —
 *  used e.g. to route Uzbek content to DeepSeek, which scores markedly higher
 *  than Kimi on Uzbek benchmarks (UzLiB 0.709 vs 0.518). */
function providerChain(prefer?: ProviderName): Provider[] {
  const chain = [KIMI, DEEPSEEK].filter(p => !!p.apiKey);
  if (prefer) chain.sort((a, b) => (a.name === prefer ? -1 : 0) - (b.name === prefer ? -1 : 0));
  return chain;
}

export type ProviderName = 'kimi' | 'deepseek';

const clients = new Map<string, OpenAI>();
function clientFor(p: Provider): OpenAI {
  let c = clients.get(p.name);
  if (!c) {
    c = new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey });
    clients.set(p.name, c);
  }
  return c;
}

// Per-provider quota cooldown so a rate-limited Kimi doesn't block DeepSeek.
const cooldownUntil = new Map<string, number>();
const isCooled = (name: string) => Date.now() < (cooldownUntil.get(name) ?? 0);

export const aiStats = {
  callAttempts: 0,
  quotaBlocked: 0,
  fallbackUsed: 0,
};

export function isQuotaBlocked(): boolean {
  const chain = providerChain();
  return chain.length > 0 && chain.every(p => isCooled(p.name));
}

/** Names of providers that have an API key configured, in chain order. */
export function configuredProviders(): ProviderName[] {
  return providerChain().map(p => p.name as ProviderName);
}

/** A provider account's remaining prepaid balance (admin page). */
export interface ProviderBalance {
  currency: string;
  amount: number;
}

const BALANCE_TIMEOUT_MS = 8_000;

/** Kimi: GET /users/me/balance → { data: { available_balance } } (USD on the international platform). */
function readKimiBalance(body: unknown): ProviderBalance | null {
  const amount = (body as { data?: { available_balance?: unknown } })?.data?.available_balance;
  return typeof amount === 'number' ? { currency: 'USD', amount } : null;
}

/** DeepSeek: GET /user/balance → { balance_infos: [{ currency, total_balance: "8.36" }] }. */
function readDeepSeekBalance(body: unknown): ProviderBalance | null {
  const info = (body as { balance_infos?: { currency?: unknown; total_balance?: unknown }[] })?.balance_infos?.[0];
  const amount = Number(info?.total_balance);
  return info && Number.isFinite(amount) ? { currency: String(info.currency ?? 'USD'), amount } : null;
}

async function fetchBalance(p: Provider, path: string, read: (body: unknown) => ProviderBalance | null): Promise<ProviderBalance | null> {
  if (!p.apiKey) return null;
  try {
    const res = await fetch(`${p.baseURL.replace(/\/$/, '')}${path}`, {
      headers: { Authorization: `Bearer ${p.apiKey}` },
      signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return read(await res.json());
  } catch (error) {
    logger.warn(`${p.name} balance unavailable`, error instanceof Error ? error.message : error, 'AI');
    return null;
  }
}

/** The remaining balance of each provider account; null = no key, or the provider did not answer. */
export async function getProviderBalances(): Promise<Record<ProviderName, ProviderBalance | null>> {
  const [kimi, deepseek] = await Promise.all([
    fetchBalance(KIMI, '/users/me/balance', readKimiBalance),
    fetchBalance(DEEPSEEK, '/user/balance', readDeepSeekBalance),
  ]);
  return { kimi, deepseek };
}

export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  if (err.status === 429) return true;
  const msg = String(err.message || '');
  return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota');
}

function extractRetryMs(error: unknown): number {
  try {
    const msg = String((error as Record<string, unknown>).message || '');
    const match = msg.match(/retry in (\d+(?:\.\d+)?)/i);
    if (match) return Math.ceil(parseFloat(match[1])) * 1000;
  } catch {
    /* ignore parsing errors */
  }
  return DEFAULT_COOLDOWN_MS;
}

export function recordQuotaCooldown(delayMs?: number): void {
  const delay = delayMs ?? DEFAULT_COOLDOWN_MS;
  for (const p of providerChain()) cooldownUntil.set(p.name, Date.now() + delay);
  logger.warn(`Quota cooldown set for ${Math.round(delay / 1000)}s`, undefined, CONTEXT);
}

/**
 * Light markdown cleanup for generated bodies. Collapses excessive whitespace
 * — but never inside fenced code blocks, where indentation is meaningful.
 * (The previous version rewrote lines whose ')' outnumbered '(' — that silently
 * corrupted real prose/citations, so it was removed.)
 */
function sanitizeContent(text: string): string {
  const cleaned = text
    .replace(/[\\\s]+$/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/^(#{1,6}\s.*)\n{3,}/gm, '$1\n\n')
    .trim();
  // Collapse 3+ spaces only outside ``` fences.
  return cleaned
    .split(/(```[\s\S]*?```)/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/ {3,}/g, ' ')))
    .join('');
}

/**
 * Kimi K3 thinks on every call; `reasoning_effort` ('low' | 'high' | 'max',
 * API default 'max') sets how hard. Verified live 2026-10: in thinking mode K3
 * accepts only temperature 1 (0.6 → 400), so the temperature is omitted and the
 * API applies its fixed value. K2.x models ignore an effort and keep the
 * historical non-thinking params.
 */
export type ReasoningEffort = 'low' | 'high' | 'max';
export type KimiReasoningEffort = ReasoningEffort;

/**
 * DeepSeek V4 (deepseek-v4-pro, deepseek-flash) is a hybrid model: thinking is
 * ON by default at effort 'high' (api-docs.deepseek.com/guides/thinking_mode,
 * checked 2026-10). `thinking: {type}` switches it, a top-level
 * `reasoning_effort` ('low' | 'high' | 'max') sets its depth; temperature is
 * ignored while thinking. 'off' disables it (temperature applies again).
 */
export type DeepSeekThinking = ReasoningEffort | 'off';

/**
 * Sampling/thinking params for one DeepSeek request. Without an explicit
 * `thinking` this is exactly what every DeepSeek call has always sent (the
 * temperature alone — the API's default thinking applies), so the blog
 * callers are unaffected.
 */
export function deepseekRequestParams(thinking: DeepSeekThinking | undefined, temperature: number): Record<string, unknown> {
  if (!thinking) return { temperature };
  if (thinking === 'off') return { thinking: { type: 'disabled' }, temperature };
  return { thinking: { type: 'enabled' }, reasoning_effort: thinking };
}

/** The provider that serves a model id ('deepseek-…' → deepseek, 'kimi-…'/'moonshot-…' → kimi); undefined when unknown. */
export function providerOfModel(model: string | undefined): ProviderName | undefined {
  if (!model) return undefined;
  if (/^deepseek-/i.test(model)) return 'deepseek';
  if (/^(kimi|moonshot)-/i.test(model)) return 'kimi';
  return undefined;
}

const REASONING_EFFORT_MODEL = /^kimi-k3/;

/**
 * Sampling/thinking params for one Kimi request. With no effort this is
 * exactly what every Kimi call has always sent (temperature 0.6 + thinking
 * disabled — kimi-k2.6 400s otherwise), so existing callers are unaffected.
 */
export function kimiRequestParams(model: string, effort?: KimiReasoningEffort): Record<string, unknown> {
  if (effort && REASONING_EFFORT_MODEL.test(model)) return { reasoning_effort: effort };
  return { temperature: KIMI_TEMPERATURE, thinking: { type: 'disabled' } };
}

/** Token usage of one completion (reasoning tokens are included in `completionTokens`). */
export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
}

/**
 * List prices, USD per 1M tokens. Used for spend caps and eval reports, not
 * billing.
 *  - Kimi (platform.kimi.ai pricing page, checked 2026-10): cache hits are
 *    billed lower but priced as misses here, so a Kimi estimate is a
 *    deliberate upper bound.
 *  - DeepSeek (api-docs.deepseek.com/quick_start/pricing, checked 2026-10-11):
 *    PEAK prices below, i.e. DOUBLE the off-peak price (`isDeepSeekPeak`);
 *    `cacheHit` is the cache-hit input price. Reasoning tokens bill as output.
 *    Each DeepSeek price is the list price × DEEPSEEK_PRICE_MARGIN: the
 *    2026-10-11 eval runs' balance moved ~20% more than their estimate (the
 *    reasoning/caching split and the peak hours are hard to predict), and a
 *    spend cap must not run low.
 */
interface ModelPrice {
  input: number;
  output: number;
  /** Cache-hit input price; absent = hits priced as misses (upper bound). */
  cacheHit?: number;
  /** Price is halved outside `isDeepSeekPeak` hours. */
  offPeakHalf?: boolean;
}
export const DEEPSEEK_PRICE_MARGIN = 1.2;
const deepseekPrice = (input: number, output: number, cacheHit: number): ModelPrice => ({
  input: input * DEEPSEEK_PRICE_MARGIN,
  output: output * DEEPSEEK_PRICE_MARGIN,
  cacheHit: cacheHit * DEEPSEEK_PRICE_MARGIN,
  offPeakHalf: true,
});
const PRICE_PER_M: Record<string, ModelPrice> = {
  'kimi-k3': { input: 3, output: 15 },
  'kimi-k2.6': { input: 0.95, output: 4 },
  'kimi-k2.7-code': { input: 0.95, output: 4 },
  'deepseek-v4-pro': deepseekPrice(1.32, 3.96, 0.044),
  'deepseek-flash': deepseekPrice(0.3, 1.2, 0.006),
  // Legacy alias, served and billed as deepseek-flash (V4.1-Flash).
  'deepseek-v4-flash': deepseekPrice(0.3, 1.2, 0.006),
};
const UNKNOWN_MODEL_PRICE = PRICE_PER_M['kimi-k3'];

/**
 * DeepSeek peak hours: 01:00–04:00 and 06:00–10:00 UTC, Monday–Friday;
 * everything else is off-peak at half price. Chinese public holidays are
 * off-peak too but are NOT modelled (a holiday is priced as peak — upper bound).
 */
export function isDeepSeekPeak(at: Date): boolean {
  const day = at.getUTCDay();
  if (day === 0 || day === 6) return false;
  const h = at.getUTCHours();
  return (h >= 1 && h < 4) || (h >= 6 && h < 10);
}

/**
 * Estimated USD cost of one completion. `at` = when the call ran: DeepSeek is
 * priced at that hour's rate (peak or off-peak); without it at peak (upper
 * bound). Cache-hit input is priced at the cache rate where the list has one.
 */
export function estimateCostUsd(model: string, usage: AiUsage | null | undefined, at?: Date): number {
  if (!usage) return 0;
  const price = PRICE_PER_M[model] ?? UNKNOWN_MODEL_PRICE;
  const hits = price.cacheHit === undefined ? 0 : Math.min(usage.cachedTokens, usage.promptTokens);
  const full =
    ((usage.promptTokens - hits) * price.input + hits * (price.cacheHit ?? 0) + usage.completionTokens * price.output) / 1_000_000;
  return price.offPeakHalf && at && !isDeepSeekPeak(at) ? full / 2 : full;
}

export function readUsage(raw: unknown): AiUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const completionDetails = (u.completion_tokens_details ?? {}) as Record<string, unknown>;
  const promptDetails = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
  return {
    promptTokens: num(u.prompt_tokens),
    completionTokens: num(u.completion_tokens),
    reasoningTokens: num(completionDetails.reasoning_tokens),
    // DeepSeek reports hits as `prompt_cache_hit_tokens` (its details field reads 0).
    cachedTokens: num(promptDetails.cached_tokens) || num(u.prompt_cache_hit_tokens) || num(u.cached_tokens),
  };
}

/** One provider attempt, reported through `onAttempt` (evals, spend accounting). */
export interface AiAttempt {
  provider: string;
  model: string;
  ms: number;
  /** Epoch ms the request was sent (DeepSeek's price depends on the hour). */
  startedAt?: number;
  ok: boolean;
  finishReason?: string | null;
  usage?: AiUsage | null;
  /** Error message only — never the request. */
  error?: string;
}

/** Strict structured-output schema (Kimi `response_format: json_schema`).
 *  Must conform to MFJS (Moonshot-flavored JSON Schema): explicit `type` on
 *  every property, no oneOf/allOf/format. DeepSeek doesn't support it, so the
 *  provider chain degrades to plain json_object there — describe the fields in
 *  the prompt too. */
export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

interface GenOptions {
  system?: string;
  json?: boolean;
  /** Takes precedence over `json` on providers that support strict schemas (Kimi). */
  jsonSchema?: JsonSchemaSpec;
  maxTokens?: number;
  /** Applied to DeepSeek only — Kimi K2.6 rejects non-default sampling. */
  temperature?: number;
  timeout?: number;
  attempts?: number;
  firstOnly?: boolean;
  /** Try this provider first (falls back to the rest of the chain). */
  prefer?: ProviderName;
  /**
   * Model override, applied to the provider that serves it (`providerOfModel`;
   * an unknown id counts as Kimi's): 'kimi-k3' overrides Kimi only,
   * 'deepseek-flash' DeepSeek only. Other providers keep their configured model.
   */
  model?: string;
  /** Use ONLY this provider (no fallback to another provider; null when it has no key). */
  provider?: ProviderName;
  /**
   * Thinking depth. Kimi: K3 only (see `kimiRequestParams`; 'off' = no effort).
   * DeepSeek: see `deepseekRequestParams` — absent keeps the API default.
   */
  reasoningEffort?: DeepSeekThinking;
  /** Called once per provider attempt with timing/usage/error (no prompt data). */
  onAttempt?: (attempt: AiAttempt) => void;
}

/** Per-provider sampling: Kimi gets its pinned params (see `kimiRequestParams`);
 *  DeepSeek takes the requested temperature (or the conservative default). */
function samplingParamsFor(provider: Provider, model: string, opts: GenOptions): Record<string, unknown> {
  if (provider.name === 'kimi') return kimiRequestParams(model, opts.reasoningEffort === 'off' ? undefined : opts.reasoningEffort);
  return deepseekRequestParams(opts.reasoningEffort, opts.temperature ?? DEFAULT_TEMPERATURE);
}

/** The model a provider runs: the override when that provider serves it, else its configured model. */
export function modelFor(provider: { name: string; model: string }, override?: string): string {
  if (!override) return provider.model;
  return (providerOfModel(override) ?? 'kimi') === provider.name ? override : provider.model;
}

/**
 * The SDK's `timeout` stops counting once the response HEADERS arrive. DeepSeek
 * sends them at once and keeps the connection alive while it thinks, so its
 * calls ran far past their timeout (a 30 s copy-edit took 45 s; a brief blew
 * its 110 s deadline — verified live and with a local fake 2026-10-11). Its
 * calls get an abort signal covering the whole request. Kimi keeps the SDK
 * timeout alone (unchanged production behaviour; whether it streams headers
 * early is unverified).
 */
const HARD_TIMEOUT_PROVIDERS: ReadonlySet<string> = new Set(['deepseek']);

/** Only Kimi enforces a strict `json_schema`; the others get json_object. */
const STRICT_SCHEMA_PROVIDERS: ReadonlySet<string> = new Set(['kimi']);

/**
 * A provider without strict schemas (DeepSeek) never sees the schema the
 * brief's prompts refer to ("matches the provided schema"), so it is appended
 * to the system prompt: same contract, enforced afterwards by the callers'
 * validators/repair instead of by the API.
 */
export function systemPromptFor(providerName: string, system: string | undefined, jsonSchema?: JsonSchemaSpec): string | undefined {
  if (!jsonSchema || STRICT_SCHEMA_PROVIDERS.has(providerName)) return system;
  const contract = `The JSON object must conform to this JSON Schema ("${jsonSchema.name}"): every property listed is required, no other properties, string values from an "enum" copied exactly.\n${JSON.stringify(jsonSchema.schema)}`;
  return system ? `${system}\n\n${contract}` : contract;
}

/** `response_format` for one provider: strict schema on Kimi, json_object elsewhere, none for plain text. */
export function responseFormatFor(providerName: string, opts: Pick<GenOptions, 'json' | 'jsonSchema'>): Record<string, unknown> {
  if (opts.jsonSchema && STRICT_SCHEMA_PROVIDERS.has(providerName)) {
    return {
      response_format: {
        type: 'json_schema',
        json_schema: { name: opts.jsonSchema.name, strict: true, schema: opts.jsonSchema.schema },
      },
    };
  }
  return opts.json || opts.jsonSchema ? { response_format: { type: 'json_object' } } : {};
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return String(error).slice(0, 300);
}

/**
 * Core generation: walks the provider chain (Kimi -> DeepSeek), retrying each
 * up to `attempts` times, skipping cooled providers, moving to the next
 * provider on quota/error. Returns the text (and which provider produced it)
 * or null when everything is exhausted.
 */
interface GenResult {
  text: string;
  provider: string;
  finishReason: string | null;
  /** The model that actually answered (after any override). */
  model: string;
  usage: AiUsage | null;
}

async function generate(prompt: string, label: string, opts: GenOptions): Promise<GenResult | null> {
  let providers = providerChain(opts.provider ?? opts.prefer);
  if (opts.provider) providers = providers.filter(p => p.name === opts.provider);
  if (opts.firstOnly) providers = providers.slice(0, 1);
  if (providers.length === 0) {
    aiStats.fallbackUsed++;
    return null;
  }

  const messagesFor = (p: Provider): OpenAI.ChatCompletionMessageParam[] => {
    const system = systemPromptFor(p.name, opts.system, opts.jsonSchema);
    return system
      ? [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ]
      : [{ role: 'user', content: prompt }];
  };

  const attempts = opts.attempts ?? MAX_ATTEMPTS;

  for (const p of providers) {
    if (isCooled(p.name)) {
      logger.info(`Cooldown active, skipping ${p.name}: ${label}`, undefined, CONTEXT);
      continue;
    }
    const model = modelFor(p, opts.model);
    const messages = messagesFor(p);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      aiStats.callAttempts++;
      const startedAt = Date.now();
      const timeout = opts.timeout ?? 120_000;
      const hardStop = HARD_TIMEOUT_PROVIDERS.has(p.name) ? AbortSignal.timeout(timeout) : undefined;
      try {
        // Strict schema output is Kimi-only; DeepSeek degrades to json_object (schema in the prompt).
        const responseFormat = responseFormatFor(p.name, opts);
        const completion = await clientFor(p).chat.completions.create(
          {
            model,
            messages,
            // Kimi: temperature 0.6 + thinking disabled (kimi-k2.6 defaults to
            // thinking mode, which rejects any temperature except 1, so plain
            // generation must disable it or every call 400s) — or, for K3
            // with an explicit effort, reasoning_effort and no temperature.
            // DeepSeek: see `deepseekRequestParams`.
            ...samplingParamsFor(p, model, opts),
            ...responseFormat,
            ...(opts.maxTokens && { max_tokens: opts.maxTokens }),
          } as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming,
          { timeout, maxRetries: 0, ...(hardStop && { signal: hardStop }) }
        );
        const choice = completion.choices[0];
        const text = choice?.message?.content ?? null;
        const finishReason = choice?.finish_reason ?? null;
        const usage = readUsage(completion.usage);
        opts.onAttempt?.({ provider: p.name, model, ms: Date.now() - startedAt, startedAt, ok: !!text, finishReason, usage });
        // finish_reason 'length' means the completion cap truncated the output
        // mid-stream — callers (the blog pipeline) use it to trigger a
        // continuation instead of silently publishing a cut-off post.
        if (text) return { text, provider: p.name, finishReason, model, usage };
        break; // empty response — try the next provider
      } catch (error) {
        const message = hardStop?.aborted ? `Request timed out after ${timeout}ms` : errorMessage(error);
        opts.onAttempt?.({ provider: p.name, model, ms: Date.now() - startedAt, startedAt, ok: false, error: message });
        if (isQuotaError(error)) {
          cooldownUntil.set(p.name, Date.now() + extractRetryMs(error));
          aiStats.quotaBlocked++;
          break; // quota — move to the next provider
        }
        logger.error(`${p.name} call failed (${attempt}/${attempts}): ${label}`, error, CONTEXT);
        if (attempt === attempts) break; // exhausted this provider — next one
      }
    }
  }

  aiStats.fallbackUsed++;
  return null;
}

export interface GenerateExtras {
  /** DeepSeek-only sampling temperature (Kimi's is fixed by the API). */
  temperature?: number;
  /** Provider to try first, e.g. 'deepseek' for Uzbek content. */
  prefer?: ProviderName;
}

/** Quota-aware text generation with provider fallback. Blog bodies (label
 *  starts with 'blog-') get sanitized and a generous default token budget.
 *  Returns the text, which provider produced it, and the finish reason
 *  ('length' = truncated at the completion cap). */
export async function generateContentWithProvider(
  prompt: string,
  label: string,
  maxTokens?: number,
  system?: string,
  extras?: GenerateExtras
): Promise<{ text: string; provider: string; finishReason: string | null } | null> {
  const isContent = label.startsWith('blog-');
  const res = await generate(prompt, label, {
    system,
    maxTokens: maxTokens ?? (isContent ? BLOG_MAX_TOKENS : undefined),
    // A full blog body takes K2.6 well over the default 120s (measured live);
    // short-changing the timeout fails every long draft.
    timeout: isContent ? 300_000 : undefined,
    temperature: extras?.temperature,
    prefer: extras?.prefer,
  });
  if (!res) return null;
  return isContent ? { ...res, text: sanitizeContent(res.text) } : res;
}

/** Quota-aware text generation with provider fallback (text-only shape). */
export async function safeGenerateContent(
  prompt: string,
  label: string,
  maxTokens?: number,
  system?: string,
  extras?: GenerateExtras
): Promise<string | null> {
  const res = await generateContentWithProvider(prompt, label, maxTokens, system, extras);
  return res?.text ?? null;
}

/** Quota-aware JSON generation (response_format json_object) with fallback. */
export async function safeGenerateJSON(
  prompt: string,
  label: string,
  maxTokens?: number,
  system?: string,
  extras?: GenerateExtras
): Promise<string | null> {
  const res = await generate(prompt, label, {
    system,
    json: true,
    maxTokens,
    temperature: extras?.temperature,
    prefer: extras?.prefer,
  });
  return res?.text ?? null;
}

/**
 * Grounded generation via Moonshot's server-side `$web_search` builtin tool
 * (Kimi-only; DeepSeek has no search API). Protocol per the official docs:
 * declare `{type:'builtin_function', function:{name:'$web_search'}}`, disable
 * thinking, and when the model emits a `$web_search` tool call, echo the
 * call's arguments back unchanged as the tool result — the search itself ran
 * server-side ($0.005/search). Loops until the model produces text or
 * MAX_SEARCH_ROUNDS is hit. Returns null when Kimi is unconfigured, cooled
 * down, or the loop fails — callers must degrade to ungrounded generation.
 */
export async function generateWithWebSearch(
  prompt: string,
  label: string,
  opts?: { system?: string; maxTokens?: number; timeout?: number }
): Promise<{ text: string; searches: number } | null> {
  if (!KIMI.apiKey || isCooled(KIMI.name)) {
    logger.info(`Web search unavailable (no Kimi key or cooldown): ${label}`, undefined, CONTEXT);
    return null;
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = opts?.system
    ? [
        { role: 'system', content: opts.system },
        { role: 'user', content: prompt },
      ]
    : [{ role: 'user', content: prompt }];

  let searches = 0;
  // Whether the model calls $web_search is sampled, not guaranteed — the same
  // prompt sometimes gets answered from stale memory (observed live). When
  // that happens we keep the conversation and nudge it to actually search.
  let nudges = 0;
  const MAX_NUDGES = 2;

  try {
    for (let round = 0; round <= MAX_SEARCH_ROUNDS + MAX_NUDGES; round++) {
      aiStats.callAttempts++;
      const completion = await clientFor(KIMI).chat.completions.create(
        {
          model: KIMI.model,
          messages,
          temperature: KIMI_TEMPERATURE,
          ...(opts?.maxTokens && { max_tokens: opts.maxTokens }),
          tools: [{ type: 'builtin_function', function: { name: '$web_search' } }],
          // $web_search requires thinking disabled (Moonshot docs).
          thinking: { type: 'disabled' },
        } as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming,
        { timeout: opts?.timeout ?? 120_000, maxRetries: 0 }
      );

      const choice = completion.choices[0];
      if (!choice) return null;

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
        messages.push(choice.message);
        for (const call of choice.message.tool_calls) {
          const fn = 'function' in call ? call.function : undefined;
          if (fn?.name === '$web_search') searches++;
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            // The search executed server-side; the protocol is to return the
            // tool call's arguments verbatim as the tool result.
            content: fn?.arguments ?? '{}',
          });
        }
        continue;
      }

      const text = choice.message?.content;

      if (searches === 0 && nudges < MAX_NUDGES) {
        nudges++;
        logger.info(`Model answered without searching — nudging (${nudges}/${MAX_NUDGES}): ${label}`, undefined, CONTEXT);
        messages.push(choice.message);
        messages.push({
          role: 'user',
          content:
            'You answered from memory without calling the $web_search tool. That answer is unusable. Call $web_search now and answer again using ONLY what the search results say.',
        });
        continue;
      }

      if (text) return { text, searches };
      return null;
    }
    logger.warn(`Web search loop exceeded ${MAX_SEARCH_ROUNDS} rounds: ${label}`, undefined, CONTEXT);
    return null;
  } catch (error) {
    if (isQuotaError(error)) {
      cooldownUntil.set(KIMI.name, Date.now() + extractRetryMs(error));
      aiStats.quotaBlocked++;
    }
    logger.error(`Web search generation failed: ${label}`, error, CONTEXT);
    return null;
  }
}

/**
 * JSON generation with a hard timeout — used by the estimator to keep its 60s
 * cap. Walks the provider chain (Kimi with strict json_schema when given,
 * DeepSeek degrading to json_object) unless `firstOnly`. Falls back to null on
 * timeout/failure so the caller can use its formula. Returns the provider name
 * so callers can attribute the result, plus the answering model and token
 * usage. `model` applies to the provider that serves it and `provider` pins
 * the call to one provider (the AI brief runs each step on its model's own
 * provider); `reasoningEffort` sets K3's or DeepSeek's thinking. Omitted,
 * behaviour is unchanged.
 */
export async function safeGenerateJSONWithTimeout(
  prompt: string,
  label: string,
  options?: {
    timeout?: number;
    maxRetries?: number;
    maxTokens?: number;
    system?: string;
    jsonSchema?: JsonSchemaSpec;
    prefer?: ProviderName;
    firstOnly?: boolean;
    model?: string;
    provider?: ProviderName;
    reasoningEffort?: DeepSeekThinking;
    onAttempt?: (attempt: AiAttempt) => void;
  }
): Promise<{ text: string; provider: string; model: string; usage: AiUsage | null; finishReason: string | null } | null> {
  return generate(prompt, label, {
    system: options?.system,
    json: true,
    jsonSchema: options?.jsonSchema,
    timeout: options?.timeout ?? 60_000,
    attempts: (options?.maxRetries ?? 0) + 1,
    maxTokens: options?.maxTokens,
    firstOnly: options?.firstOnly ?? true,
    prefer: options?.prefer,
    model: options?.model,
    provider: options?.provider,
    reasoningEffort: options?.reasoningEffort,
    onAttempt: options?.onAttempt,
  });
}
