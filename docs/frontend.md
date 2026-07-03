# Frontend & UI Architecture

How the softwhere.uz UI is assembled: layouts, the shared component library, the homepage section
composition, theming, fonts, and how sections pull in i18n + data.

## At a glance

| Concern | Where | Notes |
| --- | --- | --- |
| Root layout | `src/app/layout.tsx` | Passthrough. Owns global `metadata` + `./globals.css` import only. Returns `children` (no `<html>`). |
| Document layout | `src/app/[locale]/layout.tsx` | SOLE owner of `<html>`/`<body>`, fonts, `ThemeProvider`, provider tree, `Header`/`Footer`. |
| Homepage | `src/app/[locale]/page.tsx` | Server component composing 8 sections + `HomeClientLayer`. |
| Client glue | `src/shared/components/HomeClientLayer.tsx` | Lazy AOS + toast CSS, `ToastContainer`, secret admin trigger. |
| Theming | `src/shared/components/ThemeProvider.tsx` + `ThemeToggle/` | `next-themes`, class strategy, default **dark**. |
| Design tokens | `src/app/globals.css` + `tailwind.config.ts` | CSS custom properties (Ember palette) mapped to Tailwind `ember.*` colors. |
| Fonts | `[locale]/layout.tsx` (Inter/Sora/Manrope) + `src/shared/fonts.ts` (JetBrains Mono) | `next/font/google`, variables on `<html>`. |
| Component library | `src/shared/components/` | Mix of Server + Client components; per-component `style.module.css`. |
| Sections | `src/shared/components/sections/` | Homepage building blocks; async server sections use `getTranslations`, the rest use the `useTranslations` hook. |

Styling is a **hybrid**: Tailwind utility classes (config in `tailwind.config.ts`) + CSS Modules
(`style.module.css` colocated with each component) + a small set of global classes in
`src/app/globals.css` (`.container`, `.glass`, `.page-layout`). All colors flow through CSS custom
properties so light/dark re-theme automatically.

## Layout hierarchy

There are two layouts. The **root** layout is intentionally a passthrough so Next does not render two
nested `<html>` documents — the localized layout is the real document owner.

```tsx
// src/app/layout.tsx — passthrough, only sets global metadata + imports globals.css
export const metadata: Metadata = { metadataBase: new URL(ENV.BASE_URL), icons: { /* … */ } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

The **localized** layout (`src/app/[locale]/layout.tsx`) validates the locale, sets up static
rendering, loads fonts, and mounts the whole provider tree:

```tsx
// src/app/[locale]/layout.tsx
export default async function RootLayout({ children, params }: Props) {
  const { locale } = (await params) as { locale: Locale };
  if (!hasLocale(['en', 'ru', 'uz'] as const, locale)) notFound();
  setRequestLocale(locale);          // enables static rendering (else next-intl reads headers())
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${sora.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <StructuredData locale={locale} />
          <NextIntlClientProvider messages={messages}>
            <BlogProvider>
              <Header />
              {children}
              <ScrollToTop />
              <TelegramChat />
              <Footer />
            </BlogProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
```

Provider tree order (outer → inner): `ThemeProvider` → `NextIntlClientProvider` → `BlogProvider`.
`Header`, `ScrollToTop`, `TelegramChat`, and `Footer` are siblings of `{children}` inside
`BlogProvider`, so they render on every localized route. `SpeedInsights` and `Analytics`
(`@vercel/*`) sit outside the theme/i18n providers.

Notes grounded in the layout code:

- `generateStaticParams()` returns `[{locale:'uz'},{locale:'ru'},{locale:'en'}]`. `dynamicParams = false`
  is deliberately **not** set here — a comment explains that on a parent layout it would force the
  entire nested path (locale AND slug) to be pre-generated, breaking on-demand blog post ISR with
  `NoFallbackError`. The runtime `notFound()` already rejects bad locales.
- `generateMetadata` builds per-locale `title`/`description` from the `metadata` namespace and sets
  OpenGraph (`/api/og?title=…&locale=…`), Twitter card, and `alternates.languages` hreflang links
  (`x-default` → `BLOG_CONFIG.DEFAULT_LOCALE`).
- `StructuredData` emits Organization + WebSite JSON-LD via `safeJsonLd` (`src/shared/utils/security.ts`).
- `BlogProvider` (`src/modules/blog/context/BlogContext.tsx`) is a client context holding `currentPost`
  ({ generationGroupId, locale, slug }). The `Header` reads it to do locale-aware switching between
  translated blog posts. See `i18n.md`.

## Fonts and the `next/font`-on-`<html>` pattern

Three families are loaded in `src/app/[locale]/layout.tsx` with `next/font/google`; each exposes a
CSS variable, and those variables are applied to `<html className>` (not `<body>`):

```tsx
const inter   = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap', variable: '--font-inter' });
const sora    = Sora({ subsets: ['latin'], display: 'swap', variable: '--font-sora',    weight: ['400','500','600','700','800'] });
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope', weight: ['400','500','600','700','800'] });
```

| Font | Variable | Role | Subsets |
| --- | --- | --- | --- |
| Inter | `--font-inter` | Cyrillic fallback for RU/UZ (full glyph coverage) | latin + **cyrillic** |
| Sora | `--font-sora` | Display / headings (`font-display`) | latin only |
| Manrope | `--font-manrope` | Body text (default `font-sans`) | latin only |
| JetBrains Mono | `--font-mono` | Code (`font-mono`) — **loaded separately** | latin only |

Sora and Manrope are Latin-only and fall back to Inter for Cyrillic via the Tailwind stacks (see
below). JetBrains Mono is intentionally **not** in the root layout — `src/shared/fonts.ts` exports it
so only blog posts (code blocks) and the admin area pay its ~30KB preload:

```ts
// src/shared/fonts.ts — apply `jetbrainsMono.variable` on the outermost element of routes that need it
export const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-mono', weight: ['400', '500'] });
```

Why variables on `<html>`: the localized layout is the single document owner, so applying
`inter.variable sora.variable manrope.variable` to `<html>` makes the font custom properties
available to the entire tree (including `body`, which sets `font-family: var(--font-manrope)…` in
`globals.css`). `suppressHydrationWarning` on `<html>` is required because `next-themes` mutates the
`class` attribute before React hydrates.

## Theming (next-themes + Ember tokens)

`ThemeProvider` is a thin client wrapper around `next-themes`:

```tsx
// src/shared/components/ThemeProvider.tsx
<NextThemesProvider attribute='class' defaultTheme='dark' enableSystem={false} disableTransitionOnChange>
  {children}
</NextThemesProvider>
```

- **Class strategy** (`attribute='class'`): `next-themes` toggles `class="dark"` on `<html>`; Tailwind
  is configured `darkMode: 'class'` to match.
- **Default is dark**, and system preference is disabled (`enableSystem={false}`) — the site always
  starts in the Ember dark palette unless the user toggles.
- `disableTransitionOnChange` suppresses the CSS transition flash when switching.

`ThemeToggle` (`src/shared/components/ThemeToggle/index.tsx`) flips between `light`/`dark`. It guards
against SSR/hydration mismatch with `useSyncExternalStore` (server snapshot `false`, client `true`) —
before mount it renders a 36×36 placeholder `<div>` so layout doesn't shift; after mount it renders a
glass-styled button with `LuSun`/`LuMoon` from `react-icons/lu`:

```tsx
const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
if (!mounted) return <div style={{ width: 36, height: 36 }} />;
const isDark = resolvedTheme === 'dark';
// onClick → setTheme(isDark ? 'light' : 'dark'); icon = isDark ? <LuSun/> : <LuMoon/>
```

`ThemeToggle` is used inside `Header` (both desktop actions and the mobile nav). `HomeClientLayer` and
`ToastContainer` also read `resolvedTheme` to theme toasts.

### Design tokens

Colors are CSS custom properties defined twice in `src/app/globals.css`: light values in `:root`, dark
overrides in `html.dark` (the default theme). The "Ember" palette maps onto **both** legacy token
names (so existing CSS Modules re-theme for free) **and** newer semantic tokens for the redesigned
sections.

| Semantic token | Light (`:root`) | Dark (`html.dark`, default) | Meaning |
| --- | --- | --- | --- |
| `--bg` | `#fbf3ec` | `#0a0705` | page background |
| `--surface` | `#ffffff` | `#181009` | card surface |
| `--surface2` | `#fff6ef` | `#20140b` | elevated surface |
| `--border` | `rgba(190,90,40,.16)` | `rgba(255,150,90,.15)` | hairline borders |
| `--text` | `#2a1408` | `#fbeee6` | primary text |
| `--muted` | `#7c5c46` | `#c2a693` | muted text |
| `--accent` | `#dd450a` | `#ff5b1e` | primary accent |
| `--accent2` | `#c47a2e` | `#ffb057` | secondary accent |
| `--glow` | `rgba(221,69,10,.24)` | `rgba(255,91,30,.45)` | glow effects |

There is also a `--glass-*` set (`--glass-bg`, `--glass-border`, `--glass-blur`, etc.) consumed by the
`.glass` utility and `ThemeToggle`. Legacy `--gray-*`, `--accent-text`, `--white`, `--bg-footer`,
`--admin-bg` names are retained and retuned per theme.

`tailwind.config.ts` exposes the semantic tokens as Tailwind colors and the fonts as families:

```ts
// tailwind.config.ts (excerpt)
darkMode: 'class',
content: ['./src/**/*.{ts,tsx}'],
theme: { extend: {
  fontFamily: {
    sans:    ['var(--font-manrope)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
    display: ['var(--font-sora)',    'var(--font-inter)', 'sans-serif'],
    mono:    ['var(--font-mono)',    'ui-monospace', 'monospace'],
  },
  colors: { ember: {
    bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface2)', border: 'var(--border)',
    text: 'var(--text)', muted: 'var(--muted)', accent: 'var(--accent)', accent2: 'var(--accent2)',
  } },
} },
```

So `bg-ember-surface`, `text-ember-muted`, `border-ember-border`, `font-display`, `font-mono`, etc.
resolve to the theme-aware variables. The Cyrillic fallback works because each font stack lists
`var(--font-inter)` after the Latin-only display/body font.

### Other global CSS

`src/app/globals.css` also defines:

- `.container` — fixed max width (`1222px`, stepping down to `980px` / `600px` / `95%` by breakpoint).
  Used across sections (`<div className="container">`).
- `.glass` — the frosted-glass surface (backdrop-blur + border + shadow).
- `.page-layout` / `.admin-layout` — `padding-top: 120px` to clear the fixed header.
- Global focus-visible outline (`2px solid var(--accent)`) for links/buttons/inputs.
- A `prefers-reduced-motion` block that neuters animations/transitions.
- `react-international-phone` overrides for the Contact and Estimator phone inputs (the library emits
  global class names, so they're themed here rather than via modules).

## Homepage composition

`src/app/[locale]/page.tsx` is an async **server** component. It sets the request locale and renders a
single client "layer" plus eight sections in order:

```tsx
// src/app/[locale]/page.tsx
export default async function Home({ params }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  return (
    <main>
      <HomeClientLayer locale={locale} />
      <Hero /> <Trust /> <Service /> <AISpotlight />
      <Process /> <Projects /> <Contact /> <EstimatorCTA />
    </main>
  );
}
```

### Homepage sections

| # | Section | File | Server/Client | i18n namespace | Anchor id | Data source |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero | `sections/Hero/index.tsx` | **Server** | `hero` | — | `Counter` + `projects.length` (`shared/data/projects`) |
| 2 | Trust | `sections/Trust/index.tsx` | **Server** | `trust` | — | in-file `NAMES` marquee array |
| 3 | Service | `sections/Service/index.tsx` | **Server** | `services` | `#services` | 6 items built from translations |
| 4 | AISpotlight | `sections/AISpotlight/index.tsx` | **Server** | `aiSpotlight` | `#ai` | 4 translated chips |
| 5 | Process | `sections/Process/index.tsx` | **Server** | `process` | `#process` | 4 translated steps |
| 6 | Projects | `sections/Projects/index.tsx` | **Server** (`useTranslations`; child `ProjectSlider` is client) | `projects` | `#portfolio` | `ProjectSlider` → `projects` + `projectImages` |
| 7 | Contact | `sections/Contact/index.tsx` | **Client** | `contact`, `toastMessage` | `#contact` | form → `sender()` |
| 8 | EstimatorCTA | `sections/EstimatorCTA/index.tsx` | **Server** | `estimatorCTA` | `#estimator-cta` | links to `/${locale}/estimator` |

The `#services`/`#portfolio`/`#ai`/`#contact` anchor ids are the targets of the `Header` nav links
(e.g. `/${lang}#services`).

`Hero` is a **server component on purpose**: the `<h1>` is the LCP element and must be in the
prerendered HTML. A code comment records that the old `react-type-animation` hero rendered an empty
`<h1>` until the JS bundle hydrated; the typewriter caret is now pure CSS. `Hero` embeds two
`Counter` widgets (client) — `projects.length` apps and a hardcoded `6` countries.

Two sections exist under `sections/` but are **not** part of the homepage: `sections/Discuss/` and
`sections/FAQ/` have no importers anywhere in `src/` (grep confirms). Treat them as available-but-unused
building blocks, not live homepage content.

### HomeClientLayer

`src/shared/components/HomeClientLayer.tsx` is a `'use client'` component that carries the
homepage's client-only concerns so the sections themselves can stay server components:

```tsx
const ToastContainer = dynamic(() => import('react-toastify').then(m => m.ToastContainer), { ssr: false });

useEffect(() => {
  import('aos/dist/aos.css');                    // AOS styles, lazy
  import('aos').then(AOS => AOS.init());         // init scroll animations
  import('react-toastify/dist/ReactToastify.css'); // toast styles, lazy (needed only after submit)
}, []);
```

Responsibilities:

- **Initializes AOS** and lazy-imports both AOS CSS and react-toastify CSS (kept out of the
  render-blocking bundle).
- Renders `ToastContainer` (dynamic, `ssr:false`) themed from `resolvedTheme` — this is the toast host
  for the Contact form.
- Implements a **secret admin entry**: an invisible top-left `w-20 h-20` (80×80px) hotspot; five clicks
  within 3s reveal a floating "🔐 Admin" button that routes to `/${locale}/admin/posts` (auto-hides after
  10s). The hotspot sits at `z-index:1000`, above the fixed header, so clicks aren't swallowed.

## AOS scroll animations

Animations are driven by [AOS](https://michalsnik.github.io/aos/). There is **one** `AOS.init()` call,
in `HomeClientLayer`. Sections opt individual elements in with `data-aos` attributes (and optional
`data-aos-delay`), e.g.:

```tsx
<div data-aos='fade-up' data-aos-delay={(step.num - 1) * 100}>…</div>   // Process
<h2 data-aos='fade-down' className={css.sectionTitle}>…</h2>              // SectionTitle heading (as='h2')
<div data-aos='zoom-in' data-aos-delay='200'>…</div>                     // Contact info rows
```

Used effects across sections: `fade-up`, `fade-down`, `fade-right`, `fade-up-left`, `zoom-in`,
`flip-up`. `SectionTitle` bakes `data-aos` into its output so most section headings animate for free.
Because AOS only initializes inside `HomeClientLayer`, `data-aos` markup on non-homepage routes needs
its own `AOS.init()` (or it renders in the hidden pre-animation state). The global
`prefers-reduced-motion` rule in `globals.css` collapses these durations to ~0.

## Shared component library

`src/shared/components/` — reusable UI. Each folder-component colocates a `style.module.css`.

| Component | File | Kind | Purpose |
| --- | --- | --- | --- |
| Header | `Header/index.tsx` | Client | Fixed nav: brand, links, `LanguageSwitcher`, `ThemeToggle`, CTA, mobile burger. |
| Footer | `Footer/index.tsx` | Client | Contact details, address, credits; fires `trackEvent` on links. |
| ThemeToggle | `ThemeToggle/index.tsx` | Client | Light/dark switch (see Theming). |
| TelegramChat | `TelegramChat/index.tsx` | Client | Floating Telegram button (see below). |
| ScrollToTop | `ScrollToTop/index.tsx` | Client | Appears after 500px scroll; smooth-scrolls to top. |
| Button | `Button/index.tsx` | Server | `<button>` wrapper merging `css.button` + `className`. |
| Accordion | `Accordion/index.tsx` | Client | Accessible expand/collapse (`aria-expanded`/`inert`); used by FAQ. |
| SectionTitle | `SectionTitle/index.tsx` | Server | `SectionText` — renders `h1`/`h2` heading or `desc` paragraph with `data-aos`. |
| Counter | `Counter/index.tsx` | Client | Counts up on scroll-into-view via `IntersectionObserver`; respects reduced motion. |
| HomeClientLayer | `HomeClientLayer.tsx` | Client | Homepage client glue (see above). |
| ThemeProvider | `ThemeProvider.tsx` | Client | `next-themes` wrapper. |
| TrackedCTALink | `TrackedCTALink.tsx` | Client | `next/link` that fires a `cta_click` analytics event. |

`SectionText` is the shared heading primitive most sections use:

```tsx
// src/shared/components/SectionTitle/index.tsx
function SectionText({ children, type, className, as = 'h2' }) {
  if (type === 'desc') return <p data-aos='fade-right' className={`${css.description} ${className}`}>{children}</p>;
  const Heading = as;                       // 'h1' | 'h2'
  return <Heading data-aos='fade-down' className={`${css.sectionTitle} ${className}`}>{children}</Heading>;
}
```

### Header

`Header/index.tsx` (`'use client'`) is fixed and hides on scroll past `UI_CONFIG.SCROLL_THRESHOLD`
(`60`, from `src/core/constants.ts`), re-showing near the top. Scroll handling is throttled with
`requestAnimationFrame`. It renders:

- Brand (logo SVG + wordmark), desktop nav links (Services / Work / AI / Blog / Estimate) built from
  the `header` namespace, plus a "Let's talk" CTA pill pointing to `#contact`.
- `LanguageSwitcher` (an in-file dropdown component) with En/Ru/Uz flag options, closed on
  Escape/outside-click, `aria-haspopup`/`aria-expanded`/`aria-controls`.
- `ThemeToggle`.
- A burger menu (`css.navMobile`, `inert={!isOpen}`) mirroring the same links for mobile;
  `document.body.classList.toggle('hide')` locks body scroll when open.

Language switching is **blog-aware**: when `useBlogContext().currentPost.generationGroupId` is set, it
calls `getRelatedPost(generationGroupId, locale)` (`src/modules/blog/api/posts.ts`) to jump to the
translated post, falling back to the blog listing; otherwise it swaps the locale segment of
`window.location.pathname`. Every switch fires `trackEvent('language_switch', …)`. See `i18n.md`.

### TelegramChat

`TelegramChat/index.tsx` is a floating bottom-left Telegram link (inline SVG, no icon dep). It reads
`SOCIAL_LINKS.TELEGRAM` (`src/core/constants.ts`), is **hidden on `/admin` routes**
(`pathname?.includes('/admin')` → `null`), and shifts up (`bottom-24 lg:bottom-5`) on the estimator
route so it clears the estimator's mobile sticky bar. It fires `trackEvent('telegram_chat_click', …)`.
`ScrollToTop` owns the bottom-right corner, so the two floaters don't collide.

## How sections consume i18n + data

Two i18n access patterns:

- **`getTranslations(namespace)`** (from `next-intl/server`, `await`ed) — used by the async server
  sections: `Service`, `Trust`, `AISpotlight`, `Process`, `EstimatorCTA`. `EstimatorCTA` also calls
  `getLocale()` to build its `/${locale}/estimator` link.
- **`useTranslations(namespace)`** (from `next-intl`) — the synchronous hook, which next-intl supports
  in **both** server and client components. `Hero` and `Projects` use it as server components (no
  `'use client'`); `Contact`, `ProjectSlider`, `Header`, and `Footer` use it as client components,
  which get their messages from the `NextIntlClientProvider` in the layout.

```tsx
// Async server section
const t = await getTranslations('services');
// Sync hook — works in a server OR client component
const t = useTranslations('contact');
```

Static content comes from typed data modules under `src/shared/data/`:

- `projects.ts` — `Project[]` (`src/shared/types` `Project`: `id`, `name`, `description.{uz,ru,en}`,
  `technology`, `location`, `type`, optional store/site URLs). Array order **is** slider order and
  `id` must equal array-index + 1.
- `projectImages.ts` — `projectVisuals` map (icon/screenshot `StaticImageData`) keyed by project name.

`ProjectSlider` (`sections/Projects/components/ProjectSlider/`, client) renders `projects` in a
`react-slick` carousel, picks the description by `params.locale`, and resolves visuals via
`projectVisuals[name]` (falling back to initials). It uses `lazyLoad: 'ondemand'` specifically so
infinite mode doesn't clone every slide's `<img>` into the homepage HTML.

The `Contact` form (client) is the one interactive section: `react-international-phone` `PhoneInput`
limited to a `RELEVANT_COUNTRIES` set (to keep the SSR'd country `<li>` list small), client-side
validation, and submission through `sender()` (`src/shared/utils/send.ts`) with `react-toastify`
feedback. Its phone-input theming lives in the `.contact-form` / `.estimator-phone` blocks in
`globals.css`.

## Gotchas

- **Do not add a second `<html>`/`<body>`.** Only `src/app/[locale]/layout.tsx` renders the document;
  the root layout must stay a passthrough.
- **Font variables belong on `<html>`** (with `suppressHydrationWarning`), not `<body>` — moving them
  breaks the `var(--font-*)` stacks and the `next-themes` class swap.
- **JetBrains Mono is opt-in.** Apply `jetbrainsMono.variable` on a route's outer element (blog/admin);
  it is absent on marketing pages by design.
- **AOS is initialized once**, in `HomeClientLayer`. `data-aos` markup on other routes won't animate
  unless that route also calls `AOS.init()`.
- **`Discuss` and `FAQ` sections are unused** on the current homepage — verify before assuming they
  render.
- **Server vs client i18n:** the async `getTranslations` is `await`ed; the `useTranslations` hook works
  in **both** server and client components (`Hero`/`Projects` use it server-side). Client components
  additionally rely on the layout's `NextIntlClientProvider`.

## Related docs

- [architecture.md](./architecture.md) — layered architecture (core → shared → modules → app) and boundaries.
- [i18n.md](./i18n.md) — next-intl setup, locales, middleware, and the blog language-switch flow.
- [estimator.md](./estimator.md) — the project cost estimator that `EstimatorCTA` links to.
- [../README.md](../README.md) — project overview.

_Last verified against code: 2026-07-03._
