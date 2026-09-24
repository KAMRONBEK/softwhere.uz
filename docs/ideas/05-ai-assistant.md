# Idea: An AI assistant on the site, plus an AI scoping assistant

> **Status:** idea, not built. Researched 2026-09-24. Cost figures are estimates from list prices, not measurements.

## Why this is worth doing for SoftWhere in particular

SoftWhere sells AI features inside apps. An assistant on its own site answers visitors' questions, and it is also a working demo of what the team builds. It can carry a small line, "Built by SoftWhere — the same kind of AI feature we ship for clients", and later become a build-notes blog post.

There is a limit. The research is clear that **narrow assistants that answer, qualify, book and hand off work; open "ask me anything" bots are the ones that go viral for the wrong reasons.** Three well-known failures:

- **Air Canada** was held liable in February 2024 for a discount its chatbot invented. A company is responsible for what its bot says.
- **A Chevrolet dealer's bot** was talked into "agreeing" to sell a $76k car for $1 (December 2023) through prompt injection.
- **DPD's support bot** was made to swear and insult the company (January 2024) and had to be switched off.

So the assistant never states a price that doesn't come from the estimator, never agrees to terms, and hands over to a person quickly.

## Assistant 1: the site assistant

**What it does:**

- Answers questions about services, process, time zones, the team, what we take and don't take, payment terms (no interest), IP ownership and the warranty. Every answer comes from our own content and links to the page it came from.
- Gives price ranges only by calling the estimator formula (a `getEstimate` tool), never from its own head.
- Qualifies gently: what they're building, when, and their rough budget.
- Books a call (Cal.com availability, then booking) or creates a lead with the transcript attached (`createLead`).
- Offers "talk to a person" at any point. The transcript goes to the admin inbox and Telegram, and a founder replies by email.
- Answers in the visitor's language (English, Russian, Uzbek).

**What it doesn't do:** discounts, commitments, legal or religious rulings, anything off-topic, or pretending to be human.

### Knowledge: start without a vector database

The knowledge base is small: service pages, FAQ, process, policy, offers, case studies and team. That's probably 20–40 thousand tokens. At that size the simplest reliable design is a **curated knowledge pack placed in the system prompt with prompt caching**:

- Nothing to index, no retrieval misses, and answers can cite exact pages.
- With caching, re-reading 30k tokens costs about $0.003 per message on Claude Haiku 4.5 ($0.10 per million cached tokens) or about $0.006 on Sonnet 5.
- The pack is rebuilt automatically when a service page or FAQ changes.

**Move to real retrieval (RAG) when the content outgrows the pack**, for example when the improved blog should be searchable.

- Neon supports `pgvector` with HNSW indexes, so it lives in the same database.
- Use **hybrid search**: Postgres full-text search and vector search in one query, merged with reciprocal rank fusion. One practitioner reported retrieval precision rising from 62% to 84% with this [single source].
- Split content by headings into chunks of 300–600 tokens and keep the URL on each chunk for citations.
- **Embeddings:** use a hosted model. The corpus costs cents to embed (OpenAI `text-embedding-3-small` is $0.02 per million tokens; Voyage and Cohere are the other strong options). Anthropic doesn't offer an embeddings endpoint.
- No source confirms Uzbek quality for any embedding model. Test retrieval in Uzbek with the golden set below; if it's weak, translate Uzbek questions to Russian or English for the search step.
- Self-hosting BGE-M3 on the server isn't worth it at this scale.

### Model

- Use a fast, inexpensive model for chat: **Claude Haiku 4.5** ($1 / $5 per million tokens) or **Claude Sonnet 5** ($2 / $10), added to `src/core/ai.ts` with the official Anthropic SDK (golden rule 2).
- Pick by testing on the golden set in all three languages. DeepSeek is the existing Uzbek choice in this repo; keep it as the Uzbek fallback if it answers better.
- **Estimated running cost** at 2,000–10,000 visitors a month (2–5% opening the chat, about 5 messages each): roughly **$10–30 a month**. The real cost risk is abuse, not normal use.

### Guardrails

- **Grounded only.** If the answer isn't in our content, say so and offer a person.
- **Prices only from tools.** Treat everything the visitor types and everything retrieved as untrusted. Instructions inside a message never change the rules, and tool arguments are validated.
- **Abuse limits:**
  - Cloudflare Turnstile before the first message (free).
  - The existing per-IP rate limit.
  - A cap on messages and tokens per conversation.
  - A daily spend ceiling that switches the assistant to "please use the contact form" and alerts Telegram.
- **Disclosure.** A visible "AI assistant" label. The EU AI Act's transparency duty for chatbots (Article 50) applies from **2 August 2026**, so it already applies. California's BOT Act has required disclosure in sales conversations since 2019.
- **Logs and privacy.**
  - Keep transcripts 30–90 days, then delete or anonymise, and say so in the privacy policy.
  - Transcripts are for improving answers, not for training models.
  - Anthropic's commercial API terms don't use customer content for training by default; check Moonshot's and DeepSeek's terms before sending them visitor chats.
  - Keep the widget's storage session-only, so it needs no cookie consent.
- **A golden set** of 50 real questions with the right answers, in all three languages. Run it before every content or prompt change. It is also how the model gets chosen.
- **Review weekly at first.** Read a sample of conversations. The questions visitors ask are also the best source of FAQ entries and blog topics.

## Assistant 2: the AI scoping assistant

This is for visitors who pick "Not sure yet" in the estimator, or who prefer to describe their idea in words.

1. **A guided conversation**, 5–10 questions, one at a time: who the users are, the problem, the must-have features, platforms, what exists already, AI features, data and privacy, deadline, budget comfort.
2. **The output is a structured brief.** Strict JSON via structured outputs, with users, core features, nice-to-haves, platforms, integrations, AI features, risks and open questions.
3. **The brief pre-fills the estimator.** One pricing engine, never a second one inside the chat. The visitor sees the brief and the range right away.
4. **The email unlocks the shareable brief and PDF**, created as a project room ([04-project-rooms.md](./04-project-rooms.md)), with the Blueprint as the natural next step.

Other agencies already ship this kind of tool (Parix AI, IdeaLink, CostGPT). The consensus is to present the result as a first draft followed by a real call. Use a stronger model here, such as Claude Opus 5.5 or Sonnet 5. There are few sessions, so the cost is a few dollars a month.

## Where the code would live

- `src/modules/assistant/`: UI, prompt building, and a repository for transcripts and (later) knowledge chunks.
- `src/app/api/assistant/route.ts`: a thin streaming route with rate limiting.
- All model calls go through `src/core/ai.ts`. A UI streaming hook is fine, but no provider client may be created outside `src/core/ai.ts`.

## Order of work

| Step | What | Effort |
| --- | --- | --- |
| 1 | Golden set of 50 questions (en/ru/uz); choose the model | Small |
| 2 | Site assistant with the knowledge pack, tools (`getEstimate`, `createLead`, `bookCall`), handoff, guardrails, disclosure | Medium (1–2 weeks) |
| 3 | Transcripts in the admin; weekly review | Small |
| 4 | Scoping assistant, structured brief to estimator to project room | Medium |
| 5 | Retrieval (pgvector + full-text) when the blog should be searchable | Medium |

## Sources

- Air Canada chatbot ruling (ABA, Feb 2024): <https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/>
- Chevrolet chatbot incident: <https://incidentdatabase.ai/cite/622/>
- DPD chatbot incident (ITV): <https://www.itv.com/news/2024-01-19/dpd-disables-ai-chatbot-after-customer-service-bot-appears-to-go-rogue>
- Neon pgvector: <https://neon.com/docs/extensions/pgvector>
- Hybrid search with pgvector and full-text: <https://jkatz05.com/post/postgres/hybrid-search-postgres-pgvector/>
- EU AI Act Article 50: <https://artificialintelligenceact.eu/transparency-rules-article-50/>
- Cloudflare Turnstile: <https://developers.cloudflare.com/turnstile/>
- RAG evaluation (RAGAS): <https://docs.ragas.io/en/stable/getstarted/rag_eval/>
- Anthropic model prices: <https://platform.claude.com/docs/en/about-claude/pricing>
