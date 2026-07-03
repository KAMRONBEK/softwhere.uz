# Database — Neon (serverless Postgres) + Drizzle

The blog is backed by a single Postgres table, `blog_posts`, on **Neon**
(serverless Postgres), accessed through **Drizzle ORM** using the HTTP driver
(`@neondatabase/serverless` + `drizzle-orm/neon-http`).

Previously this was MongoDB/Mongoose. The HTTP driver is stateless (every query
is a fetch), so there is no connection pool to tune — a good fit for Vercel's
serverless functions.

## Layout

| File | Purpose |
|------|---------|
| `src/modules/blog/model/BlogPost.ts` | Drizzle table (`blogPosts`), types (`ICoverImage`, `IBlogPost`, `NewBlogPost`), and `serializePost()` |
| `src/modules/blog/model/posts.repository.ts` | **All** queries — routes/pages never touch Drizzle directly |
| `src/core/db.ts` | Lazy Neon/Drizzle client (`db`); import is side-effect-free so `next build` runs without `DATABASE_URL` |
| `drizzle.config.ts` | Drizzle Kit config for `db:push` / `db:generate` |
| `drizzle/0000_init.sql` | Hand-written DDL — paste into the Neon SQL editor if you prefer not to run the CLI |

The public shape returned everywhere is the same one the old Mongoose+lean code
produced: `_id` (string), ISO-string `createdAt`/`updatedAt`, optional fields as
`undefined`. So the admin UI, blog pages, and SEO/JSON-LD were **not** changed.

## One-time setup

1. **Create the database.** Vercel → your project → **Storage** → **Create** →
   **Neon**. Vercel injects **`DATABASE_URL`** into every environment
   automatically. (Or create it at neon.tech and set `DATABASE_URL` yourself.)

2. **Create the table.** Locally, with `DATABASE_URL` in `.env`:

   ```bash
   yarn db:push      # applies the Drizzle schema to Neon
   ```

   Or paste `drizzle/0000_init.sql` into the Neon SQL editor.

3. **CI secret.** Add **`DATABASE_URL`** to the repo's GitHub Actions secrets so
   the scheduled generators (`.github/workflows/generate-post.yml`,
   `regenerate-post.yml`, `audit-posts.yml`) can write. You can delete any old
   `MONGODB_URI` secret.

4. **Repopulate.** The migration started from an empty database. Go to
   `/admin/posts` → **Generate New Posts** (or run `yarn tsx scripts/generate-post.ts`)
   to create content with the current generator.

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Neon connection string from the dashboard |

## Scripts

```bash
yarn db:push       # push schema changes to Neon (no migration files)
yarn db:generate   # generate SQL migration files under drizzle/
yarn db:studio     # open Drizzle Studio
```
