# Idea: Trust, free tools and measurement

> **Status:** idea, not built. Researched 2026-09-24. Effort and impact ratings are judgement, not measurements.

Everything else in this folder helps convert visitors. This file is about earning their trust and bringing the right visitors in the first place.

## 1. Trust first (small effort, big effect)

The biggest objection a US or EU buyer has to a team in Tashkent is "will they disappear, and can I trust them with my code and data?" Answer it on the site before they ask.

| Idea | What it looks like | Effort | Impact |
| --- | --- | --- | --- |
| **Clutch profile and the first reviews** | Ask the clients of SoftWhere's own projects (Talim AI, DriveMe) for a Clutch review right after a milestone, while the relationship is warm. Show the official Clutch widget. A verified, interview-based Clutch review weighs far more with B2B buyers than general reviews. | Small | High |
| **Real people** | A team page with photos, roles and LinkedIn links, and a short video of the founders. No stock photos. | Small | High |
| **Time-zone widget** | "It's 9:14 in California and 21:14 in Tashkent — the team is online." A small client component. The research found nobody doing this well. | Small | Medium |
| **Trust page** | NDA by default, IP ownership per paid milestone, who can access client code and data, how secrets and backups are handled, what happens if we part ways (full handover), the work we take and don't take. A lightweight version of what SaaS companies call a trust centre; a SOC 2 audit is overkill at this size. | Small–medium | High |
| **Honest capacity line** | "Next available start: February 2027" or "1 of 2 build slots open for Q1". Only if true; buyers check, and fake scarcity destroys trust. | Small | Medium |
| **"How we scope a project" page** | Buyers told GoodFirms they value partners who ask sharp questions before quoting. Show the Blueprint process step by step. | Small | Medium |
| **Response-time promise** | "We reply within one business day" on the contact form, then keep it (the inbox in [01-leads-inbox-and-email.md](./01-leads-inbox-and-email.md) makes it measurable). | Small | Medium |
| **Accessibility** | Make the site meet WCAG 2.2 AA and say so. The European Accessibility Act has applied since 28 June 2025 to many of the apps we'd build for EU clients (shops, banking, transport). The site doubles as proof we know how. | Medium | Medium–high |
| **Engineering proof** | One small open-source package or a public benchmark from real work (for example "Flutter vs React Native: startup time on a mid-range Android phone"). Studios like Callstack and Software Mansion win on this. | Medium | Medium–high |

## 2. Free tools that bring buyers, not students

Interactive tools convert far better than PDFs, but many tool categories are crowded and bring the wrong audience. Ranked for SoftWhere:

| Tool | Why | Effort | Impact |
| --- | --- | --- | --- |
| **App store readiness checker** | Answer a few questions and get a checklist for this year's Apple and Google requirements: Apple's latest-SDK rule each spring, Google Play's target-API deadline each August, privacy manifests, account deletion. No real tool exists, only articles. Update it once a year. Exactly the founders who need an agency. | Medium | High |
| **Shariah checklist for fintech product features** | For Islamic fintech product teams: where riba, gharar or gambling-like mechanics hide in features (late fees, "boosts", streak rewards, auto-rollover), with links to the relevant AAOIFI standards. It must be reviewed by the founders' scholar and presented as a product checklist, not a religious ruling. Nobody covers product features specifically; a full Islamic fintech landscape map is already owned by IFN and Finocracy. | Medium | High for this niche |
| **Flutter vs React Native vs native decision tool** | A short decision tree with honest outcomes, including "use native". Lots of articles exist, no good interactive one. | Small–medium | Medium |
| **"Hiring an app agency" checklist** | A vendor-evaluation checklist written as a post with a download, which positions SoftWhere as the honest guide while buyers compare agencies. | Small | Medium |
| Skip: ASO grader, privacy-label generator, RFP generator | Well-ranked free tools already exist; a copy mostly attracts developers comparing tools. | — | Low |

Each tool ends with one relevant next step: the estimator, the App Rescue audit, the Blueprint. The email is only asked for when the visitor wants the result as a PDF.

## 3. Comparison and cost pages, done safely

Google's scaled-content-abuse policy (since March 2024, reinforced in 2025 and 2026) punishes pages made at scale with no added value, whatever wrote them. It applies to templated location pages in particular ("App development in [city]").

- **Do:** 10–20 deep pages on real questions buyers ask, each with our own data or experience. For example: "Flutter vs React Native for a fintech MVP", "In-house vs agency vs freelancer for an AI feature", "What an AI chatbot inside your app costs to run".
- **Don't:** city pages (SoftWhere has no offices there), hundreds of "cost of X app" pages with a noun swapped, or a glossary of definitions copied from everywhere.
- There is no reconsideration request for an algorithmic demotion; recovery waits for recrawls. Build slowly and well.

## 4. Measure what matters: PostHog

The estimator's events aren't being recorded at all today: Vercel Web Analytics custom events aren't available on the Hobby plan (`docs/seo-measurement-2026-09.md`). The Global Playbook already picked **PostHog Cloud EU**. Set it up like this:

- **Cookieless mode by default** for page views and funnels. It needs no consent banner, but it turns off session replay, surveys and identifying users.
- **Consent-based extras:** session replay and surveys only after the visitor agrees. Record replay only on the estimator and contact pages, where it answers "where do people give up?"
- **One funnel:** landing page → estimator start → result → email given → call booked → deal won (the last two come from the admin).
- **A few surveys** at most, for example "What almost stopped you from contacting us?" after a booking.

## 5. Newsletter

- A **monthly founder letter**, not a company newsletter. Send it from the US co-founder, who already has a following: what we built, one lesson about AI in apps, one note on halal fintech, one link.
- Tie it to the blog cadence: the newsletter is where the best post of the month goes. Use Listmonk with Amazon SES from the `news.` subdomain, with double opt-in.
- Judge it by replies and calls booked, not by opens.

## 6. The local site keeps its own track

softwhere.uz serves Uzbek businesses (websites, Telegram bots, e-commerce, paying in so'm); softwhere.app serves global buyers. Most ideas here are for the global site. For the local site, the existing work continues: index recovery, Yandex region and Sprav registration (`docs/yandex-setup.md`), and local-language posts on local topics.

## Order of work

| Step | What | Effort |
| --- | --- | --- |
| 1 | PostHog (cookieless) with the estimator funnel; consent for replay | Small |
| 2 | Clutch profile and first two reviews; team page with real people; time-zone widget | Small |
| 3 | Trust page; "how we scope" page; response-time promise | Small |
| 4 | App store readiness checker | Medium |
| 5 | Shariah checklist for fintech features (with scholar review) | Medium |
| 6 | WCAG 2.2 AA pass on the site | Medium |
| 7 | 10–20 deep comparison pages over time; monthly founder letter | Ongoing |

## Sources

- Clutch, "State of Software Development" (2025): <https://clutch.co/resources/state-of-software-development>
- GoodFirms buyer survey on UX and discovery (2025): <https://www.goodfirms.co/resources/startup-mobile-app-ux-design-goodfirms-survey>
- Clutch widgets: <https://clutch.co/widgets-logos-badges>
- Google spam policies: <https://developers.google.com/search/docs/essentials/spam-policies>
- PostHog cookieless tracking: <https://posthog.com/tutorials/cookieless-tracking>
- European Accessibility Act (European Commission): <https://ec.europa.eu/social/main.jsp?catId=1202>
- IFN Islamic fintech landscape: <https://www.islamicfinancenews.com/fintech-landscape>
