# Idea: Portfolio videos and pictures from our past projects

> **Status:** the tool is built; no project has been captured yet. Decided and built 2026-10-01. The tool is the `portfolio-capture` skill (`.claude/skills/portfolio-capture/`). The rules for what may be shown are in the `case-study-writer` skill and the Global Playbook (section 6).

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
| `references/inventory.md` | All 24 portfolio projects sorted into the groups below (draft) | Founders to confirm |

Test outputs (a 31-second narrated softwhere.uz walkthrough and a vertical loop) were sent to the founders on 2026-10-01.

**Everything is free.** It uses a browser, ffmpeg, open fonts and the open-source Kokoro voice. Remotion was skipped because companies with more than three people need its paid licence, and the HTML + ffmpeg pipeline shared with the `social-video` skill does the same job.

## Where it runs

- **On the Mac** (or the planned Mac mini): the iOS simulator and Xcode, the Android emulator, Maestro, and the old toolchains each project needs.
- **Not on the cheap server.** A VPS can't run the iOS simulator or the Android emulator; the server is for the website ([07](./07-own-server.md)).
- **Videos are served from Cloudflare R2 or Cloudflare Stream**, not from the repo or the server.
- One-time setup is in the skill's "Setup" section: Python packages for ffmpeg and the voice, Playwright, the fonts, and Maestro on the Mac.

## What may be shown (founders' decision, October 2026)

| Group | Projects (draft) | How it's shown |
| --- | --- | --- |
| **A. Built by SoftWhere** | Talim AI, DriveMe, DriveMe Driver | Full case study. If a client is under an NDA, only with their written permission, and anonymised if they ask |
| **B. Built by our engineers in previous jobs, and public** | Netevia, Truck Me, VBrato & Swish, HeyAll, WorkAxle, Nestegg.ai, Nestegg Loan | Anonymised: a generic name ("Online banking app"), no logo, colours or real data, only screens that were public, labelled "Anonymised. Built by [Name] in a previous role." Or on the person's profile with their real role |
| **C. Internal, unreleased, or only available as a former employer's code** | To confirm | A **concept demo**: rebuilt with new branding, fake data and our own code, labelled "Concept demo" |
| **Interest-based banking, lending, insurance** | Netevia, Nestegg.ai, Nestegg Loan, Asia Insurance, ASCON | Only as anonymised **skill showcases**, named by capability ("secure onboarding and identity checks", "card management", "instant transfers"), never offered as a service. The founders confirm this with their scholar |

Hard rules:

- **Never run or copy a former employer's code** to make SoftWhere marketing. Record what was public, or build a concept demo.
- **Read each NDA or employment agreement's confidentiality and return-of-materials clauses first.** An NDA can cover screens and features, not only the name.
- **No real user data on screen.** Every recording uses demo data: a mock server, fake repositories, or seeded test accounts.
- **Honest dates.** For example, "Recorded from the app as delivered in 2024". If an app is no longer live, say so.

## Still to decide

1. The group for each "confirm" row in `references/inventory.md`: Asia Insurance, ASCON, EDOCS, BDM, Primus mall, Align 360, NAFT, BrainWake, Nexus, Snap Taxi, Seyf Bazar, Bozorlik, MyDesign, Avtogen.uz.
2. Which SoftWhere projects are under an NDA, and the permission emails for those.
3. **The first project.** Recommended: Talim AI (a website, so it can be recorded today) or DriveMe (needs the Mac). Both need no permission and make the best case studies.
4. The scholar's view on showing interest-based and insurance work as skill showcases.

## Order of work

1. **Group A** (3 projects): about 1–3 hours of Claude time each. Getting old builds to run is the slowest part.
2. **Two or three group B public apps.**
3. **Concept demos** for the strongest group C ideas. These double as starter kits for client work.
4. **Put each project on the site** with the `case-study-writer` skill, then remove the overstated "24 apps live" count (playbook section 6).

**How to start a session on the Mac:** "Use the portfolio-capture skill to make the portfolio videos for Talim AI." The skill walks through:

1. The rights check.
2. Getting the project running with demo data.
3. Recording.
4. Building the video.
5. Checking it.
6. Delivering to `portfolio-assets/<slug>/` outside the repo.
