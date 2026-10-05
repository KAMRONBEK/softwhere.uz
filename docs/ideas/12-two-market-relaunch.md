# Plan: Re-launch as two market sites (softwhere.uz + softwhere.app)

> **Status:** decided plan, not built. Founder interview with Claude on 2026-10-05, backed by four research workflows (current blog, search data, estimator and platform; models, images and self-hosting; admin, server fit and design skills; VPS providers). **Where this file disagrees with files 01–11 or with the Global Playbook, this file wins.** The founder marked the Global Playbook as outdated.

## Why

The numbers behind the decisions (90 days to 2026-10-05):

- **Search:** 59 Google clicks from ~6,000 impressions; 49 (83%) from Uzbekistan, Central Asia, Russia and Belarus. EU and US: 4 clicks from ~2,500 impressions (US: 1 from 1,439, partly Uzbek VPN users). Clicks are recovering: 28 in the last 28 days vs 10 before.
- **Leads:** 3 recorded since July (whether they were real is unknown), none since 9 August. Every real client so far came from **referrals**. The site has to start producing leads, and until now it could not even say where a lead came from.
- **Blog:** 165 posts (55 topics × uz/ru/en), all written for Uzbek buyers, even the English ones. 22 contain invented client stories; prices run 3–10× the estimator's. The cause is the generation prompt ("write as a founder who shipped products"), not the model.
- **Hosting:** Vercel Hobby is non-commercial and lists advertising a service as commercial use, so ads can't run on it. It also never recorded the estimator's custom events.
- **Email:** the `softwhere.uz` MX record points at Vercel's web server and there are no SPF/DKIM/DMARC records, so mail to `@softwhere.uz` is probably not arriving.

## Decisions

### Markets and brand

| Topic | Decision |
| --- | --- |
| softwhere.uz | Uzbek + Russian only. Uzbekistan and Central Asia. **Russian is a language for Central Asian buyers, not a Russia market** (no Google Ads in Russia; 152-FZ bans collecting Russians' data abroad). |
| softwhere.app | English only at launch, for the EU and Americas. Other languages only after English produces leads and a native reviewer exists. A **bet on a new market**: there are no foreign clients yet. |
| Positioning (.app) | Global brand, location low-key, never hidden: the About page and contracts state the Tashkent base. Priced as an offshore team clearly below Western agencies. |
| When .app goes live | Built hidden now, launched **after the 2026-12-02 SEO gate** (`docs/seo-measurement-2026-09.md`). Until then softwhere.app stays a redirect. |
| English on softwhere.uz | **Removed** when .app launches. |
| How a visitor's market is chosen | From the **domain only** (Host header), never from IP or the browser. A dismissible "switch edition" banner can use the country header. No automatic redirects. |
| Design | **One design system, two markets.** Logo refreshed, name kept. The current "Ember" orange-on-black look is replaceable (it matches a common AI-generated default). New fonts must cover Cyrillic (Sora doesn't). Claude researches what works for software agencies and shows **3 clickable mockup directions**; the founder picks one. |
| Design skills | Install `Impeccable` (project scope, `--no-hooks`), the official `shadcn` skill and `vercel-react-view-transitions` when design work starts. Anthropic's `frontend-design` is already in `.claude/skills/`. |

### Selling

| Topic | Decision |
| --- | --- |
| .uz services pushed | Telegram bots and Mini Apps, AI automation for business, websites and landing pages, mobile apps and marketplaces. |
| .app services leading | MVPs for startups, mobile apps, web platforms and marketplaces. |
| .app price level | About **$40–45/h** blended. |
| Currencies | .uz: **fixed so'm price book**, reviewed quarterly or when the rate moves more than 10%. .app: **USD and EUR set separately** as round prices. |
| Price list | "From $X" plus what's included. Offers: landing; landing + admin; marketplace (admin always included, so "marketplace + admin" is merged into it); marketplace + app (needs bundle pricing in the estimator first); AI agent automation; **Telegram bot / Mini App (.uz)** and **website AI assistant (.app)** in place of one "chatbot"; standalone mobile app; corporate website / CMS. Each offer is an estimator preset, with a test that keeps ads, price list and estimator in agreement. |
| Ads | Google Ads in **Uzbekistan first**, after the server move. Western ads only after .app launches. Conversions at the start: **form submit + call booked**; report "qualified" and "won" back to Google later. Click IDs (gclid/gbraid/wbraid) and UTM tags are captured from day one, because they can't be backfilled. |
| .app contact | Book a call (**Cal.com free**, connected to the founder's Google Calendar), email form, **hello@softwhere.app**, WhatsApp on the **existing +998 number**. Reply promise: **within 1 business day**. The .uz pages never show the .app address, and vice versa. |
| .uz contact | A **SoftWhere Telegram bot** that greets in the visitor's language, records the source page or ad, and forwards to the team. |
| Payments (foreign) | Payoneer / Wise. |
| Invoices and contracts | Invoices stay outside the platform (Uzbek state e-invoicing). A contract template generator comes later. |

### Estimator

- One engine, two market profiles (as in [03](./03-estimator-remake.md)), with the market taken from the domain.
- The experience: an **AI conversation** plus a **visual app preview** that builds up as features are chosen, plus a **live price meter**. It ends with a **price range and a book-a-call step**.
- The price range is **always shown openly**. The full **project brief / ТЗ PDF** is the contact step: delivered by Telegram (.uz) or email (.app), marked as a non-binding draft.
- What visitors type goes **only to US/EU AI providers**, because China isn't on Uzbekistan's adequacy list. Kimi and DeepSeek may still draft public blog text, which contains no personal data.

### Admin panel ("one admin, market filter")

- **Payload CMS 3** inside the same Next app. Next.js must be upgraded to at least 16.3.3 first, with a Payload 4 upgrade planned later. The existing `blog_posts` and `leads` tables must be kept or migrated deliberately, never dropped.
- **Team logins with roles** (sales, content editor, developer).
- **First version:**
  - A lead pipeline: market, language, source, UTM, click IDs, landing page, stage, notes, tasks, and a "test lead" flag.
  - Email inside the lead (**Resend**, replies threaded into the lead).
  - Cal.com bookings attached to leads.
  - Editing blog posts, price-list offers, portfolio items and videos, per market.
- **Documents:**
  - Free spec / ТЗ PDF for visitors.
  - Proposal (КП) generator from a lead.
  - Contracts later; invoices never (see above).
  - PDFs rendered by Gotenberg (headless Chromium) from the app's own templates; prices always come from the estimator formula.
- **Alerts** go to Telegram: leads (with one-tap stage buttons), downtime, errors, failed backups.

### Blog

- **Done now (approved):** remove every invented client story, unpublish the broken posts (3 truncated Uzbek posts, the mistranslated title, unverifiable claims), and **pause the weekly generator**.
- **Scope (researched, [13-blog-plan.md](./13-blog-plan.md)):**
  - softwhere.uz keeps about 20 uz+ru topics. About 6 of them get a founder rewrite in the first year, starting in January 2027 with the Mini App vs website vs app post (T10), at its existing URLs. About 35 topics are redirected or unpublished. On the founder's choice, **this happens early**: after the spam update settles and the baseline is recorded (about 2026-10-22), and before 2026-12-02. It is never in the same week as the server or DNS move.
  - softwhere.app starts with **no** migrated posts. It launches with 2 new posts built from real portfolio work, then adds about one a month. The old English posts are unpublished, not moved.
  - The generator was **disabled on 2026-10-05** (`gh workflow enable "Generate Blog Post"` reverses it).
- **Capacity:** **1–2 genuinely good posts a month**, AI spend **at most $50/month** in total.
- **Writing model:** chosen by a **blind test**. 3–4 top models write the same briefs per language, and the founder scores them without knowing which is which.
- **Input:** the founder's **async voice notes** for in-depth posts; AI plus cited public sources for supporting posts. No invented experience, ever.
- **Byline and review:** posts are written under **Kamronbek Juraev, founder, with name and photo**. The founder reviews every post. Each carries an "AI-assisted, reviewed by …" note on both sites.
- **Visuals:** **real material first**: frames and screenshots from the 54 project videos, code-drawn diagrams, native charts. AI images only for generic scenes, never fake people or products (EU AI Act Art. 50 labelling applies on .app).
- **First free tool:** a Telegram Mini App vs mobile app vs web calculator, built on the estimator engine and embedded in the related posts.

### Platform

| Need | Decision |
| --- | --- |
| Hosting | **Contabo Cloud VPS 6**, EU region (Germany): 6 shared vCPU, 12 GB, 100 GB NVMe, IPv4. **1-month term, EUR account**, paid by the founder personally with a physical Uzbek Visa/Mastercard: €7.50 + 12% Uzbek VAT = **€8.40/month**, no setup fee. When ordering, switch the term from the preselected 24 months to "1 Month" and pick EUR (in USD it costs $10.08). Benchmark CPU steal (`vmstat`, `yabs.sh`) and Tashkent latency (~110 ms) in week one. Cancelling needs ~4 weeks' notice. **Plan B:** Hostkey VPS Standard v2-mini ($7.40, 4 vCPU / 8 GB / 120 GB NVMe, Germany or Finland, never the Netherlands). About 45 plans were compared on 2026-10-05; Hetzner, netcup, OVH, Hostinger, IONOS, Strato, the US clouds and the Uzbek hosts each failed the $7–10 / monthly / no-setup-fee rules. |
| Move order | **Server move first**, as a pure move: same URLs, same pages, nothing else changing. It also ends the Vercel Hobby commercial-use problem before ads. Vercel stays as a rollback for 2–4 weeks. |
| Deploys | GitHub-hosted runners build the Docker image, push it to GHCR, then `docker compose pull && up -d` over SSH (Kamal 2 is the alternative). **No Coolify or Dokploy** (critical 2026 CVEs), and no CI runner on the server (the repo is public). |
| App | Next.js standalone, **one process serving both hostnames**, behind Caddy. |
| Database | **PostgreSQL on the server**, with nightly encrypted backups (restic) to Cloudflare R2 and a monthly restore drill. Neon is kept as a fallback for about a month after cutover. |
| Analytics | **Umami** self-hosted (cookieless: visitors, sources, countries, speed / Web Vitals, funnels) **+ PostHog Cloud EU free** (session recordings, heatmaps, deeper estimator funnels). Export Vercel Analytics before switching (only one month of history is kept). |
| Consent | Cookieless analytics need no banner. On .app, session replay and the Google Ads tag load only after consent (Consent Mode v2). Privacy policy rewritten per edition. |
| Errors | **Bugsink** self-hosted, fed by the official `@sentry/nextjs` SDK, so moving to Sentry later is a one-line change. |
| Uptime | UptimeRobot (outside the server) plus Healthchecks.io for backup and cron heartbeats. |
| Files and video | A Docker volume served by Caddy (uploads, PDFs, the 54 walkthrough MP4s). |
| DNS | Stays at **ahost until the server move**, then moves to Cloudflare (softwhere.app proxied; softwhere.uz DNS-only because Russian ISPs throttle Cloudflare-proxied sites). Copy every mail record as DNS-only. |
| Email (decided 2026-10-05) | Kept **separate per market**. **softwhere.app:** one mailbox, **hello@softwhere.app**, on **Zoho Mail Forever Free** (EU data centre; $0, one domain, Zoho Mail apps, no IMAP); if the free plan isn't offered, Zoho Mail Lite at $12/year. **softwhere.uz:** no mailbox, contact by Telegram and phone, and the domain locked against spoofing (null MX `0 .`, SPF `v=spf1 -all`, DMARC `p=reject; sp=reject`). **Website sending:** Resend free tier from `notify.softwhere.app` / `notify.softwhere.uz` (region eu-west-1), never the root domains. Avoid the `mail.*` names, because ahost created CNAMEs there. **Ruled out:** forwarding to Gmail with "Send mail as", because Gmail removes Send-as for non-Google addresses in January 2027 (support.google.com/mail/answer/17101213, checked 2026-10-05); and Google Workspace (€6.12–6.80/month), which isn't needed for one address. |
| Spam | Cloudflare Turnstile on every public form, checked on the server. |
| Data location | Lead data on the EU server is lawful under Uzbekistan's March 2026 amendment and Resolution 415. The founder accepted the research and is not seeking a separate legal check. |

### Social and trust

- **Instagram:** keep @softwhere_uz for Uzbek content. **Reserve** an .app handle but don't run it.
- **LinkedIn:** a **company page** is needed before .app launches; none exists yet. Claude drafts the copy.
- **Clutch reviews:** not now. Trust on .app comes from the 54 portfolio videos and **4–6 case studies**, which Claude proposes and the founder approves (client names only with permission).
- **Google Business Profile and Yandex Business:** a **service-area listing with the address hidden** (home office).
- **Instagram DM assistant** ([08](./08-instagram-assistant.md)): later.

## Order of work

1. **Now, on the current site:**
   - The approved blog trust fixes and the generator pause.
   - Request Indexing on the uz/ru service pages.
   - Export the Vercel Analytics numbers.
2. **Server move** to the chosen VPS, plus Postgres, Umami, Bugsink, backups, uptime monitoring, Turnstile, and the DNS move to Cloudflare with fixed email records. URLs unchanged.
3. **Lead tracking foundation:**
   - Lead record v2 (source, click IDs, market).
   - The email field.
   - The Telegram bot inbox.
   - The privacy policy rewrite.
4. **.uz price list** in so'm, then a **small Uzbekistan Google Ads test**.
5. **Built hidden, in parallel:**
   - The redesign (3 mockup directions first).
   - The Payload admin.
   - The estimator remake.
   - Case studies.
   - The .app edition.
6. **After 2026-12-02:**
   - Launch the redesign and softwhere.app.
   - Remove /en on .uz, with per-page redirects where a .app page exists.
   - Start the blog rebuild at 1–2 posts a month.
7. **Later:**
   - The КП generator and contract templates.
   - Instagram assistant.
   - Western Ads.
   - More .app languages.

## Not now

A/B tests (traffic is far too low), lead scoring, a client portal or project rooms, invoices, self-hosted Sentry, PostHog, Cal.com or a CRM like Twenty, a mail server, and a Coolify/Dokploy panel.

## What this replaces in earlier files

- **[07 own server](./07-own-server.md):**
  - "Coolify" is replaced by GitHub-built images and Docker Compose.
  - "Keep Neon / move the database first" is replaced by Postgres on the server.
  - "netcup RS 1000 G12.5 or OVH VPS-1" is replaced by Contabo Cloud VPS 6: netcup and OVH only reach that price with a 12–24-month contract.
- **[10 analytics](./10-analytics.md):** "PostHog Cloud EU + Cloudflare Web Analytics" is replaced by Umami self-hosted + PostHog Cloud EU.
- **[02 blog engine](./02-blog-engine.md):**
  - The writer model is no longer fixed to Claude Opus 5.5; a blind test picks it, within $50/month.
  - The cadence is 1–2 posts a month.
- **[03 estimator](./03-estimator-remake.md):** "Rates from the Global Playbook" becomes $40–45/h with separate USD and EUR books.
- **[README](./README.md):**
  - "Legal entity and payment route": Payoneer / Wise.
  - "Which domain serves which market": decided as above.
  - "Who edits the blog": the founder.

## Research status

All research for this plan is complete (2026-10-05). The VPS choice is in the Platform table above. The blog plan, with the per-topic actions and the first four posts and their voice-note questions, is in [13-blog-plan.md](./13-blog-plan.md).
