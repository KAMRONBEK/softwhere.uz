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

## Interim check — 2026-09-11 (day 8 of the 30-day gate)

Not the scheduled re-record; the 30-day pass is still **2026-10-03**. This entry exists because a matched
control turned up in git history that settles the root cause, and because it changes two of the gates.

### The 12 commercial URLs (URL Inspection API, 2026-09-11)

| URL | Coverage state | Last crawl |
| --- | --- | --- |
| `/uz/services/web-development` | Discovered / unknown (oscillates — see below) | never |
| `/uz/services/mobile-apps` | unknown | never |
| `/uz/services/telegram-bots` | unknown | never |
| `/ru/services/web-development` | unknown | never |
| `/ru/services/mobile-apps` | Discovered | never |
| `/ru/services/telegram-bots` | unknown | never |
| `/en/services/web-development` | unknown | never |
| `/en/services/mobile-apps` | Discovered | never |
| `/en/services/telegram-bots` | unknown | never |
| `/uz/estimator` | Crawled – currently not indexed | 2026-04-05 |
| `/ru/estimator` | Discovered | never |
| `/en/estimator` | Discovered | never |

**0 of 12** have a post-deploy `lastCrawlTime`. The gate needs 6.

**Do not read the coverage-state column as movement.** It oscillates within a single day: three of the twelve
were re-inspected roughly an hour apart on 2026-09-11 and `/uz/services/web-development` read
"URL is unknown to Google" on the first pass and "Discovered – currently not indexed" on the second. An
earlier draft of this entry recorded four URLs as having "slipped" since baseline; that reading was noise.
The aggregate counts have not moved in 8 days. **`lastCrawlTime` is the only stable field** — track it alone.

`/ru/estimator` and `/en/estimator` now report `referringUrls` containing
`https://softwhere.uz/uz/estimator`, so Google recorded the new internal links. Do not over-read it:
`/ru/privacy-policy` has carried a `referringUrl` for 54 days without ever being fetched. **A `referringUrl`
is not a leading indicator of a crawl.**

### Production is correct — verified, not assumed

All nine `/services/` pages return 200 with a correct self-referencing canonical. All twelve are in
`sitemap.xml` (186 `<loc>`). The live `/uz` homepage carries 7 real `<a href>` anchors to the service and
estimator pages, and every blog post sampled (uz, ru, en) carries 8 — all in parsed markup, outside any
`<script>`, so they are server-rendered and crawlable, not client-hydrated. PR #32 is fully deployed.

The `userCanonical: /uz` that GSC still reports for `/uz/estimator` is **stale April data**, not a live bug:
the deployed page emits `canonical → /uz/estimator`. It will correct itself on recrawl.

### Crawl stats — exported 2026-09-11, window 2026-06-13 → 2026-09-09

Owner checklist item 1, **done**, and it closed the question it existed to close. 89 days with data,
**749 requests, 8.42/day**. August 209/31 = 6.74/day.

| Dimension | Split |
| --- | --- |
| Purpose | Refresh **88.25%**, Discovery **11.75%** (≈ 88 requests, **0.99/day**) |
| Response | 200 71.03% (532), 308-filed-as-301 21.63% (162), 404 6.81% (51), 5XX 0.53% (**4**) |
| Googlebot type | Smartphone 56.74%, Desktop 20.69%, Page resource 14.42%, Image 7.74%, AdsBot 0.40% |
| Hosts | `softwhere.uz` 702 ("Problems in the past"), `www.softwhere.uz` 47 ("No problems") |

**The tables are marginal restatements, not independent evidence.** Three identities hold to 4 d.p.:
HTML+Image+JS+JSON+CSS = .7103 = 200; "Other file type" = .2163 = 301; "Unknown (failed requests)" = .0734
= 404 + 5XX. The File type table adds nothing to the Response table — do not cite it as corroboration. The
export also cannot cross-tabulate Purpose × Response, so **no claim about *which* requests were redirects is
supportable**, in either direction.

**Verdict: uniform scarcity, confirmed against the threshold pre-registered below.** The rule was written
before the data existed: "low single-digit requests/day with a small Discovery share confirms scarcity;
tens-to-hundreds per day while these nine stay unfetched would instead make template shape worth attacking."
Observed: 8.4/day at 11.75% Discovery — the first branch by an order of magnitude. Two corroborations pulled
the same day: `/ru/privacy-policy`, a **non-services** URL on the same template as the two Google *did* fetch,
is still never-crawled at 54 days; and `/ru` still reads `lastCrawlTime: 2026-05-30` (104 days) *through* the
09-09 spike. Neither is explicable by deprioritisation of `/{locale}/services/{slug}`. **Question closed.**

**The mechanism, now visible: a deploy amplifies Refresh, not Discovery.** 88.25% of this host's crawl visits
URLs Google already holds. The 09-03 deploy changed sitewide HTML (`edbbce4` namespace scoping and `f1dd92e`
FAQPage removal touch all 165 posts), so Google swept the known set — ~186 requests × 49% HTML ≈ 91 HTML
fetches against 186 canonical URLs. The 12 have no `lastCrawlTime`, so they are reachable **only** through the
~1/day Discovery stream. That is why a 186-request week produced zero of them, and why **burst size is close
to irrelevant to the 30-day gate**.

**The September surge had no deploy behind it.** `git log` confirms no commit after 2026-09-03. Daily:
09-03 **7** (deploy) → 09-04 **35** → 09-05 **36** → 09-06 6 → 09-07 **0** → 09-08 19 → 09-09 **83**. The
09-09 figure is the highest day in the 90-day dataset and it is the **last day with data** — right-censored,
and the most informative open question here. It did not reach `/ru`.

**Day-aligned, the two bursts differ in kind, not size.** July 07-19…25 ran ~190,000 bytes/request; September
09-03…09 ran ~19,600 (baseline ~18,800). July was a new build's JS chunks plus backfilled cover images;
September is page-shaped crawl. Do not quote "26.6/day vs August's 6.7/day" — that fuses a burst window with
a baseline month.

**The 28.4% redirect + 404 share is not reclaimable and needs no action.** Every redirect this host emits is a
**308**; GSC files it under "Moved permanently (301)" because Google's docs class the two identically. Crawl
budget is not the constraint at 8.4/day against 186 canonical URLs — a 100% reclaim buys 2.4 requests/day, and
nothing suggests they would route to Discovery. The 51 `legacy-aliases.ts` entries carry the legacy impression
share measured above; deleting them converts 308s into 404s. The 51 404s are 0.57/day of background probing
with no per-URL dimension to act on.

**No missed technical problem.** Request-weighted response time by month: **June 2,305 ms (84 req) → July 647
→ August 351 → September 261**. The ten days at ≥2,000 ms are all in June, all on 1–8 requests — cold starts
on an idle serverless site, predating the Fluid-compute and ISR work of 07-02 and 07-27/28. 5XX is **4
requests in 89 days**. The host flag is a dead June artifact.
**Falsifiable prediction:** 06-30 leaves the 90-day window on **2026-09-28**, so the apex host should read
"No problems" at the 10-03 re-record. If it still reads "Problems in the past", something is erroring now.

### What the link graph does to the Discovery queue — composition, mechanism unproven

The never-crawled pool Google can see is far larger than the 12. The blog language switcher
(`src/shared/components/Header/index.tsx:36`) does a naive path swap, so every post advertises its own slug
under the other two locales: **165 posts × 2 ≈ 330 wrong-locale URLs**, against 186 canonical ones. Each 308s
to the correct sibling. Verified live on `/en/blog/7-signs-your-business-needs-a-mobile-app`: the SSR markup,
outside any `<script>`, carries anchors to `/uz/blog/7-signs-…` and `/ru/blog/7-signs-…` — while `hrefLang` in
the same `<head>` already names the correct siblings (`/ru/blog/7-priznakov-…`, `/uz/blog/7-ta-alomat-…`).

The 12 commercial URLs are therefore **~3.5%** of the never-crawled pool competing for ~1 Discovery request
per day. This is **deliberate** — the code comment at that line explains the trade (always crawlable, no
lookup needed) — and is recorded here as *composition*, **not** as budget and **not** as a proven cause: with
no Purpose × Response cross-tab there is no evidence these ~330 consume Discovery requests.
**No change before 2026-10-03.** If the gate fails, a fix is justified as a *correctness* repair — the right
URL is already in the document's `<head>` — and must not be sold as a Google-crawl remedy.

### Root cause: a matched control, and what it rules out

Commit `03ec9d3` (deployed 2026-07-19) created **twelve** new URLs, not nine: the nine `/services/*` pages
**and** the three `/privacy-policy` pages, in one commit. Same deploy, same sitemap, same sitewide footer —
and the service links sit *above* the privacy link in it (`Footer/index.tsx:99-105` vs `:115`).

| New URL from `03ec9d3` | First Google crawl |
| --- | --- |
| `/uz/privacy-policy` | 2026-07-23 — Submitted and indexed |
| `/en/privacy-policy` | 2026-07-24 — Submitted and indexed |
| `/ru/privacy-policy` | never — "URL is unknown to Google" |
| all nine `/services/*` | never |

Google fetched **2 of the 12** new URLs, both inside a five-day post-deploy burst, and none of the other 10
in the 54 days since.

This rules out page quality. The privacy-policy pages are thinner, less commercial, carry less structured
data and sit lower in the footer. If Google were making a content judgment, privacy-policy is the page it
should have skipped. And more fundamentally: Google has never retrieved any of the nine service pages, so it
has no content to judge. It also rules out capacity — a service page serves in ~0.5 s as a static prerender
from edge cache.

What remains is crawl **demand**. With four backlinks there is almost no external signal, so the host gets a
trickle of refresh crawls plus a small burst on deploy; never-fetched URLs queue behind that and mostly do
not come up. Site-wide staleness confirms the scarcity:

| Page | Google `lastCrawlTime` | Days stale |
| --- | --- | --- |
| `/uz` | 2026-09-09 | 2 |
| `/uz/blog` | 2026-09-04 | 7 |
| `/en/privacy-policy` | 2026-07-24 | 49 |
| `/uz/privacy-policy` | 2026-07-23 | 50 |
| `/uz/blog/telegram-bot-xavfsizligi…` (96 impr) | 2026-07-23 | 50 |
| `/en` | 2026-07-19 | 54 |
| `/en/blog/telegram-bot-security…` (210 impr, top page) | 2026-07-19 | 54 |
| `/ru` | 2026-05-30 | 104 |

Only two pages in this sample were crawled in the trailing 28 days. Every page carrying the new service
links except `/uz` and `/uz/blog` is still held by Google in its pre-deploy July form.

`/uz/estimator` is not a counter-example. Its April crawl recorded `userCanonical: /uz` — the page was then
declaring itself a duplicate of the homepage, and "Crawled – currently not indexed" is the correct response
to that declaration. The live page self-canonicals; it needs only a recrawl. **Google has never made a
quality judgment about any of the 12.**

### The two candidate mechanisms — resolved the same day

Two mechanisms fit the matched control, and no API separates them directly: **uniform scarcity** (Google
samples very few of this host's never-fetched URLs and the nine services were simply unlucky), or
**pattern-level deprioritisation** (the scheduler ranks the templated `/{locale}/services/{slug}` set below
everything else). The rule for deciding between them was pre-registered before the data existed:

> Settle it with GSC → Settings → Crawl stats. Low single-digit requests/day with a small Discovery share
> confirms scarcity and closes the question of further on-site work. Tens-to-hundreds per day while these
> nine stay unfetched would instead make template shape worth attacking.

The export arrived 2026-09-11: **8.4 requests/day at 11.75% Discovery**. First branch, by an order of
magnitude. **Uniform scarcity confirmed; the on-site branch of this plan is closed.** Full numbers and the
two same-day corroborations are in the Crawl stats section above.

One thing the export cannot do in principle: it has no per-URL dimension, so it could never have produced
positive evidence *for* deprioritisation. What it could do is falsify scarcity. It did not.

### Yandex, for contrast

| | Google | Yandex |
| --- | --- | --- |
| Commercial URLs crawled | 0 of 12 | **12 of 12** |
| Commercial URLs in search results | 0 of 12 | **12 of 12** |
| Deploy → crawl of `/services/*` | never (54 d and counting) | 8–9 days (2026-07-27/28) |
| Pages in search | — | 177 |
| Clicks, 28 d | 12 | 4 |

Yandex indexed all twelve with correct localized commercial titles (`Toshkentda veb-sayt yaratish — lending,
do'kon, SaaS | Softwhere`), and its diagnostics report only `NO_REGIONS` and `NOT_IN_SPRAV`, both
RECOMMENDATION severity. A second major crawler fetched, indexed and ranked all twelve without complaint.

Yandex also produced the site's **first commercial click**: `разработка мобильных приложений в узбекистане`,
position 10, 1 click. Four clicks across 28 days, against zero in any prior 90-day window. It is no longer
accurate to call Yandex unbuilt-and-unconverting.

### External links

Yandex reports **4 backlinks total**: `github.com/softwhere-uz`, `daladan.uz`, and two scraper directories
(`screenshots.wiki`, `xploredomains.com`). This is the binding input on Google's crawl demand, and it is the
one input no code change in this repository can alter.

### Search (GSC, trailing 28 d, 2026-08-14 → 2026-09-10)

| Metric | Trailing 28 d | Prior 28 d (2026-07-17 → 2026-08-13) |
| --- | --- | --- |
| Clicks | 12 | 20 |
| Impressions | 1,188 | 2,866 |
| CTR | 1.01% | 0.70% |
| Average position | 9.0 | 10.6 |
| Impressions on the 12 commercial URLs | **0** | 0 |

Per the small-numbers note below, 12 vs 20 clicks is not a readable change.

### Measurement note

GSC's Sitemaps API reports `submitted: 186, indexed: 0` for this property. `contents[].indexed` is a
long-deprecated field that returns 0 for every property — it is **not** a signal. Blog posts rank and click.

## Gates

Revised **2026-09-11** after the matched-control finding. Thresholds now test mechanisms, not rates.

| When | Gate | If missed |
| --- | --- | --- |
| **2026-10-03** (30 d) | **≥ 1** of the 12 commercial URLs shows a post-deploy `lastCrawlTime` | Pull Crawl Stats. If it confirms uniform scarcity, stop on-site work and move the effort to external citations. Do **not** re-request indexing — spent on all nine on 2026-07-23, and Google states repeats do not help. |
| **2026-10-03** (30 d) | Both `/uz` and `/ru` show a post-2026-09-03 `lastCrawlTime` | `/uz` already passes (2026-09-09); `/ru` is 104 days stale. This is the precondition for the three `/ru/services/*` pages being re-queued from an in-body link. |
| **2026-11-02** (60 d) | ≥ 1 service page has a non-brand commercial impression **in Google**, or appears as a landing page for one | GSC anonymises low-volume queries (~47% here), so check Pages, not only Queries. |
| **2026-12-02** (90 d), primary | ≥ 1 inbound inquiry, or estimator leads above the 1-per-28-d baseline, attributable to organic | Yandex counts here — it is the channel currently delivering commercial position. |

**Why the 30-day threshold moved from 6 to 1.** The observed base rate for this class of URL is 2 first-fetches
in 54 days. Six in the next 22 days needs an ~8x acceleration, and the only new input is internal links, which
have so far produced referrer records and zero fetches. Zero-to-one is the phase change worth testing — it
proves the queue can drain for never-fetched URLs. One-to-six is only rate, and rate is governed by external
links, which nothing in this plan has changed yet. A gate that cannot separate "the fix was wrong" from "the
host is slow" measures nothing.


### Gate reporting — split, 2026-09-11

The 30-day gate can pass via **`/uz/estimator`**, which already holds a `lastCrawlTime` (2026-04-05) and needs
only a *Refresh* crawl — drawing on 88% of traffic, in the one locale Google refreshes. That would pass the
gate while proving nothing about the never-fetched queue, which is what the gate exists to test. **Threshold
unchanged; record `/uz/estimator` on its own line and the other 11 as the cohort.** This splits on
`lastCrawlTime` present/absent — the field this file calls the only stable one — not on the retired
coverage-state taxonomy.

**Forecast for 2026-10-03, recorded so the result is read against a number rather than a hope.** 22 days at
11.75% Discovery over a ~340-URL never-crawled pool: **P(≥ 1 of the 11) ≈ 43%** at the July post-burst rate of
6.5/day, **≈ 51%** at the 90-day mean, **≈ 82%** only if the 09-08/09 tail proves to be a step rather than a
spike. **Expect ~45%. Failing this gate is not evidence the fix was wrong.**

Temper the internal-link optimism with the control: `/ru/estimator` and `/en/estimator` gained `referringUrls`
— but `/ru/privacy-policy` has carried one for **54 days without a fetch**. **A `referringUrl` is not a
leading indicator of a crawl.**

**Read the daily series at 10-03, not only the URL column.** Three outcomes, pre-declared:

1. Crawl holds **≥ 20/day** through late September **and** 0 of 11 fetched → this is the pre-registered
   deprioritisation signature, and it is the only outcome that overturns the scarcity verdict.
2. **≥ 3 of 11** fetched → the uniform-draw model understates the internal links; revise it upward.
3. Rate collapses to **≤ 3/day** and 0 of 11 fetched → uninformative. Conclude nothing about the fix.

**Ship nothing before 2026-10-03.** The 09-08/09-09 tail is the most informative signal in 90 days and it is
right-censored. Any deploy layers a fresh Refresh sweep on top and makes the 10-03 read uninterpretable.

### Retired from every dashboard

- **Site-level average position.** Service pages will enter at 25–40 and drag it down; that is the plan working.
- **Total impressions.** Most of what decayed was an unconvertible US/global English long tail. Compare the 12-URL group in absolute counts.
- **The Discovered / unknown coverage state.** Retired 2026-09-11: it oscillates within a single day and its aggregate counts have not moved in 8 days. Track `lastCrawlTime` only.

### The small-numbers problem

16 vs 13 clicks gives p ≈ 0.71; the 95% interval on 16 clicks is [9, 26]. A month-over-month click claim needs roughly 31 clicks in a 28-day window before it clears p < 0.05. Judge the quarter on the categorical signals above.

### Service-page copy work — unblocked 2026-09-11

The previous rule ("copy work does not start until `/uz/services/web-development` shows a `lastCrawlTime`") is
lifted. It waited on a signal that cannot deliver what it promised: a first crawl would show the queue
drained, not that copy was the binding constraint — and Google has never fetched these pages, so it has formed
no view of their copy.

Copy work is now judged on **Yandex**, which has all 12 indexed and ranking: make the change, fire
`submit-recrawl` (150/day quota), then read position and impressions for the four tracked commercial queries
over the following 28 days.

Two constraints carry over. Do not make copy changes *in order to* get Googlebot to crawl, and do not read a
Google crawl as validation of the copy. And record why: the thin-content observations (137–177 words of unique
body copy per service page, 37–41% text shared with sibling service pages) were refuted **as an explanation of
the Google crawl failure** — they do not explain it. They were never refuted as descriptions of the pages. The
work is justified as commercial and Yandex work, not as a Google-crawl remedy.

## Owner checklist

Reordered **2026-09-11**. Request Indexing is spent **once per URL** — Google states repeat requests "won't get
it crawled any faster" — and it has already been spent on all nine service URLs (2026-07-23, no effect in 50
days). The list below is ordered by expected value, not by effort.

1. ~~GSC → Settings → Crawl stats.~~ **Done 2026-09-11** — it confirmed uniform scarcity and **retired the
   on-site branch of this plan**. See the Crawl stats section above.
2. **Real external links.** *Now the only item that addresses the confirmed cause.* The actual binding input, and the only one that raises Google's crawl demand.
   Four backlinks — two of them scraper directories — is the number to move. Concretely: Clutch
   (`clutch.co/uz/developers`), `goldenpages.uz`, Uzbek IT directories, and any client or partner willing to
   link. Everything else on this list is hygiene by comparison.
3. **Yandex Webmaster → set site region** (Tashkent / Uzbekistan). Clears `NO_REGIONS`. Not API-addressable —
   `get-region-ids` and `get-feed-regions` are read-only. Yandex is the channel that demonstrably works *and*
   converts, so this is the cheapest ranking improvement available anywhere on the site.
4. **Yandex Business profile** — `https://yandex.ru/sprav/`. Clears `NOT_IN_SPRAV`, adds a regional signal and
   a real citation.
5. **Request Indexing on `/uz/estimator` only.** Its last crawl (2026-04-05) predates both the canonical fix
   and the wizard rebuild, so a recrawl is new information regardless of deploy. **Do not re-request the nine
   service URLs** — already spent, and repeats do not help.
6. **Legacy URL still indexed as canonical:** `/ru/blog/создание-успешного-технологического-стартапа-в-узбекистане-1748371477413` — 26 impressions / 28 d at position 6.7, last crawled 2026-07-20 when it still served 200 with a canonical to the new slug; it now 308s in one hop. Request Indexing so Google sees the redirect and moves the ranking to `/ru/blog/tekhnostartap-v-uzbekistane-kak-zapustit-uspeshnyy-proekt`.
7. **Security & Manual Actions → Manual actions** and **Security issues**: screenshot both. A clean panel does
   not explain the decay (algorithmic demotions leave no entry); it only rules out one hypothesis.
8. **Performance → Search results:** right-click the deploy date and annotate "Service-page internal links +
   metadata hygiene shipped".
9. Quarterly: eyeball the so'm bands on the service pages, and whenever the rate moves more than 10%.

## Cadence

- **Weekly, 30 seconds:** URL Inspection across the 12 commercial URLs. Record **one field only — does
  `lastCrawlTime` exist yet?** Do not record the Discovered/unknown coverage state; it oscillates within a day
  and has already produced one wrong narrative. Do not open the Performance report weekly.
- **Monthly, 30 minutes:** Performance → Pages, 28 d vs prior 28 d, **impressions only**, the 12-URL group in
  absolute counts against the blog's direction; per-query position for `internet dokon ochish`,
  `internet magazin ochish`, `mobil ilova yaratish`, `telegram bot yaratish`; leads in the admin viewer.
  Re-record the tables in this file.
- **Monthly, Yandex:** this is now the live commercial feedback loop, not a courtesy glance. Record position
  and impressions for the tracked commercial queries, and fire `submit-recrawl` (150/day quota) after any
  service-page copy change so the result is readable within days rather than months.
- **Quarterly glance:** Search Status Dashboard, Manual Actions.

## Blog consolidation — paused, with a stop rule

Paused 2026-09-02: the shortlist found no duplicate slug-roots among live posts (every apparent duplicate is a legacy redirect already handled by `legacy-aliases.ts`), and every retire candidate sits in one publish burst 60–62 days old, so the age cut was slicing a batch, not separating good posts from bad. Re-assess on **2026-10-03**.

When it proceeds, the mechanics are non-negotiable:

- Prune whole `generationGroupId` clusters, all three locales together; dropping one locale breaks the hreflang set.
- Never retire a post that is a `legacy-aliases.ts` target without repointing every alias that names it in the same deploy; the post route caches `notFound()` with no expiry.
- Order: write the redirects into `next.config.mjs` and deploy → `curl -I` each retired URL while still published → only then set `status = 'draft'` in small batches through the admin `PATCH`, which purges the post, its siblings and its category-mates (surviving posts bake related-articles cards into static HTML, and a drafted slug 404s with no expiry) plus the list, feeds and sitemap → after the last batch, one untargeted `POST /api/admin/revalidate` (no `paths`) as a final sweep.
- Never `410`, never bulk-redirect to the homepage or one service page.
- Stop rule, pre-declared: if clicks fall below 10 per 28 days for two consecutive windows, revert by re-publishing. That is why it is draft-not-delete.
