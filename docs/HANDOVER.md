# Handover: homepage relaunch, AI demo, localization, QA

Last updated 2026-10-12. Everything below is on `main` and live on https://softwhere.uz.
Work branch: `feat/homepage-wow` (same as `main` at handover). Read `CLAUDE.md` first.

## Ground rules (founder decisions; keep them)

- **Attribution:** no Claude/AI attribution anywhere on GitHub (commits, PRs, comments, author
  names, `Co-Authored-By` or `Claude-Session` trailers, `claude/*` branch names). History was
  rewritten on 2026-10-12 to remove the old ones; old SHAs before then are gone.
- **Production:** `main` = production deploy on Vercel. The founder gave a standing go on
  2026-10-12 to ship verified work to `main`.
  Pushes to `feat/homepage-wow` give a Vercel preview, which needs Vercel login.
- **Secrets:** never print API keys. Don't commit `.env*` or `.claude/settings.local.json`.
- **Database:** live DB content changes need founder sign-off. The Neon DB is shared by
  dev (`.env`), preview and production.
- **Founder's language:** he writes short, mixed English, and reviews copy in uz/ru himself.
  Reply in plain English.

## What shipped (recent, newest first)

| Commit | What |
|---|---|
| (this) | Final round: per-style height fits, hidden-from-Tab controls, uz/ru code-to-ui video, globe summary test (details below) |
| `7e7b3c4` | Open-work round: CLS/reservations, devices first frame, x-ray keys, touch glide, language switch keeps section, Tab reaches lazy sections (details below) |
| `a99a884` | QA pass: scroll, swipe, rotation and layout fixes across the homepage (details below) |
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
- **Interrupted QA agent:** its sections were re-verified in the next round (below).

### Open-work round (2026-10-12, second session): what changed

Every item was fixed by one agent and re-tested in a real browser by a second agent.

- **Phone CLS (old item 1):** with warm chunks the scroll-through was already ~0.02 (390x844
  uz/ru/en). The spikes only show when a section's chunk lands while it is on screen
  (repro: delay `/_next/static` 3 s via `page.route`).
  - Devices: `s06/CssDevices.tsx` measured the stage in `useEffect`, so the first frame used
    the default layout (CLS 0.112). Now a layout effect; plus `transition: none` on the CSS
    scene so reduced motion doesn't shift either. Devices now contributes 0.
  - Finale uz/ru and stack-physics: `heights.css` reservations were fitted on English only.
    New `:not(:lang(en))` fits (phones/tablets) plus a refit of the English stack-physics
    phone value (it left a 5–14px blank strip at 350–540px).
  - Delayed-chunk result at 390x844: en 0.002, ru 0.065, **uz 0.072–0.091** (borderline; see
    open work).
- **Process reservation (old item 4):** new `--lab-h-process` in `heights.css` (used by
  `registry.ts` and `s12/process.module.css`). Phone/tablet/reduced-motion column is fitted
  12px under natural height per locale; desktop with motion is unchanged (1280x720 = 2780px,
  1440x900 = 3420px). No blank tail anywhere measured (228 viewport/locale/style cases).
- **x-ray arrows (old item 2):** `s03/useLensInput.ts` only handles arrows while the stage is
  at least half on screen; off screen the page scrolls. Ctrl/Alt/Meta+arrow are ignored.
- **Touch step glide (old item 3):** `useStepStory.goTo` without Lenis uses
  `window.scrollTo({ behavior: 'smooth' })` (instant under reduced motion).
- **RAG/CRM re-check (old item 5):** RAG phone CLS ~0.001, CRM touch drag works and doesn't
  trap the page, reservations have no blank tails. One fix: the RAG chat log
  (`s17/Assistant.tsx` `useFollowLatest`) no longer yanks you back to the newest answer while
  you wheel up through it; the hold lasts until you wheel back to the end or a new turn starts.
- **Tab through lazy sections (old item 6):** `LazyMount.tsx` puts a 1px visually hidden
  sentinel `<button>` (localized label `home.shared.loadSection`) at the top of each unmounted
  section. Focusing it mounts the section and hands focus to its first control (last control
  on Shift+Tab); a section with no controls passes focus on. Gives up after 8 s on a dead
  chunk. Lazy loading unchanged (1/18 sections mounted on load). Tab and Shift+Tab walk hero →
  footer with no drops to `<body>` in en and uz.
- **Language switch (old item 7):** `LabHeaderLanguage.tsx` adds the `#id` of the section in
  view on click (rendered href stays hash-free); the existing hash landing does the rest.
  Lands at the section's top, not mid-story; from the finale it lands at the contact form.
- **Globe (old item 8a):** the count is data-driven and reads "four" in all 3 locales; "five"
  could not be found anywhere it renders. The hand-typed `summary` (no-JS/crawler text) named
  the wrong regions; it now says Uzbekistan, Europe, North America and Australia. **Founder:
  re-check the uz/ru wording.**

### Final round (2026-10-12): what changed

- **Height reservations are now generated per style × locale** (`heights.css`, finale, process,
  telegram, mobile/web/rag/crm-build, stack-physics; motion and reduced motion). Each fit sits
  ~12px under the measured natural height, so no blank bands. Delayed-chunk phone CLS is now
  0.004–0.032 in uz/ru across all 4 styles (was 0.06–0.10). Tools and how to re-fit:
  `scripts/home-reservations/README.md`. Cost: `heights.css` is 20KB gzip (was 5.5KB) and blocks
  rendering on the homepage.
- **Controls hidden from Tab:** entrances in hero, x-ray, telegram, web/rag/crm-build and globe
  fade `opacity` instead of `autoAlpha`; `global/revealOnFocus.ts` finishes an entrance when
  focus lands in it. The hero scrolls back into view when Shift+Tab reaches its CTAs.
- **code-to-ui video in uz/ru:** `public/videos/driveme.{uz,ru}.mp4` + posters, rendered with the
  `video/` Remotion package (now has a `locale` field; see `docs/portfolio-videos.md`).
  `s05/content.ts` `CARD_MEDIA` is keyed by locale. **Founder: skim the uz/ru captions** in
  `video/src/projects/driveme.{uz,ru}.json` and `video/src/strings.ts`.
- **Globe summary:** stays typed copy (case forms), guarded by `tests/home/globe.ts`;
  `yarn test:home` runs it plus i18n parity.

## Open work for the next session (in priority order)

1. **Work-wall reduced-motion reservation on desktop** is 258–1106px short; with slow chunks,
   uz style A at 1440x720 reaches CLS 0.115–0.19 (the only measured case over 0.1). Re-fit with
   `scripts/home-reservations/`.
2. **Reservations go stale** whenever copy, fonts or layout change. Re-fit the touched sections.
   If `heights.css` size matters more than slow-network CLS, raise the fit tolerance.
3. **Smaller items:**
   - Landscape reduced-motion mobile/web-build are 170–800px short; CRM, mobile-build and stack
     with motion on tablets/desktop up to 110–230px short (safe direction, no blank bands).
   - mobile-build with motion at 768x1024, en style A, is 11px over (tiny blank band).
   - LazyMount's Tab hand-off sometimes skips devices/mobile-build in fast uz walks (timing);
     the Telegram demo once dropped focus to `<body>` when its autopilot disabled a key.
   - Mobile-build step cards 02–06 are hidden by design (the step buttons are reachable).
   - Low-tier desktop (no WebGL) keeps the 380svh process floor; CSS can't detect the tier.
   - The Tab sentinel isn't tested on the latest-posts block (needs `DATABASE_URL` locally).
   - Browser numbers come from the dev server in headless Chromium; real Safari/fonts can wrap
     1–2px differently.

## How to test (this machine)

- **Dev server:** `npx next dev -p 3100`. Stop it before `yarn build` (both use `.next`). Only one per folder. `.env.local` overrides with
  empty `MOONSHOT_API_KEY` and `API_SECRET`, so export them from `.env` first.
- **Headless Chromium with the real GPU:** Playwright from node_modules. On this Windows machine
  Chromium is under `%LOCALAPPDATA%/ms-playwright`; `--ignore-gpu-blocklist --enable-gpu` is
  enough. The Linux notes below are from the earlier machine.
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
