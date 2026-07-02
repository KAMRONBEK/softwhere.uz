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
// Both Kimi and DeepSeek truncate silently at their completion cap, so blog
// bodies get a generous budget (Kimi K2.6 allows far more; DeepSeek caps 8K).
const BLOG_MAX_TOKENS = 8000;
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
  model: process.env.AI_FALLBACK_MODEL || 'deepseek-v4-flash',
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

interface GenOptions {
  system?: string;
  json?: boolean;
  maxTokens?: number;
  /** Applied to DeepSeek only — Kimi K2.6 rejects non-default sampling. */
  temperature?: number;
  timeout?: number;
  attempts?: number;
  firstOnly?: boolean;
  /** Try this provider first (falls back to the rest of the chain). */
  prefer?: ProviderName;
}

/** Per-provider temperature: Kimi is pinned to its fixed default; DeepSeek
 *  takes the requested value (or the conservative default). */
function temperatureFor(provider: Provider, requested?: number): number {
  if (provider.name === 'kimi') return KIMI_TEMPERATURE;
  return requested ?? DEFAULT_TEMPERATURE;
}

/**
 * Core generation: walks the provider chain (Kimi -> DeepSeek), retrying each
 * up to `attempts` times, skipping cooled providers, moving to the next
 * provider on quota/error. Returns the text (and which provider produced it)
 * or null when everything is exhausted.
 */
async function generate(prompt: string, label: string, opts: GenOptions): Promise<{ text: string; provider: string } | null> {
  let providers = providerChain(opts.prefer);
  if (opts.firstOnly) providers = providers.slice(0, 1);
  if (providers.length === 0) {
    aiStats.fallbackUsed++;
    return null;
  }

  const messages = opts.system
    ? ([
        { role: 'system' as const, content: opts.system },
        { role: 'user' as const, content: prompt },
      ] satisfies OpenAI.ChatCompletionMessageParam[])
    : ([{ role: 'user' as const, content: prompt }] satisfies OpenAI.ChatCompletionMessageParam[]);

  const attempts = opts.attempts ?? MAX_ATTEMPTS;

  for (const p of providers) {
    if (isCooled(p.name)) {
      logger.info(`Cooldown active, skipping ${p.name}: ${label}`, undefined, CONTEXT);
      continue;
    }
    for (let attempt = 1; attempt <= attempts; attempt++) {
      aiStats.callAttempts++;
      try {
        const completion = await clientFor(p).chat.completions.create(
          {
            model: p.model,
            messages,
            temperature: temperatureFor(p, opts.temperature),
            ...(opts.json && { response_format: { type: 'json_object' as const } }),
            ...(opts.maxTokens && { max_tokens: opts.maxTokens }),
            // kimi-k2.6 defaults to thinking mode, which rejects any
            // temperature except 1 — plain generation must disable it
            // explicitly or every Kimi call 400s.
            ...(p.name === 'kimi' && { thinking: { type: 'disabled' } }),
          } as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming,
          { timeout: opts.timeout ?? 120_000, maxRetries: 0 }
        );
        const text = completion.choices[0]?.message?.content ?? null;
        if (text) return { text, provider: p.name };
        break; // empty response — try the next provider
      } catch (error) {
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
 *  Returns the text and which provider produced it. */
export async function generateContentWithProvider(
  prompt: string,
  label: string,
  maxTokens?: number,
  system?: string,
  extras?: GenerateExtras
): Promise<{ text: string; provider: string } | null> {
  const isContent = label.startsWith('blog-');
  const res = await generate(prompt, label, {
    system,
    maxTokens: maxTokens ?? (isContent ? BLOG_MAX_TOKENS : undefined),
    // A full 8K-token body takes K2.6 well over the default 120s (measured
    // live); short-changing the timeout fails every long draft.
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
  const res = await generate(prompt, label, { system, json: true, maxTokens, temperature: extras?.temperature, prefer: extras?.prefer });
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
 * JSON generation with a hard timeout and (by default) the primary provider
 * only + a single attempt — used by the estimator to keep its 60s cap. Falls
 * back to null on timeout/failure so the caller can use its formula.
 */
export async function safeGenerateJSONWithTimeout(
  prompt: string,
  label: string,
  options?: { timeout?: number; maxRetries?: number; maxTokens?: number; system?: string }
): Promise<string | null> {
  const res = await generate(prompt, label, {
    system: options?.system,
    json: true,
    timeout: options?.timeout ?? 60_000,
    attempts: (options?.maxRetries ?? 0) + 1,
    maxTokens: options?.maxTokens,
    firstOnly: true,
  });
  return res?.text ?? null;
}
