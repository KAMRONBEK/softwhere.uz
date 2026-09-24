# Idea: Project rooms, a small dashboard for prospects and clients

> **Status:** idea, not built. Researched 2026-09-24. Tool prices are from vendor pages or third-party summaries on that date.

## The idea in one line

Each prospect gets a private page: the **project room**. It starts as the proposal. When they sign, the same page becomes their project dashboard. After launch it keeps showing app health for care-plan clients. This one feature is the "dashboard for potential clients", the "sales room" and the "client portal".

## Why

- A PDF proposal is forwarded, lost and never updated. A link is always current, and it shows when the prospect opened it.
- US and EU buyers worry most about offshore teams going quiet. A page with this week's demo video, the latest build and what's next answers that without anyone asking.
- The Global Playbook already promises a demo every week, ownership of the code per paid milestone, and a 12-month bug-fix warranty. The room is where those promises become visible.

Vendors claim digital sales rooms bring more conversions and shorter sales cycles. The figures usually quoted (+25% conversions, 30% shorter cycles) couldn't be traced to a primary source, so treat them as marketing numbers. The trust argument above doesn't depend on them.

## Be honest about timing

There have been three leads since July (`docs/seo-measurement-2026-09.md`). Building a full room system before there are prospects to put in it would be backwards. So:

1. **First 5–10 prospects:** use a free tool or a hand-made page, and learn what prospects actually open. Aligned and Dock both have free tiers.
2. **Build it** when there are several proposals a month, or together with the estimator remake, since the estimator's email step creates rooms automatically ([03-estimator-remake.md](./03-estimator-remake.md)).

## What's in a room

### Stage 1: prospect (the proposal)

- A 1–2 minute video from a founder, recorded for this prospect (a Loom link is fine).
- **What we heard:** their problem in their words, AI-drafted from the lead, the call notes and the estimate, then edited by a founder.
- **2–3 options mapped to real offers:** for example Blueprint now, then MVP; or AI Pilot only. Each shows price, timeline, what's included and what's not.
- Who will work on it: real people, photos and roles.
- One or two relevant case studies, following the honesty tiers in the `case-study-writer` skill ("Built by SoftWhere" vs "Where our engineers have shipped").
- **Terms in plain words:**
  - A deposit, then payment per milestone.
  - No interest, and no interest-style late fees.
  - They own the code for each milestone they've paid for.
  - 12 months of bug fixes.
  - A demo every week.
- **Next step buttons:** "Accept Blueprint" (e-sign, then a deposit invoice), "Ask a question", "Book a call".
- **View tracking:** Telegram message "Acme opened the proposal (2nd time, 4 min)". This is the most useful signal for a follow-up.

### Stage 2: active client

- Milestones with status and dates, and what's paid.
- **This week's demo:** a video link plus three lines on what changed and what's next. This makes the weekly-demo promise visible.
- **Latest builds:** Expo EAS internal distribution or Firebase App Distribution links for quick tests; TestFlight once builds settle, because external TestFlight needs Apple's review for each build.
- **Decisions log:** what was decided, when and by whom. It prevents "we never agreed to that".
- **Change requests:** each with its price and time impact, and an Approve button. This is where scope creep becomes paid work instead of free work.
- Invoices (links out to the payment provider), files, and contacts with each person's local time.

### Stage 3: care plan (after launch)

- **Monthly app health report**, emailed and shown in the room:
  - Crash-free sessions (Sentry or Firebase Crashlytics).
  - Store rating trend.
  - Uptime.
  - What we fixed and what we recommend next.
- A monthly job drafts it and a founder approves it. The research rated it the best effort-to-impact idea: the data sources are free and the report is a template. It keeps care-plan clients, and the "what we recommend next" line is how small upsells start.
- An optional public status page for the client's app (see [07-own-server.md](./07-own-server.md)).

## How it would work on our stack

- **Access:**
  - Prospect rooms use an unguessable link, the same model as Loom or DocSend, and are never indexed.
  - Client rooms add a one-time email code before showing invoices and files.
  - Admins keep Neon Auth. Check whether Neon Auth supports Better Auth's email OTP or magic-link plugins; if not, a small signed-token and email-code flow stored in our own tables is enough.
- **Tables** (behind a repository, like everything else):
  - `rooms`: contact, deal, stage, locale, token hash, expiry.
  - `room_items`: typed blocks such as video, option, case study, milestone, demo, build, decision, change request, invoice link and file, with a jsonb payload and an order.
  - `room_events`: views, clicks, accepts.
  - `change_requests`.
  - A deal in [01-leads-inbox-and-email.md](./01-leads-inbox-and-email.md) links to its room.
- **Editing:** from the admin. AI drafts "what we heard" and the options from the deal and the `softwhere-proposal` rules, then a founder edits.
- **E-sign:**
  - Start simple. "Type your name and tick to accept" records the name, time and IP and emails a PDF copy. That is a simple electronic signature under the US ESIGN Act and the EU's eIDAS rules, usually enough for B2B service agreements (check with a lawyer for large contracts).
  - Later, self-host DocuSeal or Documenso. Both are AGPL, so they're fine as a separate internal service; embedding or white-labelling needs their paid plans.

## Getting paid: a prerequisite, not a feature

- **Stripe does not accept businesses based in Uzbekistan** (secondary sources; stripe.com couldn't be opened from the sandbox).
- The standard route is a **US company**: the co-founder's LLC, or Stripe Atlas, with a Mercury bank account. Stripe then runs through the US entity.
- **Payoneer** can pay out to Uzbek banks and send payment requests. **Wise Business** invoices well but doesn't pay out to Uzbek accounts.
- The Global Playbook noted "no formal entity yet", so this is the real blocker for taking deposits from US and EU clients, whatever the room looks like.
- **Halal terms:** no interest and no compounding penalties. Whether a fixed late fee given to charity is acceptable is a question for the founders' scholar; the site shouldn't state an answer.

## Build or buy

| Option | Price (2026) | When it makes sense |
| --- | --- | --- |
| **Aligned** | Free; paid from $35/seat | Trying the idea with the first prospects; it combines sales room and client portal |
| **Dock** | Free tier; paid from about $59/user | Same as Aligned |
| **Qwilr / PandaDoc** | $19–75/user/month | Nice proposals with e-sign and payments, but no client portal |
| **Assembly (formerly Copilot)** | About $69/month; white-label $399 | A packaged client portal if building is off the table |
| **SuiteDash** | From $19/month flat | Cheapest all-in-one; reviewers call the UI dated |
| **Build our own** | Our time | When rooms come from the estimator automatically and must match the site; it's also a portfolio piece |

Research estimates a full custom portal with native billing and e-sign at $25–60k to build. A thin room (pages, blocks, links out to payments and e-sign) is days to a couple of weeks, because the stack, database and admin already exist.

## Order of work

| Step | What | Effort |
| --- | --- | --- |
| 0 | Legal entity and payment route (US LLC + Stripe, or Payoneer) | Founders' task |
| 1 | Try Aligned or Dock free on the next 5 prospects | None |
| 2 | Room pages with typed blocks, token access, view tracking to Telegram | Medium (1–2 weeks) |
| 3 | Created automatically from the estimator's email step | Small, after 2 |
| 4 | Accept flow (simple e-signature) and deposit invoice link | Small |
| 5 | Client stage: milestones, weekly demo, builds, decisions, change requests | Medium |
| 6 | Monthly app health report for care-plan clients | Small–medium |

## Sources

- Aligned pricing: <https://alignedup.com/pricing/>
- Dock pricing: <https://www.dock.us/pricing>
- Qwilr pricing: <https://qwilr.com/pricing/>
- DocuSeal: <https://www.docuseal.com/pricing>
- Documenso: <https://github.com/documenso/documenso>
- SuiteDash pricing: <https://suitedash.com/pricing/>
- Expo internal distribution: <https://docs.expo.dev/tutorial/eas/internal-distribution-builds/>
- Sentry crash-free rate: <https://sentry.zendesk.com/hc/en-us/articles/25916114688923-How-can-I-track-crash-free-rate-in-my-applications>
- Custom portal cost estimate: <https://wayfront.com/blog/true-cost>
