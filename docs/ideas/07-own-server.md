# Idea: Our own server, without losing anything Vercel gives us

> **Status:** idea, not built. Researched 2026-09-24; updated 2026-10-01 with the server choice, a checklist of everything Vercel does for the site today, and a warning about the database. The business case and the phases (cutover after the 2026-10-03 SEO gate) are in the Global Playbook, section 12. Analytics after Vercel: [10-analytics.md](./10-analytics.md). Environment variables in Doppler: [11-secrets-doppler.md](./11-secrets-doppler.md).

## Which server

Checked in late September 2026. Prices change often, so confirm at checkout.

| Plan | Specs | Price per month | Verdict |
| --- | --- | --- | --- |
| **netcup RS 1000 G12.5**, Nuremberg | 4 **dedicated** AMD EPYC cores, 8 GB ECC, 256 GB NVMe | ~€9.81 before VAT (sources disagree on a location surcharge of up to ~€2.34) | **Best value.** Dedicated cores mean fast builds and steady performance |
| **OVHcloud VPS-1**, Frankfurt | 4 vCPU (shared), 8 GB, 75 GB NVMe, unlimited traffic, DDoS protection, daily backups | ~€6.50–7.60 (lower with a longer commitment) | **Cheapest good option.** Shared CPU, so builds and busy moments can be slower |
| OVHcloud VPS-2 | 6 vCPU, 12 GB, 100 GB | ~€8.50–10 | More memory, where still sold |
| Contabo Cloud VPS 10, Düsseldorf | 4 vCPU, 8 GB | ~€4.99 (check for a setup fee on monthly terms) | Cheapest with 8 GB, but known for overselling. Budget only |
| netcup VPS, 2 vCPU / 4 GB | 2 vCPU, 4 GB | ~€3.99 at the old G12 price | Only with a lean setup: build in GitHub Actions, run plain Docker Compose, no Coolify (it wants ~2 GB itself) |
| Hetzner CX33 | 4 vCPU, 8 GB | €8.49 | Sold out since early September; the CPX32 you can order costs ~€35 |
| DigitalOcean, Vultr, Linode, IONOS at $2–12 | 0.5–2 GB | | Too small or poor value |

**Recommendation:** netcup RS 1000 G12.5. Take OVH VPS-1 if the lowest good price matters more than steady CPU.

**Put it in Germany, next to the database.** Neon runs in Frankfurt. A server in the US would cross the Atlantic on every query, about 90 ms each, and a blog page makes several. Approximate round trips from a German server:

| From | Round trip |
| --- | --- |
| London, Berlin | ~10–25 ms |
| New York | ~80–90 ms |
| California | ~145–160 ms |
| Tashkent (admin work) | ~70–90 ms |

**Cloudflare in front makes it fast in the US too.** Visitors connect to a nearby Cloudflare location, and cached pages come straight from there; only uncached pages travel to Germany. Cloudflare's paid Argo routing (~$5 a month plus usage) shortens that trip further and is optional. If most leads later turn out to be American, move the server **and** Neon to US East together (netcup Manassas or OVH Virginia; a new Neon project in `aws-us-east-1`, data copied with `pg_dump` and `pg_restore`), and lose the "hosted in the EU" point.

**This server is for the website.** Portfolio videos are recorded on the Mac, because a VPS can't run the iOS simulator or the Android emulator, and served from Cloudflare R2 or Stream ([09-portfolio-media.md](./09-portfolio-media.md)).

## Before anything else: who owns the database?

`docs/deployment.md` says the database was created from Vercel (**Storage → Create → Neon**). If that created a **Vercel-managed** Neon organization:

- Billing runs through Vercel, and **uninstalling the integration deletes the Neon organization**, data included.
- Vercel-managed organizations can't transfer projects to a normal Neon organization.

So, before the cutover:

1. In the Neon console, check whether the organization is managed by Vercel.
2. If it is, create a Neon account of our own with a project in the same region, copy the data (`pg_dump` and `pg_restore`, or Neon's import tool), and point `DATABASE_URL` in Doppler at the new project.
3. Neon Auth lives in the Neon project too. The new project gets a new `NEON_AUTH_BASE_URL`; re-create the admin accounts and test admin sign-in on staging.
4. Only remove the Vercel integration or the Vercel project after the new database has served production for a while and a fresh backup exists.

## Everything Vercel does today, and what replaces it

The rule for the move: nothing the site does today may stop working. Tick every row on the staging host before the cutover.

| What Vercel does today | Where it is | On our own server |
| --- | --- | --- |
| Builds and deploys on every push to `main`, with a preview URL per branch | Vercel project `softwhere-uz` | Coolify (git push to deploy, preview deployments), with its dashboard reachable only over Tailscale (Coolify had 11 critical flaws disclosed in January 2026). Or GitHub Actions builds a Docker image (`output: 'standalone'`) and the server pulls it |
| HTTPS and domains | Vercel dashboard | Cloudflare DNS with "Full (strict)" TLS; Coolify's proxy holds the origin certificate |
| Global CDN for static files and pages | Automatic | Cloudflare cache rules: `/_next/static/*`, `/images/*` and `/icons/*` cached for a long time; HTML for blog, services and home cached at the edge with a short lifetime |
| DDoS, firewall and bot protection | Automatic | Cloudflare free plan: managed rules, bot fight mode, a rate limit on `/api/*`, Turnstile on the forms |
| Image optimisation (`next/image`, AVIF and WebP, 30-day cache) | `next.config.mjs` | Works under `next start` and standalone with `sharp`, already a dependency. The cache is on disk in `.next/cache/images`, so keep it on a persistent volume |
| Page caching and revalidation after a blog write (`revalidateTag`, `revalidatePath`) | `src/modules/blog/utils/revalidate.ts` | Works on one server with the cache on disk (persistent volume). **New work:** Cloudflare's copy must be cleared too, so after `revalidateBlogCaches` call Cloudflare's purge API for the same URLs, or keep the edge lifetime short. Running more than one app container would need a shared cache handler |
| Locale redirects in middleware | `src/proxy.ts` | Works under `next start` (Node) |
| OG images | `src/app/api/og/route.tsx` (`next/og`) | Works under Node |
| Function time limits (30 s; 60 s for the estimator) | `vercel.json`, route `maxDuration` | No platform limit. Keep the timeouts in code (`safeGenerateJSONWithTimeout`) and set a proxy timeout of about 120 s. Delete `vercel.json` after the cutover |
| Region `fra1`, next to Neon | `vercel.json` | The server in Germany |
| Web Analytics: visitors, pages, referrers, **countries**, devices | `<Analytics />` in `src/app/[locale]/layout.tsx`; events in `src/shared/utils/analytics.ts` | PostHog Cloud EU, with Cloudflare Web Analytics as a free second view ([10](./10-analytics.md)) |
| Speed Insights (Core Web Vitals) | `<SpeedInsights />` in the same layout | PostHog web vitals and Cloudflare's Core Web Vitals report ([10](./10-analytics.md)) |
| Runtime logs | Vercel dashboard | Container logs in Coolify, rotated so the disk doesn't fill; errors to PostHog error tracking (free to 100,000 a month) or Sentry; Uptime Kuma for uptime |
| Environment variables per environment | Vercel dashboard; `yarn env:pull:*` | Doppler ([11](./11-secrets-doppler.md)) |
| Instant rollback | Vercel dashboard | Coolify redeploys an earlier build; keep the last few images. During the 2–4 weeks Vercel stays up, rolling back is one DNS change |
| Scheduled jobs | None on Vercel; the blog runs in GitHub Actions | Unchanged; their secrets come from Doppler's GitHub sync |
| Node 24 | `package.json#engines`, `.nvmrc` | A `node:24` base image |

The code reads no `VERCEL_*` variables (checked 2026-10-01), so nothing depends on Vercel's own environment variables.

**After the cutover, update:**

- The code:
  - Remove `@vercel/analytics`, `@vercel/speed-insights` and `vercel.json`.
  - Replace the `env:pull:*` scripts in `package.json`.
  - Remove `_vercel` from the matcher in `src/proxy.ts`.
- The privacy policy in `src/messages/{uz,ru,en}.json`: `analyticsBody` and `storeBody` name Vercel.
- The docs:
  - `docs/deployment.md`, `docs/environment.md`, `README.md`.
  - The "deployed on Vercel" lines in `CLAUDE.md`.

## What changes when we leave Vercel

On Vercel, every request is a short-lived function: 30 seconds at most, 60 for the estimator (`vercel.json`), and no background work. That is why the blog runs from GitHub Actions and why nothing can "send this email in two days". A server that is always on removes that limit.

| Now possible | Used by |
| --- | --- |
| **Background jobs and schedules** (send later, retry, run every Monday) | Follow-ups and reminders, weekly owner dashboard, monthly app health reports, rebuilding the assistant's knowledge pack |
| **Long-running tasks** (minutes, not seconds) | Blog research and drafting, voice-note transcription, PDF generation for briefs and proposals |
| **Webhooks that do real work** | Inbound email, Cal.com bookings, Telegram button presses |
| **Small self-hosted tools next to the site** | Status page, e-sign, newsletter |
| **Files on disk** | Room attachments, generated PDFs (with backups) |

## Recommended setup

- **Deploy with Coolify.** It's a Vercel-like dashboard on your own server (git push to deploy, previews, logs, TLS, one-click databases and apps).
  - Keep its dashboard behind Tailscale, never public.
  - Dokploy is a close alternative.
  - Kamal (from 37signals) is leaner but terminal-only.
  - All three run fine on a 4 vCPU / 8 GB server.
- **Put Cloudflare in front** (free plan) for the CDN, DDoS protection, and Turnstile for forms and the assistant. Vercel's global edge goes away with the move.
- **Jobs with pg-boss**, a job queue that lives in Postgres. There's no Redis to run, and the jobs sit next to the data.
  - pg-boss needs a normal TCP connection to Neon.
  - The site's code uses Neon's HTTP driver, which can't hold the connections pg-boss needs.
  - So the worker gets its own `pg` connection and connection string.
  - Keep the worker code in `src/core/jobs.ts` (infrastructure), called by modules.
- **Keep GitHub Actions for what already works** (the blog cron, audits): free, logged, independent of the server. Move a job to pg-boss only when it needs to react to something in the app.

## Small tools worth running on the server

| Tool | Why | Memory (approx.) |
| --- | --- | --- |
| **Uptime Kuma** | Monitors softwhere.app and, for care-plan clients, their APIs; a public status page for each client is a nice care-plan extra | ~100 MB |
| **Listmonk** | Newsletter (the Global Playbook plan), sending through Amazon SES | ~50–100 MB (its database can be a separate Neon database) |
| **DocuSeal** (later) | Self-hosted e-signing for project rooms | ~300–500 MB |
| **Whisper (whisper.cpp)** (optional) | Transcribing founders' voice notes for the blog, on the CPU | Only while running |

**Probably not on this server:**

| Tool | Why not |
| --- | --- |
| **n8n** | Wants about 2 vCPU and 4 GB to itself in production; the few flows we need are easier in the app |
| **Cal.com** | Its free cloud plan is enough; self-hosting is another full Next.js + Postgres app |
| **Chatwoot** | A Rails + Redis stack for a shared inbox the admin will have anyway |
| **Umami / Plausible** | PostHog covers analytics ([10](./10-analytics.md)) |

**Never self-host:**

| What | Why |
| --- | --- |
| **Email sending** | Deliverability from a fresh server IP is a losing fight; use Postmark or Resend, and SES for the newsletter |
| **The main database** | Neon keeps backups, point-in-time restore and upgrades off our plate |

## Backups and safety

- Turn on the provider's backups (OVH VPS includes daily backups; netcup offers snapshots) and keep Neon's point-in-time restore.
- Back up uploaded files and generated PDFs to object storage (Cloudflare R2).
- **Secrets** live in Doppler, never in the repo or typed into the Coolify dashboard ([11](./11-secrets-doppler.md)). Rotate the keys that lived in Vercel after the cutover.
- **Watch:** Uptime Kuma for uptime; a daily Telegram summary of failed jobs; disk and memory alerts.

## Order of work

| Step | What | Effort |
| --- | --- | --- |
| 1 | Check who owns the Neon database; move it first if Vercel manages it | Small–medium |
| 2 | PostHog and Cloudflare Web Analytics running next to Vercel Analytics, 2–4 weeks before the cutover ([10](./10-analytics.md)) | Small |
| 3 | Doppler: import the variables from Vercel; switch local development and GitHub Actions to it ([11](./11-secrets-doppler.md)) | Small |
| 4 | The server, Cloudflare, Coolify over Tailscale, a hidden staging host; tick every row of the checklist above | Medium |
| 5 | Cutover (Global Playbook phase 2), Vercel kept 2–4 weeks for rollback; then the clean-up list above | Small |
| 6 | pg-boss worker with the first jobs: acknowledgement email, founder reminders | Small–medium |
| 7 | Uptime Kuma with a status page; Listmonk with SES for the monthly founder letter | Small |
| 8 | Long-running blog pipeline steps and PDF generation on the server | Medium |

## Sources

- netcup RS 1000 G12.5: <https://www.netcup.com/en/server/root-server/rs-1000-g12-ip-iv-12m>
- netcup G12.5 price increase: <https://netcupvoucher.com/blog/netcup-g12-5-price-increase-2026>
- OVHcloud VPS: <https://us.ovhcloud.com/vps/>
- OVHcloud price changes: <https://blog.ovhcloud.com/en/posts/pricing-evolution-of-public-cloud-bare-metal-and-vps-at-ovhcloud/>
- Hetzner price adjustment, June 2026: <https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/>
- Cheapest VPS in Europe, 2026: <https://vpslocate.com/guides/cheapest-vps-europe-2026.html>
- Neon regions: <https://neon.com/docs/introduction/regions>
- Neon region migration: <https://neon.com/docs/import/region-migration>
- Neon's Vercel-managed integration (uninstalling deletes the organization): <https://neon.com/docs/guides/vercel-managed-integration>
- Neon project transfers (not supported for Vercel-managed organizations): <https://neon.com/docs/manage/orgs-project-transfer>
- Coolify vs Dokploy vs Kamal (2026): <https://www.bitdoze.com/coolify-vs-dokploy-vs-kamal-2/>
- pg-boss and Next.js background jobs: <https://render.com/articles/nextjs-background-jobs-postgresql-production>
- n8n self-hosting requirements: <https://vps.us/blog/n8n-self-hosting-requirements>
- Uptime Kuma: <https://github.com/louislam/uptime-kuma>
- Listmonk: <https://listmonk.app/>
