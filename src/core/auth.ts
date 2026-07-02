import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { getAuth } from './neonAuth';
import { logger } from './logger';

const VALID_LOCALES = ['en', 'ru', 'uz'] as const;
type ValidLocale = (typeof VALID_LOCALES)[number];

// ---------------------------------------------------------------------------
// Admin authentication (Neon Auth / Better Auth)
//
// Human admins sign in through Neon Auth (email + password); the session lives
// in a Neon-managed httpOnly cookie and is validated server-side via
// getAuth().getSession(). Access is gated on the 'admin' role (set once in the
// Neon Console via "Make admin"), NOT merely "authenticated".
//
// Machine callers (scripts / cron hitting /api/blog/generate) still present a
// `Bearer ${API_SECRET}` header — Neon Auth is session-oriented and doesn't
// cover that path. Both routes go through requireAdmin().
// ---------------------------------------------------------------------------

/** Constant-time string comparison via fixed-length SHA-256 digests. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when the current request carries a Neon Auth session for an 'admin'-role user. */
export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const { data } = await getAuth().getSession();
    const role = (data?.user as { role?: unknown } | undefined)?.role;
    return role === 'admin';
  } catch (e) {
    // Fails closed: missing NEON_AUTH_* env or an auth-service error → denied.
    logger.error('Neon Auth session check failed', e, 'AUTH');
    return false;
  }
}

/**
 * Route-handler guard. Authorizes a request via EITHER a Neon Auth admin
 * session OR a `Bearer ${API_SECRET}` header (machine access). Returns a
 * NextResponse to short-circuit on failure, or null when authorized.
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  // 1) Neon Auth admin session — the browser admin panel.
  if (await isAdminAuthenticated()) return null;

  // 2) Bearer API_SECRET — scripts / cron / curl.
  const apiSecret = process.env.API_SECRET;
  if (apiSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ') && safeEqual(authHeader.slice(7), apiSecret)) {
      return null;
    }
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function isValidLocale(locale: string): locale is ValidLocale {
  return VALID_LOCALES.includes(locale as ValidLocale);
}

export function validateLocale(locale: string | null, fallback: ValidLocale = 'en'): ValidLocale {
  if (locale && isValidLocale(locale)) return locale;
  return fallback;
}

export { VALID_LOCALES, type ValidLocale };
