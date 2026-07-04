# Environment Variables

Authoritative catalog of every environment variable the softwhere.uz app and its tooling read, where each is consumed, and how env is loaded, validated, and synced from Vercel.

## At a glance

Scope legend: **server** = server-only (never sent to the browser); **client** = `NEXT_PUBLIC_*`, inlined into client bundles at build time; **tooling** = read only by local scripts / MCP servers / CI, not by the running app; **platform** = injected by the host (Vercel / GitHub Actions).

| Variable | Scope | Required? | Subsystem | Read in |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | server | Required | Neon Postgres (Drizzle) | `drizzle.config.ts`, repository layer |
| `NEXT_PUBLIC_BASE_URL` | client | Recommended | Canonical URLs, SEO, scripts | `src/core/constants.ts:61` |
| `MOONSHOT_API_KEY` | server | Optional* | AI primary (Kimi K2.6) | `src/core/ai.ts:39` |
| `KIMI_API_KEY` | server | Optional* | AI primary (alt name for Moonshot key) | `src/core/ai.ts:39` |
| `DEEPSEEK_API_KEY` | server | Optional* | AI fallback (DeepSeek V4 Pro) | `src/core/ai.ts:48` |
| `AI_BASE_URL` | server | Optional | AI primary base URL override | `src/core/ai.ts:38` |
| `AI_MODEL` | server | Optional | AI primary model override | `src/core/ai.ts:40` |
| `AI_FALLBACK_BASE_URL` | server | Optional | AI fallback base URL override | `src/core/ai.ts:45` |
| `AI_FALLBACK_MODEL` | server | Optional | AI fallback model override | `src/core/ai.ts:52` |
| `BLOG_MAX_TOKENS` | server | Optional | AI completion budget | `src/core/ai.ts:18` |
| `NEON_AUTH_BASE_URL` | server | Optional | Admin login (Neon Auth) | `src/core/neonAuth.ts:12` |
| `NEON_AUTH_COOKIE_SECRET` | server | Optional | Admin session cookie signing | `src/core/neonAuth.ts:13` |
| `API_SECRET` | server | Optional | Machine/Bearer admin auth + ISR cache bust | `src/core/auth.ts:52`, `scripts/generate-post.ts:128` |
| `TG_BOT_TOKEN` | server | Optional | Telegram lead/notification bot | `src/app/api/contact/route.ts:46`, `src/core/notify.ts:10` |
| `TG_CHAT_ID` | server | Optional | Telegram chat target | `src/app/api/contact/route.ts:47`, `src/core/notify.ts:11` |
| `UNSPLASH_ACCESS_KEY` | server | Optional | Blog cover images | `src/modules/blog/utils/unsplash.ts:124` |
| `EXCHANGERATE_API_KEY` | server | Optional | Currency rates (estimator) | `src/app/api/currency/rates/route.ts:18` |
| `BLOG_AUTHOR_NAME` | server | Optional | Blog SEO author | `src/app/[locale]/blog/[slug]/page.tsx:146` |
| `NEXT_PUBLIC_BLOG_AUTHOR` | client | Optional | Blog SEO author fallback | `src/modules/blog/lib/seo.tsx:123` |
| `NODE_ENV` | platform | Auto-set | Environment mode | `src/core/constants.ts:60` |
| `YANDEX_WEBMASTER_TOKEN` | tooling | Required for its MCP | Yandex Webmaster MCP | `scripts/yandex-webmaster-mcp.js:20` |
| `YANDEX_WEBMASTER_HOST_URL` | tooling | Optional (has default) | Yandex Webmaster MCP host | `scripts/yandex-webmaster-mcp.js:17`, `.mcp.json` |
| `GSC_SERVICE_ACCOUNT_JSON_BASE64` | tooling | Required for its MCP | Google Search Console MCP | `scripts/searchconsole-mcp.js:17`, `scripts/verify-mcp-env.js:14` |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | tooling | Required for its MCP | GitHub MCP server (docker) | `.mcp.json` |
| `GITHUB_EVENT_NAME` | platform | Auto-set (CI) | Scheduled-vs-manual detection | `scripts/generate-post.ts:161` |
| `GITHUB_STEP_SUMMARY` | platform | Auto-set (CI) | Run summary output file | `scripts/generate-post.ts:142`, `scripts/audit-posts.ts:128` |

\* **AI keys are individually optional but collectively load-bearing:** at least one of `MOONSHOT_API_KEY`/`KIMI_API_KEY` (primary) or `DEEPSEEK_API_KEY` (fallback) must be set for blog generation to work. With none set, the provider chain is empty (`src/core/ai.ts:60`) so generation produces nothing: the CLI generator throws at startup (`scripts/generate-post.ts:50`) and the API route logs a missing-key error (`src/app/api/blog/generate/route.ts:30`).

## How env is loaded and validated

There are three independent load paths, and the "validator" you might expect is **not wired in**:

1. **App runtime (Next.js).** Next loads `.env.local` / `.env` automatically. The app reads config two ways: through the `ENV` object in `src/core/constants.ts` (fallback-based, imported in ~15 places), and via direct `process.env.*` reads in routes, `src/core/ai.ts`, `src/core/notify.ts`, etc.

2. **Drizzle CLI** (`yarn db:push` / `db:generate` / `db:studio`). `drizzle.config.ts` calls `import 'dotenv/config'`, so it loads `.env` from the project root and reads `DATABASE_URL`.

3. **MCP scripts** (`scripts/*-mcp.js`, `scripts/verify-mcp-env.js`). Each loads `.env.local` explicitly via `dotenv.config({ path: '.env.local', override: false })` — `override: false` means a value already present in the process environment wins over `.env.local`.

### The declared contract lives in `src/core/env.ts` — but it does not run

`src/core/env.ts` declares the intended required/optional split and a `validateEnvironment()` that **throws** on a missing required var and **warns** on missing optional ones:

```ts
// src/core/env.ts
const requiredEnvVars = ['DATABASE_URL'] as const;
const optionalEnvVars = [
  'MOONSHOT_API_KEY', 'DEEPSEEK_API_KEY', 'API_SECRET',
  'NEON_AUTH_BASE_URL', 'NEON_AUTH_COOKIE_SECRET',
  'UNSPLASH_ACCESS_KEY', 'EXCHANGERATE_API_KEY',
] as const;
// ...
export const env = validateEnvironment(); // runs at import
```

**Grounded caveat:** nothing in `src/` or `scripts/` imports `src/core/env.ts`, so this validator never executes in the current build. Treat it as the documented intent for which vars are required vs optional — not as an enforced boot check. In practice:

- `src/core/constants.ts` `ENV` uses `process.env.X || ''` fallbacks and never throws.
- A missing `DATABASE_URL` therefore surfaces as a **query-time** failure through the repository layer, not a startup crash.

This is also why `env.ts` lists more optionals than either example file — it is the closest thing to a single source of truth for the required/optional classification, and this doc reconciles it against actual usage.

### `NEXT_PUBLIC_*` vs server-only

`NEXT_PUBLIC_*` values are inlined into the client JavaScript bundle at **build time** and are visible to anyone. Only two exist here: `NEXT_PUBLIC_BASE_URL` and `NEXT_PUBLIC_BLOG_AUTHOR`. Everything else (`DATABASE_URL`, all AI keys, `API_SECRET`, `TG_*`, `NEON_AUTH_*`, `UNSPLASH_ACCESS_KEY`, `EXCHANGERATE_API_KEY`) is server-only — never prefix these with `NEXT_PUBLIC_` or you leak them to the browser.

## Reference by subsystem

### Core

- **`DATABASE_URL`** — Neon serverless Postgres connection string, consumed by the `@neondatabase/serverless` HTTP driver and by `drizzle.config.ts`. Format: `postgresql://user:pass@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require`. Get it from Vercel → Storage → Neon (auto-injected) or the Neon Console. See `database.md`.
- **`NEXT_PUBLIC_BASE_URL`** — public site origin, no trailing slash (`constants.ts` trims trailing slashes). Backs canonical URLs, sitemap/robots, and the scripts' cache-bust/fetch targets. Defaults to `https://softwhere.uz` if unset (`src/core/constants.ts:61`, `scripts/generate-post.ts:152`). Set `http://localhost:3000` for local dev.

### AI generation (blog + estimation)

AI runs through one OpenAI-compatible client with a two-provider chain (`src/core/ai.ts`): primary **Kimi K2.6** on Moonshot, fallback **DeepSeek V4 Pro**. All base URLs and models are env-overridable; only the API keys usually need setting.

- **`MOONSHOT_API_KEY`** (or **`KIMI_API_KEY`** as an accepted alias) — auth for the primary provider. Note the international host `https://api.moonshot.ai/v1` (default `AI_BASE_URL`); the `.cn` host rejects foreign keys.
- **`DEEPSEEK_API_KEY`** — auth for the fallback provider (default base `https://api.deepseek.com`). Also used to route Uzbek content to DeepSeek.
- **`AI_BASE_URL`, `AI_MODEL`, `AI_FALLBACK_BASE_URL`, `AI_FALLBACK_MODEL`** — override host/model per provider without code changes. Defaults: `kimi-k2.6` and `deepseek-v4-pro`.
- **`BLOG_MAX_TOKENS`** — completion budget for blog bodies; numeric, defaults to `32000` (`src/core/ai.ts:18`).

Get keys from `https://platform.moonshot.ai` (Kimi/Moonshot) and `https://platform.deepseek.com` (DeepSeek). See `mcp.md` for the generation workflows.

### Admin auth

- **`NEON_AUTH_BASE_URL`** — Neon Auth (Better Auth, beta) project auth base; drives the browser admin login. From the Neon Console → Auth.
- **`NEON_AUTH_COOKIE_SECRET`** — session-cookie signing key, **min 32 chars**. `createNeonAuth()` validates it at construction and throws if missing/short — construction is lazy (`src/core/neonAuth.ts`) so the public site still boots and admin simply **fails closed** (denied) when these are unset. Generate with `openssl rand -base64 32`.
- **`API_SECRET`** — Bearer token for machine callers (scripts / cron / curl) hitting admin & blog-generation APIs, checked with a constant-time compare (`src/core/auth.ts:52`). The generator scripts also use it to hit `/api/admin/revalidate` for an instant ISR cache bust after publishing (`scripts/generate-post.ts:128`); if unset, new posts appear within ~1h instead. Any long random string. See `auth-and-admin.md`.

### Contact form & notifications

- **`TG_BOT_TOKEN`** / **`TG_CHAT_ID`** — Telegram bot used to notify on contact-form and estimator leads, and optionally on blog publish. Read server-side only in `src/app/api/contact/route.ts`, `src/app/api/estimate/lead/route.ts`, and `src/core/notify.ts`. Token from `@BotFather`; chat id from your bot's `getUpdates`. Format: token `1234567890:ABC...`, chat id `-1234567890` for groups.

> **Never prefix these with `NEXT_PUBLIC_`.** A Telegram bot token inlined into the client bundle would ship to every visitor. The code reads the **server-only** `TG_BOT_TOKEN` / `TG_CHAT_ID`, and both `env.example` and `.env.example` use those names. (Older copies of `env.example` mistakenly used `NEXT_PUBLIC_TG_*`; that has been corrected.)

### Media & pricing

- **`UNSPLASH_ACCESS_KEY`** — cover images for AI posts. Optional; without it the generator logs a warning and posts have no cover (`src/modules/blog/utils/unsplash.ts:126`). From `https://unsplash.com/developers`.
- **`EXCHANGERATE_API_KEY`** — currency rates for the estimator. Optional: when set, the route calls `v6.exchangerate-api.com`; when absent it falls back to the free `open.er-api.com` endpoint (`src/app/api/currency/rates/route.ts:18-19`). From `https://www.exchangerate-api.com`.

### Blog SEO author

- **`BLOG_AUTHOR_NAME`** (server) and **`NEXT_PUBLIC_BLOG_AUTHOR`** (client) — author name in blog metadata/JSON-LD; precedence is `BLOG_AUTHOR_NAME` → `NEXT_PUBLIC_BLOG_AUTHOR` → hardcoded default (`src/app/[locale]/blog/[slug]/page.tsx:146`, `src/modules/blog/lib/seo.tsx:123`). Both optional.

### Platform-provided

- **`NODE_ENV`** — `development` / `production`, set automatically by Next/Vercel; do not set manually in Vercel.
- **`GITHUB_EVENT_NAME`, `GITHUB_STEP_SUMMARY`** — injected by GitHub Actions at runtime; used by the generator/audit scripts to detect scheduled runs and write job summaries. Never set these yourself.

## MCP tooling secrets (local only)

These are read only by the MCP wrapper scripts and their servers — never by the deployed app. MCP server wiring lives in `.mcp.json` (Claude Code) and `.cursor/mcp.json` (Cursor). See `mcp.md`.

- **`YANDEX_WEBMASTER_TOKEN`** — OAuth token for the Yandex Webmaster MCP. Required to launch `yarn mcp:yandex-webmaster` (`scripts/yandex-webmaster-mcp.js:20`).
- **`YANDEX_WEBMASTER_HOST_URL`** — target host; defaults to `https://softwhere.uz` and is also pinned in the `.mcp.json` server `env`.
- **`GSC_SERVICE_ACCOUNT_JSON_BASE64`** — base64-encoded Google service-account JSON for the Search Console MCP. `scripts/searchconsole-mcp.js` decodes it to a temp file and points `GOOGLE_APPLICATION_CREDENTIALS` at it. Required to launch `yarn mcp:searchconsole`.
- **`GITHUB_PERSONAL_ACCESS_TOKEN`** — passed into the dockerized GitHub MCP server (`.mcp.json`).

`scripts/verify-mcp-env.js` validates that `YANDEX_WEBMASTER_TOKEN` and `GSC_SERVICE_ACCOUNT_JSON_BASE64` are present and that the latter decodes to JSON with `client_email` + `private_key`.

## Pulling env from Vercel

Local development and MCP setup pull env from Vercel with the CLI (wrapped in `package.json` scripts). Requires `npx vercel login` + `npx vercel link` once per machine.

| Script | Command | Target file / env |
| --- | --- | --- |
| `yarn dev:env` | `vercel env pull .env --environment development` then `next dev` | `.env` (development) |
| `yarn dev:production` | `vercel env pull .env --environment production` then `next dev` | `.env` (production) |
| `yarn env:pull:production` | `vercel env pull .env --environment production --yes` | `.env` |
| `yarn env:pull:development` | `vercel env pull .env --environment development --yes` | `.env` |
| `yarn env:pull:local:production` | `vercel env pull .env.local --environment production --yes` | `.env.local` |
| `yarn mcp` | `env:pull:local:production` then `node scripts/verify-mcp-env.js` | `.env.local`, then validate |

Typical MCP bootstrap:

```bash
npx vercel login && npx vercel link   # once per machine
yarn mcp                               # pulls .env.local (production) + verifies MCP secrets
```

### Gotcha: Vercel "Sensitive" env vars are write-only

If `vercel env pull` writes **empty** values for the MCP secrets, they are almost certainly marked **Sensitive** in Vercel. Sensitive vars are write-only — Vercel will not return their values to `env pull`, so they cannot be used as a local sync source. `scripts/verify-mcp-env.js` prints exactly this diagnostic on a missing value:

```
Missing MCP env value(s): ...
If Vercel pulled empty values, those variables are probably marked Sensitive.
Vercel Sensitive env vars are write-only and cannot be used as a local sync source.
Use non-sensitive Vercel env vars for MCP sync, or store these secrets locally/with a password manager.
```

Fix: either store the MCP-only secrets (`YANDEX_WEBMASTER_TOKEN`, `GSC_SERVICE_ACCOUNT_JSON_BASE64`) as **non-sensitive** Vercel env vars, or keep them locally in `.env.local` / a password manager. This does **not** apply to genuinely secret runtime vars (`DATABASE_URL`, API keys) — those stay Sensitive in Vercel and are injected into deployments directly, never pulled for MCP.

## CI secrets (GitHub Actions)

The blog workflows read secrets from the GitHub `Production` environment, not from `.env`. `generate-post.yml` and `regenerate-post.yml` map: `DATABASE_URL`, `MOONSHOT_API_KEY`, `DEEPSEEK_API_KEY`, `TG_BOT_TOKEN`, `TG_CHAT_ID`, `API_SECRET` (both), plus `UNSPLASH_ACCESS_KEY` (generate only). `audit-posts.yml` needs only `DATABASE_URL`. Keep these in sync with the vars above.

## Templates

Two example files ship the same variable set: `env.example` (annotated) and `.env.example` (terse). Both are kept in sync with the code above — use either. The former `WEBSITE_URL` variable was removed from both: it was read **nowhere** in `src/` or `scripts/`; `NEXT_PUBLIC_BASE_URL` is the effective public-URL var.

## Related docs

- [deployment.md](./deployment.md) — Vercel deploy, env-per-environment, build settings
- [mcp.md](./mcp.md) — MCP servers, the tooling secrets above, and the blog workflows
- [auth-and-admin.md](./auth-and-admin.md) — Neon Auth session gate + `API_SECRET` Bearer path
- [database.md](./database.md) — Neon + Drizzle, `DATABASE_URL`, migrations
- [architecture.md](./architecture.md) — layered `core → shared → modules → app` boundaries
- [../README.md](../README.md) — project overview

_Last verified against code: 2026-07-03._
