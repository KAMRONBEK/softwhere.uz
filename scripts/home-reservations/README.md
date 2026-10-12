# Homepage height reservations

`src/modules/home/sections/heights.css` reserves each lazily mounted section's
height so the page doesn't jump when a section's code loads. The per-style
(`[data-style]` A–D) × per-locale (`:lang`) values in it are **generated**:
measured in a real browser, then fitted from below so a reservation never
exceeds the section's natural height (which would leave a blank band).

They go stale when copy, fonts or layout change. Re-fit the affected sections.

These scripts are a working snapshot from the 2026-10-12 refit, not a polished
tool. Run them from this folder against a dev server on `:3100`.

1. **Measure** natural heights over a list of viewports:
   `node scan.js <sectionId> <uz|ru|en> <A|B|C|D> <reduce 0|1> <mobile 0|1> "390x844,360x740,..." > <prefix>_<loc>_<style>.txt`
   (one JSON row per viewport).
2. **Fit + emit CSS** for every locale × style:
   `sh gen.sh <--css-var> <kind> <tolerancePx> <minW> <maxW> <extendTo> <indent> <prefix>...`
   `fit2.js` fits a piecewise-linear (px + vw) lower hull, sits 12px under the
   lowest sample and re-checks on a 1px grid. `kind` picks which svh terms are
   subtracted first (see the top of `fit2.js`).
3. Paste the emitted rules into `heights.css`, then **check CLS**:
   `DELAY=3000 node cls.js <loc> <w> <h> full [reduce]` (DELAY holds back
   `/_next/static` chunks so sections mount while on screen; target < 0.05).

Hand-tuned rules that the generator doesn't produce, keep them on a re-fit:
the reduced-motion Telegram short-screen cap (`--lab-tg-short`).
