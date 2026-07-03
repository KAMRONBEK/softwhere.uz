# Estimator v2 — Central Asia market-calibrated pricing

> Supersedes `estimator-section-plan.md` (v1, hour-based at $35/h). Rebuilt July 2026
> after market research showed v1 overpriced local work 3–5×.

## Pricing model

- **Blended rate: $14/h** (design + dev + QA + PM averaged). Basis: Tashkent
  quality-agency band. Clutch UZ list rates ($25–49/h) are export-facing; the
  effective local rate for quality agencies is $10–20/h. Median UZ dev salary
  ≈ $745/mo ⇒ fully-loaded cost ≈ $5–6/h; IT Park residents pay 0% profit/VAT/
  social tax (regime through 2040), so $14/h keeps a healthy margin.
- **Hours model** (`utils/estimator.ts`):
  `(base + extra screens + features×featureFactor) × tier × design × languages × mobile + integrations`, all `× urgency`.
  - `featureFactor` per subtype models starter-kit reuse (0.6 web e-commerce … 1.0 landing).
  - Feature hours can be overridden per project type (`hoursFor`) — a "catalog"
    inside a Telegram bot is menus, not UI.
  - Integrations are fixed effort (a Payme hookup is the same job at any tier).
  - Design multiplier applies only to subtypes with screens.
- **Output is a range** (×0.85 … ×1.3, rounded to friendly steps) with a
  per-subtype price floor — ranges + rate disclosure are what make calculators
  credible (competitor UX research).

## Calibration

Run after touching constants/catalog:

```
yarn tsx scripts/estimator-calibration.ts
```

Market target bands (Tashkent, 2026 research — sources: Clutch/GoodFirms UZ
profiles, Innosoft/KATOV/webnum/muvasayt/wdagency price lists, hh.uz salary
report, spot.uz market surveys):

| Scenario | Target | Engine (July 2026) |
|---|---|---|
| Landing (custom design) | $300–700 | $400–650 |
| Corporate site (standard) | $800–1500 | $1,100–1,800 |
| Web e-commerce + Payme/Click/OFD | $1200–3000 | $2,400–3,800 |
| Telegram info bot | $250–400 | $220–350 |
| Telegram order bot | $400–700 | $500–850 |
| Order bot + Payme/Click | $700–1000 | $850–1,400 |
| Mini App + payments | $1500–2500 | $2,000–3,200 |
| Mobile MVP (cross, both stores) | $3000–8000 | $3,800–7,000 |
| Custom CRM (standard) | $5000–10000 | $5,750–9,250 |
| AI chatbot | $830–1250 | $950–1,500 |

## AI refinement (Kimi K2.6 / DeepSeek)

`/api/estimate` computes the formula server-side, then asks Kimi for a refined
range + localized reasoning:

- **Strict structured output**: `response_format: json_schema` (MFJS subset —
  explicit `type` everywhere, no oneOf/allOf/format). DeepSeek fallback
  degrades to `json_object` (fields are described in the prompt too).
- **Thinking disabled** — at ~43 tok/s first-party throughput, reasoning tokens
  would blow the 45s budget; `max_tokens` 1400.
- Reasoning language follows the UI locale; Uzbek prefers DeepSeek
  (UzLiB 0.709 vs Kimi 0.518).
- AI output is **clamped** to [0.6×min … 1.6×max] of the formula
  (`clampAiRange`) so the model can never contradict the on-screen range wildly.
- The free-text project description feeds the prompt — the AI flags scope the
  checkboxes miss (verified live: it caught an unmentioned bonus program and
  mandatory OFD fiscalization).
- UX: the formula range renders instantly; the AI block loads async on the
  result step and hides on failure. Result is **never gated** behind contact info.

## Lead capture

`/api/estimate/lead`: re-computes the formula server-side (client numbers are
display-only), stores the lead in the `leads` table (`source: 'estimator'`,
full config summary in `message`) FIRST, then best-effort Telegram HTML
notification (`TG_BOT_TOKEN`/`TG_CHAT_ID`), `notified_telegram` tracks the
outcome. Every user-controlled string is `escapeHtml`-ed.

## Catalog

`data/catalog.ts` — 6 service types, 29 subtypes, 45 features (8 categories),
30 integrations (Payme/Click/Uzum/Paynet/Nasiya/OFD, Kaspi/YooKassa/Stripe,
Eskiz/PlayMobile SMS, Yandex/2GIS/Google maps, 1C/Bitrix24/amoCRM/MoySklad/
Billz/Smartup, OneID/MyID/E-IMZO/Didox), ~53 technologies with brand icons
(`react-icons/si`, zero new deps). Ids double as i18n keys
(`subtype.<id>` / `feature.<id>` / `integration.<id>`); tech display names are
hardcoded in the catalog (proper nouns need no translation).

## Analytics

`estimator_start`, `estimator_complete`, `estimator_ai {ok|unavailable|error}`,
`estimator_lead_submit` — typed in `shared/utils/analytics.ts`.
