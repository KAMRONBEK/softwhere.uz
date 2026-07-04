# 0004 — Grounded AI blog pipeline (research → generate → quality → normalize)

Blog posts are AI-written but grounded: statistics must come from a fact sheet built by real web search, and every stage degrades gracefully rather than shipping fabrication.

## At a glance

| | |
| --- | --- |
| **Status** | Accepted |
| **Landed / evolved** | `154df07` grounded pipeline → `3ff7587` pipeline v2 → `55d80e9` DeepSeek V4 Pro default → `4533955` in-place regeneration |
| **Providers** | Kimi K2.6 (primary) → DeepSeek V4 Pro (fallback), both via the OpenAI-compatible `openai` SDK |
| **Grounding** | Kimi server-side `$web_search` fact sheet + deterministic sources; no fact sheet ⇒ qualitative writing |
| **Entry points** | admin route `/api/blog/generate` (`mode: 'fast'`), CLI `scripts/generate-post.ts` / `scripts/regenerate-post.ts` (`mode: 'deep'`) |
| **Hard failure** | fabricated (unapproved) citation URLs — revised away or stripped; refusal is the last-resort backstop |
| **Client** | `src/core/ai.ts` |
| **Live spec** | [`../blog-pipeline.md`](../blog-pipeline.md) |

## Context

An always-on AI content engine is only useful if it does not lie. Left to
themselves, LLMs invent statistics, cite plausible-but-nonexistent URLs, truncate
mid-word at their completion cap, and drift across locales (live UZ posts shipped
ending mid-word; RU posts spliced raw English keywords; a fake "Paste.uz" entity
appeared). The site publishes in three languages (uz/ru/en) twice a day
unattended, so the pipeline has to catch these failure modes itself, and it must
run both inside a Vercel function's time budget *and* in a GitHub Action where
wall-clock is free.

Note: the top-level brief calls the AI "DeepSeek". The code is a **two-provider
chain** — Kimi K2.6 first, DeepSeek second — both spoken to through the
OpenAI-compatible SDK (`src/core/ai.ts`). DeepSeek V4 Pro is the fallback and the
quality tier; Kimi is primary and is the *only* provider with web search.

## Decision

Run every locale's body through one pipeline (`src/modules/blog/api/pipeline.ts`,
`producePostContent`) with four phases, each fail-safe:

1. **Research → fact sheet** (`src/modules/blog/api/research.ts`,
   `buildFactSheet`). Two calls on purpose: Kimi's server-side `$web_search`
   (`src/core/ai.ts` `generateWithWebSearch`) returns findings as prose, then a
   tool-free call converts them to strict JSON. Facts with no URL are dropped;
   dead URLs are pruned by `verifyFactUrls` (HEAD→GET, behind an SSRF guard). If
   **no search actually ran**, the sheet is discarded — the writer is then forced
   to stay qualitative rather than cite guessed numbers.

2. **Generate** (`generateContentWithProvider`). The writing prompt hard-constrains
   statistics to the fact sheet. Localized keywords are computed *before* drafting
   so ru/uz prose is written against native search phrases, and ru/uz are anchored
   to the EN draft so the three locales are adaptations of one article. Uzbek is
   routed to DeepSeek first (`prefer: 'deepseek'`) because Kimi's Uzbek scores
   markedly lower (UzLiB 0.709 vs 0.518).

3. **Quality gates.** A deterministic **truncation guard** uses the plumbed-through
   `finish_reason === 'length'` (and a heuristic `looksTruncated`) to fire one
   continuation call and refuse a still-truncated draft. Then a deterministic
   **lint** (`src/modules/blog/api/quality.ts`, `lintContent`) triggers one
   surgical revision. In **deep mode** (and always for Uzbek, the weakest path) a
   **cross-model critique** has the other provider review the draft, and deep mode
   adds a **native-editor proofread** for spelling/idiom errors that lints cannot
   catch.

4. **Normalize + final gate.** Deterministic fixes run last: `renderChartBlocks`
   turns ` ```chart ` fences into QuickChart image URLs, `normalizeInternalLinks`
   repairs locale-relative links, and `normalizeUzbekApostrophes` unifies the UZ
   apostrophe glyph. A final `lintContent` runs; residual `link` issues
   (unapproved/fabricated URLs) are **remediated, not refused** (2026-07-04 —
   a refusal-only gate cost a live RU locale over 2 links): one surgical
   link-removal revision in deep mode, then a deterministic
   `stripUnapprovedUrls`, with refusal kept only as the unreachable backstop.
   Everything else is a soft warning. Accepted content is persisted via the
   repository (`persistLocalePost` → `createPost`, see
   [ADR 0002](./0002-mongodb-to-neon-drizzle.md)).

**Two modes, one pipeline.** `mode: 'fast'` (admin route, `maxDuration = 300`) does
draft → lint → one revision; `mode: 'deep'` (the CLI, run by CI) adds critique and
proofread because wall-clock is free there.

**Provider chain** (`src/core/ai.ts`): Kimi K2.6 primary, DeepSeek V4 Pro fallback,
per-provider quota cooldowns so a rate-limited provider steps aside instead of
blocking the other. Everything is env-overridable (`AI_MODEL`, `AI_FALLBACK_MODEL`,
`BLOG_MAX_TOKENS`, base URLs). Provider quirks are handled centrally: Kimi K2.6
must run with `thinking: { type: 'disabled' }` or every call 400s, its sampling is
fixed so tuned `temperature` applies to DeepSeek only, and `$web_search` is
Kimi-only.

## Consequences

- **Invented citations never ship — but no longer cost the locale.** Unapproved
  URLs are revised away (deep mode) or deterministically stripped; the post is
  dropped only if both somehow fail. Truncated, under-length, or
  too-few-providers cases still skip the affected locale rather than ship
  filler; missing search degrades to qualitative writing.
- **Grounding depends on Kimi.** Web-search facts require a configured, non-cooled
  Kimi key. With only DeepSeek configured, posts are qualitative and the
  cross-model critique is skipped (`configuredProviders().length > 1`).
- **Cost/latency knobs are real.** `BLOG_MAX_TOKENS` defaults to 32K (the old 8K
  "cap" was itself the truncation cause); deep mode is several extra model calls;
  each `$web_search` costs ~$0.005 and rounds are bounded (`MAX_SEARCH_ROUNDS`).
- **Owner secrets:** at least one of `MOONSHOT_API_KEY`/`KIMI_API_KEY` or
  `DEEPSEEK_API_KEY` must be set (the generate route logs an error if neither is),
  plus `DATABASE_URL`. Machine runs authenticate via the `API_SECRET` bearer of
  [ADR 0003](./0003-admin-auth-neon-auth.md).
- **Scheduling reality:** `.github/workflows/generate-post.yml` runs **twice daily**
  (06:17 & 18:17 UTC) and auto-publishes; a companion `regenerate-post.yml` does
  in-place deep-mode regeneration. (The header comment in `pipeline.ts` still says
  "weekly" — the workflow schedule is the source of truth.)

## References

- `src/core/ai.ts` — provider chain, cooldowns, `generateContentWithProvider`, `generateWithWebSearch` ($web_search protocol), Kimi `thinking`/temperature quirks, `BLOG_MAX_TOKENS`.
- `src/modules/blog/api/research.ts` — `buildFactSheet` (two-stage search→JSON), `verifyFactUrls`, `PREFERRED_SOURCES`.
- `src/modules/blog/api/pipeline.ts` — `producePostContent` (the four phases), `looksTruncated`, the final link gate, `persistLocalePost`.
- `src/modules/blog/api/quality.ts`, `src/modules/blog/utils/normalize.ts` — lint and deterministic normalization.
- `src/app/api/blog/generate/route.ts` — the `mode: 'fast'` admin entry point (`maxDuration = 300`, `requireAdmin`).
- `scripts/generate-post.ts`, `scripts/regenerate-post.ts` — the `mode: 'deep'` CLI entry points.
- `.github/workflows/generate-post.yml`, `.github/workflows/regenerate-post.yml` — the schedules.
- commits `154df07`, `3ff7587`, `55d80e9`, `4533955`.

## Related docs

- [`../blog-pipeline.md`](../blog-pipeline.md) — the pipeline as a live spec.
- [`./0002-mongodb-to-neon-drizzle.md`](./0002-mongodb-to-neon-drizzle.md) — where generated posts are stored.
- [`./0003-admin-auth-neon-auth.md`](./0003-admin-auth-neon-auth.md) — how machine runs authenticate.
- [`../../README.md`](../../README.md) — project overview.

_Last verified against code: 2026-07-03._
