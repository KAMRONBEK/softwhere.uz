# Documentation

The documentation map for **softwhere.uz** — a multilingual (uz/ru/en) Next.js 16 App Router
marketing site, portfolio, AI-generated blog, project-cost estimator, and admin panel
(TypeScript 5.8, Tailwind, Neon Postgres via Drizzle, deployed on Vercel).

Every doc here is grounded in the actual code and was written to describe the **current** behavior
on `main`, not aspirational plans. Each ends with a `_Last verified against code:_` date.

## Start here

| Doc | What it is |
|-----|-----------|
| [`../CLAUDE.md`](../CLAUDE.md) | High-signal repo guide for AI coding agents — golden rules, layering, checks to run. Read first. |
| [`../README.md`](../README.md) | Project overview, features, quick start. |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Local setup, required checks, commit conventions, PR flow. |

## Architecture & foundations

| Doc | What it covers |
|-----|----------------|
| [architecture.md](./architecture.md) | The layered `core → shared → modules → app` structure and the import-direction rules enforced by `eslint-plugin-boundaries`. |
| [adr/](./adr/README.md) | Architecture Decision Records — the *why* behind the big choices (layering, Neon/Drizzle, admin auth, AI pipeline). |
| [database.md](./database.md) | Neon serverless Postgres + Drizzle (HTTP driver), the `blog_posts` / `leads` tables, and the repository layer. |
| [environment.md](./environment.md) | Authoritative catalog of every environment variable — scope, requiredness, subsystem, source of truth, and the Vercel "Sensitive" gotcha. |
| [security.md](./security.md) | Request hardening: rate limiting, input validation/sanitization, output escaping, SSRF guard, the `API_SECRET` Bearer gate, secrets hygiene, logging boundaries. |

## Subsystems

| Doc | What it covers |
|-----|----------------|
| [blog-pipeline.md](./blog-pipeline.md) | End to end: how one topic becomes three linked, grounded, quality-checked posts (uz/ru/en) — research → generation → quality gates → normalization → persistence, plus both entry points and the cron. |
| [estimator.md](./estimator.md) | Canonical reference for the cost estimator: wizard, catalog, pricing formula, AI refinement, currency, and lead capture. |
| [i18n.md](./i18n.md) | How `next-intl` is wired — locale routing (uz default, ru, en), middleware/proxy, request config, message bundles, and cross-locale blog linking via `generationGroupId`. |
| [frontend.md](./frontend.md) | UI architecture: layouts, the shared component library, homepage section composition, theming/tokens, fonts, AOS, and how sections consume i18n + data. |
| [auth-and-admin.md](./auth-and-admin.md) | Admin auth (Neon Auth session + role gate for humans, Bearer `API_SECRET` for machines) and the leads/posts admin UI behind it. |
| [seo.md](./seo.md) | Search visibility: dynamic sitemap, robots, per-locale RSS, edge OG images, JSON-LD, canonical/hreflang, slugs, reading time, IndexNow, and Search Console / Yandex over MCP. |
| [yandex-setup.md](./yandex-setup.md) | Owner-only Yandex console actions: assign the Tashkent region (`NO_REGIONS`) and register in Yandex Business/Sprav (`NOT_IN_SPRAV`), with verification steps over the MCP. |

## API & interfaces

| Doc | What it covers |
|-----|----------------|
| [api-reference.md](./api-reference.md) | Complete reference for every route under `src/app/api` — method, path, auth, params, request/response shapes, errors, and rate limiting. |

## Operations & tooling

| Doc | What it covers |
|-----|----------------|
| [deployment.md](./deployment.md) | Build & deploy on Vercel, `vercel.json` limits/regions, the stateless Neon HTTP runtime, env pull, health checks, and the `db:push` schema flow. |
| [ci-workflows.md](./ci-workflows.md) | The three GitHub Actions blog workflows — triggers, inputs, secrets, scripts run, and how to run each manually. |
| [scripts.md](./scripts.md) | The `scripts/*.ts` tsx tools (generate-post, regenerate-post, audit-posts, estimator-calibration, screenshot-homepage) and the `package.json` yarn scripts. |
| [mcp.md](./mcp.md) | Model Context Protocol setup for Claude Code and Cursor — every configured server, the two custom local wrappers, the env-sync flow, and from-scratch setup. |
| [testing/ai-playwright-suite.md](./testing/ai-playwright-suite.md) | 92 grounded end-to-end cases for AI-driven Playwright testing. |

## Design history (context, not current spec)

These predate the docs above and are kept for background. Where they disagree with a canonical doc,
the canonical doc wins.

| Doc | Status |
|-----|--------|
| [estimator-v2.md](./estimator-v2.md), [estimator-section-plan.md](./estimator-section-plan.md) | Earlier estimator design notes. **Some numbers are stale** (catalog counts, AI-pass budget); see [estimator.md](./estimator.md) for the current implementation. |
| [blog-review-2026-07.md](./blog-review-2026-07.md) | A point-in-time content review. |

## Conventions

- **Grounded, not aspirational.** Docs describe on-disk behavior. If a doc and the code disagree,
  the code is right — fix the doc (and tell someone).
- **The DB is Neon Postgres + Drizzle, not Mongo.** Any surviving mention of Mongoose / `ObjectId` /
  collections anywhere is stale.
- **ADRs are append-only.** To change a decision, add a new ADR that supersedes the old one rather
  than editing history. See [adr/README.md](./adr/README.md).

_Last verified against code: 2026-07-03._
