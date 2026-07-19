# Handover — Blog + SEO audit (updated 2026-07-19)

Everything below is **manual** work that can't be done from code or the
read-only console APIs. Context: the 2026-07-05 content audit plus the
2026-07-19 full GSC + Yandex audit and fix rollout (commit `03ec9d3` — legacy
URL recovery, crawlable locale links, `/services/*` + `/privacy-policy` pages,
sitemap 156→168 URLs; verified live).

---

## ✅ Manual TODO (in priority order)

### 1. GSC Request Indexing — the single biggest remaining lever

Google dropped the legacy `-<timestamp>` URLs after seeing the redirects but
has **never crawled the regenerated canonicals** (census 2026-07-19: 7 of 147
blog URLs indexed; the rest "Discovered"/"unknown"; 0 rejected for quality).
The sitemap is healthy and re-submitted; the only untried lever is the manual
**URL Inspection → Request Indexing** button (quota ~10–12/day, resets daily).

How: [search.google.com/search-console](https://search.google.com/search-console)
→ property `softwhere.uz` → paste the URL in the top search bar → wait for the
inspection → **Request Indexing**. ~1–2 min per URL.

Ordered by 16-month demand (`scripts/data/lost-topics.json`) — one day per block:

**Day 1 — top EN canonicals + weakest pages** (`https://softwhere.uz` + path):
`/en/blog/telegram-bot-security-protecting-your-business-and-users` (9.1k impr),
`/en/blog/telegram-mini-apps-the-future-of-in-app-experiences` (8.4k),
`/en/blog/complete-guide-to-telegram-bot-development-for-businesses` (6.9k),
`/en/blog/telegram-mini-apps-vs-traditional-mobile-apps-which-should-you-choose` (2.4k),
`/en` (Crawled–not-indexed since May 18),
`/ru/services/web-development`, `/ru/services/telegram-bots`,
`/ru/services/mobile-apps`,
`/en/blog/pwa-vs-mobile-app` (480),
`/en/blog/how-rag-can-transform-your-business-knowledge-base` (427).

**Day 2 — RU siblings of the top 4 + next EN tier:**
`/ru/blog/bezopasnost-telegram-botov-zashchita-biznesa-i-klientov`,
`/ru/blog/telegram-mini-apps-budushchee-vstroennykh-servisov`,
`/ru/blog/razrabotka-telegram-botov-dlya-biznesa-polnoe-rukovodstvo`,
`/ru/blog/telegram-mini-apps-ili-mobilnye-prilozheniya-chto-vybrat`,
`/en/blog/saas-architecture-technical-decisions-that-make-or-break-your-product` (386),
`/en/blog/seo-friendly-web-development-technical-best-practices` (336),
`/en/blog/mobile-application-cost-in-2025` (266),
`/en/blog/how-automation-saved-20-hoursweek-a-real-business-case` (247),
`/en/blog/web-development-trends-that-will-shape-2026` (227),
`/uz/services/web-development`.

**Day 3 — UZ siblings of the top 4 + remaining new pages:**
`/uz/blog/telegram-bot-xavfsizligi-biznesni-himoya-qilish`,
`/uz/blog/telegram-mini-apps-kelajakdagi-ilova-tajribalari-softwhereuz-blog`,
`/uz/blog/telegram-bot-yaratish-toliq-qollanma-biznes-uchun`,
`/uz/blog/telegram-mini-app-va-oddiy-ilovalar-qaysi-yaxshiroq`,
`/uz/services/mobile-apps`, `/uz/services/telegram-bots`,
`/en/services/web-development`, `/en/services/mobile-apps`,
`/en/services/telegram-bots`, `/uz/privacy-policy`.

Notes: don't request the legacy `-<timestamp>` URLs (they 308 now; Google
re-verifies redirects on its own). Repeating a request for the same URL does
nothing. Expect inspection states to flip within days but impressions to lag
**2–4 weeks**. Monitor weekly: GSC → Indexing → Pages, and the sitemap's
"indexed" count (was 0/156 on 2026-07-19). If URLs start landing in
"Crawled – currently not indexed" *after* being requested, that becomes a
content-quality signal — revisit before requesting more.

### 2. Yandex console settings — region + Sprav

See **[docs/yandex-setup.md](./docs/yandex-setup.md)** for the step-by-step
(assign Tashkent region, register in Yandex Business/Sprav, optional
important-pages monitoring, and how to verify via the MCP). Clears the two
diagnostics Yandex itself flags (`NO_REGIONS`, `NOT_IN_SPRAV`).

### 3. (From the 2026-07-05 content audit — still open if not done)
Regenerate the 3 truncated Uzbek posts via the **`regenerate-post`** workflow
(groups `3ffa276b-…`/uz, `sched-2026-07-02-pm`/uz, `sched-2026-07-03-am`/uz)
and re-check suspect tails in `4c4d5931-…` (en,ru) and `ae91ec01-…` (ru).

### 4. Optional
- Set `BLOG_AUTHOR_NAME` in Vercel env — switches blog JSON-LD author from
  Organization to a named Person (E-E-A-T; the only lever for Article rich
  results).
- Backlinks: ask partners/clients for links to `https://softwhere.uz`
  (Yandex knows ~3 backlinks; SQI 0).

---

## Done on 2026-07-19 (no action needed)

- All code fixes from the GSC+Yandex audit shipped and verified live
  (commit `03ec9d3`): legacy/renamed/deleted URL redirects (51-entry alias map
  + any-locale fallback), locale-less path redirects, crawlable language
  switcher, homepage latest-posts links, `/services/*` + `/privacy-policy`
  pages, brand titles, hreflang Link-header fix.
- Sitemap resubmitted to Google (downloaded 09:57 UTC, 0 errors).
- 30 URLs submitted to Yandex recrawl (top canonicals, new pages, fixed
  legacy URLs).

---

## Reference: what was already fixed & shipped

**Code (`main` + `dev`):**
- `sitemap.ts` `revalidate=3600` — it was build-frozen and missing the 30 newest posts.
- Generator hardening: skip already-published topics (title similarity — the cause
  of the `-1` duplicates); unwrap whole-post ` ```markdown ` fences; strip leading
  `---`; strip baked-in `| SoftWhere.uz Blog` title suffixes.

**Database (already live):**
- 9 titles corrected, 1 code-fenced post unwrapped, 4 stray-`---` removed.
- **4 duplicate clusters deleted** (11 posts; 113 → 102, balanced 34/34/34).
  Full backup: `deleted-duplicate-clusters-backup-2026-07-04.json` (kept in the
  session job tmp dir — ask if you need it restored).

Post bodies are otherwise well-translated and solid; remaining findings are
cosmetic (see the session report).
