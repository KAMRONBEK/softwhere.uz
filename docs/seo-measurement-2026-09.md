# SEO measurement log — September 2026

Point-in-time operational state for the index-recovery work. Dated on purpose: `docs/seo.md` is the code reference and must not carry dated state (precedent: `docs/blog-review-2026-07.md`). Next entry: re-record the tables below on **2026-10-03**, the 30-day gate.

## What this measures

The 2026-09-02 audit found the site orphaned, not penalised. The 12 commercial URLs (three service pages × three locales, plus the estimator × three) had never been fetched by Googlebot because nothing on the site linked to them in-body. Branch `seo/index-recovery` adds those links (homepage service cards, category-matched blog CTAs), repairs metadata inheritance and titles, stops unreviewed auto-publishing, scopes the client message payload, and quotes so'm alongside USD.

Success is **categorical**, not a percentage: did a commercial URL acquire a `lastCrawlTime`, did a service page surface for a non-brand commercial query, did a human contact the business.

## Baseline — recorded 2026-09-03, before deploy

### Search (Google Search Console, `sc-domain:softwhere.uz`)

Trailing 28 days, 2026-08-06 → 2026-09-02, against the prior 28 days (2026-07-09 → 2026-08-05), property-level totals:

| Metric | Trailing 28 d | Prior 28 d |
| --- | --- | --- |
| Clicks | 10 | 18 |
| Impressions | 1,151 | 2,450 |
| CTR | 0.87% | 0.73% |
| Average position | 9.9 | 10.9 |
| Impressions on URLs that 308-redirect (page rows) | 24 of 1,196 (2.0%) | — |
| Impressions on the 12 commercial URLs | 0 | 0 |

Page-level rows sum to 1,196 impressions because one query can show several of the site's pages; the legacy share is computed from those rows. The click drop (18 → 10) is inside the noise band described below, and the impression drop is the US/global English long tail continuing to fall away.

The legacy-URL share was 24.5% over the trailing 90 days (1,116 of 4,550). Over 28 days it is 2.0%: Google consolidated the largest one on its own (`/en/blog/telegram-mini-apps-the-future-of-in-app-experiences-1770024952361`, 857 impressions over 90 days, absent from the 28-day window). No code change is needed for that; one residual URL is in the owner checklist.

### Commercial URLs (URL Inspection API, 2026-09-03)

| URL | Coverage state | Last crawl |
| --- | --- | --- |
| `/uz/services/web-development` | Discovered – currently not indexed | never |
| `/uz/services/mobile-apps` | Discovered – currently not indexed | never |
| `/uz/services/telegram-bots` | URL is unknown to Google | never |
| `/ru/services/web-development` | URL is unknown to Google | never |
| `/ru/services/mobile-apps` | Discovered – currently not indexed | never |
| `/ru/services/telegram-bots` | Discovered – currently not indexed | never |
| `/en/services/web-development` | Discovered – currently not indexed (referred from a blog post) | never |
| `/en/services/mobile-apps` | Discovered – currently not indexed | never |
| `/en/services/telegram-bots` | URL is unknown to Google | never |
| `/uz/estimator` | Crawled – currently not indexed | 2026-04-05, pre-rebuild; GSC still records the old `/uz` canonical |
| `/ru/estimator` | URL is unknown to Google | never |
| `/en/estimator` | URL is unknown to Google | never |

**0 of 12** have a post-deploy `lastCrawlTime`.

### Leads and estimator

| Metric | Trailing 28 d | Prior 28 d | Note |
| --- | --- | --- | --- |
| Leads (`leads` table, all sources) | 1 | 0 | 3 total since 2026-07-02 |
| Leads with `source = estimator` | 1 | 0 | the estimator conversion proxy |
| `estimator_start` / `estimator_lead_submit` | not recorded | — | see below |

`estimator_start` and `estimator_lead_submit` are Vercel Web Analytics **custom events**, which the Hobby plan does not record (Vercel docs, "Pricing for Web Analytics": Custom Events — Hobby "–"), and the Web Analytics API returns `not_found` for this project. Until the project is on Pro they read zero regardless of traffic; the estimator proxy is leads with `source = estimator` in `/[locale]/admin/leads`.

## Gates

| When | Gate | If missed |
| --- | --- | --- |
| **2026-10-03** (30 d) | ≥ 6 of the 12 commercial URLs show a `lastCrawlTime` | Run one more cycle: re-inspect, re-request the uz/ru service pages once. Do **not** switch to link building. |
| **2026-11-02** (60 d) | ≥ 1 service page has a non-brand commercial impression, or appears as a landing page for one | GSC anonymises low-volume queries (~47% here), so check Pages, not only Queries. |
| **2026-12-02** (90 d), primary | ≥ 1 inbound inquiry, or estimator leads above the 1-per-28-d baseline, attributable to organic | Reassess service-page depth (recovery plan 6) only once a service page has been crawled. |
| 2026-12-02, leading indicator only | The 12-URL group reaches 100+ impressions per 28 d | Not a success criterion. |

### Retired from every dashboard

- **Site-level average position.** Service pages will enter at 25–40 and drag it down; that is the plan working.
- **Total impressions.** Most of what decayed was an unconvertible US/global English long tail. Compare the 12-URL group in absolute counts.

### The small-numbers problem

16 vs 13 clicks gives p ≈ 0.71; the 95% interval on 16 clicks is [9, 26]. A month-over-month click claim needs roughly 31 clicks in a 28-day window before it clears p < 0.05. Judge the quarter on the categorical signals above.

## Owner checklist (Search Console UI)

Request Indexing is spent **once per URL**. Google states that repeat requests "won't get it crawled any faster."

1. **Now:** `/uz/estimator`. Its last crawl (2026-04-05) predates the canonical fix and the wizard rebuild, so a recrawl is new information regardless of deploy.
2. **After this branch is live in production:** the six uz/ru service pages (`/uz/services/*`, `/ru/services/*`). Not the English ones: English brought 358 US impressions and zero clicks.
3. **Legacy URL still indexed as canonical:** `/ru/blog/создание-успешного-технологического-стартапа-в-узбекистане-1748371477413` — 22 impressions / 28 d at position 7.3, last crawled 2026-07-20 when it still served 200 with a canonical to the new slug; it now 308s in one hop. Request Indexing so Google sees the redirect and moves the ranking to `/ru/blog/tekhnostartap-v-uzbekistane-kak-zapustit-uspeshnyy-proekt`. Optional: the same for `…-1770024952361` (last crawled 2026-04-25, still recorded as noindex; already out of results).
4. **Security & Manual Actions → Manual actions** and **Security issues**: screenshot both. A clean panel does not explain the decay (algorithmic demotions leave no entry); it only rules out one hypothesis.
5. **Performance → Search results:** right-click the deploy date and annotate "Service-page internal links + metadata hygiene shipped".
6. No-code items from the recovery plan: a Business Profile only if you actually meet clients in person in Tashkent; Clutch (`clutch.co/uz/developers`) and goldenpages.uz listings; eyeball the so'm bands on the service pages each quarter and when the rate moves more than 10%.

## Cadence

- **Weekly, 30 seconds:** URL Inspection on `https://softwhere.uz/uz/services/web-development`. One field: does `lastCrawlTime` exist yet? Service-page copy work does not start until it does. Do not open the Performance report weekly.
- **Monthly, 30 minutes:** Performance → Pages, 28 d vs prior 28 d, **impressions only**, the 12-URL group in absolute counts against the blog's direction; per-query position for `internet dokon ochish`, `internet magazin ochish`, `mobil ilova yaratish`, `telegram bot yaratish`; leads in the admin viewer. Re-record the tables in this file.
- **Quarterly glance:** Search Status Dashboard, Manual Actions, Yandex Webmaster (indexing is healthy there; the channel has never earned a click).

## Blog consolidation — paused, with a stop rule

Paused 2026-09-02: the shortlist found no duplicate slug-roots among live posts (every apparent duplicate is a legacy redirect already handled by `legacy-aliases.ts`), and every retire candidate sits in one publish burst 60–62 days old, so the age cut was slicing a batch, not separating good posts from bad. Re-assess on **2026-10-03**.

When it proceeds, the mechanics are non-negotiable:

- Prune whole `generationGroupId` clusters, all three locales together; dropping one locale breaks the hreflang set.
- Never retire a post that is a `legacy-aliases.ts` target without repointing every alias that names it in the same deploy; the post route caches `notFound()` with no expiry.
- Order: write the redirects into `next.config.mjs` and deploy → `curl -I` each retired URL while still published → only then set `status = 'draft'` in small batches through the admin `PATCH`, which purges the post, its siblings and its category-mates (surviving posts bake related-articles cards into static HTML, and a drafted slug 404s with no expiry) plus the list, feeds and sitemap → after the last batch, one untargeted `POST /api/admin/revalidate` (no `paths`) as a final sweep.
- Never `410`, never bulk-redirect to the homepage or one service page.
- Stop rule, pre-declared: if clicks fall below 10 per 28 days for two consecutive windows, revert by re-publishing. That is why it is draft-not-delete.
