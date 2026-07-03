# CLAUDE.md — Repo Guide for AI Agents

High-signal orientation for AI coding agents (Claude Code / Cursor) working in `softwhere.uz`. Read this first, then the specific doc for your subsystem. Every claim here is grounded in code — when in doubt, open the cited file.

`softwhere.uz` is a multilingual (uz/ru/en) Next.js 16 App Router marketing site + portfolio + AI-generated blog + project-cost estimator + admin panel. TypeScript 5.8, Tailwind, Neon Postgres via Drizzle, deployed on Vercel.

## At a glance

| Thing | Where | Notes |
|-------|-------|-------|
| Framework | Next.js `^16.1` App Router | `package.json`; routes in `src/app/[locale]/` |
| Language | TypeScript 5.8 | `yarn type-check` = `tsc --noEmit` |
| Database | Neon serverless Postgres + Drizzle (HTTP driver) | client `src/core/db.ts`; **not** MongoDB/Mongoose (some old docs are stale) |
| Tables | `blog_posts`, `leads` | schemas `src/modules/blog/model/BlogPost.ts`, `src/modules/contact/model/Lead.ts` |
| AI | OpenAI-compatible SDK (`openai` pkg) | client `src/core/ai.ts`; provider chain **Kimi K2.6 → DeepSeek** (see below) |
| i18n | `next-intl` v4 | locales `uz` (default), `ru`, `en`; middleware `src/proxy.ts`; messages `src/messages/*.json` |
| Auth | Neon Auth (Better Auth, beta) + Bearer `API_SECRET` | `src/core/neonAuth.ts`, `src/core/auth.ts` → see `docs/auth-and-admin.md` |
| Layering | `core → shared → modules → app` | enforced by `eslint-plugin-boundaries` in `eslint.config.mjs` |
| Package manager | Yarn 1.x | `package.json#packageManager` |

## Golden rules

1. **DB only through the repository layer — never touch Drizzle in routes/pages.** All queries live in `src/modules/blog/model/posts.repository.ts` and `src/modules/contact/model/leads.repository.ts`. These own the `db` client, the `blogPosts`/`leads` tables, and serialization. Routes/pages/components call repository functions (`listPublished`, `getPublishedBySlug`, `createPost`, `pingDb`, …); they must not `import { db }` or build Drizzle queries.
2. **AI only through `src/core/ai.ts`.** Use the exported helpers — `safeGenerateContent`, `generateContentWithProvider`, `safeGenerateJSON`, `safeGenerateJSONWithTimeout`, `generateWithWebSearch`. Never instantiate `new OpenAI(...)` elsewhere. The module owns provider selection, quota cooldowns, retries, and the Kimi-only `$web_search` grounding loop.
3. **Log via the logger, not `console`.** Import `logger` (or `logError`/`logWarn`/`logInfo`/`logDebug`) from `src/core/logger.ts`. `no-console` is a lint warning; `logger` is the sanctioned console boundary. `warn`/`error` always emit (prod included); `info`/`debug` are dev-only.
4. **User-facing strings come from next-intl messages, not hardcoded literals.** Add keys to `src/messages/{uz,ru,en}.json` and read them with next-intl. Keep all three locales in sync.
5. **Respect layer boundaries** (next section). Don't add a cross-layer import to make something compile — move the code to the right layer instead.

## Layered architecture

Import direction is one-way: `core → shared → modules → app`. Enforced by `eslint-plugin-boundaries` (`boundaries/element-types`) in `eslint.config.mjs`.

| Layer | Path | May import from |
|-------|------|-----------------|
| `core` | `src/core/**` | `core` only — framework-agnostic infra (`env`, `logger`, `db`, `ai`, `i18n`, `http`, `auth`, `neonAuth`, `constants`, `notify`) |
| `shared` | `src/shared/**` | `core`, `shared` — reusable non-domain components/utils/data/types |
| `modules` | `src/modules/*/**` | `core`, `shared`, and **its own module only** — features (`blog`, `estimator`, `admin`, `contact`). One module must not import another. |
| `app` | `src/app/**` | anything (`core`, `shared`, `module`, `app`) — thin route handlers & pages |

Rule severity is **`warn`**, not `error`, so `yarn lint` reports 0 errors while surfacing known pre-existing couplings (e.g. `shared/components/Header` reaches into `modules/blog` for the language switcher). Do not add new violations; the plan is to remove the remaining ones and promote to `error`. Details and tracked exceptions: `docs/architecture.md`.

## AI provider chain (important nuance)

`src/core/ai.ts` runs a **two-provider chain**, not DeepSeek alone:

- **Primary: Kimi K2.6** (Moonshot, host `https://api.moonshot.ai/v1`, key `MOONSHOT_API_KEY`/`KIMI_API_KEY`). Provides strict `json_schema` output and the server-side `$web_search` grounding tool. Sampling is fixed by the API (temperature pinned; `thinking` must be disabled or calls 400).
- **Fallback: DeepSeek** (`https://api.deepseek.com`, key `DEEPSEEK_API_KEY`, model `deepseek-v4-pro`). Takes tuned temperatures; degrades strict schemas to `json_object`. Preferred first for Uzbek content via `prefer: 'deepseek'`.

If only one key is configured, that provider is used alone. All hosts/models/keys are env-overridable (`AI_BASE_URL`, `AI_MODEL`, `AI_FALLBACK_*`). See `docs/blog-pipeline.md` for how the blog generator uses these.

## Checks to run before finishing

Run all three; they must pass:

```bash
yarn type-check   # tsc --noEmit
yarn lint         # eslint src/  (0 errors; boundaries emit warnings)
yarn build        # next build
```

If you changed a Drizzle schema (`BlogPost.ts` / `Lead.ts`), also sync it: `yarn db:push` (or `yarn db:generate` for a migration file). Format with `yarn format` (Prettier is wired into ESLint via `prettier/prettier: error`).

## Key subsystems → docs

Direct pointers to each subsystem's doc and key code:

| Subsystem | Doc | Key code |
|-----------|-----|----------|
| Architecture & boundaries | `docs/architecture.md` | `eslint.config.mjs` |
| Database & repositories | `docs/database.md` | `src/core/db.ts`, `src/modules/*/model/*.repository.ts` |
| Blog generation pipeline | `docs/blog-pipeline.md` | `src/core/ai.ts`, `scripts/generate-post.ts`, `scripts/regenerate-post.ts` |
| Environment variables | `docs/environment.md` | `env.example`, `src/core/constants.ts` (`ENV`) |
| Auth & admin | `docs/auth-and-admin.md` | `src/core/auth.ts`, `src/core/neonAuth.ts` |
| API routes | `docs/api-reference.md` | `src/app/api/**` |
| i18n | `docs/i18n.md` | `src/proxy.ts`, `src/core/i18n.ts`, `src/messages/*` |
| Estimator | `docs/estimator.md` | `src/modules/estimator/**` |
| CI workflows | `docs/ci-workflows.md` | `.github/workflows/*` |
| Deployment / SEO / MCP / testing | `docs/deployment.md`, `docs/seo.md`, `docs/mcp.md`, `docs/testing/` | — |

## Warnings

- **`.cursor/rules/*.mdc` may be stale or mid-refresh.** Files like `project-structure.mdc`, `development-guidelines.mdc`, and `api-migration.mdc` are periodically regenerated and can lag the code. Treat this file and `docs/` as authoritative; verify anything in `.mdc` against the actual source before relying on it.
- **For environment variables, `docs/environment.md` and the code (`src/core/env.ts`, `src/core/constants.ts`) are authoritative — not `env.example`.** `env.example` has known drift: it lists `NEXT_PUBLIC_TG_BOT_TOKEN` / `NEXT_PUBLIC_TG_CHAT_ID` but the code reads server-only `TG_BOT_TOKEN` / `TG_CHAT_ID` (a bot token must never be `NEXT_PUBLIC_`); it omits `MOONSHOT_API_KEY`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `EXCHANGERATE_API_KEY`; and `WEBSITE_URL` is dead (unread). When a template and the code disagree, trust the code and `docs/environment.md`.
- **The DB is Neon Postgres, not Mongo.** Any doc or comment mentioning Mongoose/`ObjectId`/collections is stale — the code uses Drizzle over `@neondatabase/serverless`.

## Related docs

- [Documentation index](docs/README.md) — the map of every doc, grouped by topic
- [Project README](./README.md)
- [Architecture guidelines](docs/architecture.md)
- [Blog pipeline](docs/blog-pipeline.md)
- [Environment variables](docs/environment.md)

_Last verified against code: 2026-07-03._
