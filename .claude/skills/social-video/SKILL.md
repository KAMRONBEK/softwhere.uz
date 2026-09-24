---
name: social-video
description: Make short social media videos for SoftWhere (reels, shorts, LinkedIn and X videos, launch clips, offer announcements, app demo reels) as real MP4 files, rendered from an HTML animation with free, open-source tools. Use this whenever the user asks for a video, reel, short, animated post, motion graphic or "something moving" for social media, even if they only say "make a video for LinkedIn" or "we need content for Instagram".
---

# Social video

This skill turns a storyboard into an MP4 without paid tools: the video is an HTML page whose `window.render(t)` draws the frame at `t` seconds; `scripts/render.js` steps through time in headless Chromium and pipes the frames into ffmpeg (H.264, `yuv420p`, `+faststart`), which every platform accepts.

`assets/launch-reel.html` is a finished 25-second example (vertical, 1080×1920): logo lock-up, "Mobile apps with AI built in.", a Talim AI phone with an AI chat, the San Francisco / Tashkent clocks, three promises, and a call to action. Start from it; it shows the timing helpers, masks and scene wipes.

## Before writing anything

Write a storyboard first and show it to the user: scenes, seconds, on-screen text, visuals. Use the `softwhere-social` skill for the script and hook. Keep to what's true: real product screens, no invented numbers or clients, "built by SoftWhere" only for SoftWhere's own work.

Defaults, because they come from the founders:
- **No background music.** The founders prefer to avoid it. Text on screen carries the message (most people watch muted). If the user wants sound, suggest their own voice-over.
- **No AI avatars or stock faces.** Real screens, real product, and the founders' own filmed clips if they have them.
- **Brand:** orange `#FE4502` as a ground, not a small accent; ink `#101216`; paper `#F3F4F6`; dark ember `#2B1206`. Type: Bricolage Grotesque for headlines, Hanken Grotesk for text. Follow the `frontend-design` skill: one memorable moment per video, no all-caps labels, no decoration that doesn't carry meaning.

Sizes: 1080×1920 (9:16) for Reels, Shorts, TikTok and LinkedIn mobile; 1080×1350 (4:5) for feed posts; 1080×1080 (1:1) when unsure. Keep videos 15–45 seconds, with the hook in the first two seconds and the web address at the end.

## Setup (once per session)

Work in a scratch folder, not the repo. Copy the template and the product screenshots you need, then fetch the fonts and the encoder:

```bash
mkdir -p "$WORK/fonts" && cd "$WORK"
cp <repo>/.claude/skills/social-video/assets/launch-reel.html .
cp <repo>/public/images/projects/screens/talim-ai.webp .
npm pack @fontsource-variable/bricolage-grotesque @fontsource-variable/hanken-grotesk --silent
for f in *.tgz; do tar -xzf "$f" && cp package/files/*-latin-wght-normal.woff2 fonts/ && rm -rf package; done
pip install -q imageio-ffmpeg
```

Google Fonts links may be blocked in the sandbox; local font files are reliable and keep renders identical.

## Build and check

1. Edit the HTML: each scene is an absolutely positioned layer; `render(t)` sets every style from `t` using `seg(t, a, b)` (0→1 progress) and easing helpers. Everything must be a pure function of `t`, with no timers or CSS transitions, so every frame is reproducible.
2. Render stills at a few key moments and look at them before the full render:
   `node <repo>/.claude/skills/social-video/scripts/render.js launch-reel.html --stills 1.5,5,11,16,21,24`
   Check for text cut off at the edges, elements visible before their scene, and legibility on a phone.
3. Render the video:
   `node <repo>/.claude/skills/social-video/scripts/render.js launch-reel.html softwhere-reel.mp4 --duration 25`
   A 25-second 1080×1920 video takes about a minute.
4. Pull a few frames from the MP4 itself to confirm, then send the file to the user.

Everything here is free: Chromium, Playwright, ffmpeg and the fonts (SIL Open Font License) cost nothing. Remotion is an alternative for complex videos, but it needs a paid company licence for teams larger than three people.
