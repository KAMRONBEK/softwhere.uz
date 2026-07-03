# Security

Request-hardening controls that live in the softwhere.uz code: per-IP rate limiting, input validation/sanitization, output escaping, an SSRF guard, the `API_SECRET` Bearer gate, locale validation, and the logging/notify boundaries that keep secrets and PII out of logs. Admin **session** auth (Neon Auth cookies, role gate) is covered in [auth-and-admin.md](./auth-and-admin.md); this doc focuses on hardening the request path.

## At a glance

| Control | Where | Status |
| --- | --- | --- |
| Per-IP rate limit (in-memory, fixed window) | `src/shared/utils/rateLimit.ts` | Present — best-effort, per-instance |
| Estimator input whitelist/sanitize | `src/modules/estimator/utils/sanitize.ts` | Present |
| Contact/estimator lead field caps + line cleaning | `src/app/api/contact/route.ts`, `src/app/api/estimate/lead/route.ts` | Present |
| Request-body size cap (32 KB) | `src/app/api/estimate/route.ts`, `src/app/api/estimate/lead/route.ts` | Present (estimate routes only) |
| HTML escaping for Telegram / hand-built HTML | `src/shared/utils/security.ts` `escapeHtml` | Present |
| Safe JSON-LD embedding (anti stored-XSS) | `src/shared/utils/security.ts` `safeJsonLd` | Present |
| Admin markdown preview escaping | `src/modules/admin/utils/markdown.ts` | Present |
| SSRF guard for server-side fetches | `src/shared/utils/security.ts` `assertFetchableUrl` | Present (literal-host only) |
| `Bearer ${API_SECRET}` gate (constant-time) | `src/core/auth.ts` `requireAdmin` | Present |
| Locale validation | `src/core/auth.ts` `isValidLocale` / `validateLocale` | Present |
| AI daily spend circuit breaker | `src/app/api/estimate/route.ts` | Present (per-instance) |
| Secrets never committed | `.gitignore`, only `.env.example` tracked | Present |
| Logs free of secrets/PII | `src/core/logger.ts` + route error handling | Present |
| Security **response headers** (CSP/HSTS/X-Frame-Options/…) | `next.config.mjs`, `vercel.json`, `src/proxy.ts` | **Absent** — none configured |
| Durable/global rate limiting (KV/Upstash) | — | **Absent** |
| CSRF token on admin mutations | — | **Absent** in-repo (relies on Neon Auth cookie semantics) |

## Rate limiting

`rateLimit(key, limit, windowMs)` in `src/shared/utils/rateLimit.ts` is a **best-effort, in-memory, fixed-window** limiter. Buckets live in a module-level `Map`, so on serverless this is **per warm instance, not global** — it blunts a single client hammering one instance but is not a durable limiter under coordinated abuse (`rateLimit.ts:20-27`). Expired buckets are pruned opportunistically at most once per 60 s so the map can't grow unbounded (`rateLimit.ts:33-39`).

The bucket key is derived from `getClientIp(request)`, which reads `x-forwarded-for` (first entry) then falls back to `x-real-ip`, defaulting to `'unknown'`. IPv6 clients are bucketed to their **/64 prefix** so an attacker can't mint 2^64 fresh keys from one allocation (`rateLimit.ts:11-18`).

Applied on the three public write/spend endpoints; each returns `429` with a `Retry-After` header on rejection:

| Endpoint | Key prefix | Limit | Window | Line |
| --- | --- | --- | --- | --- |
| `POST /api/contact` | `contact:<ip>` | 5 | 60 s | `contact/route.ts:13` |
| `POST /api/estimate` | `estimate:<ip>` | 10 | 60 s | `estimate/route.ts:81` |
| `POST /api/estimate/lead` | `estimate-lead:<ip>` | 5 | 60 s | `estimate/lead/route.ts:61` |

```ts
const { allowed, retryAfter } = rateLimit(`estimate:${getClientIp(request)}`, 10, 60_000);
if (!allowed) {
  return NextResponse.json(
    { success: false, error: 'Too many requests. Please try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
```

**AI spend circuit breaker.** Because the per-IP limit is bypassable (rotating IPs, cold instances), `/api/estimate` adds a coarse per-instance daily cap on paid LLM calls: `AI_DAILY_BUDGET = 500` calls/day, after which it returns a formula-only estimate instead of calling the model (`estimate/route.ts:22-34,134-137`).

## Input validation and sanitization

### Estimator payloads — whitelist, never reject

`sanitizeEstimatorInput(raw)` in `src/modules/estimator/utils/sanitize.ts` is the server-side gate for both estimator endpoints (`estimate/route.ts:104`, `estimate/lead/route.ts:90`). It:

- Returns `null` if the payload isn't an object or `projectType` isn't a known service id (the only hard failure) (`sanitize.ts:24-27`).
- Whitelists every enum (`tier`, `design`, `urgency`, `approach`, `platforms`) against fixed `Set`s and the catalog, falling back to a safe default rather than erroring — a stale client after a catalog change **degrades, it doesn't 500** (`sanitize.ts:6-10,35-42`).
- Filters id arrays (`features`, `integrations`, `techStack`) against the catalog maps, de-dupes, and caps length at 60 (`idList`, `sanitize.ts:12-15`).
- Coerces `screens`/`languages` through `Number` + `Number.isFinite`, clamping `screens` to its subtype's bounds and `languages` to 1–3 (`sanitize.ts:44-51`).
- Strips control characters from the free-text `description`, trims, and caps at `MAX_DESCRIPTION_LENGTH = 600` (`sanitize.ts:53-60`).

```ts
const description =
  typeof value.description === 'string'
    ? value.description
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .trim()
        .slice(0, MAX_DESCRIPTION_LENGTH)
    : '';
```

The same function is also reused client-side to re-validate a restored draft from localStorage (`Wizard.tsx:54`).

### Request-body size caps

`/api/estimate` and `/api/estimate/lead` read the raw body as text and reject over `MAX_BODY_BYTES = 32 * 1024` with `413` **before** parsing JSON, then `JSON.parse` in a try/catch returning `400` on bad JSON (`estimate/route.ts:14,89-102`, `estimate/lead/route.ts:14,69-82`). Note: `POST /api/contact` has **no** pre-parse body-size cap — it calls `request.json()` directly and instead caps each field after the fact (`contact/route.ts:21-30`).

### Contact and estimator lead fields

`POST /api/contact` requires `name` and `phone`, coerces each field with `String(...)` and slices to `MAX_FIELD_LENGTH = 2000` (source to 50) before storage (`contact/route.ts:23-30`).

`POST /api/estimate/lead` is stricter via `cleanLine(value, max)` (`estimate/lead/route.ts:23-30`), which strips control chars **and Unicode bidi overrides** (`U+200E/200F`, `U+202A–202E`, `U+2066–2069`) and collapses whitespace, so a crafted `name` can't forge extra `Phone:`/`Estimate:` lines in the owner's Telegram message. Phone must contain ≥ 9 digits (`estimate/lead/route.ts:86`). Client-echoed AI numbers are **never trusted**: `parseAi` re-validates them (`0 < n < 10_000_000`), constrains `provider` to `^[a-z0-9_-]+$`, and the numbers are re-clamped against a freshly recomputed formula so an attacker can't plant a fake "AI says $1–$2" quote (`estimate/lead/route.ts:32-56,99-113`).

## Output escaping (XSS / injection)

`src/shared/utils/security.ts` centralizes escaping:

- **`escapeHtml(input)`** escapes `& < > " '`. Every user/model-controlled field composed into a Telegram message (`parse_mode=HTML`) is passed through it — otherwise raw `<`/`>`/`&` would inject markup (phishing) or 400 the message (`contact/route.ts:53-56`, `estimate/lead/route.ts:152-158`). It is also the first step of the admin markdown preview.
- **`safeJsonLd(data)`** JSON-stringifies then escapes `<`, `>`, `&` to `<` etc. Plain `JSON.stringify` does **not** escape `<`, so an AI-generated title containing a literal `</script>` inside a `<script type="application/ld+json">` block would be a stored-XSS sink. Used in `src/app/[locale]/layout.tsx:108`, `src/app/[locale]/blog/page.tsx:79`, and `src/modules/blog/lib/seo.tsx:184`.

```ts
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
```

**Admin markdown preview.** `markdownToHtml` in `src/modules/admin/utils/markdown.ts` escapes the raw markdown **first** and only then applies formatting tags, so an AI-generated `<img onerror=...>` renders as inert text. Without the leading `escapeHtml`, the preview modal would be a stored-XSS sink in the admin's authenticated session (`markdown.ts:4-9`).

`src/core/notify.ts` also exports `escapeTelegramHtml` (escapes `& < >`) for the blog-pipeline notifications it sends (`notify.ts:29-31`).

## SSRF guard for server-side fetches

`assertFetchableUrl(raw)` in `src/shared/utils/security.ts` validates any **user- or model-supplied URL** before the server fetches it. It throws unless the URL is `http(s)` and the host is not localhost/loopback/link-local/cloud-metadata/private. It blocks:

- non-`http(s)` schemes → `BLOCKED_SCHEME` (`security.ts:63-65`);
- an explicit `BLOCKED_HOSTNAMES` set incl. `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `metadata.google.internal` (`security.ts:33,67`);
- `.local` / `.internal` suffixes (`security.ts:68`);
- private/loopback/link-local/CGNAT IPv4 ranges incl. the `169.254.169.254` metadata address (`isPrivateIpv4`, `security.ts:35-46`);
- IPv6 loopback/ULA/link-local, but **only** when the host is an actual IPv6 literal, so DNS names like `fda.gov`/`fc2.com` aren't wrongly blocked (`security.ts:73-76`).

It inspects the **literal host only** — DNS-rebinding is explicitly out of scope and calls it out to pair with a network egress policy (`security.ts:52-54`). Call sites belt-and-brace it with redirect controls:

- `extractTextFromUrl` (blog source ingestion) guards, then fetches with `redirect: 'error'` and a 10 s abort (`src/modules/blog/api/generator.ts:53-66`).
- `verifyFactUrls` guards each model-emitted source URL, then fetches with `redirect: 'manual'` (`src/modules/blog/api/research.ts:169-185`).

## The `API_SECRET` Bearer gate

`requireAdmin(request)` in `src/core/auth.ts:47-61` authorizes a request via **either** a Neon Auth admin session **or** a `Bearer ${API_SECRET}` header (for scripts/cron/curl), returning a `401` `NextResponse` to short-circuit or `null` when authorized. The Bearer token is compared in **constant time** via fixed-length SHA-256 digests (`safeEqual`, `auth.ts:22-27`), avoiding length/early-exit timing leaks:

```ts
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
```

If `API_SECRET` is unset, the Bearer branch is skipped entirely (session-only). The gate **fails closed**: a missing `NEON_AUTH_*` env or an auth-service error is caught and treated as denied (`isAdminAuthenticated`, `auth.ts:30-40`). Routes behind `requireAdmin`: `POST /api/blog/generate`, `POST /api/admin/revalidate`, `GET /api/admin/leads`, and the `/api/admin/posts` + `/api/admin/posts/[id]` handlers. The Neon Auth session mechanics (cookie, role gate, `getAuth`) are documented in [auth-and-admin.md](./auth-and-admin.md).

## Locale validation

`isValidLocale` / `validateLocale` in `src/core/auth.ts:63-70` constrain any incoming locale to the `['en','ru','uz']` tuple, returning a typed fallback (default `'en'`) rather than trusting arbitrary input. Used to gate blog pages, blog API routes, and the RSS feed route (e.g. `feed.xml/route.ts:29`, `api/blog/posts/route.ts:16`, `blog/[slug]/page.tsx:54`). Note the estimator routes derive their locale with a local check (`/^[a-z]{2}$/i` in `estimate/lead/route.ts:97`, `Object.hasOwn(LOCALE_LANGUAGE, …)` in `estimate/route.ts:109`) rather than `validateLocale`.

## Middleware / request routing (`src/proxy.ts`)

The next-intl middleware handles www-stripping and a `/ → /uz` collapse into a single `308`, plus locale routing. Its `matcher` **excludes** `api`, `_next`, `_vercel`, and static assets (`proxy.ts:32-34`), so API routes do **not** pass through it — request hardening for `/api/*` lives in the route handlers above, not in middleware. The middleware adds **no** security response headers.

## Security response headers — absent

There are **no** security response headers configured anywhere in the repo. `next.config.mjs` defines only `images` and `experimental.inlineCss` and has **no `headers()` function**; `vercel.json` sets only `functions` and `regions`; `src/proxy.ts` sets none. That means **no** `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` originate from this codebase. If you need them, add a `headers()` async function in `next.config.mjs` (or a `headers` block in `vercel.json`). This is a real gap, not an oversight in this doc.

The JSON-LD blocks use `dangerouslySetInnerHTML`, made safe by `safeJsonLd` rather than by a CSP; there is no nonce/CSP layer behind them.

## Secrets hygiene

- **Never committed.** `.gitignore` ignores `.env`, `.env*`, `.env*.local`, `.env.development`, `.env.production`. The only env file tracked in git is `.env.example` (placeholders only) — confirmed via `git ls-files`.
- **All secrets are server-side.** `TG_BOT_TOKEN`, `TG_CHAT_ID`, `DEEPSEEK_API_KEY` (and `MOONSHOT_API_KEY`, referenced in `blog/generate/route.ts:30`), `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (min 32 chars, validated at construction — see `neonAuth.ts:4-6`), and `API_SECRET`. The only `NEXT_PUBLIC_*` values are `NEXT_PUBLIC_BASE_URL` and the optional `NEXT_PUBLIC_BLOG_AUTHOR` (blog author-name override), both non-sensitive by design.
- **Deployment store.** Per `.env.example`, the runtime values are supplied as Vercel/Neon dashboard environment variables; marking the secret ones as Vercel *Sensitive* is recommended (not enforced by code). Full variable-by-variable reference lives in [environment.md](./environment.md).

## Logging and notify boundaries (no secrets/PII in logs)

`src/core/logger.ts` is the sanctioned `console` boundary. `warn`/`error` are always emitted (so incidents are diagnosable in Vercel logs); `info`/`debug` are **dev-only** and dropped in production (`logger.ts:19,44-51`).

Routes deliberately avoid leaking PII into error logs. On a DB write failure the lead routes pass only `e.message`, **not** the raw error, because the Drizzle driver wraps failures with the bound `INSERT` params (name/phone — PII) attached:

```ts
} catch (e) {
  // Don't pass the raw driver error to the logger: drizzle attaches the
  // bound INSERT params (name/phone — PII) to the wrapped error.
  logger.error('Failed to store lead', e instanceof Error ? e.message : 'unknown error', 'CONTACT');
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
}
```

(`contact/route.ts:37-42`, `estimate/lead/route.ts:134-139`.) Telegram credentials (`TG_BOT_TOKEN`/`TG_CHAT_ID`) are never logged; on a missing token the code logs a generic warning and stores the lead anyway (`contact/route.ts:77`, `estimate/lead/route.ts:180`). `src/core/notify.ts` follows the same rule — it returns `false` and warns on failure, and never throws or echoes the token (`notify.ts:9-26`). Client-facing error responses are generic (`Internal server error`, `Invalid JSON body`) and never surface stack traces or driver detail.

## Known gaps / absent controls

- **Rate limiting is per-instance and in-memory** — not a durable cross-instance limiter (Upstash/Vercel KV). Documented as best-effort in `rateLimit.ts:20-27`.
- **No security response headers** (CSP, HSTS, X-Frame-Options, etc.) — see above.
- **No CSRF token** on admin mutations in-repo; cross-site protection depends on Neon Auth cookie semantics (see [auth-and-admin.md](./auth-and-admin.md)).
- **SSRF guard is literal-host only** — no protection against DNS rebinding without a network egress policy (`security.ts:52-54`).
- **`/api/contact` has no pre-parse body-size cap** (unlike the estimate routes); it relies on per-field length slicing.

## Related docs

- [auth-and-admin.md](./auth-and-admin.md) — Neon Auth session cookies, the admin role gate, and full `requireAdmin` session flow.
- [api-reference.md](./api-reference.md) — endpoint-by-endpoint request/response contracts (status codes, rate limits, payload shapes).
- [environment.md](./environment.md) — every environment variable, which are secret vs public, and how they're provisioned.

_Last verified against code: 2026-07-03._
