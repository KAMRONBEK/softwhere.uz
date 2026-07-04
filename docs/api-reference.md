# HTTP API Reference

Complete reference for every route under `src/app/api` on the main branch — method, path, auth, params, request/response shapes, errors, and rate limiting.

These are Next.js App Router route handlers. The site runs on Vercel in region `fra1` (`vercel.json`). All handlers return JSON via `NextResponse.json(...)` except `GET /api/og`, which returns a PNG. Every route validates and shapes its own JSON by hand — there is no shared middleware wrapping responses (see [Response conventions](#response-conventions)).

## At a glance

| Method | Path | Area | Auth | Rate limit |
| --- | --- | --- | --- | --- |
| GET | `/api/blog/posts` | blog | Public | — |
| GET | `/api/blog/posts/[slug]` | blog | Public | — |
| GET | `/api/blog/posts/related` | blog | Public | — |
| POST | `/api/blog/generate` | blog | API_SECRET **or** admin session | — (300s budget) |
| POST | `/api/contact` | contact | Public | 5 / 60s per IP |
| POST | `/api/estimate` | estimate | Public | 10 / 60s per IP + 500/day AI budget per instance |
| POST | `/api/estimate/lead` | estimate | Public | 5 / 60s per IP |
| GET | `/api/currency/rates` | currency | Public | — (24h server cache) |
| GET | `/api/admin/leads` | admin | API_SECRET **or** admin session | — |
| GET | `/api/admin/posts` | admin | API_SECRET **or** admin session | — |
| POST | `/api/admin/posts` | admin | API_SECRET **or** admin session | — |
| GET | `/api/admin/posts/[id]` | admin | API_SECRET **or** admin session | — |
| PUT | `/api/admin/posts/[id]` | admin | API_SECRET **or** admin session | — |
| PATCH | `/api/admin/posts/[id]` | admin | API_SECRET **or** admin session | — |
| DELETE | `/api/admin/posts/[id]` | admin | API_SECRET **or** admin session | — |
| POST | `/api/admin/revalidate` | admin | API_SECRET **or** admin session | — |
| GET / POST | `/api/auth/[...path]` | auth | Handled by Neon Auth | — |
| GET | `/api/health` | health | Public | — |
| GET | `/api/health/db` | health | Public | — |
| GET | `/api/og` | og | Public | — (edge runtime) |

## Conventions

### Auth modes

Three access levels appear across the API, all defined in `src/core/auth.ts`:

- **Public** — no auth. Most read endpoints and all public form submissions.
- **API_SECRET Bearer** — machine callers (GitHub Actions generator, cron, curl) send `Authorization: Bearer ${API_SECRET}`. Compared in constant time against `process.env.API_SECRET` (`safeEqual`, fixed-length SHA-256 digests).
- **Admin session** — the browser admin panel. A Neon Auth (Better Auth) httpOnly session cookie whose user carries the `role: 'admin'` claim (`isAdminAuthenticated`).

Protected routes call `requireAdmin(request)` first, which accepts **either** an admin session **or** a valid Bearer secret (`src/core/auth.ts:47`). It returns a `401 { "error": "Unauthorized" }` `NextResponse` to short-circuit, or `null` when authorized:

```ts
export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  // ...authorized
}
```

`isAdminAuthenticated` **fails closed**: if the `NEON_AUTH_*` env is missing or the auth service errors, it logs and returns `false` (`src/core/auth.ts:30`). The Bearer path is only checked when `process.env.API_SECRET` is set. See [auth-and-admin.md](./auth-and-admin.md).

### Response conventions

`src/core/http.ts` defines a generic `ApiResponse<T>` envelope:

```ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

Important: this type is the contract for the **client-side** `apiClient` (`src/core/http.ts`), not a server-side wrapper. Route handlers do **not** uniformly emit it. In practice there are two response styles on the wire:

- **Envelope-style** (`{ success, data | error }`) — used by `contact`, `estimate`, and `estimate/lead`. These align with `ApiResponse`.
- **Bespoke keys** — blog and admin routes return domain keys directly: `{ posts }`, `{ post }`, `{ leads }`, or `{ error }` / `{ error, details }`.

When documenting each endpoint below, the exact on-disk shape is given. Do not assume the envelope unless stated.

### Rate limiting

Three public write endpoints use a best-effort in-memory fixed-window limiter (`src/shared/utils/rateLimit.ts`). It is **per serverless instance, not global** — it blunts casual abuse of the expensive Telegram/AI paths but is not a durable limiter. The client IP comes from `x-forwarded-for` (first hop), falling back to `x-real-ip`; IPv6 is bucketed to its `/64` prefix (`getClientIp`).

On limit, the route returns `429` with a `Retry-After` header (seconds until the window resets):

```json
{ "success": false, "error": "Too many requests. Please try again shortly." }
```

`/api/estimate` adds a second guard: a per-instance daily circuit breaker of `AI_DAILY_BUDGET = 500` paid LLM calls (`src/app/api/estimate/route.ts:25`). See [security.md](./security.md).

### Function limits (Vercel)

`vercel.json` caps every `src/app/api/**/*.ts` handler at `maxDuration = 30`s, with `estimate/route.ts` raised to 60s. Two routes override this via route-segment config in their own file: `blog/generate` sets `export const maxDuration = 300` and `estimate` sets `export const maxDuration = 60`. `og/route.tsx` runs on the **edge** runtime (`export const runtime = 'edge'`).

---

## Blog (public reads)

### GET `/api/blog/posts`

`src/app/api/blog/posts/route.ts` · `export const dynamic = 'force-dynamic'`

Lists published posts (newest first, `content` omitted), capped at 100 via `listPublished(locale, 100)`.

**Query params**

| Param | Required | Notes |
| --- | --- | --- |
| `locale` | No | `en` \| `ru` \| `uz`. Omit to return all locales. Invalid value → 400. |

**Success `200`** — `{ posts: PostSummary[] }` where each item (`src/modules/blog/model/posts.repository.ts:24`):

```json
{
  "posts": [
    {
      "_id": "6f2b1e2a-9c4d-4b1a-8f3e-2b7c9d0a1e55",
      "title": "How much does a Telegram bot cost in Uzbekistan?",
      "slug": "telegram-bot-cost-uzbekistan",
      "createdAt": "2026-06-30T12:00:00.000Z",
      "locale": "uz",
      "coverImage": {
        "url": "https://images.unsplash.com/photo-...",
        "thumbUrl": "https://images.unsplash.com/photo-...&w=200",
        "authorName": "Jane Doe",
        "authorUrl": "https://unsplash.com/@jane",
        "keyword": "telegram"
      },
      "category": "telegram-bots"
    }
  ]
}
```

**Errors** — `400 { "error": "Invalid locale. Allowed: en, ru, uz" }`; `500 { "error": "Failed to fetch posts" }` (internal DB errors are logged, never leaked in the body).

### GET `/api/blog/posts/[slug]`

`src/app/api/blog/posts/[slug]/route.ts`

Returns a single **published** post by `(slug, locale)`.

**Path param** — `slug` (required; empty → 400).

**Query params** — `locale` (`en`|`ru`|`uz`); invalid/absent falls back to `en` via `validateLocale(..., 'en')`.

**Success `200`** — `{ post: IBlogPost }`. Full post including `content` (`src/modules/blog/model/BlogPost.ts:66`):

```json
{
  "post": {
    "_id": "6f2b1e2a-9c4d-4b1a-8f3e-2b7c9d0a1e55",
    "title": "How much does a Telegram bot cost in Uzbekistan?",
    "slug": "telegram-bot-cost-uzbekistan",
    "content": "<article>…rendered HTML…</article>",
    "status": "published",
    "locale": "uz",
    "generationGroupId": "b1d4…",
    "coverImage": { "url": "…", "thumbUrl": "…", "authorName": "…", "authorUrl": "…", "keyword": "…" },
    "category": "telegram-bots",
    "postFormat": "beginner-guide",
    "primaryKeyword": "telegram bot narxi",
    "secondaryKeywords": ["bot yaratish", "chatbot"],
    "metaDescription": "…",
    "contentImages": [ { "url": "…", "thumbUrl": "…", "authorName": "…", "authorUrl": "…", "keyword": "…" } ],
    "createdAt": "2026-06-30T12:00:00.000Z",
    "updatedAt": "2026-06-30T12:00:00.000Z"
  }
}
```

**Errors** — `400 { "error": "Slug is required" }`; `404 { "error": "Post not found" }`; `500 { "error": "Failed to fetch post" }`.

### GET `/api/blog/posts/related`

`src/app/api/blog/posts/related/route.ts`

Given a generation group and a target locale, returns the published sibling post in that locale (used for the "read this in another language" cross-link). Not a category-related-posts endpoint despite the path.

**Query params**

| Param | Required | Notes |
| --- | --- | --- |
| `generationGroupId` | Yes | String, max 128 chars (`MAX_GROUP_ID_LENGTH`). |
| `locale` | Yes | `en` \| `ru` \| `uz`. |

**Success `200`**:

```json
{ "success": true, "post": { "slug": "telegram-bot-narxi", "locale": "ru" } }
```

**Errors** — `400 { "error": "generationGroupId and locale are required" }`; `400 { "error": "Invalid locale. Allowed: en, ru, uz" }`; `400 { "error": "Invalid generationGroupId" }`; `404 { "error": "No related post found in target language" }`; `500 { "error": "Internal server error" }`.

---

## Blog generation (protected)

### POST `/api/blog/generate`

`src/app/api/blog/generate/route.ts` · `export const maxDuration = 300` · **auth: `requireAdmin`**

Runs the full AI blog pipeline: resolve a topic, fetch images, research grounded facts, generate one post per locale, persist, and bust the blog ISR caches. This is the machine entry point hit by the GitHub Actions generator (Bearer `API_SECRET`). See [blog-pipeline.md](./blog-pipeline.md).

**Request body** (all fields optional; the topic source is resolved by precedence):

| Field | Type | Notes |
| --- | --- | --- |
| `category` | string | A `SERVICE_PILLARS` id, `'random'`, or `'auto'`. Invalid non-random/non-auto → 400. |
| `customTopic` | string | Max `MAX_CUSTOM_TOPIC_LENGTH` chars; AI-normalized before use. |
| `sourceUrl` | string | Must parse as a URL; text is extracted from it. Fetch failure → 400. |
| `sourceText` | string | Max `MAX_SOURCE_TEXT_LENGTH` chars; classified into a topic. |
| `locales` | string[] | 1–3 of `en`/`ru`/`uz`; default `['en','ru','uz']`. |
| `generationGroupId` | string | **Continuation mode**: reuse an existing group's topic/images/meta to generate missing locales. |

Topic-source precedence when **not** in continuation mode: `sourceUrl` → `sourceText` → `customTopic` → `category` (non-`auto`) → smart auto-select (`smartSelectTopic`). In continuation mode (`generationGroupId` present), the topic/cover/images are rebuilt from the existing group's English row, the group's EN body is reused as the ru/uz anchor, and requests are rejected for locales the group already has (409) or for `en` when the group has no EN post to rebuild the topic from (409).

Example (auto weekly generation, all locales):

```bash
curl -X POST https://softwhere.uz/api/blog/generate \
  -H "Authorization: Bearer $API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"category":"auto","locales":["en","ru","uz"]}'
```

**Success `200`**:

```json
{
  "success": true,
  "message": "Generated 3 blog post(s)",
  "posts": [
    {
      "id": "6f2b1e2a-9c4d-4b1a-8f3e-2b7c9d0a1e55",
      "title": "…",
      "slug": "…",
      "locale": "en",
      "status": "draft",
      "category": "web-app-development",
      "postFormat": "beginner-guide"
    }
  ],
  "generationGroupId": "b1d4c0e2-…",
  "topic": "…",
  "format": "beginner-guide",
  "pillar": "web-app-development"
}
```

Note: generated posts are created by the pipeline (`persistLocalePost`) and the response echoes each post's `status` — the machine generator publishes separately (via the admin PATCH/revalidate path).

**Errors**

- `401 { "error": "Unauthorized" }` — missing/invalid auth.
- `400` — validation: `customTopic must be a string of N characters or fewer`, `sourceText must be a string of N characters or fewer`, `sourceUrl must be a string` / `sourceUrl must be a valid URL` / `Could not fetch the provided URL`, `locales must be an array of 1-3 items`, `Invalid locales: …`, `Invalid category`, `No topics for category`, `generationGroupId must be a string`.
- `404 { "error": "No post found for the given generationGroupId" }` — continuation mode with an unknown group.
- `409 { "error": "Locale(s) already exist in this group: … — use the regenerate workflow to re-draft them" }` — continuation would duplicate an existing locale.
- `409 { "error": "This group has no EN post to rebuild the topic from — recreate the group instead of continuing it" }` — `en` requested but the group's EN row is gone (the stored topic is localized).
- `500 { "error": "Failed to generate any posts" }` — every locale failed.
- `500 { "error": "Internal server error" }` — unexpected error.

At import time the route logs an error (not a response) if neither `MOONSHOT_API_KEY` nor `DEEPSEEK_API_KEY` is set, and separately if `DATABASE_URL` is unset.

---

## Contact (public)

### POST `/api/contact`

`src/app/api/contact/route.ts` · **rate limit: 5 / 60s per IP**

Captures a contact-form lead: stores it durably first (system of record via `createLead`), then best-effort sends a Telegram notification and records the outcome (`markLeadNotified`). Always reports success once the lead is stored, regardless of Telegram.

**Request body**

| Field | Required | Notes |
| --- | --- | --- |
| `name` | Yes | Truncated to `MAX_FIELD_LENGTH = 2000`. |
| `phone` | Yes | Truncated to 2000. |
| `message` | No | Truncated to 2000; `null` if absent. |
| `from` | No | Free-text source label; truncated to 50. |

```json
{ "name": "Ali", "phone": "+998901234567", "message": "Need a shop app", "from": "homepage-hero" }
```

**Success `200`** — `{ "success": true }`.

**Errors** — `400 { "success": false, "error": "Name and phone are required" }`; `429 { "success": false, "error": "Too many requests. Please try again shortly." }` (+ `Retry-After`); `500 { "success": false, "error": "Internal server error" }` (raw DB errors are scrubbed — Drizzle attaches PII bind params, so only `.message` is logged).

Telegram fields are HTML-escaped (`escapeHtml`) because the message is sent with `parse_mode=html`. If `TG_BOT_TOKEN`/`TG_CHAT_ID` are unset, the lead is stored and a warning is logged (no notification). See [security.md](./security.md).

---

## Estimate (public)

### POST `/api/estimate`

`src/app/api/estimate/route.ts` · `export const maxDuration = 60` · **rate limit: 10 / 60s per IP + 500/day AI budget per instance**

Computes a deterministic formula estimate, then refines it with a paid LLM call (Kimi/DeepSeek via `safeGenerateJSONWithTimeout`, strict JSON schema, `AI_TIMEOUT_MS = 25_000`, `AI_MAX_TOKENS = 900`). Uzbek prefers the `deepseek` provider. See [estimator.md](./estimator.md).

**Guards** — body capped at `MAX_BODY_BYTES = 32 * 1024` (→ 413); invalid JSON → 400; `sanitizeEstimatorInput` rejects non-estimator shapes (→ 400).

**Request body**

| Field | Required | Notes |
| --- | --- | --- |
| `input` | Yes | `EstimatorInput` (`src/modules/estimator/types.ts:10`). Server-side whitelisted against the catalog by `sanitizeEstimatorInput`; unknown enum ids are silently dropped. |
| `locale` | No | `en`/`ru`/`uz`; controls the AI narrative language. Defaults to `en`. |

```json
{
  "locale": "uz",
  "input": {
    "projectType": "mobile",
    "subtype": "ecommerce",
    "platforms": ["ios", "android"],
    "approach": "cross",
    "tier": "mvp",
    "screens": 12,
    "features": ["auth", "payments"],
    "integrations": ["payme"],
    "techStack": [],
    "autoTech": true,
    "design": "custom",
    "languages": 2,
    "urgency": "normal",
    "description": "Marketplace with vendor accounts"
  }
}
```

**Success `200`** — envelope-style `{ success: true, data: EstimateApiResponse }` where `data` is `{ formula: EstimateResult, ai: AiRefinement | null }` (`src/modules/estimator/types.ts:76`):

```json
{
  "success": true,
  "data": {
    "formula": {
      "hours": { "min": 320, "max": 480 },
      "cost": { "min": 4800, "max": 7200 },
      "weeks": { "min": 8, "max": 12 },
      "supportMonthly": 300,
      "rate": 15,
      "team": ["team.pm", "team.dev", "team.qa"],
      "breakdown": [
        { "id": "base", "labelKey": "base.mobile", "hours": 120, "kind": "base" }
      ],
      "multiplier": 1.2
    },
    "ai": {
      "cost": { "min": 5000, "max": 8000 },
      "weeks": { "min": 9, "max": 13 },
      "summary": "…localized narrative…",
      "risks": ["…"],
      "suggestions": ["…"],
      "confidence": "medium",
      "provider": "deepseek"
    }
  }
}
```

`ai` is `null` when the daily AI budget is exhausted (still `200` with formula only), when the model returns invalid/garbage numbers (rejected rather than fabricated — the returned numbers are clamped against the formula via `clampAiRange`), or when parsing fails.

**Errors** — `400 { "success": false, "error": "Invalid JSON body" }` / `"Invalid estimator input" }`; `413 { "success": false, "error": "Request body too large" }`; `429` (+ `Retry-After`); `500 { "success": false, "error": "Failed to process estimate request" }`.

### POST `/api/estimate/lead`

`src/app/api/estimate/lead/route.ts` · **rate limit: 5 / 60s per IP**

Captures an estimator lead (name/phone + the estimator config). Stores the lead first, then fires the Telegram notification **after the response is sent** via `after()` (an 8s-timeout fetch) so a slow Telegram can't stall the client into a duplicate submit. Recomputes the formula server-side and re-clamps the client-echoed AI block — client numbers are never trusted for the record.

**Request body**

| Field | Required | Notes |
| --- | --- | --- |
| `name` | Yes | Cleaned single-line, max 200. |
| `phone` | Yes | Cleaned, max 50; must have ≥ 9 digits after stripping non-digits. |
| `input` | Yes | `EstimatorInput`, sanitized like `/api/estimate`. |
| `comment` | No | Cleaned, max 1000. |
| `contact` | No | `'telegram'` or `'call'` (default `call`). |
| `ai` | No | Client-echoed AI block `{ cost:{min,max}, weeks:{min,max}, confidence, provider }`; re-validated and clamped, else dropped. |
| `locale` | No | Two-letter code; defaults `en`. |

`cleanLine` strips control chars, Unicode bidi overrides, and collapses whitespace so a crafted name can't forge extra lines in the Telegram message. Body cap `MAX_BODY_BYTES = 32 * 1024` (→ 413).

**Success `200`** — `{ "success": true }`.

**Errors** — `400 { "success": false, "error": "Invalid JSON body" }` / `"Name and phone are required" }` / `"Invalid estimator input" }`; `413 "Request body too large"`; `429` (+ `Retry-After`); `500 "Internal server error"`.

---

## Currency (public)

### GET `/api/currency/rates`

`src/app/api/currency/rates/route.ts`

Returns USD-based exchange rates, cached in-instance for 24h (`CACHE_MS`). Uses `v6.exchangerate-api.com` when `EXCHANGERATE_API_KEY` is set, else the free `open.er-api.com` endpoint. Accepts both response shapes (`conversion_rates`/`rates`, `base_code`/`base`).

**Success `200`**:

```json
{ "base": "USD", "rates": { "USD": 1, "UZS": 12650.5, "RUB": 91.2, "EUR": 0.92 } }
```

**Errors** — `502 { "error": "Failed to fetch rates" }` (upstream non-2xx); `502 { "error": "Invalid response" }` (upstream `result: 'error'` or empty rates — deliberately **not** cached, so the client keeps its USD default); `500 { "error": "Failed to fetch rates" }`.

---

## Admin (protected)

All admin routes call `requireAdmin` first (admin session **or** Bearer `API_SECRET`), returning `401 { "error": "Unauthorized" }` on failure. See [auth-and-admin.md](./auth-and-admin.md).

### GET `/api/admin/leads`

`src/app/api/admin/leads/route.ts`

Lists recent leads (newest first, up to 200 via `listLeads`).

**Success `200`** — `{ leads: LeadSummary[] }` (`src/modules/contact/model/leads.repository.ts:27`):

```json
{
  "leads": [
    {
      "id": "a1b2…",
      "name": "Ali",
      "phone": "+998901234567",
      "message": "Need a shop app",
      "source": "estimator",
      "notifiedTelegram": "sent",
      "createdAt": "2026-07-01T09:15:00.000Z"
    }
  ]
}
```

`notifiedTelegram` is `'pending' | 'sent' | 'failed'` — `failed` rows are effectively a retry queue.

**Errors** — `401`; `500 { "error": "Failed to fetch leads" }`.

### GET `/api/admin/posts`

`src/app/api/admin/posts/route.ts`

Lists **all** posts (any status), newest first, without `content` (`listForAdmin`).

**Success `200`** — `{ posts: AdminPostSummary[] }` (`src/modules/blog/model/posts.repository.ts:34`): each item has `_id, title, slug, status, locale, generationGroupId?, coverImage?, category?, createdAt, updatedAt`.

**Errors** — `401`; `500 { "error": "Failed to fetch posts", "details": "<error.message>" }`.

### POST `/api/admin/posts`

`src/app/api/admin/posts/route.ts`

Creates a blog post, then busts the blog ISR caches (`revalidateTag('blog-posts')`, `revalidatePath('/[locale]/blog/[slug]')`).

**Request body** — required: `title`, `slug`, `content`, `status` (`draft`|`published`), `locale` (`en`|`ru`|`uz`); optional: `generationGroupId`.

```json
{ "title": "…", "slug": "my-post", "content": "<article>…</article>", "status": "draft", "locale": "en" }
```

**Success `201`** — `{ "message": "Post created successfully", "post": IBlogPost }`.

**Errors** — `401`; `400 { "error": "Missing required fields (title, slug, content, status, locale)" }`; `400 { "error": "Invalid status value" }`; `400 { "error": "Invalid locale value" }`; `409 { "error": "Slug \"<slug>\" already exists for locale \"<locale>\"" }`; `500 { "error": "Failed to create post", "details": "<error.message>" }`.

### GET `/api/admin/posts/[id]`

`src/app/api/admin/posts/[id]/route.ts`

Fetches a full post by id (any status). `id` must be a UUID (`isValidPostId`).

**Success `200`** — `{ "success": true, "post": IBlogPost }`.

**Errors** — `401`; `400 { "error": "Invalid post ID" }`; `404 { "error": "Post not found" }`; `500 { "error": "Internal server error" }`.

### PUT `/api/admin/posts/[id]`

Full update. Requires the same fields as create (`title, slug, content, status, locale`). Checks slug collision only when the slug changed (`slugTaken(slug, locale, id)`). On `status: 'published'` it awaits an IndexNow ping for the post URL (`pingIndexNow`). Busts blog caches.

**Success `200`** — `{ "success": true, "message": "Post updated successfully", "post": IBlogPost }`.

**Errors** — `401`; `400 "Invalid post ID"`; `400 "Missing required fields (…)"`; `400 "Invalid status value"`; `400 "Invalid locale value"`; `404 "Post not found"`; `409 "Slug \"…\" already exists for locale \"…\""`; `500 "Internal server error"`.

### PATCH `/api/admin/posts/[id]`

Partial update. Only `PATCH_ALLOWED_FIELDS` are applied: `status`, `title`, `content`, `slug`, `locale`. This is the admin UI's real publish path — `PATCH {status:'published'}` triggers the awaited IndexNow ping. Busts blog caches.

**Success `200`** — `{ "success": true, "post": IBlogPost }`.

**Errors** — `401`; `400 "Invalid post ID"`; `400 { "error": "No valid fields to update" }`; `400 "Invalid status value"`; `400 "Invalid locale value"`; `404 "Post not found"`; `500 "Internal server error"`.

> Note: PATCH does not slug-collision-check (unlike PUT); a slug change here can violate the `(locale, slug)` unique index and surface as the generic `500`.

### DELETE `/api/admin/posts/[id]`

Deletes a post by id and busts blog caches.

**Success `200`** — `{ "success": true, "message": "Post deleted successfully" }`.

**Errors** — `401`; `400 "Invalid post ID"`; `404 "Post not found"`; `500 "Internal server error"`.

### POST `/api/admin/revalidate`

`src/app/api/admin/revalidate/route.ts`

Busts all blog ISR caches so new/edited posts surface immediately. Called by the GitHub Actions generator (Bearer `API_SECRET`) after auto-publishing, and usable from the admin session. Revalidates the `blog-posts` tag, the blog list/detail pages, each per-locale `feed.xml`, and `sitemap.xml`.

**Request body** — none.

**Success `200`** — `{ "success": true }`.

**Errors** — `401`; `500 { "error": "Revalidation failed" }`.

---

## Auth

### GET / POST `/api/auth/[...path]`

`src/app/api/auth/[...path]/route.ts` · `export const dynamic = 'force-dynamic'`

Catch-all that mounts Neon Auth (Better Auth) endpoints — sign-in/out, session, OAuth, etc. The browser client (`createAuthClient`) targets `/api/auth` by default. The handler is built lazily (`getAuth().handler()`) so a missing `NEON_AUTH_*` env does not throw at import time — it 500s per request instead. Request/response shapes are owned by Neon Auth, not this repo. See [auth-and-admin.md](./auth-and-admin.md).

---

## Health

### GET `/api/health`

`src/app/api/health/route.ts` — liveness only, no dependencies.

**Success `200`** — `{ "status": "healthy", "timestamp": "2026-07-03T12:00:00.000Z" }`.

### GET `/api/health/db`

`src/app/api/health/db/route.ts` — DB connectivity via `pingDb()` (`select 1`).

**Success `200`** — `{ "status": "healthy", "duration": "12ms" }`.

**Error** — `503 { "status": "unhealthy" }` when the DB ping throws.

---

## OG image

### GET `/api/og`

`src/app/api/og/route.tsx` · `export const runtime = 'edge'`

Generates a 1200×630 PNG social card via `next/og` `ImageResponse` (returns an **image**, not JSON).

**Query params**

| Param | Notes |
| --- | --- |
| `title` | Card title; defaults to `SoftWhere.uz - Mobile App & Web Development`. Font size shrinks over 50 chars. |
| `locale` | `en`/`ru`/`uz` (default `en`); selects the localized subtitle. |
| `image` | Optional background. **Only `images.unsplash.com` over https is allowed** (SSRF guard); anything else falls back to the brand gradient. |

Loads a Noto Sans glyph subset from Google Fonts so Cyrillic titles don't render as tofu. Cache-Control is aggressive (`immutable, max-age=31536000`) **only** when the proper font loaded; otherwise `max-age=3600` so a fallback render isn't pinned for a year.

**Success `200`** — `Content-Type: image/png`.

**Error** — `500` plain-text `Failed to generate image` (returned as a `Response`, not JSON).

---

## Related docs

- [auth-and-admin.md](./auth-and-admin.md) — admin session model, Neon Auth, and the `requireAdmin` gate.
- [security.md](./security.md) — rate limiting, input sanitization, Telegram HTML escaping, SSRF guards.
- [blog-pipeline.md](./blog-pipeline.md) — what `POST /api/blog/generate` orchestrates end to end.
- [estimator.md](./estimator.md) — the formula engine and AI refinement behind `/api/estimate`.
- [seo.md](./seo.md) — IndexNow pings, revalidation, feeds, and the OG image.
- [database.md](./database.md) — Neon/Drizzle schema and the repository layer these routes call.
- [architecture.md](./architecture.md) — the core → shared → modules → app layering.
- [Project README](../README.md)

_Last verified against code: 2026-07-03._
