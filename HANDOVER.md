# Handover — Blog + SEO audit (2026-07-05)

Everything below is **manual** work that couldn't be done from this environment
(local `.env.local` has empty `""` placeholders for `DATABASE_URL` / AI keys — the
DB is reachable only through the Neon MCP, and search-console/Yandex submissions
have no write API here).

Context: a full audit of all 113 blog posts + Google Search Console + Yandex
Webmaster. Code + data fixes already shipped are summarized at the bottom.

---

## ✅ Manual TODO (in priority order)

### 1. Confirm the deploy landed
The sitemap + generator fixes are on `main` (and `dev`). Vercel should have
auto-deployed. Verify:
- `https://softwhere.uz/sitemap.xml` now lists **~102 blog URLs** (was 83) and
  keeps updating as new posts publish (it self-refreshes hourly now).

### 2. Regenerate the 3 truncated Uzbek posts
They cut off mid-sentence (incomplete articles live now). Run the GitHub Actions
**`regenerate-post`** workflow (Actions tab → Run workflow), once per group:

| Group id | Locale | Post |
|---|---|---|
| `3ffa276b-fcab-41f8-910e-307fb65009c4` | `uz` | 90-kun MVP roadmap |
| `sched-2026-07-02-pm` | `uz` | Website-speed / sayt tezligini |
| `sched-2026-07-03-am` | `uz` | biznesda avtomatlashtirish |

Also worth re-checking (suspect tails / one fabricated-looking source
"MSMCoreTech"): group `4c4d5931-…` locales `en,ru`, and `ae91ec01-…` locale `ru`.

> The generator is now hardened, so regenerated posts won't come back truncated,
> code-fenced, or with duplicate titles.

### 3. Resubmit the sitemap to both engines
Google still indexes your **pre-migration `-<timestamp>` URLs** (one has 776
impressions); the current clean URLs are "unknown to Google" until it re-reads
the sitemap.
- **Google Search Console** → Sitemaps → resubmit `https://softwhere.uz/sitemap.xml`.
- **GSC** → URL Inspection → **Request Indexing** for your top ~10 clean blog URLs.
- **Yandex** re-reads automatically; optionally submit a recrawl for the home +
  top posts (quota 150/day).

### 4. Yandex Webmaster settings (UI-only, no API)
- Set the site **region** → Uzbekistan / Tashkent (fixes `NO_REGIONS`; big for
  local ranking).
- Add the business to **Yandex Business / Sprav** (fixes `NOT_IN_SPRAV`).
- Optional: add a **Yandex Metrika** counter for better crawl signals.

### 5. (Optional) locale-less `/blog/<slug>` 404s
Yandex probes `https://softwhere.uz/blog/<slug>` (no `/uz|ru|en`) → 404 (24 and
climbing). Low value. If you want them recovered, add a redirect in `src/proxy.ts`
for non-locale `/blog/*` → `/<default-locale>/blog/*`.

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
