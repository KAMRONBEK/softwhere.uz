# Estimator test suite

Two suites guarding the project-cost estimator. Written after clients reported
that "the pricing is all over the place" when they went back and changed their
selections — every group below corresponds to a way that actually happened.

```bash
yarn test:estimator:logic     # pure logic — fast, no server, no browser
yarn test:estimator:e2e       # real browser against a running dev server
yarn test:estimator           # both
```

| File | What it covers |
|---|---|
| `harness.ts` | Tiny zero-dependency runner: grouped checks, readable failures, a JSON artifact per run, non-zero exit on failure |
| `logic.ts` | ~1,000 checks over the catalogue, the formula and the wizard's state transitions |
| `e2e.ts` | ~30 user stories driven through Chromium, with a screenshot per story |

Output lands in `test-results/` (git-ignored): `estimator-logic.json`,
`estimator-e2e.json`, and `test-results/screenshots/<story>.png`.

## `logic.ts` — what it asserts

- **Catalogue** — unique ids; every pre-ticked "popular" feature is actually
  offered for its service; `defaultScreens` inside `[1, maxScreens]`; no service
  renders an empty step.
- **Translations** — every catalogue id resolves in `uz`/`ru`/`en`, and the three
  bundles have the same key set (ids double as i18n keys).
- **Formula sanity** — for all 30 subtypes: finite positive numbers,
  `cost.min < cost.max`, the subtype price floor is respected, and every selected
  feature appears in the breakdown.
- **Monotonicity** — no feature, integration, tier, language, design step or
  screen ever makes the project *cheaper*.
- **Timeline** — adding scope never shortens the schedule (this used to happen at
  every velocity-band edge), dropping a platform never lengthens it, and
  `rush ≤ normal ≤ flexible` weeks while `rush ≥ normal ≥ flexible` cost.
- **Navigation** — the headline guarantee: for every service, every
  `A → B → A` subtype path and every `type → other → type` path returns to the
  *identical price*; re-tapping the selected card is inert; a long adversarial
  click path never produces a state the formula would silently ignore.
- **Client/server parity** — `sanitizeEstimatorInput` leaves a real wizard state
  untouched and always emits a canonical input, so the API cannot quote a
  different number than the browser showed. Hostile payloads degrade instead of
  throwing.
- **Price hints** — the `+$…` on each chip equals the real change in the estimate.
- **AI clamp** — a wild AI answer is pulled into a range that overlaps the
  formula's and never renders as a zero-width "range".
- **Market calibration** — reference projects still land in their Tashkent-market
  bands, so a refactor cannot quietly re-price the product.

## `e2e.ts` — user stories

Runs against `yarn dev` on `http://localhost:3000` (override with `--base=…`).

```bash
yarn test:estimator:e2e --headed --slow      # watch it drive the wizard
yarn test:estimator:e2e --live-ai            # use the real (paid) /api/estimate
yarn test:estimator:e2e --live-lead          # really write a lead + ping Telegram
```

By default `/api/estimate` and `/api/estimate/lead` are intercepted: the suite
stays fast and deterministic and never drops a test lead into the owner's inbox.
One story (`api-parity`) always calls the real estimate endpoint and asserts the
server quotes exactly what the sidebar showed.

Stories cover: all three locales; the four reported-bug regressions; every
control on every step; a full walk-through for each of the six services; the
result breakdown, Back and Start-over; the AI block's ready / unavailable /
unchanged-on-return states; currency switching (including that chip hints follow
the currency); reload persistence mid-flow and on the result; lead-form
validation, success and server error; the phone-sized layout; and the currency
switcher at tablet widths.

## Conventions

- Locate by `data-testid` for the numbers (`live-range`, `result-range`,
  `result-weeks`, `ai-range`) and by visible text for controls. Chip accessible
  names contain the price hint, so exact-name locators are not usable.
- Below `xl` (1280px) the step rail and the live-estimate sidebar are hidden and
  the sticky bottom bar takes over — `goStep()` handles both.
- The wizard persists to `sessionStorage['estimator-state-v2']`; the fixture
  clears it on the first load of each tab only, so persistence stories can reload.
- After a reload, wait for hydration (`est.until(...)`) before reading numbers —
  the server renders the defaults and the restore happens in an effect.
