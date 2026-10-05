# Plan: Blog keep / rewrite / merge / retire

> **Status:** decided direction, not built. Research workflow on 2026-10-05 (per-post Search Console data, external evidence, a critique pass). Part of [12-two-market-relaunch.md](./12-two-market-relaunch.md), which wins on any conflict. Topic IDs (T1…T59) group the uz/ru/en versions of one topic.

## Founder's answers (2026-10-05). These override the plan below.

- **Telegram work:** the team has built real **Telegram bots, but no Mini Apps**.
  - The bot post (T9) and the bot parts of T10 may say "we built", using named projects from the founder's voice note.
  - Every Mini App claim must be a source-based guide, never "we built".
- **Clean up early.** If the September spam update hurt the posts, don't wait for 2026-12-02. The February 2027 retire batch moves to **after the spam update finishes and the new baseline is recorded (about 2026-10-22)**, still before 2026-12-02. The founder accepts that this muddies the Dec 2 measurement.
  - Keep every guardrail in "Risks and guardrails": redirects written before posts go to draft, alias repointing, URL Inspection of each hub before a merge, and the language-group redirect fix shipped first.
  - Never in the same week as the server or DNS move. Log every change date in `docs/seo-measurement-2026-09.md`.
- **Review:** the founder reviews **both Uzbek and Russian** personally. No second native reader.
- **Project rescue:** the team **has real rescue cases**. Keep the rescue topic for a later softwhere.app post built on them, and don't retire it as "no real cases".

## The answer

Neither option fits. At 1-2 reviewed posts a month you can properly rewrite about 12-18 topics in all of 2027, across both sites. Rebuilding 20-30 topics per market would take 2-4 years, and in the meantime it would keep the site looking like mass-produced content, which Google is penalising this year. Keeping only the posts with traction is too narrow: since July, only 15 uz/ru topics got any click at all (40 clicks in total), and one Uzbek post got 11 of them.

The plan:

1. **softwhere.uz keeps about 20 topics live in uz+ru.** These are:
   - the 15 with clicks since July;
   - posts that match a service you sell (Telegram bots and Mini Apps, AI automation, websites, apps and marketplaces);
   - clean posts Google has already indexed.

   Only about 6 of them get a rewrite from you in the first year:
   - Mini App vs website vs app (T10)
   - cost (T16)
   - Telegram bot guide (T9)
   - AI on your own documents (T12)
   - timeline (T31)
   - later, a websites page

   Each rewrite keeps its URL, and the overlapping posts are redirected into it in the same deploy. About 35 other topics get redirected or unpublished after 2026-12-02. The rest stay as they are (cleaned) until their turn comes.

2. **softwhere.app starts with no blog posts.** The old English posts are not moved over: they were written for Uzbek buyers, about 90% of their traffic came before July, and the two strongest English posts are no longer in Google's index. Two new posts go live at launch, then about one a month, built from your portfolio. Most of it is work for Western clients, and about 40 of the 54 projects are React Native.

3. **Before 2026-12-02, only the approved fixes:**
   - Pause the generator today, before 06:17 UTC.
   - Delete invented client stories and 'X of our clients' figures inside the posts. URLs stay the same.
   - Unpublish the 3 cut-off Uzbek posts and the invented 'real business case' post (T17).

4. **Money is not the limit; your review time is.** The cost estimates in docs/ideas/02 run about $2-25 per post in three languages, so even 2 posts a month stay under $50. Pausing the generator also stops its weekly AI spend.

**Questions only you can answer:**
1. Has the team built real Telegram bots or Mini Apps? The portfolio shows only the Hello Box admin panel, and both your top post and your main .uz service depend on this.
2. Which clients allow us to name them?
3. Google's September spam update is still rolling out and may be pulling the Russian posts down. If it is, do you want to clean up the archive before 12-02, or wait? I recommend waiting.
4. Can you review the Russian and Uzbek versions yourself, or do you need a second native reader?
5. Have you done real project-rescue work? If not, the rescue posts go.
6. Which 3-5 US projects do you remember well enough to give real timelines and team sizes for?

**On your social question, as far as the blog goes:** a second Instagram account or a WhatsApp username will not help search or AI answers. The research measured other sites mentioning you, not your own accounts. Keep @softwhere_uz and the Telegram username. Reserve an .app handle on Instagram without running it, as file 12 decided. Use the existing +998 number for WhatsApp on .app. If WhatsApp lets you reserve a username, it costs nothing to take one, but it won't help search. Put the effort into a LinkedIn company page and outside listings such as Clutch and goldenpages.uz.

## Timeline

| When | What |
| --- | --- |
| Today, 2026-10-05, before 06:17 UTC | Turn off the weekly generator (for example `gh workflow disable generate-post.yml`, or remove the cron in .github/workflows/generate-post.yml). Otherwise it creates 3 more drafts today and spends AI budget. Keep the 12 existing drafts unpublished as raw material for rewrites. |
| 2026-10-06 to 10-16 | Claude prepares the trust-fix list, showing each flagged sentence with the proposed deletion: 33 invented client stories, 6 'hypothetical client' hedges, 11 'X of our clients' figures, the fake companies in T1, T3 and T5 UZ (Paste.uz and similar), and claims that pair a named city with a percentage. The founder confirms each item, because the automatic scan both over-flags and misses things (for example, T1 UZ '50+ projects reviewed' may be true). This review is October's founder time for the blog. |
| 2026-10-12 to 10-23 (once the list is confirmed) | Steps, in order: 1. Ship the invisible redirect fix: old URLs resolve through the post's language group whatever the English post's status, and the shared T27 slug gets a fixed order. 2. Delete the approved sentences in place in all 3 languages. No URL changes. 3. Unpublish T3 UZ, T5 UZ and T6 UZ (cut off mid-word) and all three T17 posts. 4. In the same deploy, repoint the old aliases: T3 UZ to T35 UZ, T5 UZ to T15 UZ. 5. Use the admin PATCH so linked pages are refreshed, and log the date of every change in docs/seo-measurement-2026-09.md. Do not switch on BLOG_AUTHOR_NAME. |
| About 2026-10-22 (spam update finished, plus about 2 weeks) | Record a new baseline: blog clicks and impressions per language, plus URL Inspection of every hub page and the 12 commercial URLs. Write down that the 10-03 gate was missed. Recalculate the stop rule ('under 10 clicks per 28 days, twice') from this baseline so the spam update alone cannot trigger it. Request Indexing was already used on 07-23 with no effect, so make at most the one repeat request the doc allows. |
| Oct-Nov 2026 (built hidden, nothing changes on the live site) | Build the blog pieces: - an authors table and a byline on each post, with the founder's name and photo; - the 'AI-assisted, reviewed by Kamronbek Juraev' note; - contentUpdatedAt and a visible 'Updated on' date; - in-body links between hubs, from each post to its service page, and to the estimator. Run the blind writing test of 3-4 models on the T10 brief in uz, ru and en. Keep blog changes out of the weeks of the server and DNS move. |
| November 2026 | The founder records voice notes for .app posts A and B and reviews both. These are November's 1-2 slots. Both are published only on the hidden .app build. |
| 2026-12-02 | Read the 90-day gate: inquiries or estimator leads from organic search. Nothing on the blog changes on this day. |
| December 2026 (launch deploy) | Launch softwhere.app with posts A and B plus the case studies. Remove /en from softwhere.uz: - Redirect the English homepage, services and estimator 1:1 to softwhere.app with 301s. - Unpublish all English blog posts (404). Redirect none of them to .app or to their ru/uz versions. - Remove en from hreflang and the sitemap. The founder records the T10 voice note. |
| January 2027 (at least 3 weeks after launch) | .uz post 1: rewrite T10 in uz and ru at the same URLs. In the same deploy, 301 T1, T8, T11 and T24 into it, after URL Inspection confirms T10 is indexed. Embed the Mini App / website / app calculator if it is ready; otherwise link to the estimator. Watch it for 4-8 weeks. The founder records the taxi/delivery voice note. |
| February 2027 | First, the .uz retire batch. Write the redirects before setting anything to draft, and check each URL with curl: - unpublish T2, T22, T26, T28, T29, T33, T34, T36, T38, T40, T41, T43 and T54; - unpublish the never-crawled copies (T5 ru, T18 uz, T19 ru, T25 uz, T44 uz, T49 uz, T52 ru, T53 ru); - redirect T4, T18 ru, T30 ru, T32, T39, T48 ru, T51, T52 uz and T53 uz into their indexed hubs. At least 2 weeks later, publish .uz post 2 (taxi/delivery, a new URL). Also publish .app post 3. |
| March 2027 | Decide on the T10 pilot. If its impressions and position held, continue. If they fell, stop and investigate before rewriting anything else. Next, rewrite T16 (cost, priced in so'm), keeping its slug and changing only the title. In the same deploy, 301 T37 and T49 ru into it. Publish .app post 4. |
| April-September 2027 | At most one .uz post and one .app post a month. - .uz order: T9 (absorbing T42 and T46), T12 as 'AI on your own documents' (absorbing T44 ru), T31, a refresh of T47 with real e-commerce work, then a websites page (T55 or a new so'm landing-page post) that absorbs T15. - .app: posts from the portfolio and case studies, for example React Native lessons, the website AI assistant, and project rescue only if real cases exist. If a voice note slips, skip that month. Never publish unreviewed AI text. |
| Quarterly: April, July and October 2027 | Review each hub's clicks and impressions against the October baseline. Decide which uncleaned 'keep' topics to retire. Check AI spend against the $50 cap. Judge on categorical signals (pages indexed, leads), not monthly click changes, which are too small to mean anything. |

## First four new posts

### softwhere.uz (uz + ru): uz: 'Telegram Mini App, veb-sayt yoki mobil ilova: biznesingizga qaysi biri kerak?' / ru: 'Telegram Mini App, сайт или мобильное приложение: что выбрать бизнесу' (a rewrite of T10 at its existing URLs)

**Why:** This page earns 23% of all blog clicks: T10 uz had 11 clicks and 290 impressions at position 5.5 since July. It matches the main .uz service and the planned free Mini App / website / app calculator. Right now it quotes $40-60k for a native app, which contradicts your own prices. Keeping the URLs and the main question, and redirecting T1, T8, T11 and T24 into it in the same deploy, adds content without losing the ranking. Publish in January 2027 and watch it for 4-8 weeks as the pilot.

**Voice-note questions for the founder:**

- Which Telegram bots or Mini Apps has the team actually built or shipped: names, what they did, roughly when? If none were Mini Apps, say so plainly, and the post becomes a decision guide built on sources rather than our experience.
- When a client asks 'bot, Mini App or app?', what do you ask first, and what usually decides it?
- Tell one real case (no name needed) where you advised a client against a mobile app, or where a client chose the wrong format. What happened?
- From your new so'm price list: what does each option start at, how long does each take, and what pushes the price up?
- What can a Mini App not do as well as a native app (push notifications, offline use, store presence, device features)? Which of these limits have you hit yourself?
- How do customers in Uzbekistan pay inside Telegram today (Payme, Click, Uzum, others)? Which have you integrated?
- When does it make sense to start with a Mini App and move to an app later, and how much of the work carries over?
- Which screenshots or video frames from your projects can we show in the post?

### softwhere.uz (uz + ru): uz: 'Taksi yoki yetkazib berish ilovasi: biz qurgan loyihalardan saboqlar' / ru: 'Приложение для такси или доставки: уроки из наших проектов в Узбекистане' (a new URL)

**Why:** This is experience no other site can copy. The portfolio has DriveMe, Snap Taxi, Full Taxi, 100K Express and the Hamd delivery operator panel, with walkthrough videos to embed. It covers a .uz service (apps and marketplaces) that no current post touches, so it competes with nothing. Local details such as Yandex maps, per-km tariffs, the taximeter and Payme/Click payments are what generic AI text cannot produce. Client names appear only with permission. Publish in February 2027.

**Voice-note questions for the founder:**

- Which of DriveMe, Snap Taxi, Full Taxi, 100K Express and Hamd did the team build, and which parts (rider app, driver app, admin panel, backend)? Which clients let us name them?
- What took longest or broke most often: live tracking, background GPS on Android, the taximeter, order offers to drivers, or payments?
- Yandex or Google maps in Uzbekistan: what did you use on each project, and why?
- Roughly how long did the first working version take, and how many people worked on it? Ranges are fine, and 'I don't remember' is fine too.
- What do taxi or delivery founders here usually underestimate: driver onboarding, rules and licences, app store review, support?
- What would you do differently if someone asked you for a taxi app today?
- What does a minimal taxi or delivery MVP cost on your so'm price list, and what is the first thing to cut to fit a smaller budget?
- Which video moments best show the product (driver accepting an order, the live map, the taximeter)?

### softwhere.app (en): How long and how much: building an app MVP with an offshore team (numbers from apps we shipped for US clients)

**Why:** MVPs and mobile apps are the lead .app services. Most of the portfolio is React Native work for Western clients: United Fuel Driver, Medrite, Challenge EI, AI Merch, LiveMySteps, Swish, Netevia, Persona and others. Cost and timeline are what buyers search for first. Real timelines and team sizes, priced against the new $40-45/h price list, are original numbers that AI answers can quote. Nothing is carried over from the old English posts: they were written for Uzbek buyers and their traffic is from before July. Written in November, live when .app launches.

**Voice-note questions for the founder:**

- Pick 3-5 US projects you know best. For each: what was in the first release, how many weeks did it take, and how big was the team? Ranges are fine; no client names unless allowed.
- What did you deliberately leave out of v1, and was that the right call?
- Where did timelines slip, and why: client decisions, app store review, third-party APIs (Plaid, Stripe, Auth0, AWS)?
- How do you handle the time difference with US clients: overlap hours, standups, who joins calls?
- With the $40-45/h price list, what does a typical MVP cost, and what most often makes it bigger?
- When do you recommend React Native / Expo, and when do you tell a client to go native or web instead?
- What do you ask a founder on the first call to give an honest estimate?
- What can we show: video frames, App Store or Play Store links, and which client quotes do we have permission for?

### softwhere.app (en): How to vet an offshore development team before you sign: a checklist from the vendor's side

**Why:** Western buyers who hire offshore teams search exactly this: outsourcing vs in-house, how to choose a company, hiring dedicated developers. Those were T26, T28, T43 and T57, which are retired on .uz. A vendor's honest view, based on real vetting by US clients (for example the Perimeter Software subcontract for Stadium People), fits the 'Tashkent base low-key, never hidden' positioning. It answers buyers' real worries (IP, payments through Payoneer/Wise, continuity) with sources. The unpublished T57 draft is raw material. Written in November, live when .app launches.

**Voice-note questions for the founder:**

- What did US clients check before hiring you: a trial task, references, code samples, security questions, a call with the developers?
- How do your contracts handle IP and code ownership? Who owns the repos, accounts and app store listings from day one?
- How do you get paid (Payoneer, Wise), and what invoicing and payment terms do clients prefer?
- What red flags have you seen in other vendors, from clients who came to you after a bad experience? Real cases only.
- What does a normal week with a US client look like: demos, written updates, overlap hours?
- What happens if a developer leaves mid-project? How do you keep continuity?
- Which question should buyers ask a vendor that almost nobody asks?
- What do buyers worry about with a team in Uzbekistan specifically (time zone, holidays, internet, English), and what's the honest answer?

## Per-topic actions

| Topic | uz | ru | en (on .uz, removed at .app launch) | softwhere.app later | Reason |
| --- | --- | --- | --- | --- | --- |
| T1 7 signs your business needs a mobile app | Now: the founder checks the flagged lines; remove the fake companies, keep '50+ projects' only if true. Jan 2027: 301 to T10 uz. | Now: delete '70% наших клиентов'. Jan 2027: 301 to T10 ru. | Now: delete the invented Samarkand grocery-client story. Unpublish (404) at the .app launch. | No. | 0 uz/ru clicks since July. Indexed in every language. 'Do I need an app' is one question inside the T10 decision guide. |
| T2 AI trends 2026 | Keep until the Feb 2027 retire batch, then unpublish. | Now: delete the invented logistics-client story and the '70%' figure. Feb 2027: unpublish. | Now: delete the 'hypothetical client' line. Unpublish at the .app launch. | No. | A dated trend piece with 0 clicks ever. It matches no service and is generic content. |
| T3 MVP in 90 days | Unpublish now (cut off mid-word, fake companies). In the same deploy, point the alias 'mvp-yaratish-90-kunlik...' at T35 uz. | Keep (indexed, 1 click since July). No rewrite in year one. | Unpublish at the .app launch. | Covered by new .app post A (MVP timelines and costs from real projects). Not moved over. | MVP is a lead service on .app, not on .uz. The Uzbek post is broken. The Russian post is clean and has a click. |
| T4 Native vs cross-platform | Feb 2027: 301 to T30 uz. T25 uz has never been crawled, so the merge goes the other way in Uzbek. | Feb 2027: 301 to T25 ru. | Unpublish at the .app launch. | Maybe in 2027, inside a React Native lessons post. | 0 clicks since July. Same question as T25 and T30. Merges only go into indexed pages. |
| T5 Website speed | Unpublish now (cut off mid-word). In the same deploy, point the alias 'veb-sayt-ishlashini-optimallashtirish...' at T15 uz. | Feb 2027: 301 to T15 ru. T5 ru is unknown to Google. | Unpublish at the .app launch. | No. | 0 clicks since July. All 3 historic uz/ru clicks were on old pre-July URLs. |
| T6 Which processes to automate first | Unpublish now (cut off mid-word, never crawled). | Keep (indexed). No rewrite in year one: AI automation is covered by T12 and new posts. | Unpublish at the .app launch. | No. | 0 uz/ru clicks. The Uzbek page was never crawled. It quotes $3.5-5.5k, against your much lower prices. |
| T7 Telegram bot security | Keep as is (clean, 2 clicks since July). | Now: delete the hedged 'hypothetical client' line. Keep. | Now: delete the hedged client line. Unpublish at the .app launch. It is already 'Crawled - not indexed'. | Don't move it over. Western Telegram demand is small and 90% of the old English traffic came before July. | Telegram topics earn 57% of blog clicks. Indexed in uz and ru with no other flags. |
| T8 Telegram Mini Apps: the future | Jan 2027: 301 to T10 uz, in the T10 rewrite deploy. | Now: delete the invented coffee-chain client. Jan 2027: 301 to T10 ru. | Unpublish at the .app launch. | No. | 3 uz/ru clicks since July. It is the only merge with query evidence: it competes with T10 for 'mini ilova' and 'telegram ilova'. |
| T9 Telegram bot for business (guide) | Rewrite in Apr 2027 at the same URL. Replace the $4-8k figures with the so'm price list. In that deploy it absorbs T42 and T46. | Now: delete the invented 'what we built' scenarios. Rewrite together with uz. | Now: delete the invented story. Unpublish at the .app launch. | No. | 3 uz/ru clicks since July. 10 of its 13 long-window clicks were on old URLs. It is a core .uz service and is indexed. |
| T10 Telegram Mini App vs regular app | .uz post 1: rewrite in Jan 2027 at the same URL as 'Mini App, website or app'. It absorbs T1, T8, T11 and T24, and gets the calculator. | Rewrite together with uz, at the same URL. | Unpublish at the .app launch. It is already 'Crawled - not indexed'. | Don't move it over. | The best page: uz 11 clicks / 290 impressions / position 5.5 since July, 23% of blog clicks. Its $40-60k native-app prices contradict yours. |
| T11 PWA vs mobile app | Jan 2027: 301 to T10 uz. | Jan 2027: 301 to T10 ru. | Unpublish at the .app launch. | Maybe later, a PWA vs native post backed by portfolio work, if Western leads ask about it. | 0 uz/ru clicks since July. A PWA is the third option in T10's decision. This merge is an editorial choice; the two posts share no queries. |
| T12 RAG for business knowledge | Rewrite in May 2027 at the same URL as 'AI on your own documents', using Talim AI and Brand Guard work. It absorbs T44 ru. | Rewrite together with uz. Drop the $35-65k figure. | Now: delete 'Most of our clients'. Unpublish at the .app launch. | Maybe in 2027, as the source for a 'website AI assistant' post (an .app offer). | 0 uz/ru clicks since July; the 5 long-window clicks were on old URLs. But AI automation is a .uz service, Talim AI is real RAG work, and both locales are indexed. |
| T13 SaaS architecture | Keep (clean, 1 click since July). | Keep (1 click). No rewrite in year one. | Now: delete the invented pharma-distributor story. Unpublish at the .app launch. | No. The .app MVP posts cover it. | Small but steady traffic. Not a service .uz pushes, so it gets no founder time. |
| T14 Custom CRM vs Salesforce/HubSpot | Now: delete 'ikki mijozimizni... qutqardik'. Keep. Feb 2027: absorbs T39 and T51. | Now: delete '3 из 4 наших клиентов'. Keep. | Now: delete the invented story. Unpublish at the .app launch. | No. | 1 ru click since July. Indexed in uz and ru. CRM sits next to the AI automation offer. |
| T15 SEO-friendly web development | Keep for now as the website-quality page. It takes the T5 uz alias now. Later it merges into the websites page once that page is indexed. | Keep. It absorbs T5 ru in Feb 2027. | Now: delete the invented rebuild story. Unpublish at the .app launch. | No. | Indexed in uz and ru, 0 clicks since July. Websites are a .uz service, and no better indexed page exists yet. |
| T16 Mobile app cost 2025 | Rewrite in Mar 2027 at the same URL: keep the slug 'mobil-ilova-narxi-2025-...' and change only the title. Base it on the so'm price list. It absorbs T37 and T49 ru. | Rewrite together with uz. Same rule: keep the slug, change the title. | Unpublish at the .app launch. | Covered by .app post A. | The question buyers ask most. 1 ru click since July (5 of the 6 long-window clicks were on old URLs). Its $50-300k figures contradict your prices. |
| T17 How automation saved 20 hours a week: a real business case | Unpublish now. It has an English slug and a title claiming an invented 'real business case'. | Unpublish now, if you confirm the 'кейс компании' is invented (1 click since July). | Unpublish now, after the redirect fix ships in October. | No. | The whole post is an invented case, so deleting a few sentences can't fix it. |
| T18 Web development trends 2026 | Feb 2027: unpublish (never crawled). | Feb 2027: 301 to T20 ru. | Unpublish at the .app launch. | No. | 0 clicks since July. A trend piece that overlaps T20. |
| T19 Mobile UI/UX design trends (2024/2025) | 301 to T50 uz, but only once T50 uz is indexed (today it is only 'Discovered'). Keep it until then. | Feb 2027: unpublish (never crawled, '2024' in the slug). | Unpublish at the .app launch. | No. | 0 clicks. Same subject as T50. Never redirect into a page Google hasn't indexed. |
| T20 Modern web frameworks | Now: delete the 'mijozlarimizdan biri... (faraziy misol)' line. Keep. | Keep (1 click since July). It absorbs T18 ru in Feb 2027. | Now: delete the invented Tashkent B2B-portal story. Unpublish at the .app launch. | No. | 2 uz/ru clicks since July, indexed. Few buyers search this, so it gets no rewrite. |
| T21 Mobile app maintenance | Keep. Feb 2027: absorbs T52 uz and T53 uz. | Now: delete the invented retail-client line. Keep. It is not indexed, so nothing merges into it. | Unpublish at the .app launch. | No. | 0 clicks since July; the 3 ru clicks were on old URLs. Maintenance is an upsell worth one page. |
| T22 Mobile app security | Feb 2027: unpublish (never crawled). | Feb 2027: unpublish (never crawled). | Now: delete the invented bank-wallet '60%' story. Unpublish at the .app launch. | No. | Google has never crawled it in any language. All 6 uz clicks were on pre-July old URLs. It quotes $27-44k. |
| T23 Starting a startup in Uzbekistan | Keep. | Keep (indexed; an old RU URL still ranks). | Now: delete 'half our clients'. Unpublish at the .app launch. | No. | A local question no one else answers (IT Park, grants). 0 clicks since July, so it gets no founder time in year one. |
| T24 PWA apps | Jan 2027: 301 to T10 uz. | Jan 2027: 301 to T10 ru. | Now: delete the invented story. Unpublish at the .app launch. | No. | 0 clicks since July. A PWA is one of the options in T10's decision guide. |
| T25 React Native vs Flutter | Feb 2027: unpublish (never crawled). | Keep as the Russian framework page. It absorbs T4 ru and T30 ru. | Now: delete the invented story. Unpublish at the .app launch. | Maybe in 2027: React Native lessons from your ~40 RN projects. | 0 uz/ru clicks since July; the 4 ru clicks were on old URLs. Only the Russian page is indexed. |
| T26 Outsourcing vs in-house | Feb 2027: unpublish. | Feb 2027: unpublish. | Unpublish at the .app launch. | Covered by .app post B (vetting an offshore team, from the vendor's side). | 0 uz/ru clicks ever. This is a question Western buyers ask. |
| T27 Technical debt checklist | Feb 2027: 301 to T45 uz if T45 stays, otherwise unpublish. | Same as uz. | Unpublish only after the redirect fix: the slug is the same in all three languages and would otherwise redirect to a random one. | Maybe in 2027, together with T45. | English slug on the ru and uz pages, 0 clicks. |
| T28 How to choose an app development company | Feb 2027: unpublish (never crawled). | Feb 2027: unpublish (never crawled). | Unpublish at the .app launch. | Covered by .app post B. | 0 uz impressions; ru sits at position 25.7. Vetting a vendor is a Western buyer's question. |
| T29 User acquisition for mobile apps | Feb 2027: unpublish. | Feb 2027: unpublish. | Unpublish at the .app launch. | No. | Marketing is not a service you sell. 0 clicks. |
| T30 Choosing a mobile framework | Keep as the Uzbek framework page (indexed, 36 impressions since July). It absorbs T4 uz. | Feb 2027: 301 to T25 ru. | Unpublish at the .app launch. | Same as T25. | In Uzbek the merge goes the other way, because T25 uz has never been crawled. |
| T31 App development timeline | Rewrite in Jun 2027 at the same URL, with real timelines from the portfolio. Replace the $30-250k figures. | Rewrite together with uz. | Now: delete the invented Samarkand food-delivery story. Unpublish at the .app launch. | Covered by .app post A. | 3 uz/ru clicks since July. The ru page sits around position 10 for 'срок разработки мобильного приложения'. |
| T32 E-commerce website features | Feb 2027: 301 to T47 uz. | Feb 2027: 301 to T47 ru. | Unpublish at the .app launch. | No. | 0 clicks. Same subject as T47. Its uz impressions come from an off-topic query. |
| T33 Security myths | Feb 2027: unpublish. | Feb 2027: unpublish (never crawled). | Now: delete the invented story. Unpublish at the .app launch. | No. | Generic, 0 clicks, and no indexed page to merge it into. |
| T34 Web accessibility | Feb 2027: unpublish. | Feb 2027: unpublish. | Unpublish at the .app launch. | Maybe later: an EU accessibility-rules explainer for EU buyers, built only on cited sources. | 0 clicks, and buyers in Uzbekistan don't search for it. |
| T35 MVP vs full product | Keep (clean, 1 click since July). It takes the T3 uz alias now. | Now: delete the invented artisan-marketplace client. Keep. | Unpublish at the .app launch. | Covered by .app post A. | Indexed, and it has the only Uzbek MVP click. |
| T36 AI customer support | Feb 2027: unpublish (never indexed). | Feb 2027: unpublish (never indexed). | Unpublish at the .app launch. | Source material for the 2027 'website AI assistant' .app post. | 0 impressions in every language. |
| T37 MVP development cost | Mar 2027: 301 to T16 uz, in the T16 rewrite deploy. | Mar 2027: 301 to T16 ru. | Unpublish at the .app launch. | Covered by .app post A. | A cost question, '2024' in the slug, 0 clicks. |
| T38 Automation ROI | Feb 2027: unpublish. | Feb 2027: unpublish (never crawled). | Unpublish at the .app launch. | No. | 0 impressions. Its natural hub (T6 uz) was never indexed. |
| T39 Custom CRM ROI | Feb 2027: 301 to T14 uz. | Feb 2027: 301 to T14 ru. | Now: delete the invented 2023 pharma CRM story. Unpublish at the .app launch. | No. | 0 uz/ru impressions. Both sides of the merge are indexed. |
| T40 AI myths for small business | Feb 2027: unpublish (never indexed). | Now: delete 'трое из пяти наших клиентов'. Feb 2027: unpublish. | Now: delete the invented Almaty brokerage story. Unpublish at the .app launch. | No. | 0 impressions in every language. |
| T41 SaaS launch to 100 paying users | Feb 2027: unpublish. | Now: delete the invented client story. Feb 2027: unpublish. | Now: delete the invented story. Unpublish at the .app launch. | No. | 0 impressions. Never indexed or only 'Discovered'. |
| T42 Telegram bot for business (getting started) | Apr 2027: 301 to T9 uz, in the T9 rewrite deploy. | Apr 2027: 301 to T9 ru. | Unpublish at the .app launch. | No. | The ru page got 2 clicks since July but averages position 43. Same question as T9. |
| T43 Outsourcing cost comparison | Feb 2027: unpublish. | Feb 2027: unpublish. | Now: delete the invented story. Unpublish at the .app launch. | Covered by .app post B. | 0 clicks. A Western buyer's question. |
| T44 AI chatbot vs FAQ page | Feb 2027: unpublish (never crawled). | Now: delete 'большинства наших клиентов'. May 2027: 301 to T12 ru. | Now: delete the hedged client line. Unpublish at the .app launch. | Source material for the 'website AI assistant' .app post. | 0 uz/ru impressions. Only the Russian page is indexed. |
| T45 Finishing an abandoned app (project rescue) | Keep only if you confirm real rescue projects; in that case rewrite it in the second half of 2027. If not, unpublish in Feb 2027. | Now: delete the invented pirated-licence client. Then same as uz. | Now: delete the invented story. Unpublish at the .app launch. | Maybe in 2027: a rescue post built on real cases. | A distinct service people pay for, but 0 clicks so far. It needs real experience behind it. |
| T46 Automating sales with a Telegram bot | Apr 2027: 301 to T9 uz. | Apr 2027: 301 to T9 ru. | Now: delete the invented clothing-retailer story. Unpublish at the .app launch. | No. | Sales bots are a section of T9. 0 clicks. |
| T47 Opening an online store in Uzbekistan | Keep (clean, 2 clicks since July). It absorbs T32 in Feb 2027. Refresh it in the second half of 2027 with BirMakon, Primus Mall and Seyf Bazar work. | Keep. It absorbs T32 ru. | Now: delete the invented story. Unpublish at the .app launch. | No. | Indexed. Marketplaces are a .uz service. The uz and ru versions have no flags. |
| T48 UX design ROI | 301 to T50 uz once T50 uz is indexed. Keep it until then. | Feb 2027: 301 to T50 ru. | Unpublish at the .app launch. | No. | 7 uz/ru impressions, 0 clicks. |
| T49 SaaS development cost | Feb 2027: unpublish (never crawled, '2024' in the slug). | Mar 2027: 301 to T16 ru. | Now: delete the invented story. Unpublish at the .app launch. | Covered by .app post A. | A cost question that belongs in T16. It quotes $200-500k. |
| T50 Mobile app design trends users love | Keep. It is only 'Discovered', not yet indexed. | Now: delete 'большинства наших клиентов'. Keep. It absorbs T48 ru. | Now: delete the invented story. Unpublish at the .app launch. | No. | 4 ru clicks since July, but 0 since the spam update began on 09-24 (impressions fell from 48 to 3). Not a service you push, so it gets no rewrite. |
| T51 Building a CRM your team will use | Feb 2027: 301 to T14 uz. | Feb 2027: 301 to T14 ru. | Now: delete the invented 2022 distributor story and the client figure. Unpublish at the .app launch. | No. | 8 uz/ru impressions, 0 clicks. |
| T52 App maintenance checklist | Feb 2027: 301 to T21 uz. | Feb 2027: unpublish. Neither this page nor T21 ru is indexed. | Now: delete the invented Tashkent 'Node 14' client. Unpublish at the .app launch. | No. | 2 impressions. |
| T53 The cost of not maintaining your app | Feb 2027: 301 to T21 uz. | Feb 2027: unpublish (never crawled). | Unpublish at the .app launch. | No. | 3 impressions. |
| T54 10 MVP mistakes | Feb 2027: unpublish (never crawled). | Feb 2027: unpublish (never crawled). | Unpublish at the .app launch. | Covered by .app post A. | 0 impressions anywhere. |
| T55 Web app vs website | Keep. Never crawled yet; check it on 12-02. It is the candidate for the websites page, rewritten with so'm prices in the second half of 2027. | Keep, same as uz. | Unpublish at the .app launch. | No. | Matches the 'websites and landing pages' service, and the uz and ru versions are clean. It has no data yet because Google hasn't crawled it. |
| T56 Data protection laws (draft) | Stays a draft. Possible 2027 supporting post citing Uzbek law, after the founder checks the facts. | Stays a draft, same as uz. | Never publish. | No. GDPR would be a different post. | A local legal question, but legal claims need sources and a fact-check. |
| T57 Hiring dedicated developers (draft) | Stays a draft. Never publish on .uz. | Stays a draft. It contains an invented retail-chain example. | Never publish. | Raw material for .app post B. | A Western buyer's question. |
| T58 Cost of fixing an unfinished project (draft) | Stays a draft. Raw material for T45. | Stays a draft. | Never publish. | Only together with a real-case rescue post. | Rescue cost belongs inside T45. |
| T59 Mobile app ROI (draft) | Stays a draft. Raw material for the T10 rewrite. | Stays a draft. It contains 'большинства наших клиентов'. | Never publish. | No. | App ROI is one section of the T10 decision guide. |

## Risks and guardrails

- Google's September 2026 spam update started on 09-24 and was still listed as rolling out on 10-05. Since 09-26, Russian blog clicks fell from 8 to 0 and T50 RU from 4 clicks to 0. Don't judge any change before about 10-22. Recalculate the stop rule from the new baseline, because at about 0.4 clicks a day the update alone could trigger it.
- You have to make a choice. If the spam-update drop is confirmed, Google's own advice is to remove mass-produced content now, which conflicts with 'nothing big before 2026-12-02'. My recommendation is to wait: the numbers are tiny, and recovery takes months either way. Pulling the February retire batch forward to late October is the alternative, at the cost of muddying the gate measurement.
- Unpublishing an English post breaks redirects. 62 old ru/uz URLs reach their post only through the English post (legacyRedirectTarget step 3). T27 uses the same slug in all three languages, and getPublishedBySlugFlexible has no ORDER BY, so it could redirect to a random language. Ship the language-group redirect fix before any English post is unpublished, including T17 EN in October.
- T3 UZ and T5 UZ are targets of old aliases in legacy-aliases.ts. Point those aliases at T35 uz and T15 uz in the same deploy, or the alias URLs return a 404 that is cached with no expiry. Unpublishing a single language is safe in code, because getGroupSiblings only returns published siblings and the admin PATCH refreshes them. docs/seo-measurement-2026-09.md still says to remove whole three-language groups, so update that rule.
- 50 of the 165 posts are not in Google's index. Redirecting an indexed page into a page Google never crawled loses its ranking; this site lost one that way on 2026-07-09. Run URL Inspection on the hub right before every merge. T50 uz, T21 ru, T25 uz, T6 uz, T5 ru, T22 and T55 are not indexed today, and the plan already avoids merging into them.
- Rewriting T10, the best page, risks its position 5.5 ranking. Keep the URL and the main question and answer at the top, change one thing at a time, and watch it for 4-8 weeks before doing more rewrites.
- BLOG_AUTHOR_NAME is a single setting for the whole site (page.tsx:287, seo.tsx:100). Turning it on would put the founder's name on all 165 posts, including the invented stories. A per-post byline (an authors table) has to exist first.
- Blog prices have to match the planned price lists, not the current $14/h estimator: fixed so'm on .uz and $40-45/h on .app. The '87 posts at 3-10x' figure is an upper bound that includes competitor figures. Until each post is rewritten, the posts left live still show high USD ranges.
- The invented-story list comes from an automatic pattern scan. It flags some true claims and misses fake companies and claims that pair a city with a percentage. The founder must confirm it post by post, and nothing gets deleted on regex alone.
- The generator runs every Monday at 06:17 UTC and the check ran at 01:44 UTC today. If it isn't turned off before then, it adds 3 more drafts and spends AI budget.
- The server and DNS move planned before 2026-12-02 affects the gate more than the blog fixes do. Keep blog changes out of those weeks and log both with their dates.
- Google crawls this site slowly: about 8 requests a day and about 1 new URL a day. New posts, merges and the new softwhere.app domain will take weeks to months to show up. Don't judge a new post before 8-12 weeks. Mentions on other sites (LinkedIn company page, Clutch, goldenpages.uz, local media) do more for search and AI answers than a second Instagram account or a WhatsApp username.
- Your capacity is the real budget. October goes on reviewing the trust fixes. If a voice note slips, skip that month rather than publish unreviewed AI text. Uzbek quality depends on the blind test and on a native speaker reading every post: Yandex's AI answers favour grammatically correct pages.
- The .uz site sells Telegram bots and Mini Apps, but the portfolio shows only the Hello Box admin panel. If the team has no real Mini App work, the T10 and T9 rewrites must be source-based decision guides, never 'we built' claims.
- Client names, logos and quotes from the portfolio (US clients, Honda Research Institute, Medrite and others) appear in posts only with each client's written permission.
- With about 13 blog clicks a month, no month-to-month difference means anything (the doc says about 31 clicks per 28 days are needed). Judge on signals like indexing, ranking position and leads, and keep the 10-03 gate recorded as missed rather than quietly moved.
