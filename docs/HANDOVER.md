# Handover: homepage relaunch, AI demo, localization, QA

Last updated 2026-10-12. Everything below is on `main` and live on https://softwhere.uz.
Work branch: `feat/homepage-wow` (same as `main` at handover). Read `CLAUDE.md` first.

## Ground rules (founder decisions; keep them)

- **Attribution:** no Claude/AI attribution anywhere on GitHub (commits, PRs, comments).
- **Production:** don't merge to `main` (= production deploy on Vercel) without the founder's go.
  Pushes to `feat/homepage-wow` give a Vercel preview, which needs Vercel login.
- **Secrets:** never print API keys. Don't commit `.env*` or `.claude/settings.local.json`.
- **Database:** live DB content changes need founder sign-off. The Neon DB is shared by
  dev (`.env`), preview and production.
- **Founder's language:** he writes short, mixed English, and reviews copy in uz/ru himself.
  Reply in plain English.

## What shipped (recent, newest first)

| Commit | What |
|---|---|
| (this) | QA pass: scroll, swipe, rotation and layout fixes across the homepage (details below) |
| `f2d1652` | Uzbek code-to-ui heading no longer overlaps its copy at 1280–1440px |
| `f7e3a99` | Uzbek + Russian copy transcreated site-wide; style guide; `tests/i18n/parity.ts` |
| `7d6b97e` | Telegram + RAG sections scroll-driven; glowing loading skeletons |
| `e15a7b3` | Admin **AI demo** page: Kimi/DeepSeek switch + usage/spend stats |
| `f596842` | AI brief: DeepSeek Flash fallback + overflow lane, quality guards |
| `9e0ea95` | New animated homepage at /uz /ru /en (18 sections) |
| `8defb78` | AI project brief, one free plan per visitor a day |

### AI demo admin (`/uz/admin/ai-demo`)

- **Switch:** `ai_brief_settings.provider` picks Kimi K3 or DeepSeek Flash, and the other
  provider is the fallback. Read with a 30 s per-instance cache (`briefRuns.repository.ts`);
  `providerChainSet` in `ai-brief/chains.ts`.
- **Stats:** one `ai_brief_runs` row per brief. Metadata only: no idea text, no IP
  (`visitor_hash` = HMAC). Tables come from `drizzle/0001_ai_brief_admin.sql` and already exist
  in the shared DB.
- **Balances:** live, via `getProviderBalances()` in `src/core/ai.ts`.
- **Caps:** in `ai-brief/caps.ts` ($3/day main, $1/day overflow, per server instance).
- **Tests:** `npx tsx tests/ai-brief/admin.ts`.

### Localization

- **Style guide:** `docs/localization/uz-ru-style-guide.md`.
  - Transcreate from the English meaning; siz/вы.
  - Uzbek letters: oʻ/gʻ = U+02BB, tutuq = U+02BC.
  - Russian: «ёлочки», correct ICU plurals.
- **Check:** `npx tsx tests/i18n/parity.ts` verifies keys, ICU arguments, tags and letters
  against en.
- **Open founder decisions** (shipped with these defaults):
  1. **Main CTA:** ru «Обсудить проект» vs uz "Qoʻngʻiroqqa yozilish". It opens a form, not a
     call. Recommended: the "discuss the project" meaning in both.
  2. **Brand spelling:** "Softwhere" vs "SoftWhere". Recommended: SoftWhere everywhere.
  3. **Offers to confirm:** 1 year of free hosting for first clients, 12 months of free bug
     fixes, and the so'm prices in the uz/ru meta descriptions.
  4. **Privacy contact:** the privacy page lists the founder's personal Gmail and phone (there
     is no domain email by choice).
  5. **AI brief examples:** the uz/ru examples (barbershop, etc.) don't match the yoga-studio
     sample sketch.

### QA pass (2026-10-12): bugs fixed

Tested with real input (Lenis wheel, keyboard, CDP touch swipes, rotation) on the real GPU,
in uz/ru/en, at 1440/1280 desktop, 390/360 phones and landscape phones.

- **Global:**
  - rotation/resize no longer resets scroll to the top (GSAP matchMedia rebuild,
    `global/gsap.ts`);
  - rotation keeps your place inside scroll stories (`global/useKeepPlace.ts`);
  - the manifesto jump is gone (the stand-in is capped at its reservation in
    `SectionFallback`);
  - the AI-demo stand-in height is fixed (`withSlotFloor` in `registry.ts`).
- **x-ray:** a touch hold no longer traps page scroll; long ru pill labels wrap.
- **code-to-ui:** layout shifts removed (ping, inspector label, status bar, caption).
- **devices:** landscape-phone layout (copy over the phone, cut-off column).
- **ai-demo:** the heading no longer jitters the page (reduced-motion transition + decode
  overlay).
- **stack-physics:** a touch hold threshold of 360 ms, so a resting thumb doesn't grab a block.
- **globe:** landscape-phone overlap fixed; route labels no longer collide at 768–1199px.
- **numbers:** a swipe over the chart no longer pops a tooltip.
- **Reservations:** `heights.css` refitted for ai-demo, stack-physics, finale and the 4
  "how we build" stories (uz/ru have their own fit via `:lang`).
- **Keyboard:** new `sections/useStoryKeys.ts`, keyboard step navigation in the 4 build
  stories.
- **Interrupted:** the last QA agent (mobile/web/RAG/CRM) was stopped before it reported. Its
  changes compile, and a smoke test passed: every step reached in order on desktop and phone,
  no errors, no overflow. The RAG phone layout shift and CRM pipeline edits are not
  individually verified.

## Open work for the next session (in priority order)

1. **Phone layout shift during section swaps** (`components/SectionFallback.*` / LazyMount):
   CLS is about 0.11 on a 390×844 scroll-through (target < 0.1). Repro: a layout-shift
   PerformanceObserver with `buffered: true`, then scrollTo in 40px steps from 1.5 screens
   above `#telegram`. About 0.11 at y≈8709, just before the devices/telegram stand-ins are
   removed. The stand-in's own box changes in the frame before the swap.
2. **x-ray swallows arrow keys after a click** on the lens (tabindex=0): ArrowUp/Down stop
   scrolling the page even after you leave the section. Only handle arrows while the lens is
   on screen, or blur it when off-screen.
3. **`useStepStory.goTo` on touch** (no Lenis there) jumps instantly. Glide with
   `window.scrollTo({ behavior: 'smooth' })` unless reduced motion is on.
4. **Process reservation** in `registry.ts` (`max(320svh, 2780px)` below 960px) leaves blank
   tails of up to ~215px on phones, and ~500px under reduced motion on desktop. Refit it.
5. **Re-verify the interrupted QA agent's sections**: RAG phone layout shift (was 0.31 in view),
   CRM pipeline drag on touch, inner scroll areas not trapping page scroll, and the CRM
   reservation (was 255px short at 390×844 uz).
6. **A11y:** Tab skips lazily unmounted sections (from work-wall, Tab jumps to latest posts),
   so controls in between can't be reached by keyboard until scrolled near. Needs a design
   that doesn't hurt lazy loading.
7. **Language switch** does a clean load at the top. Optional: keep the current section with a
   `#hash`.
8. **Content:**
   - The code-to-ui project poster has English text baked into the image.
   - The globe says "four continents" in ru but "five" in the English copy; the count is
     data-driven, so check the data.

## How to test (this machine)

- **Dev server:** `npx next dev -p 3100`. Only one per folder. `.env.local` overrides with
  empty `MOONSHOT_API_KEY` and `API_SECRET`, so export them from `.env` first.
- **Headless Chromium with the real GPU (RTX 4060):** Playwright from node_modules.
  - Executable: `~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`.
  - Args: `--no-sandbox --disable-dev-shm-usage --enable-features=NetworkServiceInProcess2
    --disable-features=NetworkServiceSandbox --ignore-gpu-blocklist --enable-gpu --use-gl=angle --use-angle=gl-egl`.
  - Run with `TMPDIR=~/.cache/<something>`: Chromium breaks with TMPDIR under /tmp, which is
    RAM-backed and near its quota.
  - The bash command sandbox must be off to launch the browser.
  - Real touch needs CDP `Input.dispatchTouchEvent`; `synthesizeScrollGesture` is a no-op in
    the headless shell.
- **Paid API calls:** stub `POST /api/estimate/brief` and `/api/contact` with `page.route` when
  testing UI. Real briefs cost Kimi money and real leads ping Telegram.
- **Checks before shipping:**
  - `yarn -s type-check`
  - `npx eslint src/` (0 errors)
  - `yarn -s build`
  - `npx tsx tests/i18n/parity.ts`
  - `npx tsx tests/ai-brief/{admin,daily-limit,round3}.ts`
  - `npx tsx tests/estimator/logic.ts`
- **Vercel CLI** is logged in (scope softwhere-uz). `vercel ls` shows deployments; `vercel curl`
  reaches protected previews.

## Other open founder items (from earlier planning)

- **Founder setup tasks:** lock the email DNS records at ahost; order the Contabo VPS (server
  move, then the monorepo); Doppler, Neon ownership and the Telegram bot (M0 issues).
- **Backlog:** the GitHub board https://github.com/users/KAMRONBEK/projects/2 (issues #37–#171).
  PR #36 (relaunch plan docs) is still open.
- **DeepSeek key:** it was pasted in chat once. Recommend rotating it, then update Vercel env
  `DEEPSEEK_API_KEY` (Production + Preview).
