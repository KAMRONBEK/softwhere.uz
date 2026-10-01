---
name: portfolio-capture
description: Make portfolio media for SoftWhere's projects — scripted screen recordings of websites and mobile apps, framed in a browser or phone, with English captions and an optional AI voiceover, plus framed screenshots — for the website's work pages, case studies, Clutch and proposals. Use this whenever the user wants portfolio videos, app walkthroughs, demo videos, "show how the app works", better portfolio pictures or screenshots, or to refresh portfolio items from old codebases.
---

# Portfolio capture

Turns a project's code into portfolio media: a recorded walkthrough (the real app, driven by a script), framed in a phone or browser, with captions and an optional voiceover, plus framed stills. Everything here is free: Playwright, Maestro, ffmpeg and the Kokoro voice.

## Step 1: May we show it?

Check this before running anything. Which group is the project in? `references/inventory.md` has a draft list; ask the user when a project isn't there or is marked "confirm".

| Group                                                              | What we may show                                                                                                                                                        | Label on the video and card                                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **A. Built by SoftWhere** (agency client or own product)           | The real app. Under an NDA: only after the client agrees in writing; anonymise if they ask.                                                                             | "Built by SoftWhere" (or "Client under NDA, shown with permission")                               |
| **B. Built by our engineers at a previous company, and public**    | Only screens that were publicly available (App Store, Play Store, public website). Replace the name, logo, colours and all data. Never present the company as a client. | "Anonymised. Built by [Name / our lead engineer] in a previous role."                             |
| **C. Internal, unreleased, or only available as an ex-employer's code** | Nothing from the original. Build a fresh **concept demo** with new branding, fake data and our own code, showing the same kind of features.                       | "Concept demo"                                                                                    |

Rules for every group:

- **Never run or copy an ex-employer's source code** to make SoftWhere marketing. For group B, record the public app from the store with demo data, or rebuild it as a concept demo (group C).
- **No real customer data on screen, ever.** Use a demo account and fake data; blur anything else (`redact` boxes below).
- **Honest dates.** "Recorded with demo data, [month year]". If the app is no longer live, don't imply it is.
- **Non-halal projects** (interest-based banking, lending, conventional insurance): the founders decided (October 2026) these may appear only as **anonymised skill showcases**. Name the capability ("secure onboarding and identity checks", "card management", "instant transfers"), not the business model, and never as an offer. The site's client policy still says we don't take this work; keep the two consistent.
- Wording for case studies and cards comes from the `case-study-writer` skill.

## Step 2: Where it runs

- **Mobile apps need the Mac:** iOS builds and the Simulator only run on macOS; the Android emulator needs a real machine (not a small VPS). Real phones work too.
- **Websites** run anywhere, including Claude Code on the web.
- Record a **production build** (`next build && next start`, release builds of apps). Dev servers add badges and overlays (the Next.js "N" badge) and are slower.

## Step 3: Get it running with demo data

Old projects often fail to build (old Node, React Native, Flutter or Xcode versions). Fix the build first and keep the changes on a separate branch.

Most old backends are gone or need keys we no longer have, and real data must not be shown. Add a **demo mode**:

- Web and React Native: Mock Service Worker (MSW) handlers, or a small local mock server returning realistic JSON.
- Flutter: fake repositories behind the same interfaces.
- Seed believable data: generic names ("Alex Morgan"), round but plausible amounts, neutral photos (avatars or illustrations, no real people's photos without permission).

## Step 4: Record one story per video

Plan the walkthrough as one short story: open → the core action → the result, 30–90 seconds. Pause on each screen long enough to read it.

**Websites:** write a scenario (see `assets/web-scenario.example.json`) and run

```bash
node <repo>/.claude/skills/portfolio-capture/scripts/record-web.js scenario.json --out rec/web
```

Steps: `goto`, `click`, `hover`, `type` (`["selector", "text"]`), `press`, `scroll` (pixels, negative goes up), `scrollTo`, `wait` (ms), `waitFor`, `screenshot` (name). Each step can have a `pause` (ms). A visible cursor moves smoothly before each click. It writes `clip.webm`, the screenshots and `timeline.json` (when each step started), so captions can be timed to the actions. `"viewport": "mobile"` records at 390×844 with touch.

**Mobile apps:** install [Maestro](https://maestro.dev), write a flow (see `assets/flow.example.yaml`), install the app on a booted simulator or a connected phone, and run

```bash
<repo>/.claude/skills/portfolio-capture/scripts/record-mobile.sh ios flow.yaml rec/ios      # or: android
```

It sets a clean status bar (9:41, full battery), records while Maestro drives the app, and writes `clip.mp4` plus the flow's screenshots. Android's recorder stops at 3 minutes.

## Step 5: Build the video

Write a `walkthrough.json` next to the recording (see `assets/walkthrough.example.json`):

| Field                                | Meaning                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `title`, `category`, `label`         | Big title (a generic name for anonymised work), the category line, the honesty label from Step 1            |
| `device`                             | `iphone`, `android` or `browser` (`url` sets the address bar text; use a neutral one when anonymising)      |
| `island`                             | `false` hides the iPhone camera cutout (needed for mobile-web recordings, which have no status bar)         |
| `format`, `theme`                    | `landscape` (1920×1080, case-study pages) or `vertical` (1080×1920, cards and social); `light` or `dark`   |
| `clip`, `clipStart`, `clipEnd`       | The recording and the part to use                                                                           |
| `segments`                           | `{from, to, caption, say?, zoom?: {x, y, scale}}`, in seconds of the original recording (same clock as `timeline.json`). `say` is the spoken line if it differs from the caption; `"say": false` keeps a segment silent. |
| `redact`                             | Blur boxes `{x, y, w, h, from?, to?}` as fractions of the frame, for logos, names and stray data            |
| `intro`, `outro`                     | Seconds for the title card and the SoftWhere end card (defaults 2.4 and 3)                                  |

Then:

```bash
python3 <repo>/.claude/skills/portfolio-capture/scripts/build.py walkthrough.json \
  [--model kokoro-q8.onnx --voices <kokoro-js>/voices --voice af_heart] [--stills 5,12,20]
```

Without `--model` the video is silent with captions (right for website loops; most people watch muted). With it, each segment is spoken by Kokoro; the script warns when a line is longer than its segment, so shorten the words or widen the segment. `--stills` saves framed screenshots at those seconds, ready for portfolio cards and Clutch. The voice setup is the same as in the `social-video` skill.

## Step 6: Check before delivering

Look at the stills and at frames from the final MP4: no client name, logo, real person or real data left on screen; captions short enough to read; nothing cut off by the frame. Fix with `redact`, shorter captions or another take.

## Step 7: Deliver

Per project, in `portfolio-assets/<slug>/` (not in this repo):

- `<slug>-walkthrough.mp4`: landscape, narrated, 45–90 seconds, for the case-study page
- `<slug>-loop.mp4`: vertical or landscape, silent, 10–20 seconds, for the portfolio card; compress it: `ffmpeg -i in.mp4 -an -c:v libx264 -crf 28 -preset slow -movflags +faststart <slug>-loop.mp4`, and add a WebM: `ffmpeg -i in.mp4 -an -c:v libvpx-vp9 -crf 38 -b:v 0 <slug>-loop.webm`
- `<slug>-poster.jpg` and 4–6 framed stills

Host videos on Cloudflare R2 or Cloudflare Stream, not in the repo or on the small server.

## Setup (once per machine)

```bash
pip install imageio-ffmpeg kokoro-onnx soundfile   # ffmpeg and the voice
npm install -g playwright                           # if the project has no playwright of its own
```

Fonts: copy `bricolage-grotesque-latin-wght-normal.woff2` and `hanken-grotesk-latin-wght-normal.woff2` into a `fonts/` folder next to `walkthrough.json` (the `social-video` setup shows how to get them with `npm pack`), or pass `--fonts <dir>`. Rendering uses `../social-video/scripts/render.js`.
