# Portfolio videos

Every portfolio entry can carry a short silent walkthrough video (16:9, 1080p, English captions)
that plays in the homepage portfolio slider. The videos are rendered locally with
[Remotion](https://www.remotion.dev) from the self-contained project in [`video/`](../video) — no paid
APIs or hosted services are involved.

## How it fits together

```
video/                         Remotion project (own package.json, not part of the Next build)
├── src/projects/<slug>.json   one data file per video (validated by src/schema.ts)
├── public/projects/<slug>/    lean WebP source material (store screenshots, captures, icons)
├── specs/<slug>.json          Playwright capture specs for website screenshots
└── scripts/                   fetch / capture / validate / render tooling
        │  yarn render
        ▼
public/videos/<slug>.mp4 + <slug>.jpg (poster)   ← served by Next.js as static files
        │                                          (`videos` must stay excluded in src/proxy.ts's matcher,
        │                                           or the locale redirect turns them into /uz/videos/… 404s)
        │
src/shared/data/projects.ts → Project.video { src, poster }
        │
ProjectSlider → ProjectMedia → ProjectVideo   (sections/Projects/components/)
```

- **One composition, many configs.** `video/src/ProjectPromo.tsx` renders an intro title card, the
  config's scenes, and an outro (tech chips, role, availability, Softwhere sign-off) over a persistent
  Ember-themed backdrop. `src/projects/index.ts` discovers every `src/projects/*.json` at bundle time,
  so adding a video never touches the registry.
- **Scene types** (`video/src/schema.ts`): `mobile` (1–3 phone screens drawn in a CSS device frame, or
  designed store frames shown as floating cards), `web` (1440×900 captures in a browser frame, with
  optional scrolling and a synthetic clicking cursor), and `video` (a real screen recording in a phone or
  browser frame).
- **Validation is scoped.** `calculateMetadata` (`video/src/prepare.ts`) parses each config with zod and
  measures its images, so an invalid config only breaks its own composition. `yarn validate` performs
  the same schema check without bundling.

## Adding or updating a video

Run everything from `video/` (`yarn install` once; Node 22+; system Google Chrome is used for captures).

```bash
# 1. Gather material into public/projects/<slug>/
node scripts/fetch-appstore.mjs --id=<app id> --slug=<slug> --country=us --icon
node scripts/fetch-play.mjs --id=<package> --slug=<slug>
node scripts/save-images.mjs --slug=<slug> --prefix=archive <url-or-path> ...   # archived / local images
node scripts/capture-web.mjs specs/<slug>.json                                   # website screenshots
node scripts/contact-sheet.mjs /tmp/<slug>.jpg public/projects/<slug>/*.webp     # review them at a glance

# 2. Write drafts/<slug>.json (copy src/projects/talim-ai.json or truck-me.json), then
yarn -s validate drafts/<slug>.json && cp drafts/<slug>.json src/projects/<slug>.json

# 3. Check the real composition, then render into ../public/videos
node scripts/extract-frames.mjs --only=<slug>        # frames/<slug>/sheet.jpg
node scripts/render.mjs --only=<slug>
yarn studio                                          # optional: interactive preview
```

Finally reference it from `src/shared/data/projects.ts` with `video: promoVideo('<slug>')`.

## Content rules

- Show public material only: store listings, the product's public site, archived store screenshots, or
  local renders with mocked data. Never ratings, download counts, real user data, client admin panels,
  IP addresses, source code or credentials.
- Captions are English, concrete and honest. Client work is framed by the studio's actual role (the
  config's `role` field), and a client's corporate website is never presented as Softwhere's work.
- Delisted products use `"status": "archived"` so the outro says so instead of showing store badges.

## Encoding and size

`scripts/render.mjs` writes silent H.264 (CRF 26, `slow` preset, yuv420p, BT.709) — every browser can
autoplay it muted. Screen-content videos land around 1.5–6 MB each; source assets are capped at 900 px
(phones) / 1440 px (web) WebP to keep the repository light. Remotion is free for teams of up to three
people; a larger company needs a [Remotion company license](https://www.remotion.pro/license).

## In the slider

`ProjectVideo` plays only while its slide is selected **and** at least half on screen (an
`IntersectionObserver` also keeps react-slick's off-screen clones silent), respects
`prefers-reduced-motion`, uses `preload="none"` for inactive slides, and advances the slider when the
video ends. Slides without a video fall back to the screenshot / icon / initials visual from
`projectImages.ts` and advance after `STILL_SLIDE_MS`.

_Last verified against code: 2026-10-04._
