# Idea: A blog people learn from

> **Status:** idea, not built. Researched 2026-09-24. Leaderboard positions and non-Anthropic prices come from third-party trackers; check them again before deciding.

## The problem today

- Posts are generated end to end by Kimi K2.6 and DeepSeek (`docs/blog-pipeline.md`), a group of three locales at a time, on a weekly GitHub Actions cron.
- The July review (`docs/blog-review-2026-07.md`) found truncated posts, invented statistics ("50+ projects" against a real portfolio of about 24), fake entities ("Paste.uz"), a Uzbek takeaway that says the opposite of its own body, and a stat re-dated from 2023 to 2026.
- Every post has the same byline, "SoftWhere.uz Team" (`BLOG_AUTHOR_NAME`), so no real person stands behind the content.
- Charts are QuickChart images drawn from whatever numbers the model produced, including "illustrative" numbers when there was no data.
- Search results reflect it: 10 clicks in the 28 days to 2026-09-02 (`docs/seo-measurement-2026-09.md`).

The model is not the main problem. What makes a post worth reading is **experience and real data that only SoftWhere has**. No model can invent that, and Google's policies treat mass-produced text without it as spam, whoever or whatever wrote it.

## The model: Claude Opus 5.5, with a blind test for Uzbek

**Recommendation: Claude Opus 5.5 (`claude-opus-5-5`) for research, drafting and editing.**

- The Claude family leads the long-form writing benchmarks the research found. On EQ-Bench's creative long-form board, Claude Opus 5 is first and Moonshot's newest Kimi is second [exact scores unverified; the site was blocked in the sandbox]. A Claude Fable model tops LMArena's text board.
- Opus 5.5 is the newest Opus and cheaper than Opus 5: $4 per million input tokens and $20 per million output tokens, with cache reads at $0.20.
- Claude's API has a web search tool that returns sources to cite, which the research step needs.
- OpenAI has said publicly that GPT-5.2's prose got worse (January 2026), so GPT is not the writing pick right now.

**For the one flagship piece a quarter** (for example a data report), Claude Fable 5.1 (`claude-fable-5-1`, $10 / $50) is Anthropic's most capable model and worth trying. The cost difference per article is a few dollars.

**For Uzbek, test before choosing.** No public benchmark measures any frontier model's Uzbek writing. The repo already routes Uzbek to DeepSeek because it scored better than Kimi on UzLiB (0.709 vs 0.518), but that is a knowledge test, not a writing test. Run a blind test once:

1. Take one outline and one set of facts.
2. Have Claude Opus 5.5, DeepSeek V4 Pro and Kimi each write the Uzbek version, and add Gemini 3 Pro if you like.
3. Give the texts, unlabelled, to two native speakers. They rate accuracy, naturalness, correct terms (Payme, not "Paste.uz") and errors in the Latin script (o', g', ʻ).
4. Use the winner for Uzbek, and do the same for Russian.

**Cost is not the deciding factor.** A rough per-article estimate covers an English original plus native Russian and Uzbek versions, with research, outline, draft, critique and revision: about 510k input and 83k output tokens, plus about 15 web searches.

| Model | Approx. cost per article (3 languages) | With two rounds of rework |
| --- | --- | --- |
| Claude Sonnet 5 ($2 / $10) | ~$2 | ~$4–6 |
| Claude Opus 5.5 ($4 / $20) | ~$4 | ~$6–10 |
| Claude Fable 5.1 ($10 / $50) | ~$9–10 | ~$15–25 |
| DeepSeek V4 Pro (~$1.74 / $3.48, unverified) | ~$1–2 | ~$2–4 |

At two articles a month, even Fable costs less than $50 a month. The real cost is the founders' time: 15 minutes of interview and an hour of editing per article. That time is what makes the post valuable.

**In code:** add Claude as a provider in `src/core/ai.ts` using the official `@anthropic-ai/sdk` (golden rule 2: all AI goes through that file). Keep the Kimi/DeepSeek chain for the estimator and other fast calls. The draft and critique steps aren't interactive, so they can use the Message Batches API at half price, though at this volume that's optional.

## The new pipeline: people first, AI second

```
Topic (from sales calls, search data, the calendar)
  → Founder input: a 10–15 min voice note or a short interview, sent to the Telegram bot
  → Transcript (speech-to-text) + the facts only we have (project numbers, estimator data)
  → Research with web search: every outside claim gets a source link
  → Outline, approved by a founder in the admin (5 minutes)
  → Draft in English
  → Critique pass: a second run with a strict reviewer checklist
       (unsupported numbers, generic filler, claims we can't back, AI tells, missing examples)
  → Revision
  → Native Russian / Uzbek versions from the same outline and facts, not a translation
       of the English text, each read by a native speaker on the team
  → Human edit and publish (never automatic)
  → Distribution: founder's LinkedIn post (softwhere-social skill), newsletter,
       a short reel for flagship posts (social-video skill)
```

Rules the pipeline enforces:

- **Every number has a source**, or it is SoftWhere's own number and is labelled that way ("from 38 estimates made on our site in Q4"). No source, no number.
- **No invented examples.** Hypothetical examples say so in the text.
- **Charts only for real data.** No more "illustrative" charts.
- **Nothing is published without a human.** Generation always ends as a draft with a Telegram "draft ready" message; unreviewed auto-publishing was already turned off during the index-recovery work.
- **Every post shows its author and its reviewer.**

The voice note can be transcribed by a speech-to-text API or by a self-hosted Whisper model on the Hetzner server (fast enough on a CPU for a 15-minute file). Test Uzbek speech before relying on it; Russian and English are well supported.

## Stop forcing every topic into three languages

Today each topic is generated in `en`, `ru` and `uz` together. The audiences are different:

- **English** readers are US and EU founders and product leads buying mobile and AI work.
- **Russian and Uzbek** readers are mostly local businesses buying websites, Telegram bots and e-commerce, paying in so'm.

A post about "What an AI feature pilot costs in the US" does nothing for a shop owner in Samarkand, and "How to accept Payme in your Telegram bot" does nothing for a founder in Berlin. Plan topics per market. Only when a topic truly fits both markets, write the other versions and link them with `generationGroupId`, so hreflang only joins real equivalents.

## Post types with a fixed structure

Each post type gets a template the pipeline and the page both understand:

| Type | What it is | Must contain |
| --- | --- | --- |
| **Cost breakdown** | "What a [type of app] really costs in 2026" | Our estimator's ranges, what drives cost, the Blueprint as the way to a fixed price |
| **Build notes** | A real problem from a project and how we solved it | The founder's story, code or screenshots, trade-offs, what we'd do differently |
| **Decision guide** | "Flutter vs React Native for a fintech MVP" | Our own tests or experience, a clear recommendation, when the other choice wins |
| **Checklist** | Something a founder can use today | A downloadable version (email opt-in), each item explained |
| **Data report** (quarterly) | "What people asked us to build in Q4" | Aggregated, anonymous estimator data with the sample size shown |
| **Halal product notes** | Building Islamic fintech features correctly | References to the standards (AAOIFI), reviewed by the founders' scholar before publishing |

Every post also has: a short "answer first" summary at the top, who the post is for, a sources list at the end, an author box, and one next step that matches the topic (the estimator, the Blueprint, a call).

**Rendering:** keep Markdown as the storage format, but render custom blocks as React components:

- `chart`: drawn on the page from JSON, with a data table underneath for screen readers. Keep QuickChart only for RSS and social images.
- `callout`
- `sources`
- `checklist`
- `author-note`

**Database additions:**

- An `authors` table: name, role, photo, short bio, LinkedIn and GitHub links. It is used for bylines, author pages and the `Person` JSON-LD with `sameAs`.
- `reviewedBy` and `sources` (jsonb) on posts.
- A `contentUpdatedAt` column. Today `updatedAt` drives both `dateModified` in JSON-LD (`src/modules/blog/lib/seo.tsx`) and the sitemap `lastmod`, so fixing a typo looks like a fresh update. Only a real rewrite should move the date.

**Structured data** still worth having: `Article`, `Person` (the author, with `sameAs`), `Organization` and `BreadcrumbList`. FAQ and HowTo rich results no longer show for ordinary sites, so don't shape posts around them. The markup does no harm.

## Rewriting the posts that already exist, keeping their slugs

The site has 15 live posts with known problems. The mechanics below extend the rules already written in `docs/seo-measurement-2026-09.md` (prune whole `generationGroupId` clusters, repoint `legacy-aliases.ts`, draft instead of delete, never `410`).

1. **Wait for the measurement.** The index-recovery work has a gate on **2026-10-03**. Record that first, so rewrite effects aren't confused with the recovery work. Also don't rewrite in the same weeks as a domain move (English to softwhere.app); do one change at a time so you can tell what caused what.
2. **Inventory.** For each post: Search Console and Yandex impressions and clicks, the queries it ranks for, and the known errors from the July review.
3. **Decide per cluster:**
   - **Rewrite:** keep the slug and the main topic, improve everything else.
   - **Merge:** redirect into the stronger post in the same language, via `next.config.mjs` and `legacy-aliases.ts`, whole cluster at once.
   - **Retire:** set to draft, not delete, so the stop rule can revert it.
4. **Pilot the 3–5 posts with the most impressions.**
   - Keep `createdAt` as the publish date.
   - Set the new `contentUpdatedAt`.
   - Show "Updated on <date>" on the page with one line on what changed.
   - Check the hreflang siblings still match.
5. **Watch 4–8 weeks.** If impressions hold or grow, do the rest in small batches. If they drop, stop and look before continuing.
6. **When English moves to softwhere.app:** keep every slug identical and redirect each old URL one-to-one with a 301. Don't bulk-redirect to the homepage.

## How often

- **English (global):** two strong posts a month to start. One genuinely useful post beats four average ones.
- **Russian and Uzbek (local):** one or two a month on local topics.
- **Data report:** quarterly, once the estimator has enough anonymous data to be honest about. Show the sample size; don't publish percentages from 12 estimates.

## Order of work

| Step | What | Effort |
| --- | --- | --- |
| 1 | Claude provider in `src/core/ai.ts`; Uzbek and Russian blind test | Small |
| 2 | `authors` table, real bylines, author pages, `Person` schema; `contentUpdatedAt` | Small–medium |
| 3 | New pipeline: voice-note intake, research with sources, outline approval, critique, native versions, no auto-publish | Medium (1–2 weeks) |
| 4 | Post templates and React blocks (chart, callout, sources, checklist) | Medium |
| 5 | Rewrite pilot on 3–5 posts after the 2026-10-03 gate | Small, then wait 4–8 weeks |
| 6 | Rest of the archive; first quarterly data report | Ongoing |

## Sources

- Anthropic model prices: <https://platform.claude.com/docs/en/about-claude/pricing>
- EQ-Bench long-form writing board: <https://eqbench.com/creative_writing_longform.html> (not fetched directly)
- LMArena (Arena) creative-writing board: <https://arena.ai/leaderboard/text/creative-writing>
- GPT-5.2 prose admission: reported by Search Engine Journal, 2026-01-27 (article not linked; search "Altman GPT-5.2 writing")
- Google spam policies (scaled content abuse): <https://developers.google.com/search/docs/essentials/spam-policies>
- Google site reputation policy update (Aug 2026): <https://developers.google.com/search/blog/2026/08/update-site-reputation-policy>
- Ahrefs' AI content process (human checkpoint at every stage): <https://ahrefs.com/blog/my-complete-ai-content-process-for-ahrefs/>
