# CLI Scripts & Tooling

Reference for the standalone TypeScript scripts in `scripts/*.ts` (run through `tsx`) and the `yarn` scripts declared in `package.json`.

The `scripts/*.ts` files are **not** registered as `yarn` scripts — you run them directly with `npx tsx <path>` (or `yarn tsx <path>`; `tsx` is a devDependency). `generate-post`, `regenerate-post`, and `audit-posts` are also invoked from GitHub Actions (see [ci-workflows.md](./ci-workflows.md)). Each script loads env from a local `.env` via `import 'dotenv/config'` (except `estimator-calibration` and `screenshot-homepage`, which need no env).

## At a glance

| Script | Invocation | Touches DB? | Writes files? | Network side effects |
|---|---|---|---|---|
| `scripts/generate-post.ts` | `npx tsx scripts/generate-post.ts [opts]` | **Writes** (inserts posts) | `$GITHUB_STEP_SUMMARY` | IndexNow ping, ISR revalidate, Telegram, Unsplash, AI/web-search |
| `scripts/regenerate-post.ts` | `npx tsx scripts/regenerate-post.ts --groups <ids> [opts]` | **Writes** (updates in place) | `regen-backups/`, `regen-preview/`, `$GITHUB_STEP_SUMMARY` | IndexNow ping, ISR revalidate, Telegram, AI/web-search |
| `scripts/audit-posts.ts` | `npx tsx scripts/audit-posts.ts [--json]` | Reads only | `$GITHUB_STEP_SUMMARY` | none |
| `scripts/estimator-calibration.ts` | `yarn tsx scripts/estimator-calibration.ts` | no | stdout only | none |
| `scripts/screenshot-homepage.ts` | `npx tsx scripts/screenshot-homepage.ts [--dark]` | no | `screenshots-homepage/{light,dark}/*.png` | loads `localhost:3000` |
| `scripts/lib/post-structure.ts` | (helper module) | — | — | — |
| `scripts/lib/similarity.ts` | (helper module) | — | — | — |

All DB access goes through the repository layer (`src/modules/blog/model/posts.repository.ts`); the scripts never touch Drizzle directly.

> MCP wrappers (`scripts/*-mcp.js`, `scripts/verify-mcp-env.js`) and the `yarn mcp*` scripts are documented in [mcp.md](./mcp.md) — this doc does not duplicate them.

---

## `generate-post.ts` — scheduled/dispatch blog generation

A thin CLI wrapper around the **same** pipeline the admin API route uses (`src/modules/blog/api/pipeline.ts`), run from GitHub Actions where wall-clock is free, so it always runs the pipeline in `'deep'` mode (research → draft → lint/revise → cross-model critique → revise). See [blog-pipeline.md](./blog-pipeline.md) for the pipeline itself.

### Invocation

```bash
npx tsx scripts/generate-post.ts [options]
```

### Options

Args are parsed by hand (`parseArgs`): `--key value` sets an option; a bare `--key` (or one followed by another `--flag`) sets a boolean flag.

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `--category <id>` | value | — | Service pillar id (from `SERVICE_PILLARS`), or `random`, or `auto`. Invalid ids exit 1. |
| `--customTopic <str>` | value | — | Custom topic; normalized via a `safeGenerateContent` editor pass. Overrides `--category`. |
| `--sourceUrl <url>` | value | — | URL fetched via `extractTextFromUrl`; content classified into a topic. |
| `--sourceText <str>` | value | — | Raw source text, trimmed to `MAX_SOURCE_TEXT_LENGTH`, then classified. |
| `--locales <list>` | value | `en,ru,uz` | Comma list; only `en`/`ru`/`uz` survive filtering. Empty → exit 1. |
| `--force` | flag / `--force true` | off | Ignore the per-slot idempotency check; mint a brand-new group id. Contradicts `--group` (exit 1 if both). |
| `--publish <true\|false>` | value | (see below) | Force publish or draft, overriding the scheduled default. Ignored with `--group` (status is inherited). |
| `--group <id>` | value | — | Resume an EXISTING `generationGroupId`: fill only its missing locales, reusing topic/images/meta and inheriting the group's publish/draft status. Exits 1 if the id matches no posts, if the value is missing, or when asked to fill EN into a group with no EN post. |

**Topic resolution precedence:** resumed group topic → `--sourceUrl` → `--sourceText` → `--customTopic` → `--category` (a `random`/specific pool draw) → `smartSelectTopic()`.

**Publish decision** (`generate-post.ts:177`):

```ts
let publish = opts.publish === 'true' || (opts.publish !== 'false' && isScheduled);
```

So scheduled runs (`GITHUB_EVENT_NAME=schedule`) publish directly unless `--publish false`; manual/local runs stay drafts unless `--publish true`. A `--group` heal then overrides this with the resumed group's own status — a filled-in locale never out-publishes its siblings.

### Idempotency (scheduled runs)

When `GITHUB_EVENT_NAME=schedule` and `--force` is absent, the run uses a deterministic group id `sched-<YYYY-MM-DD>-<am|pm>` (`scheduleSlotId`) derived from the **current** wall clock. A duplicate cron fire for the same slot is a no-op; a re-run after partial failure resumes the same group and fills only the missing locales, reusing the stored topic, cover/content images, meta, and the EN body as the ru/uz anchor — but **only inside the same UTC half-day**; after the am/pm boundary a plain re-run starts a new topic under the current slot. Use `--group <id>` to heal a partial group reliably at any time.

### Environment

| Var | Required | Used for |
|---|---|---|
| `DATABASE_URL` | yes (throws if unset) | Postgres via the repository layer |
| `MOONSHOT_API_KEY` / `KIMI_API_KEY` / `DEEPSEEK_API_KEY` | one required (throws if none) | AI drafting + web-search grounding |
| `UNSPLASH_ACCESS_KEY` | for images | `getCoverImageForTopic` / `getImagesForPost` |
| `API_SECRET` | optional | Bearer token for the `POST /api/admin/revalidate` ISR bust |
| `TG_BOT_TOKEN` / `TG_CHAT_ID` | optional | Telegram run notification |
| `NEXT_PUBLIC_BASE_URL` | optional | Base URL for post links / revalidate call (default `https://softwhere.uz`) |
| `GITHUB_EVENT_NAME` | optional | `schedule` toggles slot idempotency + auto-publish |
| `GITHUB_STEP_SUMMARY` | optional | Markdown run summary appended for the Actions UI |

### Inputs / outputs / side effects

- **Inputs:** CLI options + env; optionally a fetched URL or provided source text; live web-search facts (`buildFactSheet` → `verifyFactUrls`); Unsplash images.
- **DB writes:** one row per locale via `persistLocalePost`, `status: 'published' | 'draft'`. On a resumed slot it reuses the already-saved EN body.
- **On publish:** `pingIndexNow(urls)` and a best-effort `POST /api/admin/revalidate` (Bearer `API_SECRET`) to bust ISR caches; without `API_SECRET` posts surface within ~1h.
- **Reporting:** console log, a Markdown table to `$GITHUB_STEP_SUMMARY`, and a Telegram message (`sendTelegramMessage`).
- **Exit code:** `1` if any locale failed or nothing was created (so CI opens an issue); a scheduled re-run then fills only the gap.

---

## `regenerate-post.ts` — in-place regeneration of existing posts

Re-drafts the **body** (and localized meta) of existing posts through the upgraded `'deep'` pipeline while keeping slug, URL, status, images, and generation group intact — so indexed pages improve rather than move. Built for the 2026-07 content review (see [blog-review-2026-07.md](./blog-review-2026-07.md)).

### Invocation

```bash
npx tsx scripts/regenerate-post.ts --groups <id,id,...> [options]
```

### Options

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `--groups <list>` | value | — (**required**) | Comma-separated `generationGroupId`s. Empty → exit 1. |
| `--locales <list>` | value | `ru,uz` | Locales to regenerate per group. Sorted so `en` runs first (`LOCALE_ORDER`) — a freshly regenerated EN body then anchors ru/uz in the same run. |
| `--dryRun` | flag / `--dryRun true` | off | Produce content and write previews to `regen-preview/` without touching the DB. |

### Environment

Same keys as `generate-post` except no Unsplash (images are reused from the existing post): `DATABASE_URL` + one AI key are required; `API_SECRET`, `TG_BOT_TOKEN`/`TG_CHAT_ID`, `NEXT_PUBLIC_BASE_URL`, `GITHUB_STEP_SUMMARY` are optional.

### Inputs / outputs / side effects

- **Per group:** loads siblings via `getGroupSiblings`; requires an **EN sibling** (topic source + anchor) or the group is skipped. Rebuilds the pipeline `TopicResult` from the stored EN post (`topicFromEnPost`) and runs fresh research.
- **Per locale:** loads the target via `getPublishedBySlug`, reuses its inline images (cover excluded), runs `producePostContent({ mode: 'deep', ... })`.
- **Backups (always):** before any update it writes the old row to `regen-backups/<locale>--<slug>.json` — the only copy. `mkdirSync('regen-backups')` runs unconditionally.
- **Dry run:** writes `regen-preview/<locale>--<slug>.md`, leaves the DB untouched. `regen-preview/` is created only in dry-run mode.
- **DB write (non-dry):** `updateFieldsById(target._id, fields)` sets `content` and, when the pipeline returned `localizedMeta`, `title` / `metaDescription` / `primaryKeyword` / `secondaryKeywords`. UZ fields are run through `normalizeUzbekApostrophes`. **Slug never changes.**
- **On success (non-dry):** `pingIndexNow` + best-effort ISR revalidate + Telegram summary + `$GITHUB_STEP_SUMMARY` table.
- **Exit code:** `1` if any group/locale failed.

> In CI, `regen-backups/` and `regen-preview/` are uploaded as a run artifact (`regenerate-post.yml`), so replaced rows are recoverable even for scheduled runs.

---

## `audit-posts.ts` — read-only blog audit

Detects and reports only; it never writes to the DB. It replaces the old `scripts/regenerate-posts.ts` "fix" pipeline, whose regeneration half embedded the pre-overhaul prompts and would have undone the July-2026 quality work. Fixing is a human decision in the admin, or a targeted re-generation with `generate-post.ts`.

### Invocation

```bash
npx tsx scripts/audit-posts.ts [--json]
```

`--json` prints a machine-readable array of flagged groups instead of the human console layout.

### What it checks

- **Structural gaps** per post via `getPostIssues` from [`scripts/lib/post-structure.ts`](#post-structurets--structural-validation): missing cover/inline images, missing/invalid category or post format, missing keywords/meta, content too short, content with no inline-image markdown.
- **Cross-group similarity** on EN posts only, via [`scripts/lib/similarity.ts`](#similarityts--similarity-detection): duplicate cover URLs, near-duplicate titles, near-duplicate content.

Posts are grouped by `generationGroupId` (solo posts audit as `solo-<id>`). Flagged groups are sorted by issue count (`countIssues`) descending.

### Inputs / outputs / side effects

- **Input:** `listAll()` from the repository (`DATABASE_URL` required, throws if unset).
- **Output:** console report (or JSON) + a top-30 Markdown table to `$GITHUB_STEP_SUMMARY`.
- **Side effects:** none — read-only. **Always exits `0`**, even when groups are flagged (the report is informational).

---

## `estimator-calibration.ts` — pricing formula harness

Prints `calculateEstimate` output for 15 canonical Tashkent-market scenarios (July 2026 research) next to their target price bands. Run it after changing pricing constants or the catalog, and adjust `src/modules/estimator/constants.ts` until every row lands in (or sensibly near) its band. See [estimator.md](./estimator.md).

### Invocation

```bash
yarn tsx scripts/estimator-calibration.ts
```

No flags, no env, no DB, no file writes — a pure compute over `src/modules/estimator` (`applySubtype`/`defaultInputFor` from the catalog, `calculateEstimate`). Each case is built with a small `scenario(type, subtype, patch)` helper:

```ts
{ label: 'SaaS MVP', target: '$2500–6000', input: scenario('web', 'saas') },
```

Output is one padded line per case — label, then the computed cost / weeks / hours, then the target band:

```ts
console.log(`${label.padEnd(46)} ${cost.padEnd(18)} ${weeks.padEnd(8)} ${hours.padEnd(12)} target ${target}`);
```

where `cost` is `$<min>–$<max>`, `weeks` is `<min>–<max>w`, and `hours` is `<min>–<max>h`. Compare each row's cost against its `target ...` band.

---

## `screenshot-homepage.ts` — homepage screenshots

Captures the homepage at several scroll positions plus a full-page shot, in light or dark scheme, using Playwright's bundled Chromium.

### Invocation

```bash
# start the app first
yarn dev
# then, in another shell:
npx tsx scripts/screenshot-homepage.ts        # light
npx tsx scripts/screenshot-homepage.ts --dark # dark
```

**Requires a dev server on `http://localhost:3000`** — if the page fails to load, it prints a hint (`is the dev server running? (yarn dev)`) and exits `1`.

### Behavior & outputs

- Launches headless Chromium at viewport `1280×720`, `deviceScaleFactor: 2`, with `colorScheme` set to `dark` when `--dark` is passed (also adds the `dark` class to `<html>`).
- Waits for AOS/dynamic content, then screenshots each of seven sections (`01-hero` … `07-faq`, selected by CSS selector and scrolled into view) plus a `00-full-page.png` full-page capture.
- **File writes:** PNGs to `screenshots-homepage/light/` or `screenshots-homepage/dark/` (created if absent). No DB, no network beyond the local page load.

---

## `scripts/lib/` helpers

Shared modules imported by `audit-posts.ts`. They intentionally duplicate a few constants from `src/modules/blog/data/seo-topics` because scripts cannot use the `@/` path alias.

### `post-structure.ts` — structural validation

Defines what a well-formed post must contain and detects missing parts.

- **Constants:** `SERVICE_PILLARS` (14 pillar ids) and `POST_FORMATS` (14 formats) — the allow-lists used to flag `invalid-category` / `invalid-post-format`.
- **`getPostIssues(post: PostDoc): PostIssue[]`** returns any of: `missing-cover-image`, `missing-inline-images`, `missing-category`, `invalid-category`, `missing-post-format`, `invalid-post-format`, `missing-primary-keyword`, `missing-secondary-keywords`, `missing-meta-description`, `content-too-short`, `content-no-inline-images`.
- **Inline-image thresholds scale with length:** `minInline = wc >= 3000 ? 3 : wc >= 1500 ? 2 : 1`. `content-too-short` fires below 300 words. `content-no-inline-images` fires when the body has no `![...](https://...)` markdown.
- **`analyzeGroup(posts, groupId, opts)`** rolls per-post issues into a `GroupAnalysis` (picks the EN post, sets `needs*` flags, folds in the `duplicateCover`/`similarTitle`/`similarContent` signals). **`countIssues(analysis)`** sums per-post issues plus the three group-level similarity flags.

### `similarity.ts` — similarity detection

Lightweight, no embeddings: Jaccard for titles, word-overlap for content, exact-URL match for covers.

- **`tokenize`** lowercases, strips non-alphanumerics, drops a `STOP_WORDS` set and tokens ≤2 chars. **`jaccardSimilarity(a, b)`** is intersection / union of the token sets.
- **Titles:** `areTitlesSimilar` compares title tokens against `TITLE_SIMILARITY_THRESHOLD = 0.82`.
- **Content:** `areContentsSimilar` compares the first `400` words (`CONTENT_WORD_SAMPLE`); if the head passes `CONTENT_SIMILARITY_THRESHOLD = 0.88` it's a match, otherwise it averages head + a 200-word middle sample.
- **Cluster finders (scoped to one locale):** `findDuplicateCovers` (exact cover-URL match across different groups), `findSimilarTitles`, `findSimilarContent` — each returns a `Map<groupId, groupId[]>` of related groups, which `audit-posts.ts` collapses into per-group flags.

---

## `package.json` yarn scripts

Run with `yarn <name>`. The `mcp*` scripts are covered in [mcp.md](./mcp.md).

| Script | Command | What it does |
|---|---|---|
| `dev` | `next dev` | Start the Next.js dev server. |
| `dev:debug` | `cross-env NODE_OPTIONS=--inspect next dev` | Dev server with the Node inspector attached. |
| `dev:env` | `yarn env:pull:development && next dev` | Pull Vercel **development** env into `.env`, then dev. |
| `dev:production` | `yarn env:pull:production && next dev` | Pull **production** env into `.env`, then dev. |
| `build` | `next build` | Production build. |
| `start` | `next start` | Serve the production build. |
| `start:production` | `yarn env:pull:production && next start` | Pull production env, then serve. |
| `clean` | `rm -rf .next .next/dev` | Remove build output. |
| `lint` | `eslint src/` | Lint (includes the `eslint-plugin-boundaries` layering rules). |
| `lint:fix` | `eslint src/ --fix` | Lint and autofix. |
| `format` | `prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,scss,md}"` | Format `src/`. |
| `format:check` | `prettier --check .` | Check formatting without writing. |
| `type-check` | `tsc --noEmit` | TypeScript type-check only. |
| `db:push` | `drizzle-kit push` | Push the Drizzle schema to Neon (no migration files). |
| `db:generate` | `drizzle-kit generate` | Generate SQL migration files from the schema. |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio against the DB. |
| `normalize-line-endings` | `git add --renormalize .` | Re-normalize line endings per `.gitattributes`. |
| `env:pull:production` | `npx vercel env pull .env --environment production --yes` | Pull production env vars to `.env`. |
| `env:pull:development` | `npx vercel env pull .env --environment development --yes` | Pull development env vars to `.env`. |
| `env:pull:local:production` | `npx vercel env pull .env.local --environment production --yes` | Pull production env vars to `.env.local`. |
| `mcp` | `yarn env:pull:local:production && node scripts/verify-mcp-env.js` | Prep + verify MCP env — see [mcp.md](./mcp.md). |
| `mcp:searchconsole` | `node scripts/searchconsole-mcp.js` | Search Console MCP wrapper — see [mcp.md](./mcp.md). |
| `mcp:yandex-webmaster` | `node scripts/yandex-webmaster-mcp.js` | Yandex Webmaster MCP wrapper — see [mcp.md](./mcp.md). |

> There is no `test` script — `tsc --noEmit` (`type-check`), `eslint`, and Prettier are the automated gates. The end-to-end Playwright suite is documented under `docs/testing/`; the only Playwright usage wired into a script is `screenshot-homepage.ts` above.

## Related docs

- [blog-pipeline.md](./blog-pipeline.md) — the `producePostContent` pipeline the generate/regenerate scripts wrap.
- [ci-workflows.md](./ci-workflows.md) — the GitHub Actions that invoke `generate-post`, `regenerate-post`, and `audit-posts`.
- [estimator.md](./estimator.md) — the estimator engine `estimator-calibration.ts` calibrates.
- [mcp.md](./mcp.md) — the `scripts/*-mcp.js` wrappers and `yarn mcp*` scripts.
- [../README.md](../README.md) — project overview and setup.

_Last verified against code: 2026-07-03._
