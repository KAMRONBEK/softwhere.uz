import OpenAI from 'openai';
import { logger } from './logger';

const CONTEXT = 'AI';
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_RETRIES = 3;
const MODEL = 'deepseek-chat';
const TEMPERATURE_EN = 0.9;
const TEMPERATURE_OTHER = 0.75;
const CONTENT_FREQUENCY_PENALTY = 0.4;
const CONTENT_PRESENCE_PENALTY = 0.35;

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
function sanitizeContent(text: string): string {
  let result = text
    .replace(/[\\\s]+$/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/^(#{1,6}\s.*)\n{3,}/gm, '$1\n\n')
    .replace(/ {3,}/g, ' ')
    .trim();

  result = result
    .split('\n')
    .map(line => {
      const t = line.trimEnd();
      if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('```') || t.startsWith('![')) return line;
      const opens = (t.match(/\(/g) || []).length;
      const closes = (t.match(/\)/g) || []).length;
      if (closes > opens && /\)\s*$/.test(t)) {
        return t.replace(/\)\s*$/, '.');
      }
      return line;
    })
    .join('\n');

  return result;
}

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

  const isContent = label.startsWith('blog-');
  const isNonEn = isContent && !label.endsWith('-en');
  const temperature = isNonEn ? TEMPERATURE_OTHER : TEMPERATURE_EN;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    aiStats.callAttempts++;
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens ?? (isContent ? 8192 : undefined),
        frequency_penalty: isContent ? CONTENT_FREQUENCY_PENALTY : 0,
        presence_penalty: isContent ? CONTENT_PRESENCE_PENALTY : 0,
      });
      const raw = completion.choices[0]?.message?.content ?? null;
      return raw && isContent ? sanitizeContent(raw) : raw;
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
        temperature: TEMPERATURE_EN,
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
