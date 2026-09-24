# Idea: Remake the estimator for two markets

> **Status:** idea, not built. Researched 2026-09-24. How the estimator works today is in `docs/estimator.md`; this file is about what it should become.

## The problem today

The estimator is well engineered: a pure formula shared by client and server, an AI refinement that is clamped to the formula, sanitised input, tests and a calibration script. The result is never hidden behind a contact form. But it was built for the Tashkent market, and the business is moving:

| Today | Global positioning (Global Playbook) |
| --- | --- |
| Blended rate **$14/h**, calibrated to Central Asia (`constants.ts`) | About **$45/h** blended; offers from $1.5k to $60k |
| Services: mobile, web, Telegram bots, AI, desktop | Mobile apps with AI inside, AI features, rescue, extra engineers |
| Integrations: Payme, Click, Uzum, OFD, 1C, MyID, E-IMZO… | Stripe, Apple/Google Pay, Firebase, HubSpot, LLM APIs, health and maps SDKs… |
| Output: a price range and weeks | Buyers also want: which offer, what's included, what's unknown, the next step |
| Contact: name + phone, "call" or "Telegram" | Email first (see [01-leads-inbox-and-email.md](./01-leads-inbox-and-email.md)) |
| Custom events not recorded (Vercel Hobby) | PostHog funnels (see [06-growth-and-trust.md](./06-growth-and-trust.md)) |

Showing $14/h-based numbers to a US founder undersells the offers and clashes with the pricing in proposals. Showing $45/h numbers to a Tashkent shop owner scares them away. One estimator can't serve both with one price list.

## The idea: one engine, two market profiles

Keep the formula engine, the tests and the AI clamp. Split everything market-specific into a **profile**:

| | Local profile | Global profile |
| --- | --- | --- |
| Where | softwhere.uz, `uz` and `ru` | softwhere.app, `en` (and later other languages) |
| Currency | so'm and USD | USD, EUR, GBP |
| Rate and floors | Current v2 constants | Rates from the Global Playbook; floors from the offers |
| Catalog | Current catalog | A new catalog: global integrations, compliance items (GDPR, HIPAA-ready, accessibility), AI feature types |
| Contact | Phone or Telegram | Email |
| Result ends with | Call or Telegram | A recommended offer, the project room and a booking link |

Which domain serves which profile is decided when softwhere.app goes live; the profile is picked from the domain first and the locale second.

## The global flow: start from the goal, not the app type

The first question is **"What do you need?"**, and each answer is a short path (3–5 steps):

| Answer | Short path asks | Result points to |
| --- | --- | --- |
| **A new app** | Platforms, core features, integrations, AI features, design level, deadline | **MVP** ($25–60k), with the **Blueprint** ($4,000) as the first step when scope is fuzzy |
| **Add AI to an app I have** | What the AI should do (chat over documents, vision, voice, automation), data sources, users per month, privacy limits | **AI Feature Pilot** (from $12k) |
| **Fix or take over an app** | Current stack, what's wrong (crashes, slow, store rejection, the team left), access to the code | **App Rescue audit** ($1.5–2.5k) |
| **Extra engineers** | Roles, seniority, how many months, overlap hours needed | **Dedicated team** ($6–7.5k per engineer per month) |
| **A website or landing page** | Pages, languages, CMS, integrations | **Landing page** (~$890 + $79/month care) |
| **Not sure yet** | A free-text description | **Blueprint**; this is also where the AI scoping assistant fits ([05-ai-assistant.md](./05-ai-assistant.md)) |

## What the result shows

1. **The range and the timeline, right away, with no email required.** This is the research consensus: show value first and gate only the richer output. It is also the principle already in `docs/estimator.md`.
2. **The recommended offer as a card:** name, price, what's included (design, QA, project management, store release, 12-month bug-fix warranty, weekly demos, you own the code), and how the work starts.
3. **What drives the price**, the top three items with their marginal cost. `marginalCost()` already exists. For example, "Offline mode adds about $3–4k; video calls add about $6–8k."
4. **What we can't know yet.** An honest list of unknowns, and why the Blueprint turns the range into a fixed price.
5. **A comparison anchor, only with a real source.** For example, "US agencies usually quote $X–Y/hour for this kind of team", from a published rate survey such as Clutch's. A range next to a named offer reads as "which package", not "how cheap can you go".
6. **The next step:** "Get this as a shareable page and PDF" (email required) and "Book a 30-minute call".

**The email unlocks a project room.** It is a private page with the scope, the range, the recommended offer, a relevant case study and a booking link, which the prospect can forward to a co-founder or investor. The same page becomes the prospect dashboard. See [04-project-rooms.md](./04-project-rooms.md).

## Details that matter

- **Policy check without preaching.** When the product is fintech, ask what the money flow is (payments, investing, savings, lending, insurance). Don't block anyone in the form. Flag the lead for the founders ("policy: check") and link the public "work we take" page on the result. The founders decide, as in the `client-screening` skill.
- **AI refinement.** Keep it clamped to the formula. For English, a Claude model through `src/core/ai.ts` is an option; test speed against the current 45-second budget first.
- **Save every completed estimate anonymously** (no name or email; with a line in the privacy policy). After a few hundred, this becomes original data for the quarterly report in [02-blog-engine.md](./02-blog-engine.md): what people ask to build, the typical ranges, the most common AI features. No competitor has this data.
- **Track every step** in PostHog (start, each step, result seen, email given, call booked) to see where people drop off, and watch session replays (with consent) on the steps where they quit.
- **Tests.** Extend `tests/estimator` with a parity suite per profile and a rule that no global result can fall below the offer floors.

## Order of work

| Step | What | Effort |
| --- | --- | --- |
| 1 | Email field, "what do you need" first step, offer card on the result (current engine and prices) | Small |
| 2 | Market profiles: split constants, catalog and floors; global catalog | Medium (1–2 weeks) |
| 3 | Price drivers, unknowns, sourced comparison anchor | Small |
| 4 | Email-gated project room and PDF | Medium (see 04) |
| 5 | Anonymous estimate log, PostHog funnel | Small |
| 6 | Conversational intake that pre-fills the wizard (see 05) | Medium |

## Sources

- What 9 estimator tools ask, gated vs ungated (2026): <https://axonbuild.com/blog/app-development-cost-estimate>
- Gated content conversion (show value before the ask): <https://www.amraandelma.com/gated-content-conversion-statistics/>
- Clutch pricing and rate data: <https://clutch.co/>
