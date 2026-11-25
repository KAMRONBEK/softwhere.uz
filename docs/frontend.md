# Frontend & UI Architecture

How the softwhere.uz UI is assembled: layouts, the four looks and their tokens, fonts, the site
primitives every page is built from, and how client components get their messages.

## At a glance

| Concern | Where | Notes |
| --- | --- | --- |
| Root layout | `src/app/layout.tsx` | Passthrough. Owns global `metadata` + the `./globals.css` import. Returns `children` (no `<html>`). |
| Document layout | `src/app/[locale]/layout.tsx` | SOLE owner of `<html>`/`<body>`, JSON-LD, Vercel analytics. No chrome, no fonts. |
| Homepage | `src/app/[locale]/page.tsx` → `src/modules/home` | Its own chrome, sections and messages. See [its README](../src/modules/home/README.md). |
| Every other page | `src/app/[locale]/(site)/layout.tsx` → `src/modules/home/site/SiteShell.tsx` | The homepage's themed root, header, footer and look picker, without sections, smooth scroll, GSAP or WebGL. |
| Looks | `src/modules/home/theme/` | A Observatory (default), B Concrete, C Silk, D Pomegranate. Picked by the visitor. |
| Design tokens | `theme/tokens.ts` + `src/app/globals.css` | Look tokens, plus the ones derived from them. |
| Fonts | `src/modules/home/theme/fonts.ts` | `next/font/google`; only look A's Latin files preload. |
| Site primitives | `src/shared/components/site/` | `Page`, `PageHero`, `Section`, `Card`, `ButtonLink`, `CtaBand`, `Prose`, … |
| 404 | `(site)/not-found.tsx` and `src/app/not-found.tsx` | See [404 pages](#404-pages). |

Styling is CSS Modules on the tokens, with some Tailwind utilities (admin, older components) whose
`ember-*` colours are aliases of the same tokens.

## Layouts

```
src/app/layout.tsx                  passthrough
└─ [locale]/layout.tsx              <html lang>, <body>, Organization/WebSite JSON-LD, analytics
   ├─ page.tsx                      homepage (HomeExperience)
   ├─ lab/                          noindex staging copy of the homepage
   └─ (site)/layout.tsx             client messages, SiteShell, HomeFooter
      └─ services, blog, estimator, ai-plan, privacy-policy, admin
```

- `generateStaticParams()` returns the three locales. `dynamicParams = false` is deliberately **not**
  set: on a parent layout it would require the whole nested path to be pre-generated and break
  on-demand blog ISR. `notFound()` rejects bad locales at runtime.
- Every layout and page under `[locale]` calls `setRequestLocale` so it renders statically. The server
  HTML never depends on the visitor's look: do not read `cookies()` or `headers()` for it.
- `(site)/layout.tsx` also sets the font variables on `:root`, so portalled UI (toasts, dialogs)
  outside the themed root gets the look's faces.

## Looks

The themed root is the element with `[data-lab-root][data-style='A|B|C|D']`. The server always
renders `A`. `theme/ThemeScript.tsx`, the root's first child, sets the visitor's look before first
paint; `theme/themeStore.ts` has the rules (`?style=` for this visit, then localStorage, then the
`sw-style` cookie) and `StyleRootSync` keeps the attribute after hydration. `theme/switchStyle.ts`
animates a switch as a view transition. There is no dark-mode class: A and D are dark, B and C light.

| Token | Meaning |
| --- | --- |
| `--bg`, `--bg-2`, `--surface2` | page ground, raised surface, a step above it |
| `--fg`, `--muted` | text, secondary text |
| `--accent` | fills, strokes, icons, large text (3:1 on `--bg` only) |
| `--accent-text` | the accent as small text (5.2:1 or more) |
| `--on-accent` | text on an accent fill |
| `--accent-2` | decoration only, never text |
| `--border`, `--border-strong` | hairlines |
| `--font-display`, `--font-body`, `--font-mono` | the look's faces |
| `--display-weight`, `--display-tracking`, `--display-scale` | display headings; multiply font sizes by `--display-scale` |
| `--radius` | `0px` in B: derive every radius from it, e.g. `min(var(--radius), 12px)` |
| `--site-gutter`, `--site-width`, `--site-ease` | page gutters, column, easing |
| `--lab-header-h`, `--lab-header-offset` | the header's height, and how much of it shows now (for sticky elements) |
| `--chart-1..6`, `--chart-grid`, `--chart-axis` | blog charts, validated per look |

Rules: paint with tokens only, and check a change in all four looks, three languages and at 390, 768
and 1280px. The old names (`--text`, `--surface`, `--gray-*`, `ember-*`) are aliases; do not add uses.

## Site chrome

`SiteShell` renders `global/LabHeader` (`HeaderModeContext` = `site`: section links go to the
homepage's anchors, the current page is marked by its path), `[data-page-content]`, `HomeFooter` and
the floating buttons.

- Pages must not contain `[data-section]`: it drives the homepage header's current-section logic.
- What the header imports ships on every page, so it must not import `gsap`, `lenis` or `three`. The
  logo's GSAP entrance is passed in (`<Logo frame={EntranceFrame} />`) by the homepage sections that play it.
- `TelegramChat` is at the bottom left from 1280px, where there is a gutter for it. Below that it sits
  at the bottom right under `ScrollToTop`, and both fade with the header while the visitor reads down; there it
  appears after the first screen (500px), as `ScrollToTop` does.
  It is not shown on `/admin`, nor below 1280px on `/estimator` (its bar holds the bottom edge) and `/ai-plan` (a page of form fields).
- While the phone menu is open, `[data-page-content]` and `[data-page-chrome]` are `inert`.
- The language switch is a plain link with the locale swapped; a post's server route 308s to its
  sibling. See [i18n.md](./i18n.md#locale-switching).

## Site primitives

`import { … } from '@/shared/components/site'`. All are server components and safe in client ones.

| Component | Purpose |
| --- | --- |
| `Page` | The page's `<main>`, clear of the header. Never nest another `<main>`. |
| `Container` | `width='wide'` (1320px) or `'prose'` (720px) with gutters. |
| `PageHero` | The `h1`; `size='article'` for long titles. `Breadcrumbs` goes in its `breadcrumb`. |
| `Section`, `CardGrid` + `Card`, `CtaBand` | Section head and rhythm, card list (`<ul>`/`<li>`), closing call to action. |
| `ButtonLink`, `TextLink`, `buttonClass`, `Arrow` | Links and button classes (`buttonClass` keeps `TrackedCTALink` and `<button>` in the same style). |
| `Prose`, `proseClass` | Long-form text. |

`src/shared/components/sections/` and the components only those sections use (`SectionTitle`,
`Accordion`, `Counter`, `Button`, `HomeClientLayer`, AOS) are the homepage before the rebrand. Nothing
imports them.

## Toasts

Pages that need toasts mount react-toastify's container themselves (`ai-plan/PageToasts.tsx`).
Colours come from the `.Toastify` block in `globals.css`.

## 404 pages

- `notFound()` inside a site page (unknown service, deleted post): `(site)/not-found.tsx`, with the
  full chrome in the visitor's language.
- A path no route matches: `src/app/not-found.tsx`, one prerendered document. It holds the three
  languages and the four looks; inline scripts pick from the path and from storage. It has no header
  or footer because its tree is part of every page's payload. A catch-all route under `[locale]`
  would render per probed URL, which `src/proxy.ts` avoids on purpose.

## Messages

Server components read any namespace. Client components only get `CLIENT_MESSAGE_NAMESPACES` and the
header's strings (`pickSiteChromeMessages`), both in `src/core/messages.ts`; a page whose client tree
needs more nests a provider. See [i18n.md](./i18n.md#what-reaches-the-browser).

## Gotchas

- **Do not add a second `<html>`/`<body>`.** Only `[locale]/layout.tsx` and the global 404 render one.
- **Inputs are 16px or larger**, or iOS zooms the page on focus.
- **Form errors are `--fg` text with an accent edge**, no red.
- **Phone inputs and toasts emit global classes**: they are themed in `globals.css`, not in modules.
- **`body` has a colour transition only off the site pages**: on them the look switch is a view transition.

## Related docs

- [architecture.md](./architecture.md) — layers and boundaries.
- [i18n.md](./i18n.md) — locales, messages, middleware.
- [estimator.md](./estimator.md) — the project cost estimator.
- [../src/modules/home/README.md](../src/modules/home/README.md) — the homepage module.

_Last verified against code: 2026-11-24._
