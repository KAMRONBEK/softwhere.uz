import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';
import type { OwnerQuote } from '@/modules/estimator/ai-brief/quote';

/**
 * The server-held plan, carried by the visitor's browser as a sealed token:
 * nothing is stored until the visitor sends the request, and the browser can
 * neither read nor alter the engine's price. AES-256-GCM, 7 days (as long as
 * the browser keeps the plan).
 */
export interface SealedPlan {
  id: string;
  issuedAt: number;
  locale: BriefLocale;
  /** The idea with contact details scrubbed, as the model read it. */
  idea: string;
  title: string;
  /** Catalog ids (English), for the owner. */
  product: string;
  mvp: string[];
  later: string[];
  unpriced: string[];
  /** Reasons a very large idea needs a discovery call. */
  discovery: string[];
  quote: OwnerQuote;
}

export const REQUEST_TOKEN_TTL_MS = 7 * 24 * 60 * 60_000;
const MIN_SECRET_CHARS = 32; // mirrored in next.config.mjs
const PREFIX = 'v1.';
const AAD = Buffer.from('brief-request:v1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** A clock a little ahead on another instance is not a forgery. */
const CLOCK_SKEW_MS = 5 * 60_000;

/** Null when the secret is missing or too short: there is no committed fallback key (the repository is public). */
function keyOf(secret: string | undefined): Buffer | null {
  if (!secret || secret.length < MIN_SECRET_CHARS) return null;
  return Buffer.from(hkdfSync('sha256', secret, '', 'softwhere-brief-request', 32));
}

export function sealPlan(plan: SealedPlan, secret: string | undefined): string | null {
  const key = keyOf(secret);
  if (!key) return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const body = Buffer.concat([cipher.update(JSON.stringify(plan), 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

/** The plan, or null when the token is forged, expired, from another key or malformed. */
export function openPlan(token: unknown, secret: string | undefined, now: number): SealedPlan | null {
  const key = keyOf(secret);
  if (!key || typeof token !== 'string' || !token.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(token.slice(PREFIX.length), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES), { authTagLength: TAG_BYTES });
    decipher.setAAD(AAD);
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const body = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
    const plan = JSON.parse(body.toString('utf8')) as SealedPlan;
    const age = now - plan.issuedAt;
    return age <= REQUEST_TOKEN_TTL_MS && age >= -CLOCK_SKEW_MS ? plan : null;
  } catch {
    return null;
  }
}
