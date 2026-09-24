# Ideas for the site

> **These are proposals, not current behavior.** Everywhere else in `docs/`, a doc describes what the code does today. This folder is the exception: it keeps researched ideas for later. Written 2026-09-24, from web research and a read of the current code. When an idea gets built, document it in the normal docs and mark it "built" here.

## The honest starting point

The website has plenty of room for features, but the numbers say what to fix first:

- **10 clicks from Google in 28 days, and 3 leads since July** (`docs/seo-measurement-2026-09.md`).
- **The forms don't ask for an email address.** Both forms require a phone number. That is fine in Tashkent but loses US and EU buyers.
- **The estimator prices at $14/h for the local market**, while the global offers work out to about $45/h.
- **Blog posts are written end to end by AI**, and the July review found invented numbers and errors in them.
- **Estimator usage isn't measured at all**, because Vercel's free plan doesn't record custom events.

So the order below puts **conversion blockers, trust and measurement first**, then content that brings the right visitors, then tools that make selling easier. The features that are most fun to build (the AI assistant, project rooms) come after, because they multiply traffic the site doesn't have yet.

## The files

| File                                                         | In one line                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-leads-inbox-and-email.md](./01-leads-inbox-and-email.md) | Email on the forms; a CRM-lite admin inbox (contacts, deals, timeline, reminders); send and receive email from the admin; follow-ups that stop on reply; AI screening and reply drafts; owner dashboard                       |
| [02-blog-engine.md](./02-blog-engine.md)                     | Claude Opus 5.5 as the writer; a people-first pipeline (founder voice note, sources, critique, human edit); separate topics per market; post templates and real charts; rewriting the 15 live posts while keeping their slugs |
| [03-estimator-remake.md](./03-estimator-remake.md)           | One engine, two market profiles (local and global); start from the goal; results point to a real offer; email unlocks a shareable project room; anonymous data for reports                                                    |
| [04-project-rooms.md](./04-project-rooms.md)                 | The "dashboard for potential clients": a private page that is the proposal, then the project dashboard, then the monthly app health report                                                                                    |
| [05-ai-assistant.md](./05-ai-assistant.md)                   | A narrow, grounded site assistant (start with a cached knowledge pack, add RAG later) and an AI scoping assistant that turns an idea into a brief                                                                             |
| [06-growth-and-trust.md](./06-growth-and-trust.md)           | Clutch reviews, real people, time-zone widget, trust page; two free tools worth building; safe comparison pages; PostHog set up properly; a founder newsletter                                                                |
| [07-own-server.md](./07-own-server.md)                       | What the Hetzner server enables: background jobs (pg-boss), Coolify, Cloudflare in front, small self-hosted tools, and what never to self-host                                                                                |

## Recommended order

### Now: works on the current setup (next 2–4 weeks)

1. **Email on both forms**, a "what do you need?" question, a thank-you page with a booking link, and Turnstile ([01](./01-leads-inbox-and-email.md)).
2. **PostHog in cookieless mode** with the estimator funnel, so the next decisions use real numbers ([06](./06-growth-and-trust.md)).
3. **Trust basics:** Clutch profile and the first two reviews, a team page with real people, the time-zone line, a trust page ([06](./06-growth-and-trust.md)).
4. **Blog:** add Claude to `src/core/ai.ts`, run the Uzbek and Russian blind test, add real author bylines, and stop generating posts with no founder input ([02](./02-blog-engine.md)).
5. **After the 2026-10-03 SEO gate:** rewrite pilot on the 3–5 posts with the most impressions, keeping slugs ([02](./02-blog-engine.md)).

### Next: once the site runs on its own server (October–December)

6. **Admin inbox:** contacts, deals, timeline, tasks; auto-acknowledgement email; Telegram reminders with buttons ([01](./01-leads-inbox-and-email.md), [07](./07-own-server.md)).
7. **Estimator remake:** market profiles, goal-first flow, offer card, price drivers ([03](./03-estimator-remake.md)).
8. **Two-way email** from the admin, with threaded replies and the follow-up sequence ([01](./01-leads-inbox-and-email.md)).
9. **App store readiness checker**, the first free tool ([06](./06-growth-and-trust.md)).
10. **New blog pipeline** running at two strong English posts and one or two local posts a month ([02](./02-blog-engine.md)).

### Later: when there are enough prospects to justify it

11. **Project rooms**, created from the estimator's email step. Try a free tool (Aligned or Dock) with the first prospects before building ([04](./04-project-rooms.md)).
12. **Site assistant** with guardrails and a golden test set, then the **scoping assistant** ([05](./05-ai-assistant.md)).
13. **Monthly app health report** for care-plan clients ([04](./04-project-rooms.md)).
14. **Shariah checklist for fintech features** with the scholar's review; first quarterly data report from estimator data ([06](./06-growth-and-trust.md), [02](./02-blog-engine.md)).

## Decisions only the founders can make

- **Legal entity and payment route.** A US LLC with Stripe and Mercury, or Payoneer. Stripe doesn't accept businesses based in Uzbekistan, so this blocks taking deposits from US and EU clients ([04](./04-project-rooms.md)).
- **Which domain serves which market.** softwhere.app for global and softwhere.uz for local is the assumption here; it decides the estimator profile and blog topics.
- **Who edits the blog.** Every post needs a human editor and a named author. Budget about an hour per post.
- **Uzbek and Russian writing model**, after the blind test.
- **Scholar review** for the Shariah checklist and for any fixed late-fee question.
- **Tool budget.** Build versus buy for the inbox and rooms is argued in each file.

## Rough monthly running cost once built

| Item                                                     | Approx. per month                                     |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Hetzner server (from the Global Playbook)                | ~€35                                                  |
| Cloudflare (free plan)                                   | $0                                                    |
| Postmark with inbound, or Resend                         | ~$16–20                                               |
| Amazon SES for the newsletter                            | cents at this volume                                  |
| PostHog Cloud EU                                         | $0 on the free tier at current traffic (check limits) |
| Cal.com cloud, one person                                | $0                                                    |
| Claude API: blog (2–4 articles), assistant, admin drafts | ~$20–60                                               |
| **Total**                                                | **about $70–120 plus the server**                     |

The larger cost is people's time: about an hour per blog post, a weekly look at the inbox and assistant transcripts, and the founders' calls.

## Guardrails that apply to every idea

- **Honesty:** no invented numbers, clients or reviews. Employee-era work is "where our engineers have shipped", never "our client" (the `case-study-writer` skill).
- **Halal policy:** the work we take and don't take (the `client-screening` skill); no interest in any payment terms; religious questions go to the founders' scholar.
- **The repo's golden rules** (`CLAUDE.md`):
  - Database access only through repositories.
  - AI only through `src/core/ai.ts`.
  - The logger, not `console`.
  - All three locales in the message files.
  - The `core → shared → modules → app` layering.
- **Privacy:** every new store of personal data gets a retention period and a line in the privacy policy.
