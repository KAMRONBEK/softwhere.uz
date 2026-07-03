# 📐 Project Architecture (@architecture.md)

This file is an **authoritative snapshot** of the Softwhere.uz folder layout and the allowed import directions. Keep it up-to-date whenever you move files or add new layers.

> **Status:** Realized. The `core / shared / modules / app` layering below is the
> actual on-disk structure, and the import-direction rules are wired up with
> `eslint-plugin-boundaries` in `eslint.config.mjs`.

---

## 1. Folder Layout (high-level)

```text
src/
├─ core/           # Framework & app-agnostic infra (single-file modules)
│  ├─ env.ts       #   environment access
│  ├─ logger.ts    #   logging façade
│  ├─ db.ts        #   Neon/Drizzle client
│  ├─ i18n.ts      #   next-intl request config
│  ├─ ai.ts        #   LLM client (shared by blog + estimator)
│  ├─ http.ts      #   generic API client
│  ├─ auth.ts      #   admin guard (Neon Auth session + API-secret) + locale validation
│  ├─ neonAuth.ts  #   Neon Auth (Better Auth) server instance
│  ├─ notify.ts    #   Telegram notifications (pipeline → owner)
│  └─ constants.ts #   ENV, BLOG_CONFIG, SOCIAL_LINKS, …
│
├─ shared/         # Reusable, non-domain UI & helpers
│  ├─ components/  #   Button, Header, Footer, ThemeToggle, sections/, …
│  ├─ utils/       #   slug, analytics, send, security, rateLimit
│  ├─ data/        #   projects
│  └─ types/       #   cross-cutting types
│
├─ modules/        # Business capabilities (bounded contexts)
│  ├─ blog/
│  │   ├─ api/        # generator
│  │   ├─ components/ # BlogListClient, BlogPostClient
│  │   ├─ model/      # BlogPost (Drizzle table + domain types), posts.repository
│  │   ├─ data/       # seo-topics, post-blueprints
│  │   ├─ context/    # BlogContext
│  │   └─ utils/      # unsplash
│  ├─ estimator/
│  │   ├─ components/ # Wizard, ResultPanel, CurrencySwitcher, Steps/
│  │   ├─ data/       # catalog
│  │   ├─ utils/      # estimator
│  │   ├─ constants.ts
│  │   └─ types.ts
│  ├─ admin/
│  │   ├─ components/ # AdminComponents
│  │   └─ utils/      # adminFetch
│  └─ contact/
│      └─ model/      # Lead (Drizzle table), leads.repository
│
├─ app/            # Next.js routes (logic-thin)
├─ messages/       # next-intl locale bundles (en/ru/uz)
└─ proxy.ts        # next-intl routing proxy (middleware)
```

> Detailed breakdown lives in `docs/architecture.md` but the tree above is the quick reference.

---

## 2. Import Direction Rules

| Layer   | Allowed Dependencies          | Forbidden |
|---------|--------------------------------|-----------|
| `core`  | `core`                         | Everyone else |
| `shared`| `core`, `shared`               | `modules`, `app` |
| `modules/*` | `core`, `shared`, own module | Other `modules/*` directly, `app` |
| `app`   | All layers (`core`, `shared`, `modules`, `app`) | Cannot be imported by other layers |

Enforced by `eslint-plugin-boundaries` (`boundaries/element-types`) configured in
`eslint.config.mjs`. The rule currently runs at **`warn`** severity so `yarn lint`
stays at 0 errors while it surfaces the two remaining cross-layer coupling sites
(3 warnings total) for follow-up:

- `core/db.ts` imports the Drizzle schema from `modules/blog/model/BlogPost`
  (core → module) so the shared Neon client is typed to the tables.
- `shared/components/Header` imports `useBlogContext` and `getRelatedPost` from
  `modules/blog` for the language switcher (shared → module).

(`core/http.ts` is now generic/dependency-free; its former feature calls moved to
`modules/estimator/api.ts` and `modules/blog/api/posts.ts`.) Once both couplings
are lifted the rule should be promoted to **`error`**.

---

## 3. Per-module state (not yet adopted)

There is currently **no** shared state-management convention (no Zustand/Redux
"Memory Bank", no `memory/` folders). Module state is local React state /
context (see `modules/blog/context`). If a formal store pattern is introduced
later, document it here before adding it to a module.

---

## 4. Update workflow

1. Change code / move folders (use `git mv` to preserve history).
2. Update this file **and** `docs/architecture.md`.
3. Run `yarn type-check`, `yarn lint`, `yarn build` — all must pass.
4. Commit.

---

## Related docs

- [`docs/architecture.md`](./docs/architecture.md) — detailed breakdown of the same layout.
- [`docs/adr/0001-layered-architecture.md`](./docs/adr/0001-layered-architecture.md) — the layering decision.
- [`docs/database.md`](./docs/database.md) — Neon/Drizzle data layer and the repository pattern.
- [`docs/auth-and-admin.md`](./docs/auth-and-admin.md) — Neon Auth + API-secret admin gate.

_Last verified against code: 2026-07-03._
