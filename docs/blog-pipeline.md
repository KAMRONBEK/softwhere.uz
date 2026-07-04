# AI Blog Generation Pipeline

How one blog topic becomes three linked, grounded, quality-checked posts (uz/ru/en) — from topic selection through research, generation, quality gates, normalization, and persistence.

This is the canonical reference for the generation pipeline. Every claim below is traceable to code in `src/modules/blog/**`, `src/core/ai.ts`, `src/app/api/blog/generate/route.ts`, and `scripts/generate-post.ts`.

## At a glance

| Aspect | Reality (on `main`) |
|---|---|
| Entry points | Admin API route `POST /api/blog/generate` (mode `fast`) and CLI `scripts/generate-post.ts` (mode `deep`) |
| Shared core | `src/modules/blog/api/pipeline.ts` — `producePostContent` + `persistLocalePost`, used by BOTH entry points so they cannot drift |
| AI providers | Primary **Kimi K2.6** (Moonshot), fallback **DeepSeek V4 Pro** — both via the OpenAI-compatible `openai` SDK in `src/core/ai.ts` |
| Web-search grounding | Kimi-only (`$web_search` builtin); DeepSeek has no search path |
| Locales | `en` first (anchors the others), then `ru`, `uz`; linked by `generationGroupId` |
| Persistence | Single `blog_posts` table via the repository layer (`src/modules/blog/model/posts.repository.ts`) — routes never touch Drizzle directly |
| Cron | GitHub Actions `generate-post.yml`, twice daily 06:17 / 18:17 UTC, runs the CLI in `deep` mode and auto-publishes |
| Duplicate detection | Topic rotation + slug uniqueness live in the pipeline; near-duplicate title/content/cover detection is a SEPARATE read-only audit (`scripts/audit-posts.ts`), not the generator |

## Module map

| File | Role |
|---|---|
| `src/modules/blog/api/generator.ts` | Prompt builders, topic selection, source classification, meta generation/localization. No drafting logic — builds prompts and parses model output only. |
| `src/modules/blog/api/pipeline.ts` | The one content pipeline: `producePostContent` (draft → guard → lint/revise → critique → proofread → normalize → gate) and `persistLocalePost`. |
| `src/modules/blog/api/research.ts` | `buildFactSheet` (Kimi web search → strict JSON) and `verifyFactUrls` (HEAD/GET liveness). |
| `src/modules/blog/api/quality.ts` | Deterministic slop lint + link audit (`lintContent`) and revision instruction builder. |
| `src/modules/blog/data/seo-topics.ts` | `SERVICE_PILLARS` — 14 pillars, each with weighted SEO topics (title, keywords, format, target queries, image hints). |
| `src/modules/blog/data/post-blueprints.ts` | Per-format writing blueprint (word range, tone, structure, formatting rules, SEO hint). |
| `src/modules/blog/utils/normalize.ts` | Deterministic post-normalizers: chart fences → images, internal-link repair, Uzbek apostrophe normalization. |
| `src/modules/blog/utils/meta.ts` | `clampMeta` — boundary-aware meta-description truncation. |
| `src/modules/blog/utils/unsplash.ts` | Cover + inline image fetch from Unsplash (rate-limited, keyword-driven). |
| `src/modules/blog/utils/indexnow.ts` | `pingIndexNow` — notifies Yandex/Bing of new URLs. |
| `src/modules/blog/model/BlogPost.ts` | Drizzle `blog_posts` schema, `ICoverImage`, `IBlogPost`, `serializePost`. |
| `src/modules/blog/model/posts.repository.ts` | All DB access (reads, writes, topic-rotation helper `listRecentTopicInfo`, `slugTaken`, `createPost`). |
| `src/core/ai.ts` | Provider chain, `generateContentWithProvider`, `safeGenerateJSON`, `generateWithWebSearch`. |
| `src/app/api/blog/generate/route.ts` | Admin entry point (fast mode). |
| `scripts/generate-post.ts` | CLI entry point (deep mode, scheduled). |
| `scripts/lib/similarity.ts`, `scripts/lib/post-structure.ts` | Consumed only by `scripts/audit-posts.ts` — not by the generator. |

> `src/modules/blog/api/posts.ts` is a client-side helper (`getRelatedPost`) for fetching a sibling locale's slug — unrelated to generation. The server generator is `generator.ts`.

## End-to-end flow

Both entry points run the same ordered steps. Only `mode` (`fast` vs `deep`), `status` (`draft` vs `published`), and the publish side effects differ.

```
1. Select topic        smartSelectTopic() | category pool | customTopic | source classification
2. Fetch images        getCoverImageForTopic() + getImagesForPost()   (Unsplash)
3. EN meta description  generateMetaDescription()
4. Research            buildFactSheet() -> verifyFactUrls()           (Kimi $web_search)
5. Per locale (en, ru, uz):
     producePostContent()  ->  persistLocalePost()
6. Post-run             route: revalidate caches
                        CLI (publish): pingIndexNow + revalidate + Telegram
```

Steps 1–4 run once per group; step 5 loops over locales. `en` is generated first because its finished body anchors `ru`/`uz` (see [Cross-locale linking](#cross-locale-linking-generationgroupid)).

### 1. Topic selection

Four sources, resolved in the entry point (`route.ts:155-238`, `generate-post.ts:257-330`):

- **Source material** (`sourceUrl` or `sourceText`): `extractTextFromUrl` (SSRF-guarded, strips scripts/nav/footer, caps at `MAX_EXTRACTED_TEXT_LENGTH`) then `classifySourceContent` — an LLM JSON call that picks a `SERVICE_PILLARS` category, keywords, `PostFormat`, and image hints.
- **Custom topic** (`customTopic`): normalized by a small LLM cleanup call, filed under `web-app-development` / `beginner-guide`.
- **Category** (a pillar id or `random`): random pick from that pillar's topics.
- **Smart auto-selection** (default): `smartSelectTopic()` in `generator.ts:357`.

`smartSelectTopic` reads the 30 most recent EN posts' topic metadata via `listRecentTopicInfo` (repository), then scores every catalog topic:

```ts
// generator.ts — lower score wins; recent keywords excluded outright
const scored = allTopics
  .filter(t => !usedKeywords.has(t.primaryKeyword))
  .map(t => {
    const weight = pillar?.weight ?? 1;
    const pillarCount = pillarUsage.get(t.servicePillar) ?? 0;
    const formatPenalty = recentFormats.includes(t.postFormat) ? 10 : 0;
    return { topic: t, score: pillarCount / weight + formatPenalty };
  })
  .sort((a, b) => a.score - b.score);
// pick randomly from the best 3 to avoid always emitting the same topic
```

This is the pipeline's only **content-duplication avoidance at generation time**: it never re-uses a recent `primaryKeyword` and penalizes repeating the last 4 formats, weighting higher-`weight` pillars (mobile/MVP/AI = weight 2) more heavily. Near-duplicate *detection* across existing posts is a separate offline audit (see [Duplicate detection](#duplicate-detection)).

### 2. Cover + inline images (Unsplash)

Image fetching happens in the entry point, not the pipeline — the resulting `ICoverImage[]` are passed into `producePostContent` as `inlineImages` and into `persistLocalePost` as `coverImage`/`allContentImages`.

- `getCoverImageForTopic(title, keywordHint?)` — uses the topic's first `imageHints` entry when present, else an AI-generated visual keyword, else a deterministic keyword extracted from the title.
- `getImagesForPost(imageHints, title, excludeUrl)` — up to 3 inline images; **passes the cover URL as `excludeUrl`** so the hero photo never repeats as an in-body figure.

Requires `UNSPLASH_ACCESS_KEY`; without it image fetch logs a warning and returns `null` (posts generate imageless). A process-wide `RateLimiter` caps Unsplash at 20 calls/hour (`unsplash.ts:8-31`). Image URLs (`url`, `thumbUrl`) plus `unsplash.com` and `images.unsplash.com` are added to the pipeline's allowed-URL set so the link audit doesn't flag them.

The same images are reused across all three locales (fetched once per group). On a resumed group, images are read back from the existing DB rows rather than re-fetched.

### 3. Research → fact sheet

`buildFactSheet(topic)` in `research.ts:104` grounds every statistic the writer is allowed to cite. Two-stage on purpose:

- **Stage A** — a natural-language "please search and report" prompt through `generateWithWebSearch` (Kimi `$web_search`). A strict-JSON instruction here makes the model skip tool calls and answer from memory, so stage A stays conversational.
- **Hard precondition**: if `res.searches === 0` (no search actually ran), the whole sheet is discarded and `EMPTY_FACT_SHEET` returned — unsearched "facts" are parametric-memory fabrications with guessed URLs, the exact failure mode this module exists to prevent.
- **Stage B** — a second, tool-free call converts the report to strict JSON: `{"facts":[{statement, year, source_name, source_url}]}`, dropping any fact without an `http(s)` URL. Capped at `MAX_FACTS = 12`, ids assigned `F1…Fn`.

`verifyFactUrls(sheet)` then drops facts whose source URL is dead — SSRF-guarded, HEAD then GET, treating only 404/410 as dead (403/405 pass because bot-blocking hosts are still real). Surviving facts are re-numbered contiguous.

When Kimi is unconfigured or cooled down, `generateWithWebSearch` returns `null` and the pipeline proceeds with `EMPTY_FACT_SHEET` — the prompts then **force qualitative writing with zero statistics** (`factsBlock` in `generator.ts:231`). The fact sheet is the ONLY source of citable numbers/URLs; everything else must be qualitative or explicitly hypothetical.

### 4. Per-locale content production

`producePostContent(opts)` (`pipeline.ts:126`) drafts and refines one locale's body. Returns `null` when nothing acceptable could be produced (the caller skips that locale rather than persist filler). Ordered stages:

1. **Localize keywords first (ru/uz only).** `localizePostMeta` runs *before* drafting so the body is written against native search phrases — not the English keyword list (which used to splice raw `"website speed optimization"` into Russian prose). The same `localizedMeta` is threaded to `persistLocalePost` to avoid a second, drifting localization call.
2. **Build the prompt.** `buildSourcePrompt` or `buildTopicPrompt` assembles a system persona (`buildSystemPrompt`) + a user prompt from the format blueprint, the facts block, the answer-first skeleton, internal-links block, image instructions, self-review checklist, and (for ru/uz) the EN anchor block.
3. **Draft.** `generateContentWithProvider` with `temperature: 1.3` (DeepSeek only) and, for Uzbek, `prefer: 'deepseek'` (Kimi's Uzbek is measurably weaker). Reject and return `null` if the draft is missing or under `WORD_FLOOR = 500` words.
4. **Truncation guard.** If `finishReason === 'length'` or `looksTruncated(content)` (last plain-text line lacks terminal punctuation), fire ONE continuation call (`buildContinuationPrompt`) that rewrites the cut-off fragment and finishes the post. Still truncated after that → skip the locale.
5. **Deterministic lint + one surgical revision.** `lintContent` (see [Quality gates](#quality-gates)); if issues, one revision call fixes ONLY the flagged problems. The revision is accepted only if it is itself ≥ `WORD_FLOOR`, not `length`-truncated, and not `looksTruncated`.
6. **Cross-model critique** (deep mode, OR Uzbek in fast mode — and only when both providers are configured). The critic is the *other* provider than the one that drafted (`drafted.provider === 'kimi' ? 'deepseek' : 'kimi'`) — same-model self-review reward-hacks its own weaknesses. Returns a JSON issue list applied surgically.
7. **Native-editor proofread** (deep mode only). Fixes spelling/idiom errors deterministic lints can't catch (`сентяблю`, `mijordan`), preserving structure/URLs/numbers.
8. **Deterministic normalization** — always, in order: `renderChartBlocks` → `normalizeInternalLinks` → (uz only) `normalizeUzbekApostrophes`.
9. **Final gate.** Re-lint. `link` issues at this point were introduced (or kept) by the critique/proofread re-emits — a refusal-only gate silently dropped the live RU post on 2026-07-03 over 2 links, so they are now **remediated in stages**: (a) deep mode only, one surgical link-removal revision, then re-normalize + re-lint; (b) `stripUnapprovedUrls` deterministically removes any survivors (`[text](url)` keeps its text; images, autolinks, and bare URLs are dropped); (c) refusal remains as the (unreachable) backstop. Invented sources still never ship — but the prose survives them. All other residual issues are soft warnings surfaced as `residualIssues`.

```ts
// pipeline.ts — fabricated sources are never published, but no longer cost the locale
issues = lintContent(content, { locale, allowedUrls });
let linkIssues = issues.filter(i => i.type === 'link');
if (linkIssues.length > 0 && mode === 'deep') { /* one surgical link-removal revision → re-lint */ }
if (linkIssues.length > 0) { content = stripUnapprovedUrls(content, allowedUrls); /* → re-lint */ }
if (linkIssues.length > 0) return null; // backstop — unreachable after the strip
return { content, provider: drafted.provider, residualIssues: issues, localizedMeta };
```

### 5. Persistence

`persistLocalePost(opts)` (`pipeline.ts:361`):

1. For ru/uz, use the pre-localized `localizedMeta` (or localize now as a fallback) for title/meta/keywords.
2. For uz, apply `normalizeUzbekApostrophes` to title/meta/keywords so they match the body's glyphs (exact-match search fragments otherwise mismatch).
3. `resolveUniqueSlug(createSlug(title), locale)` — appends `-1`, `-2`, … until `slugTaken(slug, locale)` is false. Slug uniqueness is per-`(locale, slug)` (unique index `blog_posts_locale_slug_uq`).
4. `createPost(...)` — the only write path, into `blog_posts`. `status` defaults to `draft` (admin route) or is set to `published` (scheduled CLI).

## Cross-locale linking (`generationGroupId`)

All three locale posts of one run share a `generationGroupId`, indexed by `blog_posts_group_idx` and used for hreflang siblings, related-post lookups, and continuation/resume.

- **Route:** `uuidv4()` per call — or, in continuation mode, the `generationGroupId` supplied in the request body (topic/images/meta are then rebuilt from the existing group via `getByGroupId`).
- **CLI scheduled runs:** a *deterministic* slot id `sched-<YYYY-MM-DD>-<am|pm>` (`scheduleSlotId`). A duplicate cron fire or a re-run after partial failure resumes the same group and generates only the locales still missing (`listGroupLocales` diff). `--force` opts out and mints a fresh `uuidv4`.
- **CLI `--group <id>`:** resumes ANY existing group the same way, inheriting the group's publish/draft status (errors if the id matches no posts, if combined with `--force`, or when asked to fill EN into a group whose EN post is gone — the stored topic would be localized). This is the healing path for partial groups whose slot has passed — the slot id is wall-clock-derived, so a re-run outside the same UTC half-day starts a new topic instead. Exposed as the `group` input on the `generate-post.yml` dispatch; the admin panel's per-group **Generate <missing locales>** button does the same through the route's continuation mode (which likewise rejects already-present locales and EN-from-localized-topic rebuilds).

The EN post is generated first; its outline and money figures become the **anchor** for ru/uz (`buildEnAnchorBlock`, `generator.ts:476`):

```ts
// The EN headings + every "$…" line are handed to ru/uz so the three locales
// adapt ONE article instead of diverging into three (live posts once quoted the
// same service at 3–8× different prices across languages).
const headings = (enContent.match(/^#{2,3}\s+.+$/gm) ?? []).slice(0, 24);
const figureLines = enContent.split('\n').filter(l => /\$\s?\d/.test(l) && !l.trim().startsWith('!')).slice(0, 8);
```

`getByGroupId` prefers the EN row so a resume rebuilds the shared topic from English, never from a localized sibling.

## The DeepSeek / Kimi client (`src/core/ai.ts`)

Despite the "DeepSeek default" shorthand, the **primary** provider is Kimi K2.6 and DeepSeek is the fallback. Both speak the OpenAI Chat Completions protocol through the `openai` package.

| Provider | `name` | Default model | Base URL | API key env | Temperature |
|---|---|---|---|---|---|
| Kimi (primary, web-search backend) | `kimi` | `kimi-k2.6` (`AI_MODEL`) | `https://api.moonshot.ai/v1` (`AI_BASE_URL`) | `MOONSHOT_API_KEY` \| `KIMI_API_KEY` | fixed `0.6` (API rejects other values) |
| DeepSeek (fallback) | `deepseek` | `deepseek-v4-pro` (`AI_FALLBACK_MODEL`) | `https://api.deepseek.com` (`AI_FALLBACK_BASE_URL`) | `DEEPSEEK_API_KEY` | requested value (blog draft uses `1.3`) |

Key behaviors:

- **Provider chain** (`providerChain`): `[Kimi, DeepSeek]` filtered to those with a key. `prefer` moves a named provider to the front — the blog pipeline passes `prefer: 'deepseek'` for Uzbek. If only one key is set, that provider runs alone; critique is skipped when fewer than 2 providers are configured (`configuredProviders().length > 1`).
- **Kimi thinking must be disabled.** `kimi-k2.6` defaults to thinking mode, which rejects any temperature except 1 — every plain call sends `thinking: { type: 'disabled' }` or it 400s. Same for `$web_search`.
- **Completion budget.** Blog bodies (label starts with `blog-`) get `BLOG_MAX_TOKENS` (default `32_000`, env-overridable) and a 300 s timeout; other calls use the 120 s default.
- **`finishReason` is propagated.** `'length'` means the completion cap truncated the output; the pipeline uses it to trigger continuation instead of shipping a cut-off post.
- **Quota handling.** A 429 sets a per-provider cooldown (parsed from the retry hint) so a rate-limited Kimi doesn't block DeepSeek.
- **Web search** (`generateWithWebSearch`): Kimi-only. Declares `{type:'builtin_function', function:{name:'$web_search'}}`; when the model emits a tool call, the search ran server-side and the protocol is to echo the call's `arguments` back verbatim as the tool result. Loops up to `MAX_SEARCH_ROUNDS = 6`, with up to 2 "nudges" if the model answers without searching. Each search costs ~$0.005.

Entry points used by the pipeline: `generateContentWithProvider` (bodies, returns `{text, provider, finishReason}`), `safeGenerateContent` (text-only), `safeGenerateJSON` (json_object), `generateWithWebSearch` (grounded research).

## Prompt + blueprint inputs

The writing prompt (`buildTopicPrompt` / `buildSourcePrompt`) is composed from:

- **System persona** (`buildSystemPrompt`) — "senior engineer-founder of Softwhere.uz", first-person plural, plus non-negotiable rules: statistics ONLY from verified facts, no invented numbers/URLs/clients, a banned AI-slop word list, plain-language business audience (say "AI"/"ИИ"/"sun'iy intellekt", never "LLM/RAG/embeddings"), sentence-case headings, and per-locale style blocks (ru anti-cancelярит list; uz Latin-script + `Siz` register + real payment providers Payme/Click/Uzum/Paynet).
- **Format blueprint** (`getBlueprintForFormat`) — one of 14 `POST_BLUEPRINTS` keyed by `PostFormat`. Each supplies `wordRange`, `tone`, `openingInstruction`, `structurePrompt`, `formattingRules`, `seoHint`. Example: `cost-guide` = 2000–2500 words, "The short answer is $X–$Y…" opening, pricing-tier tables.
- **Facts block** (`factsBlock`) — either the numbered verified facts ("the ONLY statistics you may cite") with a required `## Sources` section, or the zero-statistics qualitative instruction when the sheet is empty. Structural labels (Sources/FAQ/Key takeaways) are localized so English labels don't leak into ru/uz posts.
- **Chart instruction** (`chartBlockInstruction`) — exactly one ```chart``` fenced block of plain Chart.js v2 JSON with a `caption` key; the model never URL-encodes anything itself (the encode-it-yourself instruction produced zero charts live).
- **Answer-first skeleton, internal-links block, image instruction, self-review** — direct-answer first paragraph, a "Key takeaways" blockquote, real locale-prefixed internal links (`/{locale}/estimator`, `/{locale}#services`, …), inline-image placement with locale-language captions, and a silent pre-output checklist.
- **EN anchor block** (ru/uz only) — see above.

SEO topic catalog: `SERVICE_PILLARS` in `seo-topics.ts` — 14 pillars, each topic carrying `title`, `primaryKeyword`, `secondaryKeywords`, `searchIntent`, `postFormat`, `targetQueries`, and `imageHints`. `getAllTopics()` flattens them with `servicePillar`/`pillarName` attached.

## Quality gates

### Deterministic lint (`quality.ts`)

`lintContent(content, {locale, allowedUrls})` returns `LintIssue[]` typed `slop | structure | link | language`:

- **Slop** — high-precision banned regexes per locale (`EN_BANNED` / `RU_BANNED` / `UZ_BANNED`; uz gets EN patterns too since English slop survives in mixed drafts), plus EN-only checks for `not just X but Y` overuse, `Additionally/Moreover/Furthermore` openers, em-dash density, and Title-Case headings.
- **Language sanity** — Cyrillic/Latin ratio: ru must be ≥50% Cyrillic, uz must be <15% Cyrillic (Latin script), en <5%.
- **Structure** — must start with a single `# ` H1.
- **Link audit** — every external `http(s)` URL (outside code) must be in `allowedUrls` (fact sources + image URLs + `quickchart.io`) or an own-site hostname; anything else is flagged as `link` (likely fabricated). Hostname-based, so `evil.com/?x=softwhere.uz` doesn't pass. The audit is shared with the final gate via `findUnapprovedUrls`, and `stripUnapprovedUrls` is its deterministic remediation twin.

`buildRevisionInstruction(issues)` turns issues into a surgical fix-only-these prompt.

### LLM critique (deep + uz)

`buildCritiquePrompt` runs a fixed rubric (fabrication, slop, opening, vague, language; plus an Uzbek-integrity clause) on the *other* provider, returning `{issues:[{type, excerpt, fix}]}` parsed by `parseCritique` (max 8), applied via `buildCritiqueRevisionPrompt`.

### Normalization (`normalize.ts`)

Always applied before the final gate:

| Function | Fix |
|---|---|
| `renderChartBlocks` | ```chart``` fence (Chart.js JSON) → QuickChart image markdown; malformed blocks dropped, not shipped. Only `bar/horizontalBar/line/pie/doughnut/radar` types accepted. |
| `normalizeInternalLinks` | `](uz/estimator)` → `](/uz/estimator)` — locale-relative links without a leading slash 404 from a post URL. |
| `normalizeUzbekApostrophes` | Unifies the U+0027/U+2018/U+2019 glyph lottery to the correct `ʻ` (oʻ/gʻ) and `ʼ` (tutuq belgisi); skips code/link-targets/URLs. |

`clampMeta` (`meta.ts`) trims meta descriptions to ≤160 chars on a sentence/word boundary.

## Entry point A — admin API route

`POST /api/blog/generate` (`src/app/api/blog/generate/route.ts`), `maxDuration = 300`.

- **Auth:** `requireAdmin(request)` (Neon Auth session cookie or Bearer `API_SECRET`).
- **Body:** `{ category?, customTopic?, sourceUrl?, sourceText?, locales?, generationGroupId? }`. Validated: `customTopic` ≤ 200 chars, `sourceText` ≤ 5000 chars, `sourceUrl` a valid URL, `locales` a 1–3 array from `en/ru/uz`.
- **Mode:** `fast` — draft → lint → one revision (+ critique for uz). Research round timeout is capped at 100 s so it can't eat the 300 s function budget.
- **Status:** always `draft` (`persistLocalePost` default) — human review in admin.
- **Continuation mode:** if `generationGroupId` is provided, topic/images/meta are reused from the existing group instead of re-selected.
- **Post-run:** `revalidateTag('blog-posts')` + `revalidatePath('/[locale]/blog/[slug]')`. **No IndexNow ping** (drafts aren't public).
- **Response:** `{ success, posts:[{id,title,slug,locale,status,…}], generationGroupId, topic, format, pillar }`.

## Entry point B — CLI (scheduled)

`scripts/generate-post.ts`, invoked as `npx tsx scripts/generate-post.ts [options]`.

- **Mode:** `deep` — draft → lint/revise → cross-model critique → revise → proofread. Wall-clock is free in CI.
- **Flags:** `--category`, `--customTopic`, `--sourceUrl`, `--sourceText`, `--locales` (default `en,ru,uz`), `--force`, `--publish`.
- **Publish decision:** `--publish true` forces publish; otherwise scheduled runs (`GITHUB_EVENT_NAME=schedule`) publish and bare local runs stay drafts. Published posts are inserted with `status: 'published'`.
- **Idempotency/resume:** deterministic `sched-<date>-<am|pm>` group for scheduled runs; resumes missing locales, no-ops when all requested locales already exist, reuses the EN body as the anchor if it's already in the DB.
- **Publish side effects** (only when publishing and ≥1 post created):
  - `pingIndexNow(urls)` — the ONLY place IndexNow fires.
  - `requestRevalidate()` — `POST /api/admin/revalidate` with `Bearer API_SECRET` (best-effort; without it posts surface within ~1 h).
  - Telegram notification + `$GITHUB_STEP_SUMMARY` table.
- **Exit code:** non-zero if any locale failed (so CI opens an issue) — safe because a re-run resumes the slot.

### IndexNow

`pingIndexNow(urls)` (`indexnow.ts`) POSTs `{host, key, keyLocation, urlList}` to `https://api.indexnow.org/indexnow`. The key `46b87b7e04b9d4a6adb8fc722995bde5` is public by design (verified via `/public/<key>.txt`). Targets Yandex/Bing (~20% of Uzbekistan search); Google ignores IndexNow. Fired only from the CLI on publish.

## GitHub Actions cron

`.github/workflows/generate-post.yml`:

- **Schedule:** `17 6 * * *` and `17 18 * * *` (twice daily, 06:17 / 18:17 UTC = 11:17 / 23:17 Tashkent). Off-the-hour to dodge GitHub's :00 scheduling delays.

  > Note: a code comment in `pipeline.ts` calls this "the weekly GitHub Action" — that comment is stale; the workflow is twice-daily.
- **Run:** checkout `main` → Node 22 → `yarn install --frozen-lockfile` → `npx tsx scripts/generate-post.ts --locales "en,ru,uz"` with dispatch inputs threaded through.
- **Secrets/env:** `DATABASE_URL`, `MOONSHOT_API_KEY`, `DEEPSEEK_API_KEY`, `UNSPLASH_ACCESS_KEY`, optional `TG_BOT_TOKEN`/`TG_CHAT_ID`, optional `API_SECRET`.
- **Concurrency:** `group: generate-post` — a manual dispatch can't overlap a scheduled run.
- **Resilience:** opens a GitHub issue on failure; a keepalive step re-enables the workflow to reset the 60-day auto-disable timer.
- **`workflow_dispatch`:** category choice, customTopic, sourceUrl, sourceText, force, publish (default `true`).

## Duplicate detection

Two distinct mechanisms — do not conflate them:

1. **At generation time (in the pipeline):** `smartSelectTopic` excludes recently-used `primaryKeyword`s and penalizes repeated formats; `resolveUniqueSlug`/`slugTaken` prevent slug collisions; `getImagesForPost(excludeUrl)` prevents the cover repeating inline.
2. **Offline audit (separate):** `scripts/audit-posts.ts` (workflow `audit-posts.yml`, monthly + manual) is **read-only**. It uses `scripts/lib/similarity.ts` (Jaccard title similarity ≥0.82, content word-overlap ≥0.88, exact duplicate-cover URLs across groups) and `scripts/lib/post-structure.ts` (`getPostIssues` / `analyzeGroup` — missing images/meta/category, thin content) to flag groups. It never edits posts; fixes are a human decision in admin or a targeted re-generation. There is no automated fix/regeneration path from the audit (the old fix mode was deleted because it embedded pre-overhaul prompts).

## Known gotchas

- **"DeepSeek default" is shorthand.** Kimi K2.6 is the primary provider *and* the only web-search backend. Without `MOONSHOT_API_KEY`, posts fall back to DeepSeek and are ungrounded (no fact sheet). DeepSeek V4 Pro is the default *DeepSeek* model (owner decision, 2026-07).
- **Kimi rejects tuned temperature.** `temperature: 1.3` in the pipeline applies to DeepSeek only; Kimi is pinned to 0.6. Kimi also 400s unless `thinking` is explicitly disabled.
- **Empty fact sheet is expected, not an error.** No search / no configured Kimi ⇒ zero-statistics qualitative post. Never "fill in" numbers to compensate.
- **Fabricated links are the one hard failure.** A `link` lint issue surviving revision returns `null` and skips the locale — everything else is a soft `residualIssues` warning.
- **Locale skips are per-locale.** One locale failing (truncation, floor, fabricated links) doesn't abort the group; the others still persist. The CLI reports failed locales and exits non-zero.
- **Uzbek routes to DeepSeek and always gets critique** (even in fast mode) — its weakest-provider path is where fake entities and garbled tokens historically slipped through.
- **`ru`/`uz` keywords are localized before drafting.** If you add a code path that drafts a non-EN locale, localize meta first or the body targets English queries.
- **Stale comment:** the twice-daily cron is described as "weekly" in a `pipeline.ts` comment — trust the workflow file.

## Related docs

- [./scripts.md](./scripts.md) — the `generate-post.ts` / `audit-posts.ts` / `regenerate-post.ts` CLIs and their flags
- [./ci-workflows.md](./ci-workflows.md) — `generate-post.yml`, `audit-posts.yml`, `regenerate-post.yml` schedules and secrets
- [./database.md](./database.md) — the `blog_posts` table, Neon + Drizzle, the repository layer
- [./seo.md](./seo.md) — IndexNow, sitemaps, hreflang siblings, meta/keyword strategy
- [./api-reference.md](./api-reference.md) — `POST /api/blog/generate` and related blog endpoints
- [./architecture.md](./architecture.md) — layered `core → shared → modules → app` boundaries
- [../README.md](../README.md) — project overview

_Last verified against code: 2026-07-03._
