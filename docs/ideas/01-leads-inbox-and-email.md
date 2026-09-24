# Idea: Leads inbox, email and follow-ups in the admin

> **Status:** idea, not built. Researched 2026-09-24. Prices and rules change; check the vendor page before buying anything.

## The problem today

- **Neither form asks for an email address.** `/api/contact` and `/api/estimate/lead` require a name and a phone number (at least 9 digits), and the estimator offers "call" or "Telegram" as the way back (`src/app/api/estimate/lead/route.ts`, `src/modules/contact/model/Lead.ts`). That fits Tashkent. A founder in Austin or Berlin expects to leave an email and get an email. For the global site this is the first thing to fix, before any new feature.
- **Every lead goes to one Telegram chat.** The `leads` table is a good system of record (stored first, then Telegram, with `notifiedTelegram` as a retry queue), but the admin page only lists rows. There are no statuses, notes, reminders or replies, and no history per person.
- **Replies happen outside the system.** Whatever the founders write back in Telegram, WhatsApp or Gmail is not saved anywhere the other founder can see.

## What to build

A small "CRM-lite" inside the existing admin, on the same Neon database, rather than a second app. The research compared Twenty, Atomic CRM, EspoCRM, SuiteCRM, Krayin, Chatwoot, FreeScout, Zammad, HubSpot Free, Attio and folk. For two people selling, every self-hosted option adds a second login, a second data model to keep in sync with `leads`, and often a second database engine (MySQL) on a server the team is running for the first time. HubSpot Free (2,000 marketing emails a month, 1 pipeline) and Attio Free (3 seats, 200 emails per user a month) are fine as a stopgap for a week, not as the home for follow-up sequences.

### 1. Forms that work for both markets

- Email becomes the required contact on the global site; phone and Telegram become optional. The local site can keep phone-first.
- Add "How did you hear about us?" and, on the contact form, "What do you need?" (new app, AI feature, rescue, extra engineers, website), so leads arrive already sorted.
- After submitting, show a "what happens next" page: when we reply (one business day), who replies, and a booking link. This cuts double submissions and gives a hot lead a way to book right away.
- Spam protection: Cloudflare Turnstile (free) plus a hidden honeypot field, on top of the existing per-IP rate limit.

### 2. Contacts, deals and a timeline

New tables, all behind a repository like the existing ones (golden rule 1). Grow the `contact` module into this rather than adding a new module that imports it, because modules must not import each other.

| Table | What it holds |
| --- | --- |
| `contacts` | One row per person, unique by email. Name, company, country, time zone, locale, source, consent flags. |
| `deals` | One row per opportunity. Contact, offer (Blueprint, AI Pilot, MVP, Rescue, Dedicated, Care, landing page), stage, value range, expected start, next step, next step date. |
| `activities` | The timeline: form submitted, estimate made, email sent, email received, call booked, note, stage changed, proposal viewed. |
| `tasks` | Reminders with a due date and an owner ("follow up with Sara on Tuesday"). |
| `email_threads`, `email_messages` | Two-way email (below). |

A second submission from the same email adds an activity to the existing contact instead of creating a duplicate. Existing `leads` rows stay as they are; a one-off script can turn them into contacts.

**Stages** (keep them few): New → Replied → Call booked → Proposal sent → Won / Lost / Not a fit. "Not a fit" includes work the policy doesn't take (see the `client-screening` skill); record the reason so the founders can see patterns.

**Admin screens:** an inbox (new and waiting-on-us first), a contact page with the whole timeline, a simple board of deals by stage, and a "today" list of due tasks.

### 3. Email from the admin, with replies threaded

- **Sending:** Postmark (already in the Global Playbook plan) from a transactional subdomain such as `mail.softwhere.app`. The founder writes in the admin; the email goes out from their own name with `Reply-To` set to a reply address.
- **Receiving:** Postmark Inbound posts each reply to a webhook as JSON (headers, body, attachments). The research found that inbound needs Postmark's Pro or Platform plan, about $16.50–18 a month with 10,000 emails included [unverified; check postmarkapp.com/pricing]. Resend is the simpler alternative: inbound has been on every plan since November 2025, and its free tier is 3,000 emails a month.
- **Threading:** give every outgoing message our own `Message-ID`, and read `In-Reply-To` / `References` on replies. Also use a plus-address reply token (`reply+<threadId>@mail.softwhere.app`), because some providers rewrite Message-IDs; match on either.
- **Safety:** show replies that fail DMARC alignment as "suspicious"; never render incoming HTML without sanitising it; store attachments outside the database.
- **Telegram stays** as the alarm bell: "New lead: Sara, AI Pilot, US, replied to your email." It stops being the place where the conversation lives.

### 4. Follow-ups that stop when the person replies

- **Instant acknowledgement** email in the visitor's language: thanks, what happens next, booking link, one relevant case study.
- **Up to two follow-ups**, at about +2 days and +6 days, only if there is no reply and no booking. Any reply or booking stops the sequence. Every step is logged on the timeline.
- **Reminders to the founders** in Telegram with buttons ("Mark contacted", "Snooze 3 days", "Open in admin"). Telegram inline keyboards send the button press back to our bot webhook, so this needs no extra tool.
- **Booking:** Cal.com Cloud (free for one person) with a webhook into `activities`, rather than self-hosting Cal.com on the same server. The booking page should show both time zones.
- **Jobs:** pg-boss, a job queue that runs on Postgres, for scheduled sends and reminders, so the stack needs no Redis. It needs a normal TCP connection to Neon from the server; the site's HTTP driver can't hold the connections pg-boss needs. See [07-own-server.md](./07-own-server.md).

n8n (a self-hosted automation tool) is an option later, but the research notes it wants about 2 vCPU and 4 GB to itself in production. Build these few flows in the app first.

### 5. AI help inside the admin

The four skills in `.claude/skills/` already hold the rules; the admin can use the same rules through `src/core/ai.ts`:

- **Screen each new lead** against the "work we take and don't take" policy and basic fit (budget, timeline, what they need). Show the result as a hint on the lead ("likely fit", "ask about the product model", "outside policy"). The founders decide; nothing is auto-declined.
- **Draft the first reply** in the lead's language, using the offers and prices from `softwhere-proposal`. The founder edits and sends.
- **Summarise call notes** into the timeline and suggest the next step.
- **Draft a proposal** from the deal, which feeds the project room in [04-project-rooms.md](./04-project-rooms.md).

### 6. An owner dashboard

One admin page with this week's numbers, so the founders don't open five tools: new leads by source, deals by stage, replies waiting on us, calls booked, estimator completions, and top pages. Search Console and Yandex Webmaster both have APIs, and PostHog has one, so this page can pull everything once a day with a background job.

## Email setup that lands in the inbox

- Set up SPF, DKIM and DMARC on the new domain **before** sending anything. Start DMARC at `p=none`, read the reports for a few weeks, then move to `quarantine` and later `reject`.
- Use separate subdomains for transactional mail (`mail.`) and the newsletter (`news.`), so a newsletter problem can't hurt lead replies.
- Warm up the new domain slowly: 10–20 emails a day to people who expect them, rising over 4–6 weeks.
- Add one-click unsubscribe (RFC 8058) to anything that isn't a direct reply. Gmail, Yahoo and Microsoft require it for bulk senders, and it helps reputation even at low volume.
- Skip BIMI (the logo in the inbox) until DMARC is at `reject`. Outlook doesn't show it, and the certificate costs hundreds of dollars a year.
- Never send email from the Hetzner server itself. Use a provider.

## Legal notes (not legal advice)

- **Replying to an inquiry** is covered by legitimate interest under GDPR; the form itself is the request. **Newsletters and nurture emails** need a separate, unticked opt-in box. Use double opt-in for the newsletter; it is only expected in Germany, Austria and Switzerland, but it is cheap insurance.
- **Retention:** pick a period and write it down, for example "delete or anonymise leads that didn't become clients after 24 months without contact". Access and delete requests must be answered within one month, and deletion has to reach backups and the Telegram history too.
- **Cold email** is legal in the US under CAN-SPAM (honest headers, a postal address, opt-out honoured within 10 business days) but stricter in the EU and varies by country. The UK allows it to companies, but not to sole traders without consent. Keep cold outreach out of this system until someone has checked the rules for each target country.
- **Update the privacy policy:** the legal basis, the providers that touch personal data (Postmark or Resend, PostHog, Telegram, Cal.com, the AI providers), retention, how to ask for deletion, and data transfers between the EU, US and Uzbekistan.

## Order of work

| Step | What | Effort |
| --- | --- | --- |
| 1 | Email field on both forms, "what do you need", thank-you page, Turnstile | Small (1–2 days) |
| 2 | `contacts`, `deals`, `activities`, `tasks` tables; inbox and contact page in admin; import old leads | Medium (1 week) |
| 3 | Auto-acknowledgement email, Telegram reminders with buttons | Small–medium |
| 4 | Two-way email with threading | Medium (1 week) |
| 5 | Follow-up sequence, Cal.com webhook | Small |
| 6 | AI screening and reply drafts; owner dashboard | Medium |

Steps 1 and 3 can ship on Vercel today. Steps 4–6 are easier once the site runs on its own server with background jobs.

## Sources

- Postmark inbound webhook: <https://postmarkapp.com/developer/webhooks/inbound-webhook>
- Resend inbound (Nov 2025): <https://resend.com/blog/inbound-emails>
- Twenty self-hosting: <https://docs.twenty.com/developers/self-host/self-host>
- Telegram bot buttons: <https://core.telegram.org/api/bots/buttons>
- CAN-SPAM guide (FTC): <https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business>
- Outlook bulk-sender rules (May 2025): <https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%e2%80%99s-new-requirements-for-high%e2%80%90volume-senders/4399730>
- DMARC policy progression: <https://dmarcian.com/advancing-dmarc-policy/>
- HubSpot Free limits (third-party summary): <https://costbench.com/software/crm/hubspot/free-plan/>
- Attio pricing: <https://attio.com/pricing>
