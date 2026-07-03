# 0002 — Datastore: MongoDB/Mongoose → Neon Postgres + Drizzle

Replace MongoDB/Mongoose with Neon (serverless Postgres) accessed through Drizzle ORM over the stateless HTTP driver.

## At a glance

| | |
| --- | --- |
| **Status** | Accepted |
| **Landed** | commit `45fc257` — "db: migrate MongoDB/Mongoose → Neon Postgres + Drizzle" (2026-07-01) |
| **Driver** | `@neondatabase/serverless` + `drizzle-orm/neon-http` |
| **Tables** | `blog_posts`, `leads` (only two) |
| **Env** | `DATABASE_URL` (was `MONGODB_URI`) |
| **Data migrated** | none — fresh start; posts are regenerable |
| **Live spec** | [`../database.md`](../database.md) |

## Context

The app runs serverless on Vercel. A stateful Mongoose client is a poor fit there:
each cold invocation has to establish and warm a connection pool, and the previous
code carried a hand-tuned pool/timeout/`Promise.race` dance to survive that. The
data itself is small and relational-shaped (blog posts keyed by `(locale, slug)`,
with a handful of indexed lookups) and, crucially, fully regenerable by the AI
pipeline — so there was no data-migration risk to trade against.

## Decision

Move to **Neon serverless Postgres** through **Drizzle ORM's HTTP driver**. The
HTTP driver is stateless — every query is a `fetch`, so there is no pool to tune
or keep warm across invocations (`src/core/db.ts`). The client is created lazily
on first use so importing the module stays side-effect-free and `next build` can
collect page data without `DATABASE_URL` set:

```ts
// src/core/db.ts
let cached: NeonHttpDatabase<typeof schema> | null = null;
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (cached) return cached;
  const url = ENV.DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set — provision a Neon database and set it in the environment.');
  cached = drizzle({ client: neon(url), schema });
  return cached;
}
// `db` is a Proxy that defers getDb() until the first query.
```

Schema lives in Drizzle table definitions, not Mongoose models. `blog_posts`
(`src/modules/blog/model/BlogPost.ts`) uses a `uuid` primary key, `jsonb` for the
embedded cover/inline images and keyword arrays, `timestamptz` columns, a
`uniqueIndex('blog_posts_locale_slug_uq')` on `(locale, slug)`, and covering
indexes for the published-list, related-posts, and generation-group queries.

**All DB access goes through a repository layer** — `src/modules/blog/model/posts.repository.ts`
and `src/modules/contact/model/leads.repository.ts`. Routes and pages never touch
Drizzle directly (this is what makes the module boundary in
[ADR 0001](./0001-layered-architecture.md) hold). The repositories return the same
`_id`-shaped, ISO-string-dated objects the old Mongoose `.lean()` + JSON output
produced, via `serializePost()` — so the API contract and every frontend/SEO
consumer were untouched by the migration.

Postgres-specific translations were kept faithful: `isValidPostId` uses a UUID
regex instead of `mongoose.Types.ObjectId.isValid`, and the canonical-slug lookup
became a Postgres POSIX-regex query (`getCanonicalForLocale`, with
`escapeRegexLiteral` guarding interpolation).

## Consequences

- **No connection management.** The entire Mongoose pool/timeout/`Promise.race`
  code is gone; cold starts do not pay a connect cost.
- **Schema changes are code + `db:push`.** `drizzle.config.ts` plus scripts
  `db:push` / `db:generate` / `db:studio` (`drizzle-kit`); the initial DDL is
  checked in at `drizzle/0000_init.sql`. An owner must provision a Neon database
  and set `DATABASE_URL`; there is no data to import.
- **The `_id`/ISO-string serialization is a deliberate compatibility shim.** New
  code reads cleaner if it consumes `BlogPostRow` directly, but consumers on the
  old shape must keep going through `serializePost`. Do not "clean up" `_id` back
  to `id` without updating every consumer.
- **`DATABASE_URL` replaced `MONGODB_URI`** everywhere — env files, constants,
  scripts, both README and the GitHub Actions workflows. Any doc that still says
  Mongoose/MongoDB is stale.
- **Region:** Vercel functions run in `fra1` to co-locate with Neon Frankfurt
  (set alongside ADR 0003 in commit `fb7484f`).

## References

- `src/core/db.ts` — lazy Neon HTTP client and deferring Proxy.
- `src/modules/blog/model/BlogPost.ts` — `blog_posts` table, indexes, `serializePost()`, and the `IBlogPost` compatibility shape.
- `src/modules/blog/model/posts.repository.ts` — every blog query centralized (reads, writes, `pingDb`); UUID validator; Postgres-regex canonical lookup.
- `src/modules/contact/model/leads.repository.ts` — the `leads` table repository (durable lead capture).
- `drizzle.config.ts`, `drizzle/0000_init.sql`, `package.json` (`db:push`/`db:generate`/`db:studio`).
- commit `45fc257` — the migration, its scope, and verification notes.
- [`../database.md`](../database.md) — Neon provisioning and fresh-start steps.

## Related docs

- [`../database.md`](../database.md) — provisioning, schema, and queries as a live spec.
- [`./0001-layered-architecture.md`](./0001-layered-architecture.md) — why routes go through the repository, not Drizzle.
- [`./0004-ai-blog-pipeline.md`](./0004-ai-blog-pipeline.md) — the pipeline that writes `blog_posts` via `createPost`.
- [`../../README.md`](../../README.md) — project overview.

_Last verified against code: 2026-07-03._
