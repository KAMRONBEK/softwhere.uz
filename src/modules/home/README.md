# Homepage (`src/modules/home`) — contract for section agents

This module **is the real homepage** at **`/uz`, `/ru`, `/en`** (`src/app/[locale]/page.tsx`, `mode='home'`:
static/ISR HTML, no panel, no URL state). It grew out of the hidden lab prototype, so most identifiers
keep their `Lab` prefix (`LabShell`, `useLabTheme`, `--lab-*`, `data-lab-root`): that is history, not a
second module. The same page also runs as the noindex **staging copy** at **`/[locale]/lab/home`**
(`mode='lab'`: founder panel with `?panel=1`, URL state below). Both are built by
`src/app/[locale]/_home/HomeExperience.tsx` (scoped client messages, the AI brief slot, latest posts).
The homepage and `/lab/*` sit outside the `src/app/[locale]/(site)` route group, so the old site Header,
Footer, floating widgets and site fonts (all in `(site)/layout.tsx`) are neither rendered nor shipped there.

**Copy is next-intl messages**, one folder per part: `src/messages/home/<part>/{en,ru,uz}.json`, read as
`useTranslations('home.<sectionId>')`. Every section part has `heading` + `summary`: the shell renders them
as the section's server HTML (`components/SectionFallback.tsx`) until the section mounts. The page's HTML
carries only `home.shared`, `home.header`, `home.hero` and each section's fallback keys
(`sections/eagerMessages.ts`); a section's full part loads with its chunk (`components/SectionMessages.tsx`),
so read your own part (and `home.shared`) only. A richer fallback that reads more keys must list them in
`eagerMessages.ts` `FALLBACK_KEYS`. Worked example:
`sections/S03XRay.tsx` + `src/messages/home/xray/`. Full pattern and ownership:
`/tmp/claude-1000/-home-softwhere-Documents-apps/039b7710-9d01-4481-9ae9-8376878867aa/scratchpad/promote/PLAN.md`.
Check: `node scripts/check-home-messages.mjs`.

The founder scrolls it on his phone, flips **Style A–D**, **Logo 1–2**, **Logo color** and **Quality** in the
floating **Lab** panel, and shares links. Every choice lives in the URL:

| Param   | Values                                                              | Default |
| ------- | ------------------------------------------------------------------- | ------- |
| `style` | `A` `B` `C` `D`                                                     | `A`     |
| `logo`  | `1` `2` (Original, the reference; Refined, the default)             | `2`     |
| `lc`    | `brand` (SoftWhere orange) `accent` (the style's accent)            | `brand` |
| `q`     | `auto` `high` `low` (+ `mid`, URL only)                             | `auto`  |
| `only`  | a section id or number (`devices`, `06`) → render just that section | all     |

## 1. Your file

Replace **only** your section file. Keep its path and its default export: a component taking
`LabSectionProps` (`{ meta }`).

| #   | id              | file                           |
| --- | --------------- | ------------------------------ |
| 01  | `hero`          | `sections/S01Hero.tsx`         |
| 02  | `manifesto`     | `sections/S02Manifesto.tsx`    |
| 03  | `xray`          | `sections/S03XRay.tsx`         |
| 04  | `assembly`      | `sections/S04Assembly.tsx`     |
| 05  | `code-to-ui`    | `sections/S05CodeToUI.tsx`     |
| 06  | `devices`       | `sections/S06Devices.tsx`      |
| 07  | `telegram`      | `sections/S07Telegram.tsx`     |
| 08  | `mobile-build`  | `sections/S15MobileBuild.tsx`  |
| 09  | `web-build`     | `sections/S16WebBuild.tsx`     |
| 10  | `rag-build`     | `sections/S17RagBuild.tsx`     |
| 11  | `crm-build`     | `sections/S18CrmBuild.tsx`     |
| 12  | `ai-demo`       | `sections/S08AIDemo.tsx`       |
| 13  | `work-wall`     | `sections/S09WorkWall.tsx`     |
| 14  | `numbers`       | `sections/S10Numbers.tsx`      |
| 15  | `globe`         | `sections/S11Globe.tsx`        |
| 16  | `process`       | `sections/S12Process.tsx`      |
| 17  | `stack-physics` | `sections/S13StackPhysics.tsx` |
| 18  | `finale`        | `sections/S14Finale.tsx`       |

07–11 are the **"how we build" chapter**: Telegram, then a mobile app, a website, AI on your documents
(RAG) and a CRM / admin system, each told the way 07 tells the Telegram bot. The number is the section's
position in `SECTION_IDS` (`types.ts`), so it moves when a section is inserted (the badge, the panel and
`?only=08` follow it); ids and file names never change, so a file's `SNN` prefix is only the order it was
added in. Refer to sections by id.

```tsx
'use client';
import type { LabSectionProps } from '../types';
import { SectionHeading } from '../components/LabSection';

export default function S03XRay({ meta }: LabSectionProps) {
  return (
    <div style={{ minHeight: '100svh' }}>
      <SectionHeading meta={meta}>See through the screen</SectionHeading>…
    </div>
  );
}
```

You may add private helper files next to it (`sections/s03/…`, `S03XRay.module.css`). Do **not** edit
the shell, registry, theme, panel or another section — tell the orchestrator instead (e.g. "set
`minHeight` for `process` to `400svh`" or "`devices` needs `ssr: false`").

**What the shell already does around you** (don't duplicate it): wraps you in
`<section id={meta.id} aria-labelledby=…>` with the reserved `minHeight` (default `100svh`), the sticky
`NN · Name` badge (founder-only: shown with `?panel=1`, below the header), an error boundary, and lazy
mounting: your chunk loads and your component mounts when the section is ~1 viewport away and **unmounts
when it is ~2.5 viewports away** (its height is frozen, so nothing shifts). Expect to be
mounted/unmounted several times per visit: set up in effects / `useGSAP` and clean up completely.
Nothing below the hero mounts before the visitor's first scroll (`LazyMount waitForScroll`), and the hero
itself stays the static `HeroFallback` until the first input or an idle moment after load
(`sections/s01/HeroGate.tsx`, `s01/heroBoot.ts`; never on reduced motion, Save-Data or the low tier).

**The visitor header** (`global/LabHeader.tsx`) is fixed over every section: 56px on phones, 64px from
900px (`--lab-header-h`, safe area included). It slides away while the visitor scrolls down and comes back
on a move up. `--lab-header-offset` on the lab root is its height while it shows and `0px` once it has gone:
a bar you stick to the top can use `top: var(--lab-header-offset)` to sit under it. Keep the top ~56px of a
pinned stage free of anything the visitor must read or tap. The page logo is the header's, so a section
never draws its own.

ScrollTrigger: don't put a `once: true` trigger on a `gsap.timeline()`. A timeline's trigger refreshes a
tick late, and when the visitor has already jumped past it, it kills itself inside the next trigger's
refresh and ScrollTrigger throws (S13's walls hit this). Use separate tweens that share the trigger config.
With `invalidateOnRefresh` on a scrubbed proxy, also pass `onRefresh: render`: the refresh renders the
start state and restores the progress without an update (S18 showed chapter 01 at the end of its track).

Reserved heights live in `sections/registry.ts` (`MIN_HEIGHT`: plain lengths for fixed scroll stories) and
`sections/heights.css` (breakpoint-aware `--lab-h-<id>` values for content-height sections, fitted from
below so they never leave a blank tail). Change them there when your section's height changes. A section
whose slot the page fills (12 · `ai-demo` holds the real AI brief) reserves `SLOT_MIN_HEIGHT` instead
(`--lab-h-ai-demo-slot`): the shell picks it from `meta.slotMinHeight` when the slot is present.
`FADE_EDGES` in the registry melts a section's top/bottom edge into `--bg` when its own backdrop would end in
a seam. `scrollToSection()` keeps the target pinned for ~1.5s while its neighbours mount; scroll the page
yourself only through `scrollToY()` (it hands over cleanly) or a Lenis animated `scrollTo`.

## 2. Available building blocks

All paths are relative to `src/modules/home/`.

| Import                                                                                                         | What it gives you                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/LabSection` → `SectionHeading`                                                                     | Your section's one real heading (`as='h1'` for the hero only, `h2` otherwise). DOM text, never canvas-only. `isVisuallyHidden` keeps it for screen readers when the visible title is in WebGL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `components/LazyCanvas`                                                                                        | R3F `<Canvas>` wrapper — **the only way to put WebGL on the page** (see §4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `components/LazyMount`                                                                                         | Mount any heavy subtree near the viewport, unmount when far. Props: `fallback`, `mountMargin` (default `'100% 0px'`), `unmountMargin` (default `'250% 0px'`, `null` = keep).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `components/useInView` → `useInView(ref, rootMargin?)`                                                         | Boolean in-viewport flag (IntersectionObserver). Use it to pause loops, physics, videos and 2D canvases offscreen. Also `useLazyMount`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `global/gsap` → `gsap`, `ScrollTrigger`, `useGSAP`                                                             | Import GSAP **from here**: ScrollTrigger + useGSAP are registered once and wired to Lenis. For SplitText/Flip/DrawSVG etc.: `import { SplitText } from 'gsap/SplitText'; gsap.registerPlugin(SplitText);` at your module top.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `global/scroll` → `useLenis()`, `scrollToSection(id)`, `scrollToY(px)`                                         | Lenis instance (null under reduced motion), instant jumps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `device/useDeviceTier` → `useDeviceTier()`, `useLabDevice()`, `useReducedMotion()`, `useIsTouch()`, `DPR_CAPS` | Device tier `'high' \| 'mid' \| 'low'` (honours the panel's Quality override), DPR range, reduced motion, touch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `theme/useLabTheme` → `useLabTheme()`, `getLabTheme(id)`                                                       | Active style as JS: `colors` (hex, WebGL-safe except `glow`; includes `onAccent`), `blending` (`'additive'` dark / `'normal'` light), `fontFamily` (resolved strings for 2D canvas/SDF text), `type` (display weight/tracking), `radius`, `scheme`. Re-renders on style change; the object identity is stable per style.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `logos` → `useLabLogo()`, `useLogoInk()`, `LOGOS`, `getLogo(id)`                                               | The company's chevron S (two code chevrons, `<` and `>`; founder's decision 2026-10-10: keep the existing logo), as picked in the panel: `const { Logo, Mark } = useLabLogo();` `<Logo className=… animate />` is the lockup (the mark + lowercase "softwhere" in Sora 800, as the live site's header sets it, outlined), `<Mark />` the 64-box glyph (full height, legible at 16px); Logo 2 also has `Icon`, the app tile (32px and up). Inline SVG, no font loads. At rest the S is one path (no seam under a translucent ink). The mark paints with `var(--logo-ink, var(--accent))`: the lab root sets `--logo-ink` to brand orange unless the panel says Style accent; override `--logo-ink` to re-ink it on an accent fill (a `color` prop pins one logo); the word is `currentColor`. `useLogoInk()` is the mark's hex for WebGL. `animate` glides the two chevrons in along the middle diagonal, rests them a beat apart (`< / >`), clicks them shut into the S with a small pulse, while the word rises (GSAP, ~1.2s, static under reduced motion); for your own timeline target `[data-logo-part]` (`mark`, `whole`, `letter`, `tile`). |
| `media/portfolio` → `LAB_PROJECTS`, `getFeaturedProjects(n)`, `getShowcaseProjects()`, `getProjectBySlug()`    | The 54 real projects with `video` (`/videos/<slug>.mp4`) and `poster` (`.jpg`), English description, tech list, platforms, `isLiveInStore`, `isSensitiveFinance`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `media/LabVideo`                                                                                               | `<video>` that is muted + playsInline + `preload="none"`, plays only while visible, pauses offscreen, stays a poster under reduced motion. Use it for every walkthrough.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `context/LabContext` → `useLabState()`                                                                         | `{ state: { style, logo, quality, only }, update }` — read-only for sections.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Portfolio rule (founders' decision):** banking, lending, leasing and insurance projects
(`isSensitiveFinance`) never appear in hero-level showcases — `getFeaturedProjects()` excludes them and
prefers projects with a live store listing; `getShowcaseProjects()` (walls, grids) puts them last.

## 3. Theme tokens

The lab root carries `data-style="A|B|C|D"`; these custom properties are defined on it (and on `<html>`
while the lab is open). Style **only** with them — the founder flips styles live.

The four directions (full rationale in `theme/styles.ts`):

| Style | Name        | Scheme | Display / body / mono                                     | Accent, accent-2          |
| ----- | ----------- | ------ | --------------------------------------------------------- | ------------------------- |
| A     | Observatory | dark   | Science Gothic 500 / Onest / Martian Mono                 | brand orange, ultraviolet |
| B     | Concrete    | light  | Sofia Sans Extra Condensed 800 / Literata / IBM Plex Mono | cobalt, black             |
| C     | Silk        | light  | Geologica 300 / Geologica / Geist Mono                    | jade, apricot             |
| D     | Pomegranate | dark   | Cormorant 600 / Commissioner / IBM Plex Mono              | pomegranate red, gold     |

Two of them are **light**. Design every section to survive both schemes: no white-on-whatever assumptions,
no glow that only works on black.

| Token                                          | Use                                                                                                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--bg`, `--bg-2`                               | page background, raised surfaces                                                                                                                                                                |
| `--fg`, `--muted`                              | primary text, secondary text / hairlines (both ≥ 4.5:1 on bg)                                                                                                                                   |
| `--accent`, `--accent-2`                       | brand accent (≥ 3:1 on bg: large text, icons), second accent (data, gradients, particles — never text)                                                                                          |
| `--on-accent`                                  | text/icons on an accent fill (buttons, chips) — not `--bg`, which fails in Silk                                                                                                                 |
| `--glow`                                       | CSS glow/shadow color (may have alpha)                                                                                                                                                          |
| `--font-display`, `--font-body`, `--font-mono` | font stacks (Cyrillic-capable)                                                                                                                                                                  |
| `--display-weight`, `--display-tracking`       | the display face's tuned weight and letter-spacing (300 in Silk, 800 in Concrete)                                                                                                               |
| `--display-scale`                              | optical size factor for display text (0.9 → 1.2): `font-size: calc(clamp(…) * var(--display-scale))` keeps headings the same visual size, and wide Observatory headlines inside the phone width |
| `--radius`                                     | base corner radius (0 in Concrete, 22px in Silk)                                                                                                                                                |

`h1`/`h2` inside the lab already default to the display face, `--display-weight` and `--display-tracking`
(zero-specificity `:where()` rules), so a heading that only sets its size looks native in every style.
If you use the `font:` shorthand, write the weight as `var(--display-weight)` rather than a number.
Selection, caret and scrollbar colors are themed for you.

WebGL: read `useLabTheme().colors` and pass the hex strings to materials/uniforms; update uniforms when
`colors` changes (it's a stable object per style, safe in dependency arrays). Use `useLabTheme().blending`
(`'additive'` on dark styles, `'normal'` on light) for glow and particles: additive light vanishes on
Concrete and Silk, where particles should read as ink or pigment instead. Never hard-code colors or font
families. Styles are defined in `theme/styles.ts`, fonts in `theme/fonts.ts` (art director only).

## 4. WebGL with LazyCanvas

```tsx
import LazyCanvas from '../components/LazyCanvas';

<LazyCanvas
  className={css.stage} // the box MUST have a size; the canvas fills it
  camera={{ position: [0, 0, 5], fov: 40 }}
  fallback={<img src={poster} alt='' className={css.still} />} // real still, not a spinner
  activeFrameloop='always' // or 'demand' + invalidate() for static scenes
  maxDpr={1.5} // optional: lower than the tier cap for heavy shaders
  label='xray lens'
>
  <Scene />
</LazyCanvas>;
```

What it does for you: mounts within ~1 viewport, unmounts past ~2.5 (R3F disposes the scene graph and the
renderer and force-loses the context — phones cap live WebGL contexts at ~8–16); `frameloop='never'`
while offscreen (your `useFrame` stops); DPR clamped by tier (`high [1,2]`, `mid [1,1.5]`, `low [1,1]`);
reduced motion → `'demand'` (one still frame); no WebGL or a crash → `fallback`. Accepts every other
R3F `Canvas` prop (`camera`, `orthographic`, `gl`, `events`, `onCreated`, …).

Inside the scene: clamp `delta` (`Math.min(delta, 1 / 30)`) — it can be large after a pause. Dispose what
the loader cache doesn't own (manual `VideoTexture`s, render targets, generated geometries) in effect
cleanups. drei is available (`@react-three/drei`), import only what you use.

## 5. Performance rules (phones get the full show)

- Animate **transform and opacity only** (and shader uniforms). No animating `top/left/width/height`,
  `filter: blur()` on large areas, or box-shadows per frame.
- One canvas per section at most, always through `LazyCanvas`. Respect the tier: `low` gets a static or
  CSS-only version; `mid` gets every effect at lower density (fewer particles, cheaper shaders).
- Pause everything offscreen: `useInView` for rAF loops, matter-js runners, 2D canvases, videos
  (`LabVideo` does it). Kill/revert GSAP with `useGSAP` (automatic) — never leak ScrollTriggers.
- Scroll stories: prefer a tall section + `position: sticky` stage + `ScrollTrigger` with `scrub` over
  `pin: true` (smoother with Lenis and on iOS). If your section is taller than `100svh`, report its real
  height to the orchestrator so the registry reserves it.
- Full-bleed canvases must not block page scroll on touch: never `touch-action: none` on them; use
  `pan-y` if you need horizontal drags.
- **No new dependencies.** Available: `three`, `@react-three/fiber` v9, `@react-three/drei` v10, `gsap`
  (+ all bonus plugins), `@gsap/react`, `lenis`, `matter-js`.
- Images/video: posters and videos from `public/videos` only; `preload="none"` for anything not on screen.
- The finale's contact form is real now: it creates a lead with `postLead()` (`@/shared/utils/lead`, no toast library).
  Nothing else sends data, and never submit an idea to the AI brief from tests (live AI call).

## 6. Reduced motion and mobile

- `useReducedMotion()` true → no scroll-jacking (Lenis is already off), no autoplaying loops, no
  parallax. Show the end state (or a crossfade) with all content visible. LazyCanvas renders one frame.
- `useIsTouch()` true → no hover-only interactions; give every hover effect a tap or scroll equivalent.
  The custom cursor is hidden on touch.
- Design at **390×844** first; use `svh`/`dvh`, not `vh`, for full-screen stages; respect
  `env(safe-area-inset-*)` (the page sets `viewport-fit=cover`). Keep the bottom-right ~80px clear-ish:
  the Lab panel button floats there.

## 7. Cursor conventions (desktop)

`global/CursorLayer.tsx` (being built by another agent) reads data attributes — no imports needed:
`data-cursor="Play"` (label), `data-magnetic` (pull toward pointer), `data-cursor-hide`.

## 8. Testing

```bash
nvm use && yarn dev -p 3100                                      # dev server
open http://localhost:3100/en/lab/home?only=xray                 # just your section
node scripts/lab-shot.mjs --only xray                            # desktop shot (staging route)
node scripts/lab-shot.mjs --path / --locale uz --viewport mobile  # the real homepage
node scripts/lab-shot.mjs --only xray --viewport mobile          # phone shot (390x844 @2x, touch)
node scripts/lab-shot.mjs --only process --steps 6               # 6 shots across the scroll range
node scripts/lab-shot.mjs --only hero --reduced --q low          # reduced-motion / low tier
node scripts/lab-shot.mjs --only finale --style B --logo 2       # other style/logo
```

Shots land in `/tmp/claude-1000/lab-shots/`; each run prints `{ file, url, scrollY, maxScroll }` per
shot and echoes `[page error]` / `[console error]` lines — treat any as a bug. Headless Chrome renders
WebGL in software, so `--q` defaults to `high` (desktop) / `mid` (mobile); `--q auto` would correctly
detect `low`. Options: `--scroll 0.5|640px`, `--from/--to`, `--settle ms`, `--full`, `--panel`, `--dpr`,
`--out name.png`. Run `yarn type-check` and `yarn lint` (0 errors) before you report done.
