# Project Cost Estimator

Canonical "how it works today" reference for the estimator: the multi-step wizard, the option catalog, the pricing formula, the AI refinement pass, currency conversion, and lead capture. Every claim here is traced to code on `main`; the prior design notes in [`./estimator-v2.md`](./estimator-v2.md) and [`./estimator-section-plan.md`](./estimator-section-plan.md) are history — this doc describes the **actual current implementation**.

## At a glance

| Concern | Where | Notes |
|---|---|---|
| Page (route) | `src/app/[locale]/estimator/page.tsx` | Server component; sets locale + SEO metadata, renders `<Wizard/>` |
| Wizard (state machine) | `src/modules/estimator/components/Wizard.tsx` | `'use client'`; 6 input steps + result; sessionStorage persistence |
| Steps UI | `src/modules/estimator/components/Steps/*` | `TypeStep`, `ScopeStep`, `FeaturesStep`, `IntegrationsStep`, `TechStep`, `DetailsStep` |
| Catalog (data) | `src/modules/estimator/data/catalog.ts` | 6 services, 30 subtypes, 45 features, 30 integrations, 51 tech |
| Pricing constants | `src/modules/estimator/constants.ts` | Blended rate, multipliers, velocity bands, AI clamps |
| Formula (pure) | `src/modules/estimator/utils/estimator.ts` | `calculateEstimate()` + `clampAiRange()` — runs client **and** server |
| Input sanitizer | `src/modules/estimator/utils/sanitize.ts` | `sanitizeEstimatorInput()` — whitelists every enum against the catalog |
| Owner summary | `src/modules/estimator/utils/leadSummary.ts` | `buildLeadSummaryLines()` — English, for Telegram/admin |
| Estimate API | `src/app/api/estimate/route.ts` | `POST` — formula + clamped AI refinement |
| Lead API | `src/app/api/estimate/lead/route.ts` | `POST` — store lead + best-effort Telegram |
| Currency API | `src/app/api/currency/rates/route.ts` | `GET` — USD-base FX rates, 24h cache |
| AI client | `src/core/ai.ts` | Kimi K2.6 → DeepSeek chain over the OpenAI SDK |
| Calibration | `scripts/estimator-calibration.ts` | `yarn tsx scripts/estimator-calibration.ts` |

**Design principle baked into the flow:** the local formula range renders instantly and the AI pass + lead form are pure enrichment layered *after* it. The estimate is **never gated** behind contact info.

## Data flow

```
Wizard (client)
  ├─ input: EstimatorInput  ─── calculateEstimate() ──▶ LivePreview / ResultPanel hero   (instant, client-side)
  │
  ├─ reaches result step ──▶ POST /api/estimate  { input, locale }
  │      route: sanitize → calculateEstimate (authoritative) → AI refine → clampAiRange
  │      ◀── { formula, ai }                                   ResultPanel "AI refinement" block
  │
  └─ LeadForm submit ──▶ POST /api/estimate/lead  { name, phone, ..., input, locale, ai }
         route: sanitize → recompute formula → re-clamp echoed AI → createLead() → after(Telegram)

CurrencySwitcher / useCurrency ──▶ GET /api/currency/rates ──▶ format(usdAmount) everywhere
```

The **same pure function** `calculateEstimate()` powers the instant client preview and the authoritative server recompute. The server never trusts client numbers: both API routes re-sanitize the input and recompute the formula themselves.

## The wizard

`Wizard.tsx` is a single client component holding one `EstimatorInput` in state and a step index. Steps:

```ts
type StepId = 'type' | 'scope' | 'features' | 'integrations' | 'tech' | 'details';
const STEPS: StepId[] = ['type', 'scope', 'features', 'integrations', 'tech', 'details'];
// resultIndex === STEPS.length (6); step >= resultIndex renders the ResultPanel.
```

Per-step responsibilities:

| Step | Component | Edits | Notable behavior |
|---|---|---|---|
| type | `TypeStep` | `projectType`, `subtype` | Type switch → `defaultInputFor(type)` (keeps only `description`); subtype switch → `applySubtype` (keeps user features, merges new populars) |
| scope | `ScopeStep` | `platforms`, `approach`, `tier`, `screens` | Platform/approach shown only for `mobile`; screens slider shown only when `hasScreens()`; never allows zero platforms |
| features | `FeaturesStep` | `features[]` | Chips grouped by `FEATURE_CATEGORIES`; per-chip `+$` hint = `effectiveFeatureHours × rate × tierMult` (an approximation of the full multiplier chain) |
| integrations | `IntegrationsStep` | `integrations[]` | Chips grouped by `INTEGRATION_GROUPS`; hint = `hours × rate` (integrations are fixed effort) |
| tech | `TechStep` | `techStack[]`, `autoTech` | "Agency picks" toggle clears `techStack`; picking any tech sets `autoTech=false`. Tech is **informational** — it does not change the formula (the mobile *approach* multiplier does) |
| details | `DetailsStep` | `design`, `languages`, `urgency`, `description` | Design shown only when `hasScreens()`; description capped at `MAX_DESCRIPTION_LENGTH` (600) |

Result step renders `ResultPanel`, which shows the hero range, timeframe, monthly support, suggested team, the AI block, an expandable breakdown, included/excluded/terms, and the `LeadForm`.

### Client state & persistence

- **Live estimate** is `useMemo(() => calculateEstimate(input), [input])` — recomputes on every selection and feeds both `LivePreview` (sticky desktop sidebar) and the mobile sticky bottom bar.
- **Session persistence:** `sessionStorage['estimator-state-v2']` stores `{ input, step }`. On mount the stored blob is re-run through `sanitizeEstimatorInput` (same sanitizer the API uses), so stale/garbled state degrades to defaults instead of crashing. `hydratedRef`/`StrictMode` guards prevent the persist effect from overwriting the restore.
- **AI fetch** fires in an effect once the result step is reached, keyed on `JSON.stringify({ input, locale })` to dedupe, with an `AbortController` that cancels an in-flight request when the input changes or the user leaves the step.
- **Analytics** (`trackEvent`, typed in `src/shared/utils/analytics.ts`): `estimator_start`, `estimator_complete`, `estimator_ai {status: 'ok'|'unavailable'|'error'}`, `estimator_lead_submit`.

## The catalog

`data/catalog.ts` is the option catalog. Ids are stable and **double as i18n keys** under the `estimator` namespace (`subtype.<id>`, `feature.<id>`, `integration.<id>`, `category.<c>`, `intGroup.<g>`, `techGroup.<g>`). Tech entries carry a hardcoded `label` instead (proper nouns need no translation). All hour numbers are **hours**; money comes from `constants.ts`.

Counts (on `main`): **6 services · 30 subtypes · 45 features (8 categories) · 30 integrations (6 groups) · 51 technologies (7 groups)**.

### Shapes

```ts
interface SubtypeDef {
  id: string;
  baseHours: number;        // core build incl. includedScreens
  includedScreens: number;  // screens covered by baseHours
  screenHours: number;      // cost per extra screen
  defaultScreens: number;
  maxScreens: number;       // 0 ⇒ screens slider hidden (bots/AI/service work)
  minPrice: number;         // hard floor for the displayed minimum, USD
  featureFactor?: number;   // starter-kit reuse discount on feature hours (1 = none)
  popular: string[];        // feature ids pre-selected for this subtype
  icon: string;
}

interface FeatureDef {
  id: string;
  category: FeatureCategory;                 // auth|content|commerce|communication|geo|data|ai|platform
  hours: number;
  hoursFor?: Partial<Record<ProjectType, number>>; // per-type override (e.g. a "catalog" in a bot is menus)
  types: ProjectType[];                      // which services offer it
}

interface IntegrationDef { id: string; group: IntegrationGroup; hours: number; icon?: string; flag?: string; }
interface TechDef        { id: string; label: string; group: TechGroup; icon?: string; flag?: string; types: ProjectType[]; }
```

Services (`ProjectType`): `mobile`, `web`, `telegram`, `ai`, `desktop`, `other`. Integration groups: `payments_uz`, `payments_intl`, `messaging`, `maps`, `business`, `gov` — the regional catalog (Payme/Click/Uzum/Paynet/Nasiya/OFD, Kaspi/YooKassa/Stripe/PayPal, Eskiz/PlayMobile SMS, Yandex/2GIS/Google maps, 1C/Bitrix24/amoCRM/MoySklad/Billz/Smartup, OneID/MyID/E-IMZO/Didox).

### Helpers

| Function | Purpose |
|---|---|
| `getService(type)` / `getSubtype(type, id)` | Lookup with safe fallback to the first entry |
| `featuresFor` / `integrationsFor` / `techFor` | Options offered for a service type (`integrationsFor` drops `maps` for `desktop`) |
| `FEATURE_BY_ID` / `INTEGRATION_BY_ID` / `TECH_BY_ID` | `Map` lookups used by the formula & sanitizer |
| `effectiveFeatureHours(type, subtype, id)` | `(hoursFor[type] ?? hours) × subtype.featureFactor`, rounded |
| `hasScreens(type, subtype)` | `getSubtype().maxScreens > 0` — gates the screens slider, design multiplier, design step |
| `defaultInputFor(type)` | Fresh `EstimatorInput` (first subtype, its populars, `autoTech`, 2 languages, `custom` design) |
| `applySubtype(input, id)` | Keep user features, merge in the new subtype's populars, reset screens to its default |

Icons for tech/integration chips render via `components/TechIcon.tsx`: a `react-icons/si` component when `icon` is set, else the `flag` emoji, else a letter chip.

## The pricing formula

`calculateEstimate(input): EstimateResult` in `utils/estimator.ts` is pure and deterministic. The model, in order:

```
hours = ( baseHours
        + extraScreens × screenHours          // only when hasScreens
        + Σ effectiveFeatureHours(feature) )   // subtype featureFactor already applied
        × tierMult × designMult × langMult × mobileMult
        + Σ integration.hours                  // fixed effort, added AFTER the multipliers
hours = round(hours × urgencyMult)             // urgency scales COST
cost.mid = hours × BLENDED_RATE
```

Step-by-step (matches the numbered comments in the source):

1. **Base + screens.** `breakdown` starts with the subtype base. If `hasScreens`, `screens` is clamped to `[1, maxScreens]` and only screens above `includedScreens` are charged at `screenHours` each.
2. **Features.** Each selected feature id is looked up in `FEATURE_BY_ID`; unknown ids or ids whose `types` don't include the project type are **silently skipped** (stale client payloads can't break the math). Hours come from `effectiveFeatureHours` (per-type override × subtype reuse discount).
3. **Scope multipliers.** `tier × design × languages × mobile`, applied to `base + screens + features` only:
   - `designMult` applies **only when `hasScreens`** (bots/AI backends/service work carry no design phase).
   - `langMult = 1 + (languages − 1) × EXTRA_LANGUAGE_FACTOR`, `languages` clamped `[1,3]`.
   - `mobileMult` from `MOBILE_FACTOR` keyed on `approach` × (`platforms.length !== 1` ⇒ "both").
4. **Integrations.** Added as **fixed effort after** the multipliers — a Payme hookup is the same job at any tier.
5. **Urgency.** `effortHours` (pre-urgency, rounded) is captured for the calendar; then `hours = round(hours × urgencyMult)`. Urgency scales **cost**; the timeline has its own separate factor (step 7).
6. **Money range with subtype floor.** `roundMoney` rounds outward to friendly steps (50/100/250/500 by magnitude). `cost.min = max(round(mid×0.85), minPrice)`; `cost.max = round(max(mid×1.3, minPrice×1.3))`. Displayed `hours` are re-anchored so `hours × rate` still reconciles with the floored cost.
7. **Timeline.** Derived from **pre-urgency** `effortHours` and a velocity band (`velocityFor`), then scaled by `URGENCY_WEEKS_FACTOR` (rush **compresses**, flexible stretches). `weeks.max` is at least `weeks.min + 1` (no fake-precise "2–2 weeks").
8. **Support retainer.** `max(SUPPORT_MONTHLY_MIN, round(mid × 0.1 / 12 / 5) × 5)` — first-year support ≈ 10% of dev cost as a monthly figure.
9. **Team.** Derived for credibility framing: always PM; designer unless `design === 'ready'`; `devs` vs `dev` by hours; QA unless tier is `mvp`. Emitted as i18n keys (`team.pm`, …).

### Constants (`constants.ts`)

| Constant | Value |
|---|---|
| `BLENDED_RATE` | `$14/h` (design+dev+QA+PM blended) |
| `TIER_MULTIPLIER` | `mvp 1.0 · standard 1.4 · enterprise 2.0` |
| `DESIGN_MULTIPLIER` | `ready 0.92 · template 1.0 · custom 1.15` |
| `URGENCY_MULTIPLIER` (cost) | `flexible 0.97 · normal 1.0 · rush 1.25` |
| `URGENCY_WEEKS_FACTOR` (calendar) | `flexible 1.15 · normal 1.0 · rush 0.8` |
| `EXTRA_LANGUAGE_FACTOR` | `0.06` per language beyond the first |
| `MOBILE_FACTOR` | `cross_single 0.94 · cross_both 1.0 · native_single 1.12 · native_both 1.55` |
| `RANGE_LOW` / `RANGE_HIGH` | `0.85` / `1.3` |
| `SUPPORT_RATE_YEARLY` / `SUPPORT_MONTHLY_MIN` | `0.1` / `$40` |
| `VELOCITY` | `≤120h→30 · ≤400h→45 · ≤900h→70 · else 95` (effective h/week) |
| `MIN_WEEKS` | `1` |
| `AI_CLAMP` | `costMin 0.6× · costMax 1.6× · weeksMin 0.5× · weeksMax 2.0×` |

`EstimateResult` (`types.ts`) returns `hours`, `cost`, `weeks` (all `{min,max}` Ranges), `supportMonthly`, `rate`, `team[]`, `breakdown[]`, and the combined `multiplier` (rounded, shown in the "How we calculated" accordion).

## Input sanitization

`sanitizeEstimatorInput(raw): EstimatorInput | null` (`utils/sanitize.ts`) is the trust boundary. It:

- Returns `null` only when the payload isn't object-shaped or `projectType` isn't a known service.
- Whitelists every enum (`tier`, `design`, `urgency`, `approach`, `platforms`) against fixed sets, falling back to sane defaults (`mvp`, `custom`, `normal`, `cross`).
- Falls back `subtype` to the service's first subtype if unknown.
- Drops **unknown ids** from `features`/`integrations`/`techStack` via `idList()` (each checked against its catalog `Map`, deduped, capped at 60) — a stale client after a catalog change degrades instead of erroring.
- Clamps `screens` to `[1, maxScreens]` (or `0` when `maxScreens === 0`) and `languages` to `[1,3]`.
- For `mobile`, defaults empty `platforms` to `['ios','android']`; for non-mobile forces `platforms: []`.
- Strips control chars from `description` and truncates to `MAX_DESCRIPTION_LENGTH` (600).

It is called in three places: Wizard hydration (sessionStorage restore), `POST /api/estimate`, and `POST /api/estimate/lead`.

## The AI refinement pass

`POST /api/estimate` (`src/app/api/estimate/route.ts`) returns `{ formula, ai }` where `ai` is a clamped, localized `AiRefinement` or `null`.

Flow:

1. **Rate limit** `estimate:<ip>` — 10 requests / 60s (`shared/utils/rateLimit`). Body capped at 32KB.
2. **Sanitize** the input and pick the locale (`en`/`ru`/`uz`, default `en`).
3. **Compute the formula** server-side (authoritative).
4. **Daily budget gate:** a per-warm-instance circuit breaker (`AI_DAILY_BUDGET = 500`) bounds paid LLM spend beyond the bypassable per-IP limit. When exhausted it returns `{ formula, ai: null }` immediately.
5. **Prompt** the model with the config, the formula estimate, and Tashkent market anchors, asking for a refined range + localized `summary`/`risks`/`suggestions`/`confidence`. Reasoning language follows the locale; **Uzbek prefers DeepSeek** (`prefer: 'deepseek'`, UzLiB 0.709 vs Kimi 0.518).
6. **Generate** via `safeGenerateJSONWithTimeout(prompt, 'estimate-refine', { timeout: 25s, maxTokens: 900, jsonSchema: REFINEMENT_SCHEMA, prefer, firstOnly: false })`. `firstOnly: false` walks the whole provider chain (Kimi → DeepSeek). `REFINEMENT_SCHEMA` is a strict MFJS `json_schema` (Kimi enforces it; DeepSeek degrades to `json_object`, which is why the fields are also described in the prompt).
7. **Validate & clamp.** The four numbers must all be finite and `> 0` and `summary` must be non-empty, otherwise `ai` stays `null` (never fabricate a confident range from a garbage response). Valid numbers go through `clampAiRange` (see below); `confidence` is normalized to `low`/`medium`/`high`; `provider` records which model answered.

Route config: `export const maxDuration = 60` (the AI call can take ~30–45s; the global 30s cap would kill it). Budget chain: 2 providers × 25s < 60s function cap < the client's 60s fetch timeout.

### `clampAiRange`

`clampAiRange(ai, formula)` (in `utils/estimator.ts`) keeps the AI from wildly contradicting the on-screen formula: cost is clamped to `[0.6×formula.min, 1.6×formula.max]`, weeks to `[0.5×min, 2.0×max]` (`AI_CLAMP`), swapped if inverted, friendly-rounded without rounding back through the enforced floor, and given the same "never N–N weeks" guard.

### AI client (`src/core/ai.ts`)

The estimator uses `safeGenerateJSONWithTimeout`, which calls the shared `generate()` provider chain:

- **Primary: Kimi K2.6** (Moonshot, `https://api.moonshot.ai/v1`, model `kimi-k2.6`). Kimi's sampling is fixed (temperature 0.6) and **thinking is disabled explicitly** (`thinking: { type: 'disabled' }`) — otherwise every call 400s. Strict `json_schema` structured output is Kimi-only.
- **Fallback: DeepSeek** (`https://api.deepseek.com`, default model `deepseek-v4-pro`). No strict schema — degrades to `json_object`.
- Providers with no API key are dropped; `prefer` moves a named provider to the front. Per-provider quota cooldowns and a 429 detector let a rate-limited Kimi fall through to DeepSeek. Everything is env-overridable (`AI_BASE_URL`, `AI_MODEL`, `AI_FALLBACK_BASE_URL`, `AI_FALLBACK_MODEL`, `MOONSHOT_API_KEY`/`KIMI_API_KEY`, `DEEPSEEK_API_KEY`). See [`./api-reference.md`](./api-reference.md) for the full AI surface.

> Note: [`./estimator-v2.md`](./estimator-v2.md) quotes `max_tokens 1400` and a "45s budget" for this pass; the code on `main` uses **900 tokens** and a **25s** per-provider timeout under a 60s route cap. Follow the code.

## Lead capture

Post-result only — the `LeadForm` sits *after* the fully-visible estimate inside `ResultPanel` and never gates it.

### `LeadForm` (client)

`components/LeadForm.tsx` collects `name`, `phone`, preferred `contact` channel (`telegram`/`call`), and an optional `comment` (max 1000). Phone uses `react-international-phone` restricted to a market-relevant country subset (`uz, ru, kz, kg, tj, tm, az, tr, ae, us, gb, de`, default `uz`). `isPhoneComplete()` counts local digits (excluding the dial code) against the country mask before allowing submit. On submit it calls `submitEstimateLead()` (`modules/estimator/api.ts`), which POSTs to `/api/estimate/lead` with the full `input`, `locale`, and the client-echoed `ai` block.

### `POST /api/estimate/lead` (`src/app/api/estimate/lead/route.ts`)

1. **Rate limit** `estimate-lead:<ip>` — 5 / 60s. Body capped at 32KB.
2. **`cleanLine`** every user string (name/phone/comment): strips control chars, Unicode bidi overrides, and collapses newlines — so a crafted `name` can't forge extra `Phone:`/`Estimate:` lines in the Telegram message, and a NUL can't 500 the Postgres INSERT. Requires a name and ≥ 9 phone digits.
3. **Re-sanitize** the input and **recompute the formula** — client numbers are display-only. `parseAi()` re-validates the echoed AI block and re-runs `clampAiRange` against the fresh formula (an attacker could otherwise plant "AI says $1–$2" in the notification). The re-clamped AI carries empty `summary`/`risks`/`suggestions` (only its numbers/confidence/provider are trusted).
4. **`buildLeadSummaryLines`** (`utils/leadSummary.ts`) builds owner-facing, **English** plain-text lines (project/tier/platforms, scope, features, integrations, stack, formula estimate, and the AI line if present). The client's free-text comment is budgeted **first** so a maximal config can't truncate it away.
5. **Store first, notify second.** `createLead()` (`src/modules/contact/model/leads.repository.ts`) durably persists to the `leads` table with `source: 'estimator'` and the joined summary in `message` (capped at 2000 chars) — this is the system of record. A store failure returns 500 and logs only the error message (never the raw driver error, which carries bound PII params).
6. **Telegram** is best-effort inside `after()` (runs after the response is sent, so a hung Telegram API can't stall the client into a duplicate resubmission). It needs `TG_BOT_TOKEN` + `TG_CHAT_ID`; the message HTML-escapes every user string via `escapeHtml`, has an 8s timeout, and `markLeadNotified(leadId, ok)` records `sent`/`failed`. Missing credentials → the lead is still stored, logged as un-notified.

All DB access goes through the repository (`leads.repository.ts`) — routes never touch Drizzle directly. See [`./database.md`](./database.md) for the `leads` table.

## Currency conversion

Prices are computed and stored in **USD**; conversion is display-only and client-side.

### `GET /api/currency/rates` (`src/app/api/currency/rates/route.ts`)

Returns `{ base, rates }` (USD-base). In-memory cached for 24h. Uses the paid `v6.exchangerate-api.com` endpoint when `EXCHANGERATE_API_KEY` is set (reads `conversion_rates`), else the free `open.er-api.com` endpoint (reads `rates`). An empty/error rate set is **not cached** and returns 502 — that fails soft so the client keeps its USD default instead of quoting USD numbers under a foreign label.

### `useCurrency` hook (`components/CurrencySwitcher.tsx`)

`CurrencyCode` = `USD | UZS | KZT | RUB | EUR`. The hook fetches rates on mount, defaults to `USD`, and restores the saved `localStorage['estimator-currency']` **only once that currency's rate exists** (applying "UZS" while rates are still `{USD:1}` would mislabel USD amounts ~12,000×). `format(amountUsd)` converts, rounds to 3 significant digits (`roundForCurrency` — "5 100 000 сум" reads honest, "5 083 214" reads fake), and formats via `Intl.NumberFormat` in the UI locale. `available` only offers currencies that actually have a fetched rate. `CurrencySwitcher` is rendered in both `LivePreview` (desktop sidebar) and `ResultPanel` (mobile).

## Calibration

`scripts/estimator-calibration.ts` prints `calculateEstimate` output for ~15 canonical market scenarios next to their Tashkent-market target bands. Run it after touching `constants.ts` or `catalog.ts`:

```bash
yarn tsx scripts/estimator-calibration.ts
```

Each `CASE` builds an input via `scenario(type, subtype, patch)` (using `defaultInputFor` + `applySubtype`) and logs `cost / weeks / hours` vs its `target`. Adjust the pricing constants until every row lands inside (or sensibly near) its band. Sample targets: landing `$300–700`, corporate `$800–1500`, web e-commerce+Payme/Click/OFD `$1200–3000`, Telegram order bot `$400–700`, mobile MVP `$3000–8000`, custom CRM `$5000–10000`, AI chatbot `$830–1250`.

## Endpoints & env

| Method · Path | Rate limit | Body cap | Key config |
|---|---|---|---|
| `POST /api/estimate` | 10 / 60s per IP | 32KB | `maxDuration = 60`; AI budget 500/instance/day |
| `POST /api/estimate/lead` | 5 / 60s per IP | 32KB | needs `TG_BOT_TOKEN` + `TG_CHAT_ID` for notification |
| `GET /api/currency/rates` | — | — | 24h cache; optional `EXCHANGERATE_API_KEY` |

| Env var | Used by | Effect |
|---|---|---|
| `MOONSHOT_API_KEY` / `KIMI_API_KEY` | AI refine | Enables the Kimi (primary) provider |
| `DEEPSEEK_API_KEY` | AI refine | Enables the DeepSeek fallback (and preferred provider for `uz`) |
| `AI_MODEL` / `AI_FALLBACK_MODEL` / `AI_BASE_URL` / `AI_FALLBACK_BASE_URL` | AI refine | Override models/hosts |
| `TG_BOT_TOKEN` / `TG_CHAT_ID` | Lead route | Telegram lead notifications (best-effort) |
| `EXCHANGERATE_API_KEY` | Currency route | Switches FX source to the paid endpoint |

With **no AI keys configured**, `/api/estimate` still returns `{ formula, ai: null }` and the UI shows the formula-only result (the AI block hides). With **no Telegram creds**, leads are still stored. The estimator degrades gracefully at every external dependency.

## Related docs

- [`./estimator-v2.md`](./estimator-v2.md) — the pricing-model rebuild design notes (prior context; some counts/AI numbers are stale vs code).
- [`./estimator-section-plan.md`](./estimator-section-plan.md) — the original v1 master plan (superseded; Mongo/$35-h era).
- [`./api-reference.md`](./api-reference.md) — full API surface incl. the shared AI client.
- [`./frontend.md`](./frontend.md) — client architecture, i18n, and shared UI conventions.
- [`./architecture.md`](./architecture.md) — layered module boundaries (core → shared → modules → app).
- [`./database.md`](./database.md) — Neon/Drizzle schema, including the `leads` table.
- [`../README.md`](../README.md) — project overview.

_Last verified against code: 2026-07-03._
