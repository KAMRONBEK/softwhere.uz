# SEO & Discoverability

How softwhere.uz makes itself findable: a dynamic sitemap, `robots.txt`, per-locale RSS feeds, an edge-rendered OG image, JSON-LD structured data, canonical + hreflang alternates, transliterated slugs, computed reading time, and an IndexNow ping on publish — plus Search Console / Yandex Webmaster wired in over MCP for offline inspection.

Everything is Next.js App Router file-conventions or route handlers. Base URL comes from `ENV.BASE_URL` (`src/core/constants.ts:61` — `NEXT_PUBLIC_BASE_URL` or `https://softwhere.uz`, trailing slashes stripped). All post data flows through the blog repository (`src/modules/blog/model/posts.repository.ts`); no generator touches Drizzle directly.

## At a glance

| Concern | File | Emits |
| --- | --- | --- |
| Sitemap | `src/app/sitemap.ts` | `/sitemap.xml` — static roots + per-post URLs with hreflang |
| Robots | `src/app/robots.ts` | `/robots.txt` — allow/disallow rules + sitemap ref |
| RSS feed | `src/app/[locale]/feed.xml/route.ts` | `/{locale}/feed.xml` — RSS 2.0, one per locale |
| OG image | `src/app/api/og/route.tsx` | `/api/og` — 1200×630 PNG (edge runtime) |
| Post JSON-LD | `src/modules/blog/lib/seo.tsx` | `BlogPosting` + `BreadcrumbList` (+ `FAQPage`) |
| Site JSON-LD | `src/app/[locale]/layout.tsx` | `Organization` + `WebSite`; home metadata |
| Post metadata | `src/app/[locale]/blog/[slug]/page.tsx` | canonical, hreflang, OG/Twitter, robots index rules, reading time |
| Blog-list metadata | `src/app/[locale]/blog/page.tsx` | canonical/hreflang, RSS `alternates.types`, `CollectionPage` JSON-LD |
| IndexNow | `src/modules/blog/utils/indexnow.ts` | POST to `api.indexnow.org` on publish |
| Slugs | `src/shared/utils/slug.ts` | transliterated slug + cluster-root helper |
| Meta clamp | `src/modules/blog/utils/meta.ts` | boundary-aware 160-char description clamp |
| Image/CSS config | `next.config.mjs` | AVIF/WebP, Unsplash allow-list, inlined CSS |

Offline tooling (not runtime): Search Console + Yandex Webmaster MCP servers in `.mcp.json`, wrapped by `scripts/searchconsole-mcp.js` and `scripts/yandex-webmaster-mcp.js`. See [Search Console & Yandex over MCP](#search-console--yandex-over-mcp).

---

## Sitemap — `src/app/sitemap.ts`

A single `sitemap()` default export (Next's `MetadataRoute.Sitemap` convention) served at `/sitemap.xml`. It has two halves.

**Static pages.** For each locale (`uz`, `ru`, `en`) × page (`''`, `/blog`, `/estimator`) it emits one entry. Notes baked into the code:

- **No bare-root entry.** `${baseUrl}` 308-redirects to `/uz`; listing a redirecting URL is bad, so only the localized roots (`/uz`, `/ru`, `/en`) appear.
- **No `lastModified`** on static pages — stamping `new Date()` every render churned the field and trained Google to ignore it.
- `changeFrequency: 'weekly'`; `priority` is `1` for the home page, `0.8` otherwise.
- Each carries hreflang `alternates.languages` with `x-default` pointing at the default locale (`BLOG_CONFIG.DEFAULT_LOCALE` = `uz`).

**Blog posts.** Pulled from `listForSitemap()` (published only, oldest-first). Two-step processing:

1. **Cluster de-duplication.** Posts are grouped by `` `${locale}:${getSlugRoot(slug)}` ``; the *oldest* post per cluster (by `createdAt`) is kept as canonical. This collapses legacy timestamp-suffixed slug variants into one URL.
2. **hreflang via generation group.** Canonical posts sharing a `generationGroupId` are cross-linked as language alternates; `x-default` resolves to the default-locale sibling, falling back to the post's own URL.

Per-post entries use `lastModified: updatedAt`, `changeFrequency: 'monthly'`, `priority: 0.7`. hreflang alternates are attached only when the post has a `generationGroupId` — the guard is `Object.keys(alternates).length > 1`, and a grouped post's map always carries its own locale plus `x-default` (so even a single-locale group qualifies).

```ts
const clusterKey = `${post.locale}:${getSlugRoot(post.slug)}`;
const currentCanonical = canonicalByCluster.get(clusterKey);
if (!currentCanonical || new Date(post.createdAt) < new Date(currentCanonical.createdAt)) {
  canonicalByCluster.set(clusterKey, post);
}
```

The whole dynamic block is wrapped in `try/catch`: on any DB error it logs (`logger.error(..., 'SEO')`) and returns **static-only** URLs rather than failing the sitemap.

## Robots — `src/app/robots.ts`

`MetadataRoute.Robots` served at `/robots.txt`:

- `allow: ['/', '/api/og']` — `/api/og` must stay crawlable because `og:image` and the `BlogPosting` JSON-LD point at it; Google can't use robots-blocked images.
- `disallow: ['/admin/', '/*/admin/', '/api/', '/_next/']` — admin is locale-prefixed (`/uz/admin/...`), so both shapes are blocked.
- `sitemap: ${ENV.BASE_URL}/sitemap.xml`.

## Per-locale RSS feed — `src/app/[locale]/feed.xml/route.ts`

One RSS 2.0 feed per locale at `/{locale}/feed.xml` (`/uz/feed.xml`, `/ru/feed.xml`, `/en/feed.xml`). `revalidate = 3600`. The locale is normalized with `validateLocale(rawLocale, 'en')`.

Despite the `.xml` name and `xmlns:atom` declaration, this is **RSS 2.0**, not a separate Atom document — the Atom namespace is used only for the `<atom:link rel="self">` self-reference. There is no standalone Atom feed.

Content comes from `listForFeed(locale, 20)` (newest 20 published posts, that locale). Per item: `title`, `link`, `guid` (permalink), `pubDate` (`createdAt` → `toUTCString()`), plus optional `description` (`metaDescription`) and `category`. Channel title/description are localized inline (`CHANNEL_TITLE` / `CHANNEL_DESCRIPTION`). All text runs through a local `escapeXml()`.

```xml
<atom:link href="${baseUrl}/${locale}/feed.xml" rel="self" type="application/rss+xml"/>
```

Response: `Content-Type: application/rss+xml; charset=utf-8`, `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`. On error it logs and returns `500 Feed unavailable`. The feed is advertised to crawlers from the blog-list page via `alternates.types['application/rss+xml']` (`src/app/[locale]/blog/page.tsx`).

## OG image — `src/app/api/og/route.tsx`

Edge-runtime (`runtime = 'edge'`) `ImageResponse`, 1200×630, served at `/api/og`. Query params:

| Param | Behavior |
| --- | --- |
| `title` | Rendered as the headline; defaults to a brand string. Font size shrinks to `36px` when > 50 chars. |
| `locale` | `en` / `ru` / `uz` (default `en`); selects the localized subtitle. |
| `image` | Background image. **Only `https://images.unsplash.com` is honored** — an SSRF guard, since Satori fetches this server-side. Anything else falls back to the brand gradient. |

**Cyrillic fix.** `loadFontSubset()` pulls a Noto Sans subset (only the glyphs actually rendered) from the Google Fonts CSS API, using a legacy desktop User-Agent so the API returns TTF (Satori can't parse woff2). Without it, RU titles render as tofu boxes. It's best-effort — on any failure the default font is used.

**Cache correctness.** The response is cached `immutable, max-age=31536000` **only when the proper font loaded**; if the font fetch failed it drops to `max-age=3600` so a tofu render isn't pinned for a year.

This endpoint backs the `BlogPosting` JSON-LD `image`, the post OG/Twitter `images`, and the home OG image. When a post has a cover image, the metadata passes it through as the `image` param so the OG card uses the real photo behind the gradient overlay.

## Structured data / JSON-LD

Three emitters, all serialized through `safeJsonLd()` (`src/shared/utils/security.ts`), which escapes `<`, `>`, `&` so an AI-generated title containing `</script>` can't break out of the `<script type="application/ld+json">` tag (stored-XSS guard).

### Post schema — `src/modules/blog/lib/seo.tsx`

`<BlogPostSchema post={post} />` (rendered inside the post page) always emits:

- **`BlogPosting`** — `headline`, `description` (`extractDescription`), `image` (cover image or `/api/og`), `author`, `publisher`, `datePublished`/`dateModified`, `mainEntityOfPage`, `articleSection` (mapped via `PILLAR_LABELS`, default `Technology`), `keywords` (`getKeywords`), `wordCount` (whitespace-split count), `inLanguage`, `isPartOf` (the `Blog`).
- **`BreadcrumbList`** — Home › Blog › post title.

Conditionally:

- **`FAQPage`** — only when `postFormat` is `faq` or `myth-buster` **and** `parseFAQPairs()` finds ≥ 3 Q/A pairs. `parseFAQPairs` treats any `#`–`###` heading ending in `?` as a question, accumulates following lines as the answer (capped 300 chars), max 10 pairs.

**Author (E-E-A-T).** When `BLOG_AUTHOR_NAME` or `NEXT_PUBLIC_BLOG_AUTHOR` is set, the author is a `Person` (Google rewards named authors); otherwise it falls back to the `Organization`. The same identity is mirrored into the page's `authors` metadata.

```tsx
const authorName = process.env.BLOG_AUTHOR_NAME || process.env.NEXT_PUBLIC_BLOG_AUTHOR;
const author = authorName
  ? { '@type': 'Person', name: authorName, url: `${baseUrl}/${locale}#contact` }
  : { '@type': 'Organization', name: 'SoftWhere.uz', url: baseUrl };
```

### Site schema — `src/app/[locale]/layout.tsx`

The root locale layout renders `<StructuredData>` for every page: an **`Organization`** (logo, `sameAs` Telegram/Instagram from `SOCIAL_LINKS`, a `ContactPoint` with phone + `availableLanguage`) and a **`WebSite`** node.

### Blog-list schema — `src/app/[locale]/blog/page.tsx`

A **`CollectionPage`** node describing the blog index (`name`, `description`, `url`, `isPartOf` WebSite, `inLanguage`).

## Blog-post metadata construction — `src/app/[locale]/blog/[slug]/page.tsx`

`generateMetadata()` is where per-post SEO is assembled. Key mechanics:

- **Description**: `extractDescription(content, metaDescription, locale)` — uses stored `metaDescription` if present, else the first content line > 50 chars, run through `clampMeta` (160-char boundary-aware clamp). Falls back to a localized string if nothing qualifies.
- **Keywords**: `getKeywords(post)` — `primaryKeyword` + `secondaryKeywords` (+ `softwhere.uz`), or locale fallback keywords matched against the content.
- **Canonical**: resolved via `getCanonicalForLocale(locale, slugRoot)` → the *oldest* published post in the slug cluster. `canonicalUrl` uses that slug, so timestamp/duplicate variants all point at one canonical URL.
- **hreflang** (`alternates.languages`): starts with the post's own locale, then for each `generationGroupId` sibling maps to *that sibling's* canonical slug; `x-default` resolves to the default-locale entry.
- **Robots index gate** (the deduplication lever):

```ts
robots: isCanonicalVariant && !localeMismatch
  ? { index: true, follow: true }
  : { index: false, follow: true },
```

Only the canonical slug served under its own locale is indexable; non-canonical variants and cross-locale hits are `noindex, follow`. The page body additionally `permanentRedirect`s a mismatched-locale or non-canonical slug to the right URL.

- **Genuine 404s**: when the post doesn't exist, `generateMetadata` calls `notFound()` itself (not just the page body) so the response is a real HTTP 404 instead of a soft 404 that search engines keep indexing. A *transient* DB error instead returns generic fallback metadata (never a noindex).
- **OG / Twitter**: `openGraph.type = 'article'` with `publishedTime`/`modifiedTime`/`authors`; `twitter.card = 'summary_large_image'`. Both images go through `/api/og`, forwarding the cover image via the `image` param when available.

The **home** (`layout.tsx`) and **blog-list** (`blog/page.tsx`) pages build their own `alternates.canonical` + four-way `languages` map (`x-default`→`uz`, `uz`, `ru`, `en`) the same way.

## Slugs — `src/shared/utils/slug.ts`

`createSlug(title)` transliterates Cyrillic → Latin (including Uzbek-Cyrillic extras `ў қ ғ ҳ`), strips apostrophes (`ʻ ' '`), lowercases, drops non-`[a-z0-9\s-]`, collapses whitespace/dashes, and trims. Used by the generation pipeline and the admin editors.

`getSlugRoot(slug)` strips a trailing `-\d{10,}` (a legacy 10+-digit timestamp suffix) to yield the **cluster root** used for canonical grouping in the sitemap and metadata.

```ts
export function getSlugRoot(slug: string): string {
  return slug.replace(/-\d{10,}$/, '');
}
```

Note a subtlety: the current pipeline de-duplicates collisions with small integer suffixes (`resolveUniqueSlug` appends `-1`, `-2`, … in `src/modules/blog/api/pipeline.ts`), **not** timestamps. `getSlugRoot`'s 10-digit strip therefore targets *legacy* timestamped slugs; fresh collisions keep their `-N` suffix and are treated as distinct roots.

## Reading time

Computed at render in the post page, not stored:

```ts
const readingTime = Math.ceil(post.content.split(/\s+/).length / 200);
```

Passed to `BlogPostClient` and shown in the article header (`{readingTime} {t('readingTime')}`), 200 words/minute.

## IndexNow ping — `src/modules/blog/utils/indexnow.ts`

`pingIndexNow(urls)` POSTs to `https://api.indexnow.org/indexnow` with `host`, the (intentionally public) `key`, `keyLocation`, and `urlList` (capped at 100). This notifies **Yandex/Bing** within minutes; Google ignores IndexNow, which is fine. Failures are logged (`warn`) and swallowed — never fatal.

```ts
const INDEXNOW_KEY = '46b87b7e04b9d4a6adb8fc722995bde5';
// verified by fetching https://<host>/46b87b7e04b9d4a6adb8fc722995bde5.txt
```

Ownership is proven by `public/46b87b7e04b9d4a6adb8fc722995bde5.txt` (contents = the key). The ping fires from the admin post route on publish — both the `PUT` handler (`status === 'published'`) and the `PATCH` handler (`patch.status === 'published'`, the real admin publish path) in `src/app/api/admin/posts/[id]/route.ts`. It is **awaited**, because a fire-and-forget promise can be killed when the serverless instance suspends after responding.

## Search Console & Yandex over MCP

These are **developer/agent tools**, not part of the deployed app — used to inspect indexing status and query analytics from inside this repo. Both are declared in `.mcp.json` and launched via `package.json` scripts:

| MCP server | Launch | Wrapper | Required env |
| --- | --- | --- | --- |
| `searchconsole-mcp` | `yarn mcp:searchconsole` | `scripts/searchconsole-mcp.js` → `npx @vmandic/searchconsole-mcp` | `GSC_SERVICE_ACCOUNT_JSON_BASE64` |
| `yandex-webmaster` | `yarn mcp:yandex-webmaster` | `scripts/yandex-webmaster-mcp.js` → `npx yandex-webmaster-mcp` | `YANDEX_WEBMASTER_TOKEN` (+ `YANDEX_WEBMASTER_HOST_URL`, default `https://softwhere.uz`) |

`scripts/searchconsole-mcp.js` base64-decodes the service-account JSON, writes it to a `0600` temp file, points `GOOGLE_APPLICATION_CREDENTIALS` at it, and cleans up on exit. Both wrappers load `.env.local` (populated by `yarn mcp`, which pulls production env from Vercel). Yandex site ownership is additionally verified by `public/yandex_f08533a1b0b3541d.html`.

Once running, the tools expose (among others) `gsc_search_analytics`, `gsc_inspect_url`, `gsc_list_sitemaps` and Yandex `get-summary`, `get-indexing-history`, `submit-recrawl`, `get-recrawl-quota`. See [mcp.md](./mcp.md) for the full MCP setup.

## Image & CSS config — `next.config.mjs`

Not SEO endpoints, but they shape crawl/render quality:

- `images.formats: ['image/avif', 'image/webp']`, `minimumCacheTTL: 2592000` (30 days), `remotePatterns` allow-lists `images.unsplash.com`. The same allow-list decides whether a blog `<img>` is upgraded to `next/image` (Unsplash) or served as a plain tag.
- `experimental.inlineCss: true` inlines the global CSS into the HTML — a latency/LCP win for far-from-region visitors (Core Web Vitals feed ranking).
- next-intl is wired via `createNextIntlPlugin('./src/core/i18n.ts')`.

## Related docs

- [blog-pipeline.md](./blog-pipeline.md) — how posts (and their `metaDescription`, keywords, cover images, `generationGroupId`) are generated.
- [mcp.md](./mcp.md) — full MCP server catalog and env setup, including Search Console + Yandex.
- [i18n.md](./i18n.md) — locales, `next-intl`, and the `/`→`/uz` redirect that hreflang and the sitemap account for.
- [api-reference.md](./api-reference.md) — the admin post routes that trigger the IndexNow ping, plus `/api/og`.
- [architecture.md](./architecture.md) — the core → shared → modules → app layering these files sit in.
- [database.md](./database.md) — the `blog_posts` table and repository layer feeding every generator here.
- [../README.md](../README.md) — project overview.

_Last verified against code: 2026-07-03._
