---
name: social-video
description: Make short social media videos for SoftWhere (reels, shorts, LinkedIn and X videos, launch clips, offer announcements, app demo reels) as real MP4 files, rendered from an HTML animation with free, open-source tools. Use this whenever the user asks for a video, reel, short, animated post, motion graphic or "something moving" for social media, even if they only say "make a video for LinkedIn" or "we need content for Instagram".
---

# Social video

This skill turns a storyboard into an MP4 without paid tools: the video is an HTML page whose `window.render(t)` draws the frame at `t` seconds; `scripts/render.js` steps through time in headless Chromium and pipes the frames into ffmpeg (H.264, `yuv420p`, `+faststart`), which every platform accepts.

Two templates, both vertical 1080×1920:

- **`assets/hype-reel.html` — the default for Instagram, TikTok and Shorts.** A 30-second, beat-synced reel at 128 BPM: every cut lands on a beat of `scripts/music.py`'s track. Word-by-word slams with an RGB split, a zoom-through, a 3D phone drop, a chat with a sparkle burst, a code rush into a blackout, a drop with a shockwave and confetti, a spinning globe, whip-cut promise cards, a logo slam, and a last frame that matches the first, so the reel loops seamlessly. Start from this whenever the user wants energy, movement or something that "could go viral".
- **`assets/launch-reel.html` — calm explainer.** 25 seconds of scene wipes and holds, suited to LinkedIn and a narrated walk-through.

## High-energy reels

What makes a reel feel alive, all present in `hype-reel.html`:
- **The beat grid decides everything.** `T(bar, beat)` gives the time; cuts, slams and impacts happen on beats, and `music.py` places whooshes, whips, risers and impacts on the same times. Change a cut in one file and change it in the other.
- **Something moves in every frame:** the camera bounces on each kick, shakes on impacts (`IMPACTS`), slowly zooms through build-ups; backgrounds drift (stripes, orbs, rotating rings); a grain overlay changes every frame.
- **Motion vocabulary:** `slam()` (scale down from 2–3× with blur and an RGB split), whip transitions (translate + skew + blur), zoom-through, back-ease pops, a flash frame on drops, deterministic particles and shockwave rings on a canvas, clip-path wipes.
- **Structure:** hook in the first second (a question the viewer answers "yes" to), a build-up with a blackout before the drop, the payoff on the drop, rapid proof, a logo end card, then back to the first frame.
- **Deterministic:** everything is a pure function of `t` (use `hash()` for randomness), and scenes are hidden with `display: none`. Visibility alone leaks through, because a child set to `visible` shows inside a hidden parent.

`scripts/music.py` writes the matching original track (uplifting house, C major, Am–F–C–G, 16 bars = 30 s, drop at bar 9, seamless loop). Change `BPM`, `CHORDS`, `LEAD` and the arrangement in `build()`; pass `--voice narration.wav` to duck the music under a voice-over. You can't hear the result, so check it with the section levels it prints and a band-energy analysis. Keep the 120–500 Hz and 500 Hz–2 kHz bands within about 3–8 dB of the sub-bass in the drop, because phone speakers can't play deep bass, and tell the user to listen before posting.

## Before writing anything

Write a storyboard first and show it to the user: scenes, seconds, on-screen text, visuals. Use the `softwhere-social` skill for the script and hook. Keep to what's true: real product screens, no invented numbers or clients, "built by SoftWhere" only for SoftWhere's own work.

Defaults, because they come from the founders:
- **Music is original.** `scripts/music.py` synthesises the track from oscillators and noise, so there is nothing to license and no copyright claim. Never use a commercial song. For extra reach, the user can also add trending audio inside the Instagram app when posting (business accounts only get Meta's licensed sound library).
- **No AI avatars or stock faces.** Real screens, real product, and the founders' own filmed clips if they have them.
- **Brand:** orange `#FE4502` as a ground, not a small accent; ink `#101216`; paper `#F3F4F6`; dark ember `#2B1206`. Type: Bricolage Grotesque for headlines, Hanken Grotesk for text. Follow the `frontend-design` skill: one memorable moment per video, no all-caps labels, no decoration that doesn't carry meaning.

Sizes: 1080×1920 (9:16) for Reels, Shorts, TikTok and LinkedIn mobile; 1080×1350 (4:5) for feed posts; 1080×1080 (1:1) when unsure. Keep videos 15–45 seconds, with the hook in the first two seconds and the web address at the end.

## Setup (once per session)

Work in a scratch folder, not the repo. Copy the template and the product screenshots you need, then fetch the fonts and the encoder:

```bash
mkdir -p "$WORK/fonts" && cd "$WORK"
cp <repo>/.claude/skills/social-video/assets/hype-reel.html .     # or launch-reel.html
cp <repo>/public/images/projects/screens/talim-ai.webp .
npm pack @fontsource-variable/bricolage-grotesque @fontsource-variable/hanken-grotesk @fontsource/jetbrains-mono --silent
for f in *.tgz; do tar -xzf "$f" && cp package/files/*-latin-wght-normal.woff2 package/files/jetbrains-mono-latin-500-normal.woff2 fonts/ 2>/dev/null; rm -rf package; done
pip install -q imageio-ffmpeg scipy soundfile
```

Google Fonts links may be blocked in the sandbox; local font files are reliable and keep renders identical.

## Build and check

1. Edit the HTML: each scene is an absolutely positioned layer; `render(t)` sets every style from `t` using `seg(t, a, b)` (0→1 progress) and easing helpers. Everything must be a pure function of `t`, with no timers or CSS transitions, so every frame is reproducible.
2. Render stills and tile them into one contact sheet before the full render (20–25 moments across the timeline, including mid-transition frames):
   `node <repo>/.claude/skills/social-video/scripts/render.js hype-reel.html --stills 0.6,3.5,5.2,8.3,12.8,15.05,17.7,21.5,23.6,27.4,29.95`
   Check for text cut off at the edges, elements from other scenes leaking in, layers painting over each other, and legibility on a phone.
3. Render the video: `node <repo>/.claude/skills/social-video/scripts/render.js hype-reel.html video.mp4 --duration 30` (about 1–2 minutes).
4. Make the music (and optionally a voice track, see below), then mix at Instagram's loudness:
   ```bash
   python3 <repo>/.claude/skills/social-video/scripts/music.py music.wav [--voice voice.wav]
   ffmpeg -i video.mp4 -i music.wav -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-14:TP=-1.0:LRA=9" \
     -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart reel.mp4
   ```
5. Pull a few frames from the MP4 itself to confirm, then send the file to the user.

## Voice-over

Videos are voiced by default. For the hype reel, don't stretch the visuals: `scripts/beat_voice.py` speaks short lines on the beat grid (`assets/hype-reel-voice.json` is the example) and warns when a line runs into the next cut. Shorten the words or raise that line's `speed`, then pass the file to `music.py --voice`. For calmer videos there are two options:

- **A founder's own voice (best for trust).** Write the narration per scene, timed to the storyboard, and have them record it on a phone in a quiet room. Mix it in with the ffmpeg command below.
- **An AI narrator (quick drafts and explainers).** `scripts/narrate.py` speaks each scene's lines with Kokoro-82M, an Apache-2.0 model that runs locally for free, and writes `narration.wav` plus `timing.js`. The template loads `timing.js` so each scene holds until its line is finished, and items listed in a scene's `align` appear as their sentence starts. `assets/launch-reel-narration.json` is the example. Good voices: `af_heart` (American female, the clearest), `am_michael` (American male), `bm_george` (British male).

Setup for the AI narrator: `pip install kokoro-onnx soundfile`, then `npm pack kokoro-js` for the voices (`package/voices`). Get the model from Hugging Face (`onnx-community/Kokoro-82M-v1.0-ONNX`, `onnx/model_quantized.onnx`). Where Hugging Face is blocked, `npm pack kokoro-q8-shards` and join its parts: `cat package/kokoro-q8.part*.bin > kokoro-q8.onnx` (92,361,116 bytes). Then:

```bash
python3 <repo>/.claude/skills/social-video/scripts/narrate.py launch-reel-narration.json --model kokoro-q8.onnx --voices package/voices
node <repo>/.claude/skills/social-video/scripts/render.js launch-reel.html reel.mp4 --duration <total printed by narrate.py>
ffmpeg -i reel.mp4 -i narration.wav -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart reel-voice.mp4
```

You can't listen to the result, so tell the user to check how names are pronounced (SoftWhere, Talim, Tashkent) before posting; adjust the spelling in the script if a word comes out wrong, for example "Taleem". Some platforms ask creators to label AI-generated audio; ticking that box is harmless.

Everything here is free: Chromium, Playwright, ffmpeg and the fonts (SIL Open Font License) cost nothing. Remotion is an alternative for complex videos, but it needs a paid company licence for teams larger than three people.
