# Idea: Analytics after Vercel (PostHog, with Cloudflare as a second view)

> **Status:** idea, not built. Researched 2026-10-01. What to track, and the cookie rules for each domain, are in the Global Playbook (section 12) and [06-growth-and-trust.md](./06-growth-and-trust.md); this file is how to replace Vercel's analytics so nothing is lost when the site moves to its own server ([07](./07-own-server.md)). No Google Analytics: the founders don't want it.

## Is PostHog free for us? Yes

PostHog Cloud's free allowance, every month (it resets on the 1st), as reported by several 2026 pricing guides; PostHog's own pages were blocked from the research environment, so confirm on posthog.com/pricing:

| Product | Free each month |
| --- | --- |
| Analytics events (web analytics and product analytics share this allowance) | 1,000,000 |
| Session recordings | 5,000 web, 2,500 mobile |
| Feature flag requests | 1,000,000 |
| Error tracking | 100,000 exceptions |
| Survey responses | 1,500 |

- **What 1 million events means for us:** a visit produces roughly 5–20 events (page views, page leaves, web vitals, a few clicks and named events). Even at 20 per visit, that's about 50,000 visits a month before anything is charged, far above today's traffic.
- **After the allowance**, anonymous events cost about $0.00005 each (around $5 per extra 100,000), and each product is metered separately. PostHog says 97% of companies stay on the free tier.
- **Set a billing limit of $0** in PostHog's billing settings, so nothing is ever charged without a decision.
- If the volume ever gets close, turn off autocapture and keep only the named events.

## What Vercel shows today, and where to find it after the move

| Vercel today | PostHog | Cloudflare Web Analytics (free) |
| --- | --- | --- |
| Visitors, page views, bounce rate | Web analytics dashboard: visitors, page views, sessions, session length, bounce rate | Visits, page views |
| Top pages | Paths, entry and exit pages | Top pages |
| Referrers | Referrers, channels (search, social, direct) and UTM tags | Referrers |
| **Countries** | Countries on a map, plus cities, from an IP lookup | Countries |
| Devices, browsers, operating systems | Yes | Yes |
| Custom events from `trackEvent` (**recorded nowhere today**: Vercel's Hobby plan drops them) | Recorded, with funnels, trends and retention | No |
| Speed Insights (Core Web Vitals) | Web vitals (LCP, INP, CLS, FCP) | Core Web Vitals (LCP, INP, CLS), filterable by page, country and browser |
| Not available | Session replay (only after consent), heatmaps, surveys, error tracking | Not available |

Cloudflare's normal traffic dashboard also shows **every request by country**, bots included, with no script at all. That is the closest match to "where are the requests coming from", and it comes free once the domain is on Cloudflare.

## How to set it up

1. **PostHog Cloud EU** (data stays in Frankfurt; accept the data processing agreement). One project for both domains, filtered by host.
2. **Install `posthog-js`.** Initialise it once on the client, either in `src/instrumentation-client.ts` (supported since Next.js 15.3; check that `eslint.config.mjs` boundaries accept the file) or in a small client provider in `src/shared/` mounted in `src/app/[locale]/layout.tsx`. Settings:
   - `api_host: '/ingest'` (see step 3) and `ui_host: 'https://eu.posthog.com'`.
   - `cookieless_mode: 'always'` on softwhere.uz, so no banner is needed. PostHog then counts unique visitors with a hash of the IP address, user agent and a salt that changes daily and is deleted. Session replay and identified users don't work in this mode.
   - softwhere.app: `cookieless_mode: 'on_reject'` with an Accept/Reject banner (playbook). Replay only after Accept, and only on the estimator and contact pages.
   - Page views on client-side navigation (PostHog's Next.js guide: `capture_pageview: 'history_change'`).
   - Turn on web vitals autocapture in the project settings, to replace Speed Insights.
3. **Send events through the site's own domain**, as Vercel does with `/_vercel/insights`, so ad blockers don't drop them. Add rewrites to `next.config.mjs`:

   ```js
   async rewrites() {
     return [
       { source: '/ingest/static/:path*', destination: 'https://eu-assets.i.posthog.com/static/:path*' },
       { source: '/ingest/:path*', destination: 'https://eu.i.posthog.com/:path*' },
     ];
   },
   skipTrailingSlashRedirect: true,
   ```

   **Also add `ingest` to the exclusions in the `matcher` of `src/proxy.ts`.** Otherwise the locale middleware redirects `/ingest` to `/uz/ingest` and every event is lost.
4. **Swap one file.** Every event already goes through `trackEvent` in `src/shared/utils/analytics.ts`. Replace `track(name, props)` from `@vercel/analytics` with `posthog.capture(name, props)`. All 14 event types keep their names, and the estimator funnel (`estimator_start` → `estimator_complete` → `estimator_lead_submit`) starts recording for the first time.
5. **Record leads on the server too:** capture `lead_created` after the lead is saved, through a small `posthog-node` client in `src/core/` (infrastructure, like `ai.ts`), so ad blockers can't hide conversions. Send no names, phones or emails to analytics, only the source and locale.
6. **Cloudflare Web Analytics:** once the DNS is on Cloudflare and proxied, switch it on in the dashboard. It adds its small script automatically; no code changes.
7. **Security headers:** when the planned Content-Security-Policy goes in, allow `static.cloudflareinsights.com` for scripts. PostHog needs nothing extra because it runs through `/ingest`.
8. **Privacy policy:** rewrite `privacy.analyticsBody` and `privacy.storeBody` in `src/messages/{uz,ru,en}.json`, which name Vercel today. Name PostHog Cloud EU (cookieless) and Cloudflare instead.

## Switching over without losing history

- **Start PostHog 2–4 weeks before leaving Vercel,** with `<Analytics />` and `<SpeedInsights />` still in the layout, and compare the numbers week by week.
- **Vercel's history doesn't move.** Before the cutover, save the last 30 days (countries, referrers, top pages, Web Vitals) as screenshots or notes, as the baseline.
- At the cutover, remove `<Analytics />`, `<SpeedInsights />`, `@vercel/analytics` and `@vercel/speed-insights`, and the `_vercel` exclusion in `src/proxy.ts`.

## Not chosen

| Option | Why not |
| --- | --- |
| Google Analytics | The founders don't want it: consent banner, data to Google |
| Umami or Plausible, self-hosted | Light and good, but one more service to run and back up, and PostHog also does funnels, replay, surveys and errors. Umami is the fallback if PostHog's free tier changes |
| Vercel Analytics | Only works on Vercel |

## Sources

- PostHog pricing guides, 2026: <https://rybbit.com/blog/posthog-pricing>, <https://flexprice.io/blog/posthog-pricing-guide>, <https://schematichq.com/blog/posthog-pricing>
- PostHog web analytics pricing (billed as product analytics events): <https://posthog.com/web-analytics/pricing>
- PostHog web analytics getting started: <https://posthog.com/docs/web-analytics/getting-started>
- PostHog cookieless tracking: <https://posthog.com/tutorials/cookieless-tracking>
- PostHog and cookie banners (GDPR, CCPA): <https://www.probo.com/blog/2026-05-27-posthog-cookie-banner-gdpr-ccpa-compliance>
- Cloudflare Web Analytics, Core Web Vitals: <https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/>
- Cloudflare Web Analytics limits (review): <https://clycyo.com/blog/cloudflare-web-analytics-review-limits/>
- Why Vercel custom events read zero today: `docs/seo-measurement-2026-09.md`
