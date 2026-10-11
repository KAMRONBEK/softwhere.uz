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
| GET | `/api/admin/ai-brief` | admin | API_SECRET **or** admin session | — |
| PUT | `/api/admin/ai-brief` | admin | API_SECRET **or** admin session | — |
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

### POST `/api/estimate/brief`

`src/app/api/estimate/brief/route.ts` · **one free brief per visitor a day** (+ 3 requests / 10 min and 5 attempts / day per IP) · `maxDuration = 120` (route + `vercel.json`)

Plain-words idea → AI project brief (`src/modules/estimator/ai-brief/`). **Who writes it is the admin's switch** (`/admin/ai-demo`, `GET/PUT /api/admin/ai-brief`): Kimi (the default, described below) or DeepSeek Flash with Kimi as the fallback; every run is recorded for the admin's usage and spend stats. Contact details are scrubbed from the idea before any model call; the idea text is never logged. Five Kimi calls, each with a `deepseek-flash` fallback (since 2026-10-11, was `kimi-k2.6`; without `DEEPSEEK_API_KEY` the chain falls back to `kimi-k2.6` as before — `usableChain` in `chains.ts`) and one retry on a dropped connection (`BRIEF_PART_CHAINS` in `constants.ts`). DeepSeek runs `json_object` with the schema appended to the system prompt and the same validators; the flash scope thinks `high`, the later calls answer without thinking and retry once on flash with thinking `low` when the answer is unusable; every DeepSeek call has a hard abort timer (the SDK timeout stops counting once headers arrive). The hedges (scope 38 s, later calls 27 s) start the flash fallback in parallel. The Uzbek copy-edit stays on Kimi only (skipped when Kimi is down). The calls: (1) **scope** on `kimi-k3` at reasoning effort `high` (catalog ids only) → deterministic rules (`reconcile.ts`: market — incl. Kazakhstan/Russia on Russian pages, OFD with consumer payments, no interest-bearing installments in the MVP, no unrequested extra products, a bot's live operator = bot admin, an AI tool people log in to = web portal, roles & permissions when the MVP has two kinds of users with their own screens, a pilot never prices the rollout to the whole organization, a stack and complexity flags that follow what is priced — no cloud hosting for an on-premise idea, Uzbek TAS-IX hosting only for Uzbekistan; uz/ru pages always price an Uzbek + Russian interface, whether or not the idea names languages, and a third language only when the idea names one beyond them, e.g. "+ English" — `DEFAULT_UI_LANGUAGES`; en pages price the languages the idea names, else one) → the engine prices it (tier and screen count set by rule, `mapping.ts`) → the **consistency guard** (`guard.ts`) drops summary sentences, audience lines and assumptions that contradict the priced scope (including a different number of interface languages than priced: a third language nobody priced, or "Uzbek only" next to the priced Uzbek + Russian — while "Uzbek + Russian" copy, its language switch and its translation risks stay); then, in parallel on `kimi-k3` at effort `low`, (2) **plan** (build first, can wait, phases), (3) **risks** (risks, discovery questions) and (4–5) **wireframes** in two halves (the main user's journey; the other roles, the operator view and one later screen), all written against the *priced* scope and checked against it (`parseNarrative.ts`, `screens.ts`), then the guard drops MVP wireframe copy and MVP narrative that shows unpriced or later work (including a language switch that offers more languages than priced) and any leaked prompt framing (words put in the reader's mouth — "as you confirmed" — are stripped as clauses; a "build first" whose lead sentence fails is rebuilt from the MVP deliverables instead of leaving a fragment). The timeline keeps at most five deliverables per phase, one per scope ref, chosen by kind (the product's own work and the systems it connects before sign-up/roles/profiles); a search field or filter chips on the product's own screens needs "Search & filters" in the MVP; a screen drawn inside a third-party system ("… in Zendesk") is dropped; one sample item keeps one price across both wireframe halves. Two helper calls never block a brief: **samples** (`kimi-k3` low, in parallel with call 1) writes the items, prices and places both wireframe halves reuse — passed only for customer-facing products (`SAMPLE_PRODUCTS`); on **uz** pages a **copy-edit** (`polish.ts`, `kimi-k3` low, 20 s limit, `UZ_POLISH_ENABLED`) returns find → replace fixes for the scope text (while calls 2–5 run), the plan, the risks and the wireframes (each as soon as its call is back), each part in balanced parallel chunks (`POLISH_CHUNK_STRINGS` / `POLISH_CHUNK_CHARS`); its prompt carries the native reviewers' glossary and every string containing a flagged term carries a "check" (`uzGlossary.ts`), while errors with one reading are fixed outright (`polishUzbek` in `cleanText.ts`); a fix that changes a number, adds a price or duration, drops a brand, writes Cyrillic, only changes the case of the first letter or swaps "we" and "you" in a question is refused, and the guard runs on the edited text. A rejection or policy decline stops after call 1. A **very large idea** (`bigIdea.ts`: a named enterprise suite being replaced — SAP, S/4HANA, Oracle ERP/E-Business, Dynamics, NetSuite, 1C:ERP as the object of the replace verb, so "replace Excel with a simple ERP" is not one — or a generic/"complete" ERP with an engine MVP of 900+ h (`BIG_IDEA_ERP_MIN_MVP_HOURS`), or 1,000+ staff (people count only as staff, never visitors or students) / 3+ plants / 50+ own branches with an engine MVP of 300+ h, or an engine MVP ≥ 1,200 h / full vision ≥ 2,000 h — decided by rule, never by the model) still gets its plan, risks, questions and screens, but `estimate.mode` is `'discovery'`: no price, hours or weeks anywhere in the payload, phases without durations, and the page shows "This needs a discovery call" instead of the price card. **Every price and week comes from the estimator engine** (`calculateEstimate`); the model never sees a number. uz/ru get the engine range as-is, en gets `hours.min × $14` (floored at the engine min) … `hours.max × $40`. **No hour count or hourly rate leaves the server** (founder rule 2026-10-10): the payload carries price ranges and weeks only — `PricedEstimate` has no `hours`; the engine hours feed the EN price and the big-idea rule server-side (`engineSize` in `mapping.ts`), and the page says the range becomes an exact price once the details are agreed and the technical specification is written. **One free brief per visitor a day** (founder decision 2026-10-10, was five; `DAILY_LIMIT_PER_IP` + `ai-brief/allowance.ts`): the visitor is the client IP for now — accounts come later. The brief is held when a run starts and given back when the run ends without one (rejected, declined, failed, budget refusal), so rephrasing a "too vague" idea is free; a delivered brief (priced or discovery-call) keeps the slot for 24 h from when it started. A visitor who already has today's brief gets `429 daily_limit` before any attempt is counted; attempts (delivered or not) are separately capped at 3 / 10 min (`BURST_LIMIT`) and 5 / day (`DAILY_ATTEMPTS_PER_IP`), which bounds the paid scope calls a rejected idea costs. Like every limiter here it is in memory per warm instance (reset on a cold start) — a casual-use limit, not a durable one. Per-instance daily cap `AI_BRIEF_DAILY_USD` (default $3.00 since 2026-10-10, was $1.50 — ≈ 12 uz or 25–35 en/ru briefs a day at list prices) / `AI_BRIEF_DAILY_CALLS` (default 150 — not the binding limit: every priced brief costs $0.06–0.31); an empty, zero or invalid value falls back to the default; every brief in flight holds a $0.30 reserve against it until its cost is recorded, so a burst of parallel requests cannot overshoot the cap. **Overflow** (`ai-brief/lanes.ts`): once that cap is spent, briefs run fully on `deepseek-flash` (no Uzbek copy-edit, `overflowRunOptions` in `chains.ts`) under their own cap `AI_BRIEF_OVERFLOW_DAILY_USD` (default $1, $0.05 reserve) / `AI_BRIEF_OVERFLOW_DAILY_CALLS` before the route answers `503 busy`; no overflow without a DeepSeek key. The per-visitor allowance is the same for both. **Quality guards** (`specifics.ts`, applied by `guard.ts` and scored by `consistency.ts` as `invented_detail` / `template_leak`): invented branches, cities, brand/company names and — on English pages — Uzbek places, personal names or so'm are dropped; delivery words in a product that delivers nothing (a taxi, a school), app-store risks without a mobile app, in-app-purchase risks on goods/in-person services and budget/timeline filler risks or budget questions when the idea names no budget are dropped; MVP wireframe blocks whose kind is not priced in the MVP (a map when maps come later) and later-screen copy showing what no price covers are dropped. Uzbek brief text is converted to oʻ/gʻ (U+02BB) and the tutuq belgisi ʼ (U+02BC) as the very last step (`uzLetters.ts`); the site's own uz copy is written with ʻ/ʼ directly (checked by `tests/i18n/parity.ts`).

**Request body** — `{ "idea": string (≤ 3000 chars), "locale": "uz" | "ru" | "en" }` (unknown locale → `en`). Body cap 16KB.

**Success `200`** — `{ "success": true, "data": <outcome> }` where outcome is one of:

- `{ "status": "ok", "brief": AiBrief }` — see `src/modules/estimator/ai-brief/types.ts` (scope, `screens` wireframe specs — may be `[]` if that call failed, `estimate` — `mode: 'priced'` with `mvp` / `fullVision` / `phases` / `extras` / `drivers`, or `mode: 'discovery'` with `reasons` / `team` / weekless `phases` and no number — localized `narrative`, `policy`).
- `{ "status": "rejected", "reason": "not_software" | "abusive" | "too_vague" | "too_short" }`
- `{ "status": "declined_policy", "topics": [...], "note": string }` — the core product is outside the published work policy (`ENFORCE_POLICY_DECLINE`); `note` is one calm sentence in the page language.

**Errors** — `{ "success": false, "code", "error" }`: `400 invalid_input | too_long`; `413 too_large`; `429 daily_limit` (today's free brief is used; `Retry-After` = seconds until the next one) / `429 rate_limited` (+ `Retry-After`); `503 busy` (daily cap) / `ai_unavailable` / `invalid_output` / `timeout`; `500 internal`. The UI should key its error state on `code` — `daily_limit` is not an error on the page but its "come back tomorrow" state.

**Streaming (what the page uses)** — send `Accept: application/x-ndjson` and an accepted brief streams as NDJSON (`src/modules/estimator/ai-brief/stream.ts`): `{"type":"accepted"}`, then `{"type":"progress","progress":{"stage":"scoped","preview":…}}` (~20–30s: title, scope and every engine number), `{"stage":"screens","screens":[…]}` (both wireframe halves merged) and `{"stage":"narrative"}` (plan and risks both in) in either order, and finally one `{"type":"result","data":<outcome>}` or `{"type":"error","code":…}` line. Rate limit, validation and budget refusals still answer with the JSON errors above. Without the header the route answers with one JSON body as before.

**UI** — `/[locale]/ai-estimate` (noindex, not in the sitemap, not linked yet) renders `AIBriefSection` (`src/modules/estimator/components/brief/`), which also has a `compact` variant for a homepage section; it dispatches a bubbling `ai-brief:status` event (`idle` / `thinking` / `done`) for the lab's AI section, which renders it in its `ai-demo` slot (`/[locale]/lab/home`). "Talk to us about this plan" (or, for a very large idea, "Book a discovery call") prefills the contact form through `src/shared/utils/contactPrefill.ts` (nothing is sent). The price card shows the range, weeks, team, what is and isn't included and the assumptions, with the note "This is a range. The exact price comes after we agree the details and write the technical specification together." — no hours or rates anywhere. The page keeps the last finished brief per locale in **localStorage** for 7 days (`briefStorage.ts`), together with when the visitor's next free brief opens: once today's is used, a reload or a return visit shows that brief with "Talk to us about this plan" and "Try the step-by-step estimator" (no "plan another idea") and when the next free plan opens; with no saved brief for the page's locale, a calm "You've used today's free plan" card (`DailyLimit.tsx`) takes the composer's place with "Talk to us about your project" (prefilled with the idea in the field, if any) and the estimator. A `429 daily_limit` sets the same state and brings back a saved brief if there is one. Client tests: `npx tsx tests/ai-brief/client.ts` and `tests/ai-brief/daily-limit.ts`.

Eval harness: `npx tsx scripts/eval-ai-brief.ts --chain` (production chains and deadline; `--label` names the run), `--model kimi-k3`, or `--variant a,b,c` (a = k3-low everywhere, b = k2.6 wireframes, c = k3-high scope — the production configuration without its fallback) with `--repeat N` for per-case price / screen / scope variance, over `scripts/eval-ai-brief.cases.json` (60 cases tagged `round1`, `us`, `uz-colloquial`, `ru`, `tricky`; select with `--tags` or `--cases`, `--merge` re-runs a few into an existing output dir). Every brief is scored by the deterministic consistency checker (`consistency.ts`: MVP wireframes, MVP narrative, summary/audience and assumptions against the priced scope; framing leaks) both before and after the request-path guard; `--recheck <dir>` re-scores saved runs without API calls, `--replay <dir> --out <dir2>` re-runs everything after the model (parsers, rules, engine, guard, checks — the current code; saved copy-edit fixes are re-checked by the current refusal rules) on the saved model answers for $0, `--list` prints the case set, `--min-balance` stops below a Moonshot balance floor, `--no-samples` / `--no-polish` switch the helper calls off for an A/B, and `--polish-test <dir> --out <dir2>` runs the Uzbek copy-edit alone on saved uz briefs (paid, ~$0.03 a brief; `--polish-model` compares models). `--cases` runs in the order given and `--repeat N` runs repeat-major, so a run the budget stops early still holds whole passes. Unit tests: `npx tsx tests/ai-brief/logic.ts`, `tests/ai-brief/iteration.ts`, `tests/ai-brief/iteration2.ts`, `tests/ai-brief/iteration3.ts`, `tests/ai-brief/round3.ts`, `tests/ai-brief/round3-review.ts`, `tests/ai-brief/consistency.ts`, `tests/ai-brief/daily-limit.ts` (allowance, quota state, no hours on the page, the overflow lane), `tests/ai-brief/providers.ts` (provider routing, DeepSeek params and prices, the hard timeout, against local fake endpoints) and `tests/ai-brief/quality.ts` (Uzbek letters, invented specifics, template leakage, the wireframe guard). `--variant kimi,overflow,ds-flash,ds-pro,ds-mix,kimi-flash` compares the production chains with the DeepSeek presets (`chains.ts`; `--ds-thinking` sets DeepSeek thinking; `--ds-min-balance` guards the DeepSeek balance).

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

### GET / PUT `/api/admin/ai-brief`

`src/app/api/admin/ai-brief/route.ts` — the admin page `/[locale]/admin/ai-demo` (2026-10-11).

**GET** → `{ success: true, data: { settings, stats, balances, configured, caps } }`: `settings` = `{ provider: 'kimi' | 'deepseek', updatedAt }` (who writes the AI briefs); `balances` = each provider account's live prepaid balance (`getProviderBalances` in `src/core/ai.ts`; `null` = no key or no answer); `caps` = the per-instance daily caps (`ai-brief/caps.ts`); `stats` (`getBriefStats` in `src/modules/estimator/model/briefRuns.repository.ts`) = summaries for today / 7 days / 30 days / all time (requests, delivered, rejected, failed, cap-reached, unique visitors, spend total and per provider, tokens, average time, backup calls), today's spend per lane since UTC midnight, a 30-day daily series and per-language / per-provider groups (Tashkent days), and the latest 50 runs. Spend is the per-call list-price estimate the caps use.

**PUT** `{ "provider": "kimi" | "deepseek" }` → `{ success: true, data: { settings } }`; anything else `400`. Every instance re-reads the switch within 30 s (`getBriefProvider`). `'kimi'` = the production chains (Kimi K3, deepseek-flash fallback); `'deepseek'` = deepseek-flash for every call with Kimi K3 (effort low) as the fallback (`providerChainSet` in `chains.ts`). The overflow lane stays on deepseek-flash either way.

Rows come from `POST /api/estimate/brief`: one `ai_brief_runs` row per finished run (plus a `busy` row when both caps are spent) — metadata only: no idea text, no IP (`visitor_hash` is an HMAC of it, `ai-brief/runRecord.ts`). A database error never fails a brief: the run is just not recorded and the last known (else default) provider is used. Tables: `drizzle/0001_ai_brief_admin.sql`. Tests: `npx tsx tests/ai-brief/admin.ts`.

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

Creates a blog post, then busts the blog ISR caches through the shared `revalidateBlogCaches()` helper (`blog-posts` tag, the new post's path plus its locale siblings and category-mates, the blog list, feeds, sitemap).

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

Busts blog ISR caches so new/edited posts surface immediately. Called by the GitHub Actions generator (Bearer `API_SECRET`) after auto-publishing, and usable from the admin session. Always revalidates the `blog-posts` tag, the blog list pages, each per-locale `feed.xml`, and `sitemap.xml`.

**Request body** (optional) — `{ "paths": ["/uz/blog/<slug>", ...] }`. When given, only those post pages are revalidated (paths must match `/{en|ru|uz}/blog/<slug>`, max 100). Without it, **every** post page is purged (`revalidatePath('/[locale]/blog/[slug]', 'page')`), which re-renders the whole blog on Fluid CPU as crawlers return — scripts should always send their written paths.

**Success `200`** — `{ "success": true, "targeted": <number of targeted paths> }`.

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
| `sig` | HMAC signature over `title`+`locale`+`image` (see `src/core/og.ts`). **Required whenever `title` or `image` is present** — each unique URL is a ~2.6s satori render, so unsigned free-form input was an unbounded CPU surface. Unsigned/invalid → `308` to `/api/og?locale=<locale>` (the bounded default card). Bare or locale-only requests need no signature. Fail-open when `API_SECRET` is unset (local dev). |

Metadata builders must construct these URLs with `buildOgUrl()` from `src/core/og.ts` — never by hand. Loads a Noto Sans glyph subset from Google Fonts so Cyrillic titles don't render as tofu. Cache-Control is aggressive (`immutable, max-age=31536000`) **only** when the proper font loaded; otherwise `max-age=3600` so a fallback render isn't pinned for a year.

**Success `200`** — `Content-Type: image/png`. **`308`** — unsigned/invalid `sig` (see above), long-cached.

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

_Last verified against code: 2026-09-03._
