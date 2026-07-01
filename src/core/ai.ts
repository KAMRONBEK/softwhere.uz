import OpenAI from 'openai';
import { logger } from './logger';

const CONTEXT = 'AI';
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 2;
// Moonshot recommends 0.6; DeepSeek is fine at 0.6-0.7.
const DEFAULT_TEMPERATURE = 0.6;
// Both Kimi and DeepSeek truncate silently at their completion cap, so blog
// bodies get a generous budget (Kimi K2.6 allows far more; DeepSeek V3 caps 8K).
const BLOG_MAX_TOKENS = 8000;

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
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.AI_FALLBACK_MODEL || 'deepseek-chat',
};

/** Configured providers in preference order (Kimi, then DeepSeek). */
function providerChain(): Provider[] {
  return [KIMI, DEEPSEEK].filter(p => !!p.apiKey);
}

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
 * Light markdown cleanup for generated bodies. Collapses excessive whitespace.
 * (The previous version rewrote lines whose ')' outnumbered '(' — that silently
 * corrupted real prose/citations, so it was removed.)
 */
function sanitizeContent(text: string): string {
  return text
    .replace(/[\\\s]+$/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/^(#{1,6}\s.*)\n{3,}/gm, '$1\n\n')
    .replace(/ {3,}/g, ' ')
    .trim();
}

interface GenOptions {
  system?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  attempts?: number;
  firstOnly?: boolean;
}

/**
 * Core generation: walks the provider chain (Kimi -> DeepSeek), retrying each
 * up to `attempts` times, skipping cooled providers, moving to the next
 * provider on quota/error. Returns the text (and which provider produced it)
 * or null when everything is exhausted.
 */
async function generate(prompt: string, label: string, opts: GenOptions): Promise<{ text: string; provider: string } | null> {
  let providers = providerChain();
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
            temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
            ...(opts.json && { response_format: { type: 'json_object' as const } }),
            ...(opts.maxTokens && { max_tokens: opts.maxTokens }),
          },
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

/** Quota-aware text generation with provider fallback. Blog bodies (label
 *  starts with 'blog-') get sanitized and a generous default token budget. */
export async function safeGenerateContent(prompt: string, label: string, maxTokens?: number, system?: string): Promise<string | null> {
  const isContent = label.startsWith('blog-');
  const res = await generate(prompt, label, {
    system,
    maxTokens: maxTokens ?? (isContent ? BLOG_MAX_TOKENS : undefined),
  });
  if (!res) return null;
  return isContent ? sanitizeContent(res.text) : res.text;
}

/** Quota-aware JSON generation (response_format json_object) with fallback. */
export async function safeGenerateJSON(prompt: string, label: string, maxTokens?: number, system?: string): Promise<string | null> {
  const res = await generate(prompt, label, { system, json: true, maxTokens });
  return res?.text ?? null;
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
