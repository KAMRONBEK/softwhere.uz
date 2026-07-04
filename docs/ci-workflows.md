# CI Workflows (`.github/workflows`)

The blog's content jobs run in GitHub Actions, not on Vercel. Three workflows drive
the AI blog: one generates new posts on a schedule, one regenerates existing posts in
place, and one audits the corpus. This documents each one's triggers, inputs, secrets,
the script it runs, and how to run it by hand.

> **These workflows do not commit or push to the repo.** Their output is written to the
> Neon Postgres database (the `blog_posts` table) via the repository layer, plus best-effort
> IndexNow pings, ISR cache revalidation, and Telegram/issue notifications. The only files
> they emit are the `regen-backups/` / `regen-preview/` artifacts on the regenerate job. There
> are no `git commit` steps in any of the three.

## At a glance

| Workflow | File | Trigger | Runs | Writes to DB? | Notifications |
|---|---|---|---|---|---|
| Generate Blog Post | `.github/workflows/generate-post.yml` | 2× daily cron + manual dispatch | `scripts/generate-post.ts` | Yes (creates rows) | Issue on failure, Telegram, keepalive |
| Regenerate Blog Posts | `.github/workflows/regenerate-post.yml` | Manual dispatch only | `scripts/regenerate-post.ts` | Yes (updates rows in place) | Issue on failure, Telegram, backup artifacts |
| Blog Audit | `.github/workflows/audit-posts.yml` | Monthly cron + manual dispatch | `scripts/audit-posts.ts` | No (read-only) | Step summary only |

Common shape across all three: `ubuntu-latest`, `environment: Production`, Node 22 with
the `yarn` cache, `yarn install --frozen-lockfile`, then `npx tsx scripts/<name>.ts`. All
require `DATABASE_URL`. Every script calls `import 'dotenv/config'`, so a local run reads
env from `.env`.

> **`environment: Production` must have no required reviewers or wait timers.** A scheduled
> job would otherwise sit in "Waiting" and eventually fail (see the note at
> `.github/workflows/generate-post.yml:79`). Workflow secrets are read from this environment.

---

## Secrets checklist

Set these as **Production environment** secrets in the repo (Settings → Environments → Production).
Optional ones degrade gracefully when absent.

| Secret | generate | regenerate | audit | Purpose |
|---|:--:|:--:|:--:|---|
| `DATABASE_URL` | required | required | required | Neon Postgres connection (Drizzle HTTP driver). |
| `MOONSHOT_API_KEY` | required¹ | required¹ | — | Kimi K2.6 — primary AI provider **and** the web-search grounding backend. |
| `DEEPSEEK_API_KEY` | required¹ | required¹ | — | DeepSeek V4 Pro — UZ path + cross-model critique; fallback if Kimi is missing. |
| `UNSPLASH_ACCESS_KEY` | required² | — | — | Cover + inline images for new posts. |
| `TG_BOT_TOKEN` | optional | optional | — | Telegram bot for the published/draft/regen summary (same bot as leads). |
| `TG_CHAT_ID` | optional | optional | — | Telegram chat the summary is sent to. |
| `API_SECRET` | optional | optional | — | Bearer token to bust the site's ISR caches right after writing (`POST /api/admin/revalidate`). Without it, new/updated posts surface within ~1 hour. |

¹ The scripts guard on **at least one** AI key: `MOONSHOT_API_KEY` **or** `KIMI_API_KEY` **or**
`DEEPSEEK_API_KEY` (`scripts/generate-post.ts:50`, `scripts/regenerate-post.ts:42`). The
workflows only wire `MOONSHOT_API_KEY` + `DEEPSEEK_API_KEY`; `KIMI_API_KEY` is an accepted alias
in code but is not passed by the workflow env. Without `MOONSHOT_API_KEY`, generation falls back
to DeepSeek and is **ungrounded** (no web-search facts).

² Not enforced by an env guard, but new posts need it for images; missing images are exactly
what the audit flags.

`GITHUB_TOKEN` is provided automatically by Actions (used as `github.token` for issue creation
and the keepalive re-enable). `NEXT_PUBLIC_BASE_URL` is read by the scripts for building post
URLs and the revalidate call; it is not set in the workflow env, so it falls back to
`https://softwhere.uz` (`scripts/generate-post.ts:152`).

---

## `generate-post.yml` — Generate Blog Post

Creates a full multilingual post group (EN → RU → UZ) through the **deep** pipeline
(research → draft → lint/revise → cross-model critique → revise). It is a thin CI wrapper
around the same pipeline the admin API route uses (`src/modules/blog/api/pipeline.ts`).

### Triggers

The brief calls this "weekly," but the on-disk schedule is **twice daily** —
`.github/workflows/generate-post.yml:9`:

```yaml
schedule:
  # 06:17 and 18:17 UTC (11:17 / 23:17 Tashkent). Off the hour on purpose —
  # GitHub delays/skips schedules at :00 peaks.
  - cron: '17 6 * * *'
  - cron: '17 18 * * *'
workflow_dispatch:
  inputs: { ... }
```

Scheduled runs use a deterministic **slot group id** `sched-<YYYY-MM-DD>-<am|pm>`
(`scripts/generate-post.ts:105`). A duplicate cron fire, or a re-run after a partial failure,
resumes the same slot and generates **only the missing locales** — reusing the slot's topic,
images, and meta. Pass `force=true` to opt out and start a brand-new group.

The slot id is derived from the **current** UTC date + am/pm, so that self-healing only works
inside the failed run's own half-day slot — a re-run after the am/pm boundary (or the next day)
silently starts a **new topic** under the current slot instead. To fill a partial group reliably,
dispatch with `group=<generationGroupId>` — it resumes that group exactly like a slot resume
(reuses topic/images/meta, skips locales that already exist, **inherits the group's
publish/draft status**, errors if the id matches nothing, and refuses to fill EN when the group
has no EN post to rebuild the topic from). `group` cannot be combined with `force`. The admin
panel's per-group **Generate** button is the UI equivalent (route continuation mode, fast
pipeline).

### Dispatch inputs

| Input | Type | Default | Effect |
|---|---|---|---|
| `category` | choice | `''` | Service pillar (e.g. `mobile-app-development`), or `random`. Empty = smart auto-selection. |
| `customTopic` | string | `''` | Free-text topic; overrides `category`. Normalized by the model first. |
| `sourceUrl` | string | `''` | URL fetched and used as source material; overrides topic selection. |
| `sourceText` | string | `''` | Raw source text (truncated to `MAX_SOURCE_TEXT_LENGTH`); overrides topic selection. |
| `group` | string | `''` | Existing `generationGroupId` to fill missing locales for; overrides topic selection (topic/images/meta AND publish status come from the group; `publish`/`force` inputs are ignored/rejected). |
| `force` | boolean | `false` | Bypass the slot idempotency check → new group. |
| `publish` | boolean | `true` | `true` publishes immediately; `false` saves drafts for review. |

Precedence in the script (`scripts/generate-post.ts:257`+): resumed group topic → `sourceUrl` →
`sourceText` → `customTopic` → `category`/`random` → smart auto-select.

**Publish semantics** (`scripts/generate-post.ts:177`): `publish` is true when the input is
`'true'`, or when the input is not `'false'` **and** the run is scheduled. So scheduled runs
auto-publish unless `publish=false`; a bare local run (`GITHUB_EVENT_NAME` unset, no `--publish`)
stays as drafts. A `group=<id>` dispatch overrides all of this and inherits the resumed group's
own status — healed locales never out-publish their siblings.

### What the step runs

```yaml
run: |
  npx tsx scripts/generate-post.ts \
    --category "$INPUT_CATEGORY" \
    --customTopic "$INPUT_CUSTOM_TOPIC" \
    --sourceUrl "$INPUT_SOURCE_URL" \
    --sourceText "$INPUT_SOURCE_TEXT" \
    --group "$INPUT_GROUP" \
    --locales "en,ru,uz" \
    ${INPUT_FORCE:+--force "$INPUT_FORCE"} \
    ${INPUT_PUBLISH:+--publish "$INPUT_PUBLISH"}
```

On success the script persists each locale via `persistLocalePost`, and (when publishing)
pings IndexNow, requests ISR revalidation with `API_SECRET`, writes a `$GITHUB_STEP_SUMMARY`
table, and sends a Telegram message. It **exits non-zero if any locale failed or nothing was
created** (`scripts/generate-post.ts:494`) — safe, because a `group=<id>` dispatch (or a re-run
inside the same UTC half-day slot) fills only what's missing.

### Concurrency, permissions, timeouts

- `concurrency: generate-post` (`cancel-in-progress: false`) — a manual dispatch cannot overlap
  a scheduled run and double-post.
- `permissions: contents: read`, `issues: write` (failure issue), `actions: write` (keepalive).
- `timeout-minutes: 45` on the job, `40` on the generate step.

### Post-run steps

- **Open issue on failure** (`if: failure()`): `gh issue create` with a link to the run.
- **Keepalive** (`if: always()`): `gh api -X PUT ".../workflows/generate-post.yml/enable"` — resets
  GitHub's 60-day inactivity auto-disable so the schedule keeps firing.

### Run it manually

From the Actions tab: **Generate Blog Post → Run workflow**. Or with the CLI:

```bash
# Draft a specific pillar for review (no publish)
gh workflow run generate-post.yml -f category=mobile-app-development -f publish=false

# Force an extra post from a custom topic, published immediately
gh workflow run generate-post.yml -f customTopic="How much a Telegram bot costs in 2026" -f force=true

# Fill the missing locales of a partial group (e.g. after a failed scheduled run)
gh workflow run generate-post.yml -f group=sched-2026-07-03-pm
```

Locally (writes to whatever `DATABASE_URL` points at; defaults to drafts):

```bash
npx tsx scripts/generate-post.ts --category ai-solutions --locales en,ru,uz
```

---

## `regenerate-post.yml` — Regenerate Blog Posts

Manual-only. Re-drafts the **body** and localized meta of existing posts **in place** — same
slug, URL, status, images, and generation group — so indexed pages improve instead of moving.
Built for the 2026-07 content review. It's safe to re-run: a failed locale leaves its post
untouched, and every replaced row is backed up first.

### Trigger & inputs

`workflow_dispatch` only. Inputs (`.github/workflows/regenerate-post.yml:9`):

| Input | Type | Default | Effect |
|---|---|---|---|
| `groups` | string | — (**required**) | Comma-separated `generationGroupId`s to regenerate. |
| `locales` | string | `ru,uz` | Locales per group. `en` is processed first and becomes the anchor for ru/uz — include it only to also re-draft the EN body. |
| `dryRun` | boolean | `false` | Produce content into `regen-preview/` as artifacts; **no DB writes**. |

The script sorts requested locales EN-first (`scripts/regenerate-post.ts:48`) and, for each
group, rebuilds the pipeline `TopicResult` from the stored EN post
(`scripts/regenerate-post.ts:90`). A group with **no EN sibling is skipped**.

### What the step runs

```yaml
run: |
  npx tsx scripts/regenerate-post.ts \
    --groups "$INPUT_GROUPS" \
    --locales "$INPUT_LOCALES" \
    ${INPUT_DRY_RUN:+--dryRun "$INPUT_DRY_RUN"}
```

Before overwriting a row, the script writes the old row to `regen-backups/<locale>--<slug>.json`
(`scripts/regenerate-post.ts:207`) — the only copy of the pre-regen content. In dry-run mode it
writes the new body to `regen-preview/<locale>--<slug>.md` and skips the DB entirely. The
`updateFieldsById` call **never changes the slug**. When not a dry run and something updated, it
pings IndexNow and revalidates ISR (`API_SECRET`), then sends a Telegram summary. It exits
non-zero if any group/locale failed.

### Backups artifact

```yaml
- name: Upload backups of replaced rows
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: regen-backups-${{ github.run_id }}
    path: |
      regen-backups/
      regen-preview/
    if-no-files-found: ignore
    retention-days: 90
```

The old-row JSON (and, in a dry run, the preview markdown) are uploaded as
`regen-backups-<run_id>`, kept 90 days. This is your recovery path if a regeneration goes wrong.

### Concurrency, permissions, timeouts

- `concurrency: generate-post` — **the same group as the generator**, so a regeneration never
  overlaps a scheduled generate or another regen (shared DB + provider quotas).
- `permissions: contents: read`, `issues: write`.
- `timeout-minutes: 120` on the job, `110` on the regenerate step.

### Run it manually

```bash
# Preview only — inspect regen-preview/ artifacts, nothing written
gh workflow run regenerate-post.yml -f groups="sched-2026-06-30-am,sched-2026-06-30-pm" -f dryRun=true

# Regenerate RU + UZ for one group, then also re-draft EN
gh workflow run regenerate-post.yml -f groups="sched-2026-06-30-am" -f locales="en,ru,uz"
```

Find `generationGroupId`s via the admin, the `blog_posts` table, or the audit report (its group
column). Locally:

```bash
npx tsx scripts/regenerate-post.ts --groups <id> --locales ru,uz --dryRun
```

---

## `audit-posts.yml` — Blog Audit

Read-only health report. It replaced an older "Fix Blog Posts" workflow whose fix mode embedded
pre-overhaul prompts and would have overwritten reviewed posts. This one **only detects and
reports** — never writes to the DB, opens no issues, and produces no artifacts.

### Trigger

`workflow_dispatch` + a monthly cron (`.github/workflows/audit-posts.yml:8`):

```yaml
schedule:
  # 07:07 UTC on the 1st of each month — a low-noise health report.
  - cron: '7 7 1 * *'
```

- `concurrency: audit-posts`, `permissions: contents: read`, `timeout-minutes: 15`.

### What the step runs

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
run: npx tsx scripts/audit-posts.ts
```

`DATABASE_URL` is the only secret needed — no AI keys. The script accepts an optional `--json`
flag (not passed by the workflow) for machine-readable output.

### What it reports

`scripts/audit-posts.ts` loads all posts via the repository, groups them by
`generationGroupId` (solo posts audit as their own group), and reports two classes of problem.

**Per-post structural gaps** (`scripts/lib/post-structure.ts`):

| Issue | Condition |
|---|---|
| `missing-cover-image` | No cover `url` + `thumbUrl`. |
| `missing-inline-images` | Fewer valid inline images than required (1 / 2 / 3 by word count ≥1500 / ≥3000). |
| `content-no-inline-images` | Body has no `![...](...)` markdown image. |
| `missing-category` / `invalid-category` | Absent, or not one of the 14 service pillars. |
| `missing-post-format` / `invalid-post-format` | Absent, or not a known post format. |
| `missing-primary-keyword` / `missing-secondary-keywords` | SEO keyword fields empty. |
| `missing-meta-description` | No meta description. |
| `content-too-short` | Word count < 300. |

**Cross-group similarity on EN posts** (`scripts/lib/similarity.ts`):

- `duplicate cover` — exact cover URL reused across groups.
- `similar title` — Jaccard token similarity ≥ `0.82`.
- `similar content` — head/mid word-overlap ≥ `0.88`.

Output goes to the console (or JSON with `--json`) and a `$GITHUB_STEP_SUMMARY` table of the
top flagged groups. The script **always exits 0** — a flagged group is a report, not a failure.
Fixing is a human decision in the admin, or a targeted `generate-post` / `regenerate-post` run.

### Run it manually

```bash
gh workflow run audit-posts.yml          # CI report in the run's step summary
npx tsx scripts/audit-posts.ts --json    # local, machine-readable
```

---

## Notes & gotchas

- **"Weekly" is actually twice daily.** The generator's cron fires at 06:17 and 18:17 UTC; the
  brief's "weekly" wording is stale. Follow the code.
- **No git writes.** None of these workflows commit or push. Content lives in Neon; treat the DB
  as the source of truth for posts (the repo only holds the scripts/pipeline).
- **Generate and regenerate share the `generate-post` concurrency group** on purpose — they must
  never run at the same time (shared DB + AI quotas). Audit uses its own `audit-posts` group.
- **Failure = an open issue** for generate and regenerate (not audit). For the generator, the
  intended retry is dispatching with `group=<id>` (a plain re-run only resumes the slot inside
  the same UTC half-day, and outside it silently generates a new topic). For regenerate,
  re-dispatch with the same groups — failed locales left their posts untouched.
- **Keepalive is generate-only.** The monthly audit and the scheduled generate both reset
  GitHub's 60-day auto-disable indirectly by running, but only `generate-post.yml` has an
  explicit `enable` step.
- **There is no `package.json` script** for these tasks; they're always invoked as
  `npx tsx scripts/<name>.ts`. See the `scripts` block in `package.json` for the ones that do exist.

## Related docs

- [Blog pipeline](./blog-pipeline.md) — the `producePostContent` deep pipeline these scripts wrap.
- [Scripts](./scripts.md) — every `scripts/*.ts` entry point, including these three.
- [Environment variables](./environment.md) — full env/secret reference.
- [Deployment](./deployment.md) — Vercel deploy vs. these Actions-run content jobs.
- [Database](./database.md) — the Neon `blog_posts` table and repository layer.
- [Blog content review 2026-07](./blog-review-2026-07.md) — the review that motivated `regenerate-post`.
- [Project README](../README.md)

_Last verified against code: 2026-07-03._
