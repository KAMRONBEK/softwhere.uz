# Authentication & Admin Panel

How the admin panel is protected and how its screens work: Neon Auth (Better Auth) session cookies with an `admin`-role gate for humans, a `Bearer ${API_SECRET}` path for machine callers, and the leads/posts management UI behind it.

## At a glance

| Concern | Where | Notes |
| --- | --- | --- |
| Server admin guard (routes) | `requireAdmin()` in `src/core/auth.ts` | Session **or** Bearer `API_SECRET` |
| Server admin gate (pages) | `isAdminAuthenticated()` in `src/core/auth.ts` | Session-only; role must equal `admin` |
| Neon Auth instance (server) | `getAuth()` in `src/core/neonAuth.ts` | Lazy singleton; fails closed if unset |
| Neon Auth endpoints | `src/app/api/auth/[...path]/route.ts` | Mounts sign-in/out, session, OAuth |
| Browser auth client | `authClient` in `src/modules/admin/utils/authClient.ts` | `createAuthClient()` → `/api/auth` |
| Admin fetch wrapper | `adminFetch()` in `src/modules/admin/utils/adminFetch.ts` | Same-origin cookie; 401 → reload |
| Admin section gate | `src/app/[locale]/admin/layout.tsx` | Renders login if not admin |
| Admin screens | `src/app/[locale]/admin/{leads,posts}` | Leads (read-only), Posts (CRUD + generate) |
| Admin JSON APIs | `src/app/api/admin/{leads,posts,revalidate}` | All call `requireAdmin()` |
| Secret entry gesture | `src/shared/components/HomeClientLayer.tsx` | 5 clicks on the top-left corner |

Two identities can pass the guard:

- **Humans** sign in through Neon Auth (email + password, or Google). Access requires the session user's `role` to equal `admin` — being merely authenticated is not enough.
- **Machines** (scripts, cron, curl) send `Authorization: Bearer ${API_SECRET}`. Neon Auth is session-oriented and does not cover that path, so the shared secret is the machine door.

## The two guards

Both live in `src/core/auth.ts`.

### `isAdminAuthenticated()` — session + role check

Used by the page-level gate. It reads the Neon Auth session server-side and checks the role. It **fails closed**: any thrown error (missing `NEON_AUTH_*` env, auth-service outage) is caught and returns `false`.

```ts
// src/core/auth.ts
export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const { data } = await getAuth().getSession();
    const role = (data?.user as { role?: unknown } | undefined)?.role;
    return role === 'admin';
  } catch (e) {
    logger.error('Neon Auth session check failed', e, 'AUTH');
    return false;
  }
}
```

### `requireAdmin(request)` — route-handler guard

Every admin/machine JSON route calls this first. It authorizes via **either** an admin session **or** the Bearer secret, and returns a `NextResponse` (401) to short-circuit on failure, or `null` when authorized (`src/core/auth.ts:47`).

```ts
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (await isAdminAuthenticated()) return null;                 // 1) browser admin session

  const apiSecret = process.env.API_SECRET;
  if (apiSecret) {                                               // 2) machine caller
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ') && safeEqual(authHeader.slice(7), apiSecret)) {
      return null;
    }
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

The Bearer comparison is constant-time: `safeEqual()` hashes both strings to fixed-length SHA-256 digests and compares them with `crypto.timingSafeEqual` (`src/core/auth.ts:23`), so token length/content does not leak through timing.

Usage pattern in every guarded handler:

```ts
export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  // ...authorized work
}
```

## Neon Auth wiring

### Server instance — `getAuth()`

`src/core/neonAuth.ts` builds the Better Auth server instance lazily and caches it. Construction is deferred because `createNeonAuth()` validates the cookie secret at construction time — it throws if `NEON_AUTH_COOKIE_SECRET` is missing or shorter than 32 chars. Deferring keeps module import safe so the public site still boots and admin simply fails closed.

```ts
// src/core/neonAuth.ts
let instance: NeonAuth | null = null;

export function getAuth(): NeonAuth {
  if (instance) return instance;
  instance = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL ?? '',
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET ?? '' },
  });
  return instance;
}
```

### Auth catch-all route — `/api/auth/[...path]`

`src/app/api/auth/[...path]/route.ts` mounts Neon Auth's own handlers (sign-in/out, session, OAuth callbacks). The browser client targets `/api/auth` by default, so this is where login/logout traffic lands. The handlers are wrapped (not destructured at module top) so a missing `NEON_AUTH_*` env 500s per request instead of crashing at import. The route is `force-dynamic`.

```ts
// src/app/api/auth/[...path]/route.ts
export function GET(request: NextRequest, context: unknown) {
  return getHandlers().GET(request, context as never);
}
export function POST(request: NextRequest, context: unknown) {
  return getHandlers().POST(request, context as never);
}
```

### Browser client — `authClient`

`src/modules/admin/utils/authClient.ts` is a one-liner: `createAuthClient()` with no config, so it defaults to the `/api/auth` catch-all. Login/logout components call methods on it (`authClient.signIn.email`, `authClient.signIn.social`, `authClient.signOut`).

## Login and logout

### `AdminLogin`

`src/modules/admin/components/AdminLogin.tsx` renders the "Admin Access" card with two paths:

- **Email + password** — `authClient.signIn.email({ email, password })`. On success the Neon-managed httpOnly session cookie is set and the component calls `router.refresh()`, which re-runs the server layout gate; the gate now sees the `admin` session and renders the app.
- **Google OAuth** — `authClient.signIn.social({ provider: 'google', callbackURL: window.location.pathname })`. This redirects to Google and back; per the component's comment, Google links to the existing admin user by matching email. The session cookie is set on return.

There is **no sign-up UI** — the login card only offers sign-in. New admins are provisioned in the Neon Console (see below), not from the app.

### `AdminLogout`

`src/modules/admin/components/AdminLogout.tsx` calls `authClient.signOut()`, then does a hard `window.location.assign(window.location.pathname)` (not `router.refresh`) so the server re-reads cookies fresh and bypasses any cached RSC payload; the gate then shows the login screen.

## The admin section gate

`src/app/[locale]/admin/layout.tsx` is the authoritative server-side gate for the whole `/[locale]/admin/*` tree:

```tsx
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }) {
  if (!(await isAdminAuthenticated())) {
    return <AdminLogin />;
  }
  // ...top nav (Posts / Leads) + <AdminLogout /> + children
}
```

Key properties:

- Unauthenticated (or non-admin) requests never receive the admin UI — the layout returns `<AdminLogin />` instead of `children`. This replaced an older client-only gate where pages were reachable.
- Reading the session cookie makes the section dynamic (`force-dynamic`), so admin pages are never statically cached.
- `robots: { index: false, follow: false }` keeps the admin panel out of search indexes.
- When authorized, it renders a slim top bar with links to `…/admin/posts` and `…/admin/leads`, plus the logout button.

## The admin fetch client — `adminFetch`

`src/modules/admin/utils/adminFetch.ts` is the browser wrapper every admin page uses for JSON calls. Auth rides on the httpOnly session cookie (set at login), which the browser sends automatically on same-origin requests — so there is **no token to attach client-side**. It sets `Content-Type: application/json` when a body is present, uses `credentials: 'same-origin'`, and on a `401` reloads the page so the server-side gate falls back to the login form.

```ts
export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  if (res.status === 401 && typeof window !== 'undefined') window.location.reload();
  return res;
}
```

## Admin screens

### Leads — `src/app/[locale]/admin/leads/page.tsx`

A read-only table of contact-form submissions. On mount it fetches `GET /api/admin/leads` via `adminFetch` and renders each lead's date, name, phone (as a `tel:` link), message, source, and Telegram-notification status (`pending`/`sent`/`failed`, color-coded). There are no edit/delete controls — leads are display-only in the UI.

### Posts — `src/app/[locale]/admin/posts/page.tsx`

The content-management screen. It fetches `GET /api/admin/posts` and groups the flat list by `generationGroupId` (posts generated together across locales share one group; ungrouped posts become singleton groups), then renders newest-first. Capabilities:

- **AI generator** (toggled by "Generate New Posts"): two modes — Topic/Category or From Source (URL or pasted text, 5000-char cap) — plus per-locale checkboxes (`en`/`ru`/`uz`). It POSTs to `/api/blog/generate` **one locale per request**: the first call creates the group, follow-ups continue it via `generationGroupId` (reusing topic/images), because research + a full draft don't fit three locales into the route's time budget. See `api-reference.md` for the generation endpoint.
- **Per-group actions**: Publish All / Unpublish All (`PATCH /api/admin/posts/{id}` with `{status}` for each post in the group) and Delete All (`DELETE` per post), each with a `confirm()` for deletes.
- **Batch actions**: a selection bar (checkboxes + select-all) drives Publish / Unpublish / Delete across selected groups, fanning out `PATCH`/`DELETE` per post via `Promise.all`.
- **Preview**: opens the `PostPreviewModal`. If the list row lacks `content`, it lazy-loads it via `GET /api/admin/posts/{post._id}` first.
- **Live** links open the public URL `/{locale}/blog/{slug}` in a new tab.

The post shape used here (`BlogPost`, `PostGroup`, `GenerationRequest`) is defined in `src/modules/admin/types.ts`; category options come from `src/modules/admin/constants.ts` (`BLOG_CATEGORIES`, including `auto` and `random` pseudo-categories).

### Preview modal — `src/modules/admin/components/PostPreviewModal.tsx`

Renders the selected post: title, created date, locale + status badges, optional cover image with photographer credit, and the body via `markdownToHtml(post.content)` injected with `dangerouslySetInnerHTML`. Footer shows the URL and a "View Live" link. Falls back to "Content not available in preview." when `content` is empty.

### Create / edit forms

- `src/app/[locale]/admin/posts/new/page.tsx` — title (auto-slugs via `createSlug`), slug, status, locale, Markdown content; submits `POST /api/admin/posts`, then redirects to the posts list.
- `src/app/[locale]/admin/posts/edit/[postId]/page.tsx` — loads via `GET /api/admin/posts/{postId}`, submits `PUT /api/admin/posts/{postId}`, shows success then redirects.

## Admin JSON API (all behind `requireAdmin`)

| Method + path | Handler | Purpose |
| --- | --- | --- |
| `GET /api/admin/leads` | `src/app/api/admin/leads/route.ts` | List leads via `listLeads()` repository |
| `GET /api/admin/posts` | `src/app/api/admin/posts/route.ts` | List posts for admin (`listForAdmin()`) |
| `POST /api/admin/posts` | same | Create a post (validates fields, locale, slug collision → 409) |
| `GET /api/admin/posts/{id}` | `src/app/api/admin/posts/[id]/route.ts` | Fetch one post (validates `isValidPostId`) |
| `PUT /api/admin/posts/{id}` | same | Full update; pings IndexNow on publish |
| `PATCH /api/admin/posts/{id}` | same | Partial update (allow-listed fields); real publish path |
| `DELETE /api/admin/posts/{id}` | same | Delete a post |
| `POST /api/admin/revalidate` | `src/app/api/admin/revalidate/route.ts` | Bust blog ISR caches (list, detail, feeds, sitemap) |

Every post-write handler busts the blog ISR caches (revalidate the `blog-posts` tag + the blog detail path) after a successful mutation — the `[id]` route (`PUT`/`PATCH`/`DELETE`) via a shared `invalidateBlogCache()` helper, the create `POST` inlines the same two calls — and `PATCH`/`PUT` await `pingIndexNow(...)` when the resulting status is `published`. `revalidate` is also the endpoint the GitHub Actions generator hits with `Bearer API_SECRET` after auto-publishing. Data access goes exclusively through the repository layer (`posts.repository.ts`, `leads.repository.ts`) — handlers never touch Drizzle directly.

## Secret admin entry gesture

There is no visible link to the admin panel. The entry point is a hidden gesture on the home page, in `src/shared/components/HomeClientLayer.tsx` (rendered from `src/app/[locale]/page.tsx`):

- A transparent 80×80 clickable area is fixed to the **top-left corner** (`opacity-0`, `z-index: 1000` so it sits above the header).
- **Five clicks within 3 seconds** reveal a floating red "🔐 Admin" button (top-right) for 10 seconds; the click counter resets after 3 seconds of inactivity.
- Clicking that button navigates to `/{locale}/admin/posts`.

```tsx
// src/shared/components/HomeClientLayer.tsx
if (newCount === 5) {
  setShowAdminButton(true);
  setClickCount(0);
  setTimeout(() => setShowAdminButton(false), 10000); // Hide after 10 seconds
}
```

This gesture is only obscurity — it just navigates to the admin route. The real protection is the server-side gate in the admin layout, which still demands an `admin` session (or the Bearer secret for APIs). You can also just visit `/{locale}/admin/posts` directly.

## Required environment variables

Declared/validated in `src/core/env.ts` and documented in `.env.example`. The auth vars (`NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `API_SECRET`) are optional there — the app boots without them, admin just fails closed — while `DATABASE_URL` is the one required var (`validateEnvironment()` throws at startup if it is missing).

| Var | Required for | Notes |
| --- | --- | --- |
| `NEON_AUTH_BASE_URL` | Human admin login | Project auth base from Neon Console → Auth |
| `NEON_AUTH_COOKIE_SECRET` | Human admin login | Session-cookie signing key; **min 32 chars** or `createNeonAuth()` throws. Generate with `openssl rand -base64 32` |
| `API_SECRET` | Machine callers | Value for `Authorization: Bearer …` on admin/generation APIs |
| `DATABASE_URL` | Everything | Neon Postgres connection string (required app-wide) |

If `NEON_AUTH_*` are unset, the admin gate denies all humans (fails closed) while the public site still boots. See `environment.md` for the full variable list.

## Neon Console setup

To provision a working admin:

1. **Enable Neon Auth** in the Neon Console, then copy the auth base URL into `NEON_AUTH_BASE_URL` and set a 32+ char `NEON_AUTH_COOKIE_SECRET` (`.env.example:13-20`).
2. Create the admin user (email/password, or the Google account you'll sign in with).
3. **Make admin** — grant that user `role = 'admin'` in the Console. The role gate in `isAdminAuthenticated()` checks exactly this; a user without it is denied even when signed in. (`src/core/auth.ts:15` comments this as the "Make admin" step.)
4. **Disable public sign-up** in the Console (recommended hardening). The app itself exposes no sign-up UI, and the role gate already blocks any self-registered non-admin account — disabling sign-up closes the door entirely so nobody can create accounts against your Neon Auth project.
5. Set `API_SECRET` (Vercel env) for scripts/cron that call the admin or blog-generation APIs.

## Security notes

- The page gate is server-side and authoritative — non-admin sessions never receive admin markup.
- Failure modes are closed, not open: a session-check error or missing Neon Auth config denies access rather than allowing it.
- The Bearer comparison is constant-time (`safeEqual`), reducing timing side-channels on `API_SECRET`.
- The admin section is `noindex, nofollow` and `force-dynamic`.

See `security.md` for the site-wide threat model and hardening checklist.

## Related docs

- [architecture.md](./architecture.md)
- [database.md](./database.md)
- [api-reference.md](./api-reference.md)
- [security.md](./security.md)
- [environment.md](./environment.md)
- [Project README](../README.md)

_Last verified against code: 2026-07-03._
