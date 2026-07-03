# Architecture Decision Records

The load-bearing architecture decisions behind softwhere.uz, one file each.

An ADR captures a single decision that shaped the codebase: the problem it
solved, what was chosen, and what living with that choice costs. Read these to
understand *why* the code looks the way it does before you change it — the
grounding is in the actual files each record cites.

## At a glance

| ADR | Title | Status | Grounds in |
| --- | --- | --- | --- |
| [0001](./0001-layered-architecture.md) | Layered `core / shared / modules / app` architecture | Accepted | `eslint.config.mjs`, `src/` |
| [0002](./0002-mongodb-to-neon-drizzle.md) | Datastore: MongoDB/Mongoose → Neon Postgres + Drizzle | Accepted | `src/core/db.ts`, `src/modules/*/model/` |
| [0003](./0003-admin-auth-neon-auth.md) | Admin auth: Neon Auth sessions + `API_SECRET` bearer | Accepted | `src/core/auth.ts`, `src/core/neonAuth.ts` |
| [0004](./0004-ai-blog-pipeline.md) | Grounded AI blog pipeline (research → generate → quality → normalize) | Accepted | `src/modules/blog/api/`, `src/core/ai.ts` |

## Format

Each record uses the same headings, in this order:

- **Title** — `NNNN <short decision name>`.
- **Status** — one of `Proposed`, `Accepted`, `Superseded by NNNN`, `Deprecated`.
  Every record here is `Accepted` and reflects on-disk behavior on `main`.
- **Context** — the forces and constraints that made a decision necessary.
- **Decision** — what was chosen, stated in the present tense.
- **Consequences** — what got better, what got worse, and what you must now
  keep in mind. Includes known debt.
- **References** — the code and neighbor docs that ground the record.

## Conventions

- Records are numbered sequentially and never renumbered. Supersede, don't edit,
  a decision that changes: add a new ADR and flip the old one's status.
- Every factual claim traces to a file in this repo. If an ADR and the code
  disagree, the code wins — fix the ADR.
- ADRs are historical once accepted. They are not a live spec; for how a
  subsystem works *today*, read the linked topic doc (e.g.
  [`../architecture.md`](../architecture.md), [`../database.md`](../database.md)).

## Related docs

- [`../architecture.md`](../architecture.md) — the layering as a live guideline.
- [`../database.md`](../database.md) — Neon/Drizzle provisioning and schema.
- [`../auth-and-admin.md`](../auth-and-admin.md) — admin auth and the admin panel.
- [`../../README.md`](../../README.md) — project overview.

_Last verified against code: 2026-07-03._
