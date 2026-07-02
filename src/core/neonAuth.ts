import { createNeonAuth, type NeonAuth } from '@neondatabase/auth/next/server';

// Server-side Neon Auth (Better Auth) instance. Constructed lazily because
// createNeonAuth() validates the cookie secret at construction time (throws if
// NEON_AUTH_COOKIE_SECRET is missing or < 32 chars) — deferring keeps module
// import safe so the public site still boots and admin simply fails closed.
let instance: NeonAuth | null = null;

export function getAuth(): NeonAuth {
  if (instance) return instance;
  instance = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL ?? '',
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET ?? '' },
  });
  return instance;
}
