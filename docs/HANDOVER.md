# Handover: homepage relaunch, AI demo, localization, QA

Last updated 2026-10-12. Everything below is on `main` and live on https://softwhere.uz.
Work branch: `feat/homepage-wow`. It is one commit ahead of `main` (the open-work round below),
not pushed or merged yet. Read `CLAUDE.md` first.

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
| (this) | Open-work round: CLS/reservations, devices first frame, x-ray keys, touch glide, language switch keeps section, Tab reaches lazy sections (details below) |
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

## Open work for the next session (in priority order)

1. **Push + preview:** push `feat/homepage-wow`, check the Vercel preview, then merge on the
   founder's go. Local `yarn build` compiles and type-checks but can't prerender `/blog`:
   `DATABASE_URL` in `.env.local` is empty on this machine.
2. **uz finale footer CLS:** with delayed chunks, `HomeFooter` in the finale shrinks
   (762→677px), uz CLS 0.072–0.091 at 390x844, just under 0.1. The fit is limited by the
   spread between the 4 styles; a per-`[data-style]` reservation would fix it. Same idea would
   remove the 215–367px growth of style B in the process column when it mounts.
3. **Hidden controls Tab can't reach:**
   - Hero CTAs are `visibility:hidden` once scrolled past, so Shift+Tab from x-ray skips them.
   - x-ray "Full x-ray" / "Next project" (`S03XRay.tsx`, `[data-xray-rise]` `gsap.from`
     autoAlpha) stay hidden until scrolled to 95%. Animate opacity only, or reveal on
     `focusin`.
4. **code-to-ui video (old item 8b):** English chapter captions are burned into
   `public/videos/driveme.mp4` and its poster `assets/code-to-ui/driveme-frame.jpg`; they move
   between chapters, so no crop hides them. Options: per-locale re-render
   (`driveme.<locale>.mp4`, `CARD_MEDIA` keyed by locale), a caption-free render with DOM
   captions from messages, or accept it.
5. **Smaller items:**
   - Reduced-motion reservations for RAG/CRM are 100–356px short (safe direction, no blank
     tail, but the page can nudge when they mount).
   - uz/ru finale at 861px+ is not refitted (CLS there is ~0.035, low).
   - The globe `summary` region list is still hand-typed copy, not derived from the data.
   - ru globe finale body ends in `other {# страны}`; check it reads right.
   - Low-tier desktop (no WebGL) keeps the 380svh process floor and its old tail; CSS can't
     detect the tier.
   - The Tab sentinel is not tested on the latest-posts block (needs `DATABASE_URL`), and a
     mouse click on a stand-in link before mount rests on a `:focus-visible` guard only.
   - All browser numbers were taken on the dev server; production chunk timing differs.

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
