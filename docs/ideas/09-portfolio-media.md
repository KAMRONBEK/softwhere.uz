# Idea: Portfolio videos and pictures from our past projects

> **Status:** the tool is built; no project has been captured yet. Built 2026-10-01; what may be shown was decided 2026-10-02. The tool is the `portfolio-capture` skill (`.claude/skills/portfolio-capture/`). The credit rules are in the `case-study-writer` skill and the Global Playbook (section 6).

## The idea

Claude goes through the old codebases one at a time on the Mac, gets each project running with demo data, records a scripted walkthrough, and turns it into a framed video with English captions and a plain-English voiceover, plus better pictures for the site. Each project gets:

| Output | Where it's used |
| --- | --- |
| A 10–20 second silent loop with captions (landscape, plus a vertical version) | The portfolio card on the site; Reels |
| A 45–90 second narrated walkthrough | The project's case-study page, proposals, Clutch |
| 4–6 framed screenshots and a poster image | The site, Clutch, proposals |

## What's built

| Part | What it does | Tested |
| --- | --- | --- |
| `scripts/record-web.js` | Records a website from a JSON list of steps (go to, click, type, scroll, wait, screenshot) with Playwright, a visible cursor and smooth scrolling. Writes `clip.webm` and `timeline.json` | Yes, on softwhere.uz |
| `scripts/record-mobile.sh` | iOS: clean status bar, `xcrun simctl io booted recordVideo`, and a Maestro flow that taps through the app. Android: demo mode, `adb shell screenrecord`, Maestro | Syntax only: needs the Mac |
| `scripts/build.py` | Blurs logos (boxes with start and end times); frames the clip in an iPhone, Android or browser frame; adds the title, captions, zooms, an end card and a Kokoro voice per caption; normalises loudness. Landscape (16:9) or vertical (9:16), plus framed stills | Yes |
| `assets/walkthrough.html` | The video template, in SoftWhere's colours and fonts | Yes |
| `references/inventory.md` | All 24 portfolio projects in site order, who built each one, and the recording order | Who built some projects is still to fill in |

Test outputs (a 31-second narrated softwhere.uz walkthrough and a vertical loop) were sent to the founders on 2026-10-01.

**Everything is free.** It uses a browser, ffmpeg, open fonts and the open-source Kokoro voice. Remotion was skipped because companies with more than three people need its paid licence, and the HTML + ffmpeg pipeline shared with the `social-video` skill does the same job.

## Where it runs

- **On the Mac** (or the planned Mac mini): the iOS simulator and Xcode, the Android emulator, Maestro, and the old toolchains each project needs.
- **Not on the cheap server.** A VPS can't run the iOS simulator or the Android emulator; the server is for the website ([07](./07-own-server.md)).
- **Videos are served from Cloudflare R2 or Cloudflare Stream**, not from the repo or the server.
- One-time setup is in the skill's "Setup" section: Python packages for ffmpeg and the voice, Playwright, the fonts, and Maestro on the Mac.

## What may be shown (founders' decision, 2 October 2026)

- **Every project in the portfolio is shown by name**, with the real app, icon and screens. The founders confirmed there are no NDA issues with the current list, and they will add more projects. For a new project, confirm it may be shown before recording.
- **Interest-based banking, lending and insurance projects** (Netevia, Nestegg.ai, Nestegg Loan, Asia Insurance, ASCON) are shown as regular projects but **always last**: last on the site, in proposals and in reels, and recorded last. The site already lists them last (`src/shared/data/projects.ts`, positions 20–24). The client policy still says we don't take this kind of work, so they are never offered as a service.

Rules for every project:

- **Credit it honestly.** Say who built it and in what role. An app a team member built while working at another company says so ("Built by [Name] at WorkAxle"); the company is never called SoftWhere's client or used as a reference. Buyers call references, and Clutch verifies reviews.
- **No real user data on screen.** Every recording uses demo data: a mock server, fake repositories, or seeded test accounts.
- **Honest dates.** For example, "Recorded with demo data, October 2026". If an app is no longer live, say so.
- **Anonymise only when someone asks** (a client or a former employer); the tool's `redact` boxes blur logos and names.
- **Concept demo** only when the original can't be run any more: the same kind of features rebuilt with fake data, labelled "Concept demo".

## Still to decide

1. **Who built each project** marked "[to fill]" in `references/inventory.md`, for the credit line.
2. **The new projects** the founders will add: name, platforms, links, who built it.
3. **The first recordings:** Talim AI (a website, so any session can record it), then DriveMe and DriveMe Driver on the Mac.

## Order of work

1. **Talim AI, DriveMe and DriveMe Driver:** about 1–3 hours of Claude time each. Getting old builds to run is the slowest part.
2. **The other public apps**, then **the unreleased ones** with demo data.
3. **The banking and insurance projects last.**
4. **Put each project on the site** with the `case-study-writer` skill, then remove the overstated "24 apps live" count (playbook section 6).

**How to start a session on the Mac:** "Use the portfolio-capture skill to make the portfolio videos for Talim AI." The skill walks through:

1. Confirming the project may be shown and who gets the credit.
2. Getting the project running with demo data.
3. Recording.
4. Building the video.
5. Checking it.
6. Delivering to `portfolio-assets/<slug>/` outside the repo.
