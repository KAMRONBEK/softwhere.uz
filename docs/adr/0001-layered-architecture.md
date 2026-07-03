# 0001 — Layered `core / shared / modules / app` architecture

A four-layer, feature-first `src/` layout with import direction enforced (at `warn`) by `eslint-plugin-boundaries`.

## At a glance

| | |
| --- | --- |
| **Status** | Accepted |
| **Layers** | `core` → `shared` → `modules/*` → `app` |
| **Enforced by** | `eslint-plugin-boundaries` (`boundaries/element-types`), `eslint.config.mjs` |
| **Current severity** | `warn` (not `error`) — one tracked cross-layer coupling remains |
| **Live spec** | [`../architecture.md`](../architecture.md) |

## Context

The codebase grew from a flat `src/utils`, `src/lib`, `src/constants` layout into
a marketing site plus three distinct capabilities (blog, estimator, admin). Without
a rule about who may import whom, framework glue, reusable UI, and business logic
bleed into each other; a change to one feature silently reaches into another, and
nothing catches it in review. The project needed a dependency direction that is
(a) obvious from a file's path and (b) checkable by a linter rather than by
discipline.

## Decision

Organize `src/` into four layers and allow imports to point in one direction only:

```
core     → framework/infra, app-agnostic, single-file modules (env, logger, db, ai, auth, http)
shared   → cross-cutting reusable code, no business logic (components, utils, data, types)
modules/ → business capabilities: blog, estimator, admin, contact — grouped by kind inside each
app      → Next.js routes & pages, minimal logic; may import anything
```

The allowed dependency edges are encoded declaratively in `eslint.config.mjs`
(`boundaries/element-types`), with `default: 'disallow'`:

```js
rules: [
  { from: ['core'],   allow: ['core'] },
  { from: ['shared'], allow: ['core', 'shared'] },
  { from: ['module'], allow: ['core', 'shared', ['module', { moduleName: '${from.moduleName}' }]] },
  { from: ['app'],    allow: ['core', 'shared', 'module', 'app'] },
]
```

So: `core` imports only `core`; `shared` adds `core`; a module may import `core`,
`shared`, and *its own* module (the `${from.moduleName}` capture forbids
module-to-module imports); `app` may import anything. `src/messages/**`,
`src/proxy.ts`, `**/global.d.ts`, and `scripts/**` are excluded via
`boundaries/ignore`. Only the layering rule is on — entry-point/external/no-private
rules are deliberately left off because modules do not yet expose uniform public
`index.ts` barrels.

## Consequences

- **A file's layer is its path.** `src/core/db.ts` may not reach into a module;
  `src/modules/blog/*` may not import `src/modules/estimator/*`. This is why, for
  example, DB access is a repository inside each module (`src/modules/blog/model/posts.repository.ts`)
  that `app` routes call, rather than routes importing Drizzle from `core`.
- **The rule runs at `warn`, not `error`.** `yarn lint` stays at 0 errors while
  still surfacing real coupling debt. Promoting to `error` (and gating CI on it) is
  blocked on one remaining violation: `src/shared/components/Header` imports
  `src/modules/blog` (`BlogContext` + the related-post client) to power the
  locale switcher. The global header therefore knows about the blog feature. See
  the "Known violations" section of [`../architecture.md`](../architecture.md).
- **Already paid down:** `core/http.ts` is now a generic, dependency-free client;
  feature-specific calls moved to `src/modules/estimator/api.ts` and
  `src/modules/blog/api/posts.ts`.
- **Not adopted:** the per-module Zustand "Memory Bank" store and `husky`/`lint-staged`
  commit hooks described in older drafts do not exist — run `yarn lint`,
  `yarn type-check`, `yarn build` manually. This ADR set *is* the `docs/adr/`
  directory that `../architecture.md` §3.3 points to.

## References

- `eslint.config.mjs` — the `boundaries/element-types` rule and layer patterns (`eslint.config.mjs:41-87`).
- `src/core/db.ts`, `src/modules/blog/model/posts.repository.ts` — the layering in practice (route → repository, never route → Drizzle).
- `src/shared/components/` — the tracked `Header` → blog coupling that keeps severity at `warn`.
- [`../architecture.md`](../architecture.md) — the same layering as a living guideline, with migration status and known violations.

## Related docs

- [`../architecture.md`](../architecture.md) — layered structure as a live spec.
- [`./0002-mongodb-to-neon-drizzle.md`](./0002-mongodb-to-neon-drizzle.md) — the repository layer that the module boundary depends on.
- [`../../README.md`](../../README.md) — project overview.

_Last verified against code: 2026-07-03._
