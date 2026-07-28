import { ENV } from './constants';

/**
 * HMAC signing for `/api/og` parameters.
 *
 * The OG route renders ~2.6s of CPU per UNIQUE URL (satori + font subsetting),
 * so free-form `title` input is an unbounded compute surface: any crawler with
 * a mangled query string — or anyone looping random titles — mints a fresh
 * cold render that the CDN cache can never amortize. Signing collapses the
 * renderable URL space to exactly what our own metadata builders emit.
 *
 * Uses Web Crypto (not node:crypto) because the OG route runs on the edge
 * runtime while the builders run in Node — this module must work in both.
 *
 * Fail-open by design when API_SECRET is unset (local dev / misconfigured
 * env): builders emit unsigned URLs and the route accepts them, i.e. exactly
 * the pre-signing behavior. Production has API_SECRET set (admin auth
 * depends on it).
 */

export interface OgParams {
  title: string;
  locale: string;
  image?: string;
}

const encoder = new TextEncoder();

// JSON array, not string concatenation: a delimiter char inside `title`
// must not let two different param sets share one payload.
const payloadOf = ({ title, locale, image }: OgParams): string => JSON.stringify([title, locale, image ?? '']);

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Signature for the given params, or '' when no API_SECRET is configured. */
export async function signOgParams(params: OgParams): Promise<string> {
  if (!ENV.API_SECRET) return '';
  return (await hmacHex(ENV.API_SECRET, payloadOf(params))).slice(0, 32);
}

/** True when `sig` matches `params` (or when no API_SECRET is configured). */
export async function verifyOgSignature(params: OgParams, sig: string | null): Promise<boolean> {
  if (!ENV.API_SECRET) return true;
  const expected = await signOgParams(params);
  if (!sig || sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** Absolute, signed `/api/og` URL — the only URL shape the route will render. */
export async function buildOgUrl(params: OgParams): Promise<string> {
  const sp = new URLSearchParams({ title: params.title, locale: params.locale });
  if (params.image) sp.set('image', params.image);
  const sig = await signOgParams(params);
  if (sig) sp.set('sig', sig);
  return `${ENV.BASE_URL}/api/og?${sp.toString()}`;
}
