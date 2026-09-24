# Idea: What our own server makes possible

> **Status:** idea, not built. Researched 2026-09-24. The migration plan itself (server size, phases, cutover after the 2026-10-03 gate) is in the Global Playbook; this file covers what the server lets the site do.

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
  - Dokploy is a close alternative.
  - Kamal (from 37signals) is leaner but terminal-only.
  - All three run fine on a 4 vCPU / 8 GB server.
- **Put Cloudflare in front** (free plan) for the CDN, DDoS protection, and Turnstile for forms and the assistant. Vercel's global edge goes away with the move. Static pages and images should be cached close to US visitors, while the server stays in Germany near the Neon database, which today runs next to Vercel's Frankfurt (`fra1`) region.
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
| **Umami / Plausible** | PostHog already covers analytics |

**Never self-host:**

| What | Why |
| --- | --- |
| **Email sending** | Deliverability from a fresh server IP is a losing fight; use Postmark or Resend, and SES for the newsletter |
| **The main database** | Neon keeps backups, point-in-time restore and upgrades off our plate |

## Backups and safety

- Turn on Hetzner's server backups (daily, small extra cost) and keep Neon's point-in-time restore.
- Back up uploaded files and generated PDFs to object storage (Hetzner Storage Box or Cloudflare R2).
- **Secrets:** environment variables in Coolify, never in the repo. Rotate the keys that lived in Vercel after cutover.
- **Watch:** Uptime Kuma for uptime; a daily Telegram summary of failed jobs; disk and memory alerts.

## Order of work

| Step | What | Effort |
| --- | --- | --- |
| 1 | The migration itself (Global Playbook phases), Cloudflare in front, backups | Medium |
| 2 | pg-boss worker with the first jobs: acknowledgement email, founder reminders | Small–medium |
| 3 | Uptime Kuma with a status page | Small |
| 4 | Listmonk with SES for the monthly founder letter | Small |
| 5 | Long-running blog pipeline steps and PDF generation on the server | Medium |

## Sources

- Coolify vs Dokploy vs Kamal (2026): <https://www.bitdoze.com/coolify-vs-dokploy-vs-kamal-2/>
- pg-boss and Next.js background jobs: <https://render.com/articles/nextjs-background-jobs-postgresql-production>
- n8n self-hosting requirements: <https://vps.us/blog/n8n-self-hosting-requirements>
- Uptime Kuma: <https://github.com/louislam/uptime-kuma>
- Listmonk: <https://listmonk.app/>
