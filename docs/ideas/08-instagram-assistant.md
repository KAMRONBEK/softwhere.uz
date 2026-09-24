# Idea: Claude on SoftWhere's Instagram (DMs, comments, posting)

> **Status:** idea, not built. Researched 2026-09-24. Meta's developer pages could not be opened from the research sandbox, so API limits and policy wording below come from dated secondary sources. Check each against developers.facebook.com with a real token before building.

## Short answer

Yes, through Meta's official Instagram API. For the company's **own** account it needs no App Review:

- a Professional (Business or Creator) Instagram account;
- a Meta developer app in development mode, with the account added as a tester.

That standard access is enough for DMs, comments, publishing and insights. App Review and Meta Business Verification are only needed if the bot later serves **other** companies' accounts.

Never use unofficial libraries (instagrapi) or a browser or "computer use" agent logged into the account. That is the one path with real ban risk.

## Part 1: Talking to leads in DMs

### What Instagram allows

| Action | Allowed? |
| --- | --- |
| Bot replies within 24 hours of the lead's last message | Yes |
| Replies 1–7 days later | Only a person, using the `HUMAN_AGENT` tag. Meta says a bot must not apply it. |
| First message to someone who never wrote or commented | No; there is no API for cold DMs |
| One private DM in reply to a comment, within 7 days of the comment | Yes, once per comment. This is the "comment ESTIMATE" funnel. |
| A business-specific AI assistant (our services, prices, booking) | Yes. Meta's January 2026 ban on general-purpose AI chatbots applies to WhatsApp only. Keep the bot about SoftWhere so it stays well inside that line. |
| Not saying it's a bot, or no way to reach a person | Don't. The EU AI Act (Article 50, from 2 August 2026) and California's BOT Act require disclosure, and a similar Meta policy from January 2026 is reported [unverified]. |
| Using DM content from the API to train models | Reportedly forbidden by Meta's data-use terms [verify]; use transcripts only to improve prompts and answers. |

### How it would work

```
Lead writes (or comments "ESTIMATE")
  → Meta webhook → our server (verify signature)
  → load the conversation from Postgres
  → voice message? transcribe first (Whisper)
  → Claude with a SoftWhere-only prompt and tools:
       get_price_range  (the estimator formula, never a made-up price)
       book_call        (Cal.com)
       create_lead      (the admin inbox from 01)
       handoff          (Telegram alert to a founder, bot pauses)
  → Send API reply (with "I'm SoftWhere's AI assistant" in the first message)
```

- **Human takeover.** When a founder replies from the Instagram app, Meta sends our webhook an "echo" of that message, but doesn't say who sent it. So we keep the IDs of messages the bot itself sent. Any echo not on that list means a human has replied, and the bot goes quiet in that conversation, for example for 24 hours or until a founder hands it back. Even ManyChat doesn't solve this automatically, so it has to be built. Meta's Handover Protocol, which passes control to the Business Suite inbox, is the alternative.
- **Roll it out in two modes:**
  - **Draft mode first:** Claude writes the reply, and a founder approves it with one tap in Telegram or the admin.
  - **Auto mode:** switch it on later, only for question types that proved safe (services, process, timelines, booking).
- **Languages.** Leads mix Uzbek and Russian, and often send voice messages. Evidence on Claude's conversational Uzbek is thin, so test Claude Haiku 4.5, Claude Sonnet 5 and DeepSeek on 30–50 real past DMs, reviewed blind by a native speaker, before choosing.
- **Voice messages.** Whisper handles Russian and English well. Uzbek speech recognition is weak, so when a transcript looks unreliable the bot should ask politely for text or hand over to a person.
- **Guardrails.** These are the same as the site assistant in [05-ai-assistant.md](./05-ai-assistant.md):
  - It never states fixed prices, discounts or promises.
  - It hands over quickly.
  - A spend cap applies.
  - A founder reviews transcripts weekly.
- **Model and cost.**
  - Claude Haiku 4.5 ($1 / $5 per million tokens) is the fast default; use Sonnet 5 ($2 / $10) if it clearly wins the language test.
  - At a few hundred conversations a month, with the system prompt cached, expect **under $10–20 a month**.
  - All calls go through `src/core/ai.ts`, which today only has Kimi and DeepSeek. Adding Claude there is step 1 of [02-blog-engine.md](./02-blog-engine.md).
- **Data.** Keep a retention period (for example 12 months for leads, then delete) and delete stored copies when Meta reports a deleted message. Uzbekistan's personal-data law was loosened on 27 March 2026: ordinary personal data may reportedly be stored abroad under set conditions, but biometric data may not. Confirm with a local lawyer.

### Comment-to-DM funnels for a dev agency

The first private DM is automatic. Once the lead replies, the normal 24-hour window opens and the assistant takes over.

- **"Comment ESTIMATE"** → 2–3 scoping questions → a price range from the estimator → a booking link.
- **"Comment AUDIT"** → the App Rescue checklist → offer the paid audit.
- **"Comment ROADMAP"** → an MVP scoping guide → the Blueprint.

DMs to people who don't follow the account can land in their "Requests" folder, so make the first message short and immediately useful.

### Build, buy, or Meta's own agent

| Option | Good | Not so good |
| --- | --- | --- |
| **Build (recommended)** | Plugs into the admin inbox from [01](./01-leads-inbox-and-email.md), our own prompt, tools and data; a portfolio piece; the same system could become a product for local businesses | 1–2 weeks of work; human takeover must be engineered |
| **ManyChat** (has a native Claude integration via an Anthropic API key, plus comment-to-DM) | Live in a day; good for a 2–4 week pilot to learn what people ask | Monthly fee plus the $29 AI add-on; a second system outside the inbox; no automatic pause when a human replies |
| **Meta Business Agent** (Meta's own AI agent for business inboxes, launched June 2026, about $2 per million tokens) | No API work at all | No choice of model, less control over answers and data, no link to our estimator or inbox |

**A business idea:** Tashkent agencies (Zukko.AI, Lynx AI and others) already sell Instagram and Telegram AI sales bots that "understand Uzbek slang and voice messages". Once SoftWhere's own bot works, it's a natural low-ticket local offer. Serving clients' accounts needs Meta's App Review and Business Verification.

## Part 2: Posting reels, posts and stories

### What the official Content Publishing API can do

| Can | Can't |
| --- | --- |
| Single images, carousels (up to 10), reels, stories (single image or video) | Add Instagram's licensed music library (so bake the audio into the MP4, as the `social-video` skill already does with original music) |
| Captions, hashtags, alt text, location (not on stories), user tags, up to 3 collaborators, custom cover or thumbnail frame, reel share-to-feed | Story stickers: links, polls, questions, countdowns |
| Delete a post | Edit a caption after publishing (delete and repost instead), apply filters |
| Insights: `views` (replaced impressions in 2025), reach, likes, comments, saves, shares, total interactions | Set Meta's "AI info" label (do it in the app) |
| | Schedule natively: our own job must publish at the chosen time, or use Buffer |

How it works: create a media container from a **public URL** of the file, wait until its status is `FINISHED`, then publish. The daily publishing limit is reported as anywhere from 25 to 100; read it from the `content_publishing_limit` endpoint instead of assuming.

### The workflow

```
social-video skill renders the MP4  +  softwhere-social skill drafts caption, hashtags, alt text
  → admin "content queue": preview, edit, pick a time        (a human approves; nothing auto-posts)
  → at that time a background job (pg-boss on our server) creates the container,
    waits for FINISHED, publishes
  → stories that need stickers or links: Telegram reminder to post from the phone
  → every Monday: insights per post → a short Telegram report (what worked, what to repeat)
```

**Label realistic AI voice in the app.** Meta's rules ask for the "AI info" label on realistic AI-made video or realistic-sounding AI audio. The motion-graphics reels don't need it; the version with the AI voice-over probably does, so tick the label in the app when posting it.

**Quicker alternative:** Buffer released an official MCP server in May 2026 (`mcp.buffer.com/mcp`). Connected to Claude, it lets you say "schedule this reel for Tuesday 19:00" in a chat, and Buffer's scheduler does the publishing. It costs about $5–10 a month per channel. Zapier's Claude connector is another route.

## Order of work

| Step | What | Effort |
| --- | --- | --- |
| 0 | Professional account; Meta developer app in dev mode; account as tester; tokens | An hour |
| 1 | Webhook + draft-mode assistant (Claude drafts, founder approves in Telegram), disclosure, handoff, echo-based pause | 1–2 weeks |
| 2 | Language test on real past DMs; auto mode for safe question types | Small |
| 3 | "Comment ESTIMATE" and "Comment AUDIT" funnels | Small |
| 4 | Content queue in the admin + scheduled publishing + weekly insights report (or Buffer's MCP as a stopgap) | Medium |
| 5 | Voice-message transcription | Small |

## Sources (secondary unless noted)

- Instagram Platform overview: <https://developers.facebook.com/docs/instagram-platform/overview/>
- Content Publishing: <https://developers.facebook.com/docs/instagram-platform/content-publishing/>
- Webhooks reference (Instagram): <https://developers.facebook.com/docs/graph-api/webhooks/reference/instagram>
- WhatsApp general-purpose chatbot ban (TechCrunch, 2025-10-18): <https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform>
- Meta Business Agent (Bloomberg, 2026-06-03): <https://www.bloomberg.com/news/articles/2026-06-03/meta-sells-ai-agent-for-businesses-in-push-to-monetize-service>
- EU AI Act Article 50: <https://artificialintelligenceact.eu/transparency-rules-article-50/>
- California SB 1001 (BOT Act): <https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB1001>
- Human Agent tag (Chatwoot guide): <https://www.chatwoot.com/hc/user-guide/articles/1745225158-what-is-human-agent-tag-in-instagram-messenger-channel>
- Comment-to-DM private replies: <https://postproxy.dev/how-to/instagram-comment-to-dm-private-reply/>
- Meta AI content labelling: <https://transparency.meta.com/governance/tracking-impact/labeling-ai-content/>
- instagrapi (unofficial; not for business use): <https://github.com/subzeroid/instagrapi>
