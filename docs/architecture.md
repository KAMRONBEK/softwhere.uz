# Project Architecture Guidelines

> **Status:** Realized – v1.0. The layered structure below is the actual on-disk
> layout, and the import-direction rules are enforced by `eslint-plugin-boundaries`
> (see [§3](#3-continuous-compliance)).

This document establishes the canonical architecture for the Softwhere.uz code-base. New work **SHOULD** comply with these guidelines.

---

## 1. Layered, Feature-First Structure

```
src/
├─ core/           # Framework-level, app-agnostic infra (single-file modules)
│  ├─ env.ts       #   environment access
│  ├─ logger.ts    #   logging façade
│  ├─ db.ts        #   Mongoose connection
│  ├─ i18n.ts      #   next-intl bootstrap (referenced by next.config.mjs)
│  ├─ ai.ts        #   LLM client
│  ├─ http.ts      #   generic API client
│  ├─ auth.ts      #   API-secret + locale validation
│  └─ constants.ts
│
├─ shared/         # Cross-cutting, reuse-friendly code (no business logic)
│  ├─ components/
│  ├─ utils/
│  ├─ data/
│  └─ types/
│
├─ modules/        # Business capabilities (a.k.a. features)
│  ├─ blog/
│  │   ├─ api/          # generator (calls core/ai, core/http)
│  │   ├─ components/   # UI that belongs to the blog domain only
│  │   ├─ model/        # Mongoose model + domain types
│  │   ├─ data/         # seo-topics, post-blueprints
│  │   ├─ context/      # React context
│  │   └─ utils/
│  ├─ estimator/
│  │   ├─ components/
│  │   ├─ data/
│  │   ├─ utils/
│  │   ├─ constants.ts
│  │   └─ types.ts
│  └─ admin/
│      ├─ components/
│      └─ utils/
│
├─ app/            # Next.js route handlers & pages (minimal logic)
├─ messages/       # next-intl locale bundles (en/ru/uz)
└─ proxy.ts        # next-intl routing proxy (middleware)
```

### 1.1 Import Rules

1. **`core`** depends only on **`core`** (no other layer).
2. **`shared`** may pull from **`core`** and **`shared`**.
3. **`modules/*`** can depend on:
   - their own code (`modules/<self>`)
   - `shared`
   - `core`
   They **must not** import from another `modules/*` folder directly.
4. **`app`** may import from any layer (including other `app` files) but **must
   not** be imported by `core`, `shared`, or `modules`.

> Enforcement is automated via ESLint (`eslint-plugin-boundaries`). See
> `eslint.config.mjs` for the rule-set.

#### Known violations (tracked, not yet resolved)

The boundaries rule currently runs at **`warn`** severity because the present
file placement still contains real cross-layer couplings that need a follow-up
refactor rather than a file move:

- `core/http.ts` imports types from `shared` and from `modules/estimator`
  (`EstimateResult`, `EstimatorInput`). Core should not know about a feature.
- `shared/components/Header` imports `modules/blog` (`BlogContext`).

Resolve these (e.g. relocate the shared types into `shared`/`core`, lift
`BlogContext` consumption out of `Header`) before promoting the rule to `error`.

### 1.2 Directory Conventions

- Each **module** groups code by kind (`components/`, `api/`, `model/`, `data/`,
  `utils/`, …). A public `index.ts` per module is recommended but **not yet**
  uniformly present, so the `boundaries/entry-point` rule is intentionally left
  disabled.

---

## 2. Per-module State Pattern

> **Not yet adopted.** Earlier drafts described a Zustand-based "Memory Bank"
> (`store.ts` / `controller.ts` / `selectors.ts`) per module. No such store
> library or `memory/` folders exist in the codebase today. Module state is
> handled with local React state and React context (see
> `modules/blog/context/BlogContext.tsx`). Document and wire up a store
> convention here before introducing one.

---

## 3. Continuous Compliance

### 3.1 ESLint

Boundary rules live in `eslint.config.mjs` (ESLint flat config) via
`eslint-plugin-boundaries`. The `boundaries/element-types` rule encodes the
layering above. It currently emits **warnings** (so `yarn lint` reports 0 errors)
until the known violations in §1.1 are removed, at which point it should be
switched to `error` and gated in CI.

### 3.2 Commit Hooks

> **Not yet adopted.** `husky` / `lint-staged` are not installed. Run
> `yarn lint`, `yarn type-check`, and `yarn build` manually before committing.

### 3.3 Architecture Decision Records

> **Not yet adopted.** There is no `docs/adr/` directory yet. Introduce one if/when
> ADRs are needed.

---

## 4. Migration Status

- ✅ ESLint boundaries installed and configured (`warn` mode).
- ✅ `core/` carved out (`src/utils/*`, `src/lib/*`, `src/constants/*`, `src/i18n.ts`).
- ✅ `shared/` extracted (non-domain components, utils, data, types).
- ✅ `modules/{blog,estimator,admin}` carved out.
- ⏳ Remove the §1.1 cross-layer couplings, then promote boundaries to `error`.

---

## 5. References

- Clean Architecture – Robert C. Martin
- eslint-plugin-boundaries – <https://github.com/javierbrea/eslint-plugin-boundaries>
