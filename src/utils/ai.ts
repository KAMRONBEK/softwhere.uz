import OpenAI from 'openai';
import { logger } from './logger';

const CONTEXT = 'AI';
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_RETRIES = 2;
const MODEL = 'deepseek-chat';
const DEFAULT_TEMPERATURE = 0.7;

let quotaBlockedUntil = 0;
let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!_client && process.env.DEEPSEEK_API_KEY) {
    _client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
  }
  return _client;
}

export const aiStats = {
  callAttempts: 0,
  quotaBlocked: 0,
  fallbackUsed: 0,
};

export function isQuotaBlocked(): boolean {
  return Date.now() < quotaBlockedUntil;
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
  quotaBlockedUntil = Date.now() + delay;
  logger.warn(`Quota cooldown set for ${Math.round(delay / 1000)}s`, undefined, CONTEXT);
}

/**
 * Quota-aware text generation with bounded retry.
 * Returns the generated text or null when blocked/failed.
 */
export async function safeGenerateContent(prompt: string, label: string, maxTokens?: number): Promise<string | null> {
  const client = getClient();
  if (!client) {
    aiStats.fallbackUsed++;
    return null;
  }

  if (isQuotaBlocked()) {
    logger.info(`Quota blocked, skipping: ${label}`, undefined, CONTEXT);
    aiStats.quotaBlocked++;
    aiStats.fallbackUsed++;
    return null;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    aiStats.callAttempts++;
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: DEFAULT_TEMPERATURE,
        ...(maxTokens && { max_tokens: maxTokens }),
      });
      return completion.choices[0]?.message?.content ?? null;
    } catch (error) {
      if (isQuotaError(error)) {
        recordQuotaCooldown(extractRetryMs(error));
        aiStats.fallbackUsed++;
        return null;
      }
      logger.error(`Call failed (${attempt}/${MAX_RETRIES}): ${label}`, error, CONTEXT);
      if (attempt === MAX_RETRIES) {
        aiStats.fallbackUsed++;
        return null;
      }
    }
  }
  return null;
}

/**
 * Quota-aware JSON generation with bounded retry.
 * Returns raw JSON string or null when blocked/failed.
 */
export async function safeGenerateJSON(prompt: string, label: string, maxTokens?: number): Promise<string | null> {
  const client = getClient();
  if (!client) {
    aiStats.fallbackUsed++;
    return null;
  }

  if (isQuotaBlocked()) {
    logger.info(`Quota blocked, skipping: ${label}`, undefined, CONTEXT);
    aiStats.quotaBlocked++;
    aiStats.fallbackUsed++;
    return null;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    aiStats.callAttempts++;
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: DEFAULT_TEMPERATURE,
        ...(maxTokens && { max_tokens: maxTokens }),
      });
      return completion.choices[0]?.message?.content ?? null;
    } catch (error) {
      if (isQuotaError(error)) {
        recordQuotaCooldown(extractRetryMs(error));
        aiStats.fallbackUsed++;
        return null;
      }
      logger.error(`JSON call failed (${attempt}/${MAX_RETRIES}): ${label}`, error, CONTEXT);
      if (attempt === MAX_RETRIES) {
        aiStats.fallbackUsed++;
        return null;
      }
    }
  }
  return null;
}
