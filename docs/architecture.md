# Project Architecture Guidelines

> **Status:** Draft – v1.0 (applies from the next sprint)

This document establishes the canonical architecture for the Softwhere.uz code-base.  All new work **MUST** comply with these guidelines.  Divergence requires an approved ADR (Architecture Decision Record).

---

## 1. Layered, Feature-First Structure

```
src/
├─ core/          # Framework-level, app-agnostic utilities
│  ├─ api/        # HTTP client, interceptors, DTO mappers
│  ├─ env/        # Environment validation & config
│  ├─ logger/     # Logging façade
│  └─ i18n/       # Internationalisation bootstrap
│
├─ modules/       # Business capabilities (a.k.a. features)
│  ├─ blog/
│  │   ├─ api/          # Remote data-sources (calls **core/api**)
│  │   ├─ components/   # UI that belongs to the blog domain only
│  │   ├─ hooks/        # React hooks that belong to blog
│  │   ├─ model/        # Domain types, services, selectors
│  │   └─ tests/
│  ├─ estimator/
│  │   └─ …
│  └─ admin/
│      └─ …
│
├─ shared/        # Cross-cutting, reuse friendly code (no business logic)
│  ├─ components/
│  ├─ hooks/
│  └─ utils/
│
└─ app/           # Next.js route handlers & pages (minimal logic)
```

### 1.1 Import Rules

1. **`core`** has **no** dependencies on any other layer.
2. **`shared`** may pull from **`core`** only.
3. **`modules/*`** can depend on:
   • their own code (`modules/<self>`)
   • `shared`
   • `core`
   They **must not** import from another `modules/*` folder directly – use public API re-exports in that module's `index.ts` if collaboration is needed.
4. **`app`** is allowed to import from anywhere but **must not** be imported by any other layer.

> Enforcement is automated via ESLint (`eslint-plugin-boundaries`).  See `.eslintrc` for the rule-set.

### 1.2 Directory Conventions

• Each **module** exposes a public surface via `modules/<name>/index.ts`.<br/>
• UI sub-folders (`components/`) follow Atomic naming (Atom, Molecule, Organism, Template, Page).<br/>
• Tests live alongside code in `__tests__` or `tests`.

---

## 2. Memory Bank Pattern

A **Memory Bank** is an in-process cache that holds transient UI/session state, acting as the single source of truth for a feature.  Inspired by the article *"Memory Banks in Model Control Protocol"* (Sarvex Jatasra, 2025).

### 2.1 Vocabulary

• **Store** – the underlying data structure (usually Zustand store).<br/>
• **Controller** – functions that read/write the store.<br/>
• **Selectors** – pure functions that derive state.

Each module may expose `memory/` with the trio above.  Memory Banks must satisfy:
1. Serializable state.
2. No direct React component imports – keep pure.
3. Automatic retention policy (e.g. clear on route change).

---

## 3. Continuous Compliance

### 3.1 ESLint

Boundaries defined in `eslint.config.mjs`.  CI fails on boundary violations.

### 3.2 Commit Hooks

`husky` + `lint-staged` run lint & tests before commit.

### 3.3 Architecture Decision Records

Large-impact changes recorded under `docs/adr/`.

---

## 4. Migration Plan

1. **Phase 0** – Add ESLint boundaries & pass on untouched code (this PR).
2. **Phase 1** – Introduce `core/`, move `src/utils/*` and `src/constants/*`.
3. **Phase 2** – Carve out `modules/blog` & `modules/estimator`.
4. **Phase 3** – Gradually migrate remaining feature areas.

During migration the rule-set runs in **warn** mode; it will switch to **error** once Phase 3 completes.

---

## 5. References

• [Clean Architecture – Robert C. Martin]  
• eslint-plugin-boundaries – <https://github.com/javierbrea/eslint-plugin-boundaries>  
• *Memory Banks in MCP* – Sarvex Jatasra, 2025 