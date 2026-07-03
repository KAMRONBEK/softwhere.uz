# Deployment & Operations

How softwhere.uz is built, deployed on Vercel, and operated day to day: build/start
scripts, `vercel.json` function limits and regions, the stateless Neon serverless
runtime model, env-pull commands, health checks, and the `db:push` schema flow.

## At a glance

| Concern | Value | Source |
|---|---|---|
| Host | Vercel (linked project `softwhere-uz`) | `.vercel/repo.json` |
| Framework | Next.js 16 App Router (`next@^16.1.6`) | `package.json` |
| Package manager | Yarn 1.22 (`yarn@1.22.19`) | `package.json` (`packageManager`) |
| Build command | `next build` (`yarn build`) | `package.json` `scripts.build` |
| Start command | `next start` (`yarn start`) | `package.json` `scripts.start` |
| Primary region | `fra1` (Frankfurt) | `vercel.json` |
| Default function timeout | 30s for `src/app/api/**/*.ts` | `vercel.json` |
| Database | Neon (serverless Postgres) via Drizzle **HTTP** driver — stateless, no pool | `src/core/db.ts` |
| DB env var | `DATABASE_URL` | `src/core/constants.ts:55`, `src/core/db.ts:22` |
| Health checks | `GET /api/health`, `GET /api/health/db` | `src/app/api/health/route.ts`, `src/app/api/health/db/route.ts` |
| Schema migration | `yarn db:push` (Drizzle Kit) | `package.json`, `drizzle.config.ts` |
| Scheduled jobs | GitHub Actions cron — **not** Vercel Cron | `.github/workflows/*.yml` (see below) |

## Build & start scripts

All operational scripts live in `package.json`:

```jsonc
"build":  "next build",
"start":  "next start",
"dev":    "next dev",
"dev:env":         "yarn env:pull:development && next dev",
"dev:production":  "yarn env:pull:production && next dev",
"start:production":"yarn env:pull:production && next start",
"clean":  "rm -rf .next .next/dev",
"db:push":     "drizzle-kit push",
"db:generate": "drizzle-kit generate",
"db:studio":   "drizzle-kit studio",
"env:pull:production":       "npx vercel env pull .env --environment production --yes",
"env:pull:development":      "npx vercel env pull .env --environment development --yes",
"env:pull:local:production": "npx vercel env pull .env.local --environment production --yes"
```

On Vercel, the platform runs `next build` for you on every push; you rarely run
`yarn build` / `yarn start` by hand except to reproduce a production build locally
(see [Run a production-like build locally](#run-a-production-like-build-locally)).

Node version is **not** pinned in the repo — there is no `engines` field, `.nvmrc`,
or `.node-version`. CI standardizes on Node 22 (`.github/workflows/audit-posts.yml`,
`node-version: '22'`); match that locally and let Vercel use its project-level Node
setting.

## `vercel.json` — function limits & regions

```json
{
  "functions": {
    "src/app/api/**/*.ts": { "maxDuration": 30 },
    "src/app/api/estimate/route.ts": { "maxDuration": 60 }
  },
  "regions": ["fra1"]
}
```

- **Regions** — all Serverless Functions run in `fra1` (Frankfurt). Static/CDN assets
  are still served from Vercel's global edge; only the function compute is pinned.
- **`maxDuration`** — the glob caps every API route at 30s; `estimate` is bumped to
  60s. Individual routes can raise their own ceiling with a **route-segment export**
  (`export const maxDuration = …`), which takes precedence over the `vercel.json`
  glob for that file. Current per-route overrides:

  | Route | Effective `maxDuration` | Declared in |
  |---|---|---|
  | `src/app/api/estimate/route.ts` | 60s | route export **and** `vercel.json` |
  | `src/app/api/blog/generate/route.ts` | 300s | route export (`export const maxDuration = 300`) |
  | all other `src/app/api/**` | 30s | `vercel.json` glob |

  `blog/generate` needs 300s, which is the **Hobby maximum with Fluid compute** — its
  own header note (`src/app/api/blog/generate/route.ts:25`) says to enable Fluid
  compute in *Vercel Project Settings → Functions* if it is off.

### No Vercel Cron

`vercel.json` has **no `crons` key** — this project does not use Vercel Cron. All
scheduled work runs as **GitHub Actions cron** instead:

| Workflow | Schedule (UTC) | Purpose |
|---|---|---|
| `.github/workflows/generate-post.yml` | `17 6 * * *`, `17 18 * * *` | Twice-daily blog generation |
| `.github/workflows/audit-posts.yml` | `7 7 1 * *` | Monthly read-only blog health report |

Those jobs hit the same Neon `DATABASE_URL` directly (via `tsx` scripts), not through
the deployed site. See [ci-workflows.md](./ci-workflows.md) for details.

## Runtime model — stateless Neon over HTTP

The database client (`src/core/db.ts`) uses Neon's **HTTP** driver through Drizzle
(`@neondatabase/serverless` + `drizzle-orm/neon-http`). This shape is what makes the
app safe on Vercel's serverless functions:

```ts
// src/core/db.ts
cached = drizzle({ client: neon(url), schema });
```

Key properties, straight from the file's own docs:

- **No connection pool.** Every query is a `fetch` (`neon(url)`), so there is nothing
  to keep warm across invocations and no pool size to tune. A cold function is fine.
- **Lazy, side-effect-free import.** The client is created on first use behind a
  `Proxy` (`export const db = new Proxy(...)`), so importing `@/core/db` never calls
  `neon()` at module-eval time. This is deliberate: **`next build` can collect page
  data without `DATABASE_URL` set**, and any route that actually queries throws a
  clear error at call time (`DATABASE_URL is not set — provision a Neon database …`,
  `src/core/db.ts:24`).
- **Single access layer.** Routes and pages never touch Drizzle directly — everything
  goes through the repositories (`src/modules/blog/model/posts.repository.ts`,
  `src/modules/contact/model/leads.repository.ts`). See [database.md](./database.md).

### Runtime targets per route

Most API routes run on the default **Node.js** serverless runtime. Two routes opt
into non-default behavior via route-segment exports:

| Route | Segment config | Effect |
|---|---|---|
| `src/app/api/og/route.tsx` | `export const runtime = 'edge'` | OG image rendering on the Edge runtime |
| `src/app/api/auth/[...path]/route.ts` | `export const dynamic = 'force-dynamic'` | Never statically cached (auth) |
| `src/app/api/blog/posts/route.ts` | `export const dynamic = 'force-dynamic'` | Always fresh post list |

## `next.config.mjs` build settings

```js
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // 30 days
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  experimental: { inlineCss: true },
};
export default withNextIntl(nextConfig);
```

- **`next-intl` plugin** wraps the config (`createNextIntlPlugin('./src/core/i18n.ts')`);
  i18n is part of the build, not a runtime add-on.
- **Images** — only `images.unsplash.com` is an allowed remote host; blog cover images
  come from Unsplash. Optimized outputs are AVIF/WebP, cached 30 days.
- **`experimental.inlineCss: true`** inlines the global CSS into the HTML to avoid
  render-blocking stylesheet round trips (see the [CDN caveats](#regional--cdn-caveats)).

## Health checks

Two GET endpoints, both under `src/app/api/health/`:

| Endpoint | Checks | Healthy | Unhealthy |
|---|---|---|---|
| `/api/health` | Process is up (static) | `200 {status:"healthy", timestamp}` | — |
| `/api/health/db` | Neon connectivity | `200 {status:"healthy", duration:"<n>ms"}` | `503 {status:"unhealthy"}` |

`/api/health/db` calls `pingDb()`, which issues a trivial `select 1` through the
repository layer:

```ts
// src/modules/blog/model/posts.repository.ts
export async function pingDb(): Promise<void> {
  await db.execute(sql`select 1`);
}
```

Use `/api/health/db` (not `/api/health`) for any uptime/database monitor — the plain
`/api/health` never touches the database and always returns `healthy`.

```bash
curl -fsS https://softwhere.uz/api/health      # process liveness
curl -fsS https://softwhere.uz/api/health/db   # DB reachability (503 if Neon is down)
```

## Environment & `vercel env pull`

Env vars are managed in the Vercel dashboard and pulled locally with the wrapper
scripts. Note the **target filenames differ** — this matters because `.env` is what
Drizzle Kit reads:

| Command | Vercel environment | Writes to |
|---|---|---|
| `yarn env:pull:development` | development | `.env` |
| `yarn env:pull:production` | production | `.env` |
| `yarn env:pull:local:production` | production | `.env.local` |

`.env`, `.env*.local`, and `.vercel/` are git-ignored (`.gitignore`), so pulled
secrets never get committed. For the full variable list and semantics see
[environment.md](./environment.md); the MCP/tooling env is covered in [mcp.md](./mcp.md).

## Schema changes — the `db:push` flow

Drizzle Kit is configured in `drizzle.config.ts`:

```ts
export default defineConfig({
  schema: ['./src/modules/blog/model/BlogPost.ts', './src/modules/contact/model/Lead.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
```

- It reads `DATABASE_URL` from the environment, loaded from `.env` via the
  `import 'dotenv/config'` at the top of the config. Run `yarn env:pull:production`
  (or `:development`) first so `.env` exists.
- The schema is **two tables**, not one: `blog_posts` (`BlogPost.ts`) and `leads`
  (`Lead.ts`). (Older notes that say "only `blog_posts`" are stale — `Lead.ts` defines
  a `leads` table backing the contact form, and it is in the Drizzle Kit `schema`
  array, so `db:push` provisions both.)

Workflow:

```bash
yarn env:pull:production   # populate .env with DATABASE_URL (once per machine/change)
yarn db:push               # introspect the Drizzle schema and apply it to Neon
```

- `yarn db:push` applies the current TypeScript schema directly (no migration file).
  `strict` + `verbose` make it print the SQL and ask before destructive changes.
- `yarn db:generate` writes a versioned migration into `./drizzle/` instead of pushing.
- `yarn db:studio` opens Drizzle Studio against the same `DATABASE_URL`.
- As an alternative to the CLI, `drizzle/0000_init.sql` is a hand-written DDL you can
  paste straight into the Neon SQL editor (it uses `CREATE TABLE IF NOT EXISTS` and
  `gen_random_uuid()`, built into Neon's Postgres 16+). Note this file currently
  contains only the `blog_posts` table; use `yarn db:push` to also create `leads`.

There is no automatic migration step in the Vercel build — schema changes are applied
out-of-band with `db:push`, then you deploy code that depends on them.

## First-deploy checklist

1. **Link the repo to Vercel.** Import the GitHub repo as a Vercel project; per the
   README, deploys trigger on push to `main`. Vercel runs `next build` automatically.
2. **Provision Neon.** Vercel → project → **Storage → Create → Neon**. Vercel injects
   `DATABASE_URL` into every environment. (Or create it at neon.tech and set
   `DATABASE_URL` yourself.)
3. **Set the remaining env vars** in the Vercel dashboard for Production (and Preview):
   AI keys, `API_SECRET`, Neon Auth vars, `NEXT_PUBLIC_BASE_URL`, etc. — see
   [environment.md](./environment.md).
4. **Create the tables.** Locally with `DATABASE_URL` in `.env`:
   ```bash
   yarn env:pull:production && yarn db:push
   ```
   (or paste `drizzle/0000_init.sql` in the Neon SQL editor, then `db:push` for `leads`).
5. **Add CI secrets.** Put `DATABASE_URL` (and AI keys) in the repo's GitHub Actions
   secrets so the scheduled generators can run — see [ci-workflows.md](./ci-workflows.md).
6. **Deploy**, then verify:
   ```bash
   curl -fsS https://<deployment>/api/health
   curl -fsS https://<deployment>/api/health/db   # expect status: healthy
   ```
   A `503` from `/api/health/db` means `DATABASE_URL` is missing/wrong or Neon is
   unreachable from `fra1`.

## Run a production-like build locally

Pull the production env and start a production server (helper scripts pull env first):

```bash
yarn start:production   # env:pull:production (-> .env) then next start
# or, to iterate against prod env with hot reload:
yarn dev:production     # env:pull:production (-> .env) then next dev
```

To reproduce Vercel's build step exactly, run the two commands separately after an
env pull:

```bash
yarn env:pull:production
yarn build && yarn start
```

The [README](../README.md) documents the same pattern under *Development → Vercel Env*.

## Regional / CDN caveats

- **Single compute region (`fra1`).** Functions run only in Frankfurt. Latency scales
  with distance to Frankfurt; far cohorts pay a round-trip penalty. `next.config.mjs`
  calls this out for China visitors served from the `hkg1` edge, which is why global
  CSS is inlined (`experimental.inlineCss`) to cut render-blocking stylesheet requests.
- **Edge OG route.** `src/app/api/og/route.tsx` runs on the Edge runtime, so it is not
  bound to `fra1` — it executes at the nearest edge PoP.
- **Static assets** are served from Vercel's CDN globally; only Serverless Function
  compute (API routes, SSR) is region-pinned to `fra1`.
- **Neon region.** Keep the Neon database in (or near) `eu-central` so the `fra1`
  functions are close to the database. Cross-region DB latency is added to every
  request that queries, since the HTTP driver makes a fresh `fetch` per query.

## Related docs

- [environment.md](./environment.md) — full environment-variable reference
- [ci-workflows.md](./ci-workflows.md) — GitHub Actions (scheduled generation, audit)
- [database.md](./database.md) — Neon + Drizzle schema, repositories, `db:push` details
- [mcp.md](./mcp.md) — MCP tooling env and scripts
- [../README.md](../README.md) — project overview and quick start

_Last verified against code: 2026-07-03._
