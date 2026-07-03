# Blog content & pipeline review — 2026-07-03

Full review of all 15 published posts (5 topics × en/ru/uz) on softwhere.uz plus the rendering/generation code. 27-agent adversarially-verified pass: 19 findings confirmed and fixed in code, 1 refuted, 7 remaining as content (DB) edits.

## Fixed in code — rendering (`[slug]/page.tsx` & friends) — repairs all 15 live posts

| Finding | Fix |
|---|---|
| Every post rendered **two stacked `<h1>`s** (page title + content's leading `# ...`, often with different wording) | Strip the first markdown H1 before `ReactMarkdown`; the page `<h1>` is the only H1 |
| External citation links were **dofollow** — RU/UZ posts pass 11 links each to one competitor agency (innovariatech.com ×22 sitewide) | `rel='nofollow noopener noreferrer'` on all external links |
| UZ posts contain **broken internal links** `](uz/estimator)` (resolve under the post path → 404) | Render-side href normalization to `/uz/estimator` (+ pipeline-side normalizer for future posts) |
| Inline images: raw `<img>` hotlinking full-size Unsplash JPEGs | `next/image` (AVIF/WebP + responsive `sizes`) for Unsplash hosts, `<img>` fallback for others |
| RU/UZ dates rendered English-order (`июль 03, 2026`) | `d MMMM yyyy` for ru/uz (→ `3 июля 2026`) on post + list pages |
| Estimator unreachable from posts (UZ funnel dead) | Third CTA button "Estimate Project Cost" → `/{locale}/estimator` on every post (tracked as `cta_click:estimate`) |

## Fixed in code — generation pipeline (future posts)

- **Truncation guard**: `finish_reason` now plumbed out of `src/core/ai.ts`; a draft that hits the completion cap (DeepSeek 8K — two live UZ posts end mid-word) gets one continuation call, else the locale is skipped. Lint/critique/proofread revisions are also rejected if truncated.
- **Keyword localization hoisted before drafting**: RU/UZ bodies were generated against the *English* keyword list (RU prose contained "website speed optimization" ×4). `localizePostMeta` now runs first; body, meta and stored keywords use the same native phrases.
- **EN-draft-as-anchor**: ru/uz prompts receive the EN outline + all money figures — stops locales diverging into different articles with 3–8× conflicting price anchors.
- **Localized structural labels**: «Источники»/«Manbalar», «Частые вопросы»/«Ko'p beriladigan savollar», «Ключевые выводы»/«Asosiy xulosalar» — English "Sources/FAQ/Key takeaways" no longer leak into RU/UZ.
- **Locale-correct AI term**: ИИ (ru) / sun'iy intellekt (uz) — the RU ai-trends post had 41× Latin "AI", 0× ИИ in the body.
- **In-language anti-fabrication rules** (ru/uz style blocks): no invented stats/percentages/project counts; hypothetical examples must be marked as such.
- **UZ integrity**: apostrophe normalizer (oʻ/gʻ → U+02BB, tutuq → U+02BC, skips URLs/code) on body + meta; UZ slop-lint for scaffolding phrases ("faraziy ravishda", "keltiraman"); cross-model critique now runs for UZ even in fast mode with a rubric item for garbled tokens/fake entities (real payment providers: Payme, Click, Uzum, Paynet).
- **Native-editor proofread pass** (deep mode): catches "сентяблю", "топите воду", "mijordan", "a isolated feature"-class errors no regex can.
- **Titles/meta**: localized titles instructed ≤60 chars (5 live RU/UZ titles are 64–78 and truncate in SERPs); metaDescription clamped on word/sentence boundary (shared `clampMeta`) instead of `.slice(0,160)` mid-word cuts; 140–160 range instructed.
- **Localized image captions**: model writes its own 2–6-word caption in the post language (was: English keyword + "illustration N" as a visible figcaption on RU/UZ pages).
- **Cover dedup**: the hero photo is excluded from the inline-illustration pool (it repeated as "illustration 1" directly below itself in every topic).
- **Absolute price-floor claims banned** ("below $X it's a thin wrapper") — impossible to keep true across markets.

## Refuted (no action)

- "No inter-post linking / no PageRank flow" — related-posts grid already links same-category posts in every locale.

## Remaining: content edits in the production DB (need owner sign-off)

1. **UZ speed + UZ mvp posts are truncated mid-word** — finish the last FAQ answer + closing CTA (or regenerate via the improved pipeline).
2. **UZ native takeaway states the factual opposite of its own body** ("cross-platform = high performance + full device access").
3. **RU speed post**: «отказоустойчивость» misused for bounce rate (×2 → «показатель отказов»); cost table has 4 headers but 3-cell rows (every value in the wrong column).
4. **UZ fake entities**: "Paste.uz" (not a real payment gateway → Payme/Click), "magaz pro" (not a product), "buchalarni" (non-word), 2 scaffolding sentences.
5. **UZ ai-trends** sells AI as headcount reduction — the opposite of EN/RU positioning; UZ 7-signs has no Payme/Click/Uzum mentions (EN/RU do).
6. **RU/UZ 7-signs**: invented stats presented as fact ("60% повторных заказов", "в 3-4 раза") + «50+ проектов» vs the real ~24-project portfolio.
7. **Native-vs-cross (all locales)**: $935B stat is the 2023 projection re-dated to 2026; "Flutter 46%" drops the "of cross-platform developers" qualifier in EN.
8. **Apostrophe backfill**: run the new normalizer once over the 5 stored UZ posts (title/meta/content/keywords).
9. **5 overlong RU/UZ titles** (64–78 chars) → trim below 60.

Options: targeted SQL edits (surgical, keeps slugs/URLs), or regenerate affected posts through the now-improved pipeline (new slugs unless overwritten carefully).

## Addendum (same day): budgets, DeepSeek V4 Pro, charts

- **Root cause correction**: the "DeepSeek 8K cap" was our own `BLOG_MAX_TOKENS = 8000`. Verified July 2026: DeepSeek V4 (flash & pro) allows up to 384K output tokens, Kimi K2.6 up to ~256K−prompt. Budget raised to **32,000** (env-overridable via `BLOG_MAX_TOKENS`) — max_tokens is a ceiling, not a spend, so this costs nothing unless used. The truncation guard stays as belt-and-braces.
- **DeepSeek V4 Pro for blog bodies**: new quality tier in `src/core/ai.ts` — calls with a `blog-` label use `deepseek-v4-pro` (env: `AI_FALLBACK_PRO_MODEL`) on the DeepSeek path (drafts, revisions, continuations, proofreads — i.e. all UZ long-form). Flash remains the default for latency-sensitive JSON (estimator's 60s budget) and utility calls. Pro output ≈ $0.87/M tokens post-May-2026 price cut → fractions of a cent per post.
- **Charts now actually appear**: the old prompt asked the model to URL-encode a Chart.js config into a link — zero live posts contain a chart. New contract: exactly one chart per post is REQUIRED (bar/line/doughnut, labels+caption in the post's language), emitted as a fenced ```chart block of plain Chart.js v2 JSON; `renderChartBlocks()` in `utils/normalize.ts` deterministically converts it to a QuickChart image URL (parens/quotes escaped, malformed blocks dropped, verified 200 image/png). Fact-less posts chart the worked example's hypothetical figures with an "illustrative example" caption.
