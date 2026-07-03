# 0003 — Admin auth: Neon Auth sessions + `API_SECRET` bearer

Humans sign in via Neon Auth (Better Auth) session cookies gated on an `admin` role; machines present a `Bearer ${API_SECRET}` header. Both flow through one `requireAdmin()` guard.

## At a glance

| | |
| --- | --- |
| **Status** | Accepted |
| **Landed** | commit `fb7484f` — "feat(admin,contact): Neon Auth login + durable lead capture" (2026-07-02) |
| **Human auth** | Neon Auth (`@neondatabase/auth`, Better Auth, beta) — email/password + Google |
| **Authorization** | `role === 'admin'` (set once in the Neon Console), NOT merely "authenticated" |
| **Machine auth** | `Authorization: Bearer ${API_SECRET}`, constant-time compared |
| **Guard** | `requireAdmin()` in `src/core/auth.ts` |
| **Env** | `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (≥ 32 chars), `API_SECRET` |
| **Live spec** | [`../auth-and-admin.md`](../auth-and-admin.md) |

## Context

Admin access previously relied on a shared `API_SECRET` bearer for everything, and
the admin UI was protected by a client-only gate — pages were reachable without a
valid session. That is unacceptable for a panel that can create, edit, and delete
content. But two callers have genuinely different needs: a **human** wants a real
login (email/password, optionally Google) with a durable session, while a
**machine** (the scheduled generation script / cron hitting `/api/blog/generate`)
has no browser and no cookie jar and needs a static credential. Neon Auth is
session-oriented and does not cover the machine path, so a single mechanism cannot
serve both.

## Decision

Adopt **Neon Auth (Better Auth, beta)** for humans and keep the **`API_SECRET`
bearer** for machines, unifying them behind one route guard.

- The server-side auth instance is built lazily in `src/core/neonAuth.ts`, because
  `createNeonAuth()` validates the cookie secret at construction and throws if
  `NEON_AUTH_COOKIE_SECRET` is missing or under 32 chars — deferring keeps module
  import safe so the public site still boots and admin *fails closed*.
- Neon Auth mounts its own endpoints (sign-in/out, session, OAuth) at a catch-all
  handler, `src/app/api/auth/[...path]/route.ts`, wrapped so a missing
  `NEON_AUTH_*` env 500s per request instead of throwing at import time.
- Authorization is a **role gate, not just presence of a session**. A user is admin
  only when their session's `role === 'admin'` — set once per user in the Neon
  Console via "Make admin":

```ts
// src/core/auth.ts
export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const { data } = await getAuth().getSession();
    const role = (data?.user as { role?: unknown } | undefined)?.role;
    return role === 'admin';
  } catch (e) {
    logger.error('Neon Auth session check failed', e, 'AUTH'); // fails closed
    return false;
  }
}
```

- `requireAdmin(request)` authorizes a route via **either** an admin session **or**
  a bearer secret, returning a `401` `NextResponse` to short-circuit or `null` when
  allowed. The bearer is compared in constant time (`safeEqual`, fixed-length
  SHA-256 digests over `timingSafeEqual`):

```ts
// src/core/auth.ts
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (await isAdminAuthenticated()) return null;                 // 1) browser admin
  const apiSecret = process.env.API_SECRET;                       // 2) scripts / cron / curl
  if (apiSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ') && safeEqual(authHeader.slice(7), apiSecret)) return null;
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

- The whole admin section is gated server-side. `src/app/[locale]/admin/layout.tsx`
  is `dynamic = 'force-dynamic'`, renders `<AdminLogin />` when
  `isAdminAuthenticated()` is false, and is marked `robots: { index: false }`. API
  routes (`/api/admin/posts`, `/api/blog/generate`) call `requireAdmin()`.

## Consequences

- **Two credentials, one guard.** New protected routes should call
  `requireAdmin()` and get both paths for free; do not re-check auth ad hoc.
- **Fails closed by construction.** A missing/short `NEON_AUTH_COOKIE_SECRET` or an
  auth-service error denies access rather than crashing the site — the public pages
  keep serving, admin just shows the login.
- **Owner setup is required:** set `NEON_AUTH_BASE_URL` and a ≥ 32-char
  `NEON_AUTH_COOKIE_SECRET`, keep `API_SECRET` for machines, and promote your user
  to the `admin` role in the Neon Console (a signed-in non-admin is still denied).
- **Beta dependency.** `@neondatabase/auth` is `^0.4.2-beta`; treat its API as
  potentially unstable and pin deliberately.
- **What was dropped:** the bespoke login/logout routes, the client-only
  `AdminAuthGate`, and the `jose` dependency were removed in the same change;
  `AdminLogin`/`AdminLogout` components replaced them.

## References

- `src/core/auth.ts` — `requireAdmin()`, `isAdminAuthenticated()`, constant-time `safeEqual`, plus the locale validators that also live here.
- `src/core/neonAuth.ts` — lazy `getAuth()` and the cookie-secret precondition.
- `src/app/api/auth/[...path]/route.ts` — the Neon Auth mount, wrapped against import-time throws.
- `src/app/[locale]/admin/layout.tsx` — server-side admin gate + `noindex`.
- `src/app/api/blog/generate/route.ts:40-41` — a machine-callable route guarded by `requireAdmin()`.
- commit `fb7484f` — the auth rework (and co-located `fra1` region + `leads` capture).
- [`../auth-and-admin.md`](../auth-and-admin.md) — admin auth and panel walkthrough.

## Related docs

- [`../auth-and-admin.md`](../auth-and-admin.md) — auth and admin panel as a live spec.
- [`./0004-ai-blog-pipeline.md`](./0004-ai-blog-pipeline.md) — the machine caller that uses the bearer path.
- [`./0002-mongodb-to-neon-drizzle.md`](./0002-mongodb-to-neon-drizzle.md) — the `leads` table landed in the same commit.
- [`../../README.md`](../../README.md) — project overview.

_Last verified against code: 2026-07-03._
