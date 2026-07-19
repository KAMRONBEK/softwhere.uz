# Yandex local-presence setup (owner actions)

Two settings Yandex itself flags as missing for `softwhere.uz` — its diagnostics
report `NO_REGIONS` and `NOT_IN_SPRAV` as PRESENT (severity: recommendation).
Neither can be set from code or from the Yandex Webmaster API/MCP; both are
UI-only owner actions. They matter because the site currently has **SQI 0, ~3
known backlinks, and zero commercial-intent queries in Yandex** (2026-07-19
audit): indexation is healthy (186 pages in search), but with no region and no
business card the site cannot compete for local queries like «разработка сайтов
Ташкент» or «sayt yaratish Toshkent» — exactly the queries the new
`/services/*` landing pages target.

## 1. Assign the site region (`NO_REGIONS`)

1. Open [webmaster.yandex.com](https://webmaster.yandex.com) → site
   `https://softwhere.uz`.
2. **Информация о сайте → Региональность** (Site Information → Regionality).
3. Set region: **Ташкент** (Tashkent, Uzbekistan).
4. Yandex asks for a confirming URL — a page showing the region. Use
   `https://softwhere.uz/ru` (the contact section and footer show «Ташкент,
   Узбекистан» and the +998 phone number).
5. Submit; moderation usually takes a few days.

Effect: the site becomes eligible for region-boosted ranking on geo-dependent
queries from Uzbekistan.

## 2. Register in Yandex Business / Sprav (`NOT_IN_SPRAV`)

1. Go to [Yandex Business](https://business.yandex.com) (Яндекс Бизнес,
   formerly Справочник / sprav.yandex.ru) and add the organization.
2. Fill the card with the **same NAP** (name / address / phone) the site shows:
   - Name: **Softwhere** (site brand: SoftWhere.uz)
   - City: Tashkent, Uzbekistan (no public street address is listed on the
     site — use the real registered address in the card; it does not have to
     be published on the site)
   - Phone: **+998 33 249-91-11**
   - Website: **https://softwhere.uz** ← this field is what links the card to
     the Webmaster host and clears `NOT_IN_SPRAV`
   - Email: kamuranbek98@gmail.com; Telegram: t.me/softwhereuz
3. Category: «Разработка программного обеспечения» / IT services.
4. Confirm ownership (SMS/call), publish the card.

Effect: presence in Yandex Maps/search company snippets, a trust/authority
signal (feeds SQI, currently 0), and eligibility for local-pack results.

## 3. Optional, same UI session

- **Important pages monitoring** (Индексирование → Важные страницы): add
  `https://softwhere.uz/uz`, `/ru`, `/en`, `/uz/estimator`, and the three
  `/ru/services/*` pages. Observational only — Yandex notifies on
  status/snippet changes for these URLs.
- **Yandex Metrika**: not installed by choice (the site runs cookieless Vercel
  Analytics only — see `/privacy-policy`). Adding Metrika would improve Yandex
  behavioral/crawl signals but contradicts the published no-tracker policy;
  if it is ever added, the privacy policy (`privacy` namespace in
  `src/messages/*.json`) must be updated first.

## Verifying it worked

Via the Yandex Webmaster MCP (read-only):

- `get-diagnostics` → `NO_REGIONS` and `NOT_IN_SPRAV` flip to `ABSENT`
  (allow a few days after moderation).
- `get-summary` → watch `sqi` (moves slowly; backlinks matter more than the
  card alone).
- `get-query-analytics` / `get-popular-queries` → success signal is the first
  appearance of commercial ru/uz queries («разработка …», «… narxi», «… yaratish»)
  and any nonzero clicks. As of 2026-07-19 the 90-day baseline is ~67
  impressions, 0 clicks, 0 commercial queries — anything above that is progress.

## Context / history

- 2026-07-19: full GSC+Yandex audit and fix rollout (commit `03ec9d3`) — legacy
  URL recovery, crawlable locale links, `/services/*` + `/privacy-policy`
  pages, sitemap 156→168 URLs; 30 URLs submitted to Yandex recrawl the same
  day. These two console settings and GSC Request Indexing (see
  `HANDOVER.md`) were the only actions that could not be done from code.
