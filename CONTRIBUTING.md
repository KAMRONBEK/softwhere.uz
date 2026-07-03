# Contributing to softwhere.uz

A task-oriented guide for developers and AI coding agents working in this repo: local setup, the checks every change must pass, the commit/branch conventions, where new code belongs in the layered architecture, and how to ship a change.

## At a glance

| Concern            | Command / rule                              | Source of truth                     |
| ------------------ | ------------------------------------------- | ----------------------------------- |
| Package manager    | Yarn 1 (classic)                            | `package.json` `packageManager`     |
| Install            | `yarn install`                              | `package.json`                      |
| Env file           | `cp env.example .env.local`                 | `env.example`                       |
| DB schema push     | `yarn db:push`                              | `package.json`, `drizzle.config.ts` |
| Dev server         | `yarn dev`                                  | `package.json` (`next dev`)         |
| Type-check         | `yarn type-check`                           | `tsc --noEmit`                      |
| Lint (+ boundaries)| `yarn lint`                                 | `eslint.config.mjs`                 |
| Format             | `yarn format` / `yarn format:check`         | `.prettierrc`                       |
| Build              | `yarn build`                                | `next build`                        |
| Commit style       | Conventional Commits: `type(scope): subject`| `git log`                           |
| Default branch     | `main` (also `dev`)                         | `git branch -a`                     |
| Layering           | `core → shared → modules → app`             | `eslint.config.mjs`, `docs/architecture.md` |

There is **no test runner script** in `package.json`. Playwright is a devDependency, but the E2E suite is documented (AI-executable), not wired to `yarn test` — see `docs/testing/`.

## 1. Local setup

Prerequisites (per `README.md`): Node.js 18+ (CI uses Node 22 — see `.github/workflows/generate-post.yml`), Yarn, a Neon Postgres database, and optionally a DeepSeek API key for AI features.

```bash
git clone https://github.com/KAMRONBEK/softwhere.uz.git
cd softwhere.uz
yarn install
cp env.example .env.local
```

Then edit `.env.local`. The two variables that block basic functionality (`env.example`):

| Variable                   | Required | Purpose                                                        |
| -------------------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL`             | Yes      | Neon serverless Postgres connection string (`?sslmode=require`)|
| `NEXT_PUBLIC_BASE_URL`     | Yes      | Base URL for internal API calls, e.g. `http://localhost:3000`  |
| `NEXT_PUBLIC_TG_BOT_TOKEN` | Contact  | Telegram bot token for contact-form notifications              |
| `NEXT_PUBLIC_TG_CHAT_ID`   | Contact  | Telegram chat id for contact-form notifications                |
| `DEEPSEEK_API_KEY`         | Optional | DeepSeek AI for blog generation and the estimator              |
| `API_SECRET`               | Optional | Bearer secret for machine/admin endpoints                      |
| `UNSPLASH_ACCESS_KEY`      | Optional | Cover images for generated blog posts                          |

See `docs/environment.md` for the full variable reference. Never commit `.env.local` or real credentials.

### Push the database schema

The schema lives in Drizzle table files, not migrations you write by hand. `drizzle.config.ts` points at both:

```ts
schema: ['./src/modules/blog/model/BlogPost.ts', './src/modules/contact/model/Lead.ts'],
```

Push them to your Neon database:

```bash
yarn db:push        # drizzle-kit push — syncs the tables to DATABASE_URL
```

> **Gotcha:** `drizzle.config.ts` starts with `import 'dotenv/config'`, which loads `.env` (not `.env.local`). Next.js dev reads `.env.local`. So `db:push` will only see `DATABASE_URL` if it is present in `.env` or already exported in your shell. Either duplicate the value into `.env`, or run `DATABASE_URL=... yarn db:push`.

There are **two tables** — `blog_posts` (`src/modules/blog/model/BlogPost.ts`) and `leads` (`src/modules/contact/model/Lead.ts`). Other Drizzle commands: `yarn db:generate` (emit SQL migrations to `./drizzle`) and `yarn db:studio` (browse data). All application DB access goes through the repository layer (`src/modules/blog/model/posts.repository.ts`, `src/modules/contact/model/leads.repository.ts`) — routes and pages must never touch Drizzle directly. See `docs/database.md`.

### Run the dev server

```bash
yarn dev            # next dev — http://localhost:3000
```

`yarn dev` runs plain `next dev` and uses your local `.env.local`. If you want production-like values pulled from Vercel first, use `yarn dev:env` (development env) or `yarn dev:production` — both run `vercel env pull` into `.env` before starting.

Line endings are LF (`.editorconfig`: `end_of_line = lf`). After cloning:

```bash
git config --local core.autocrlf false
yarn normalize-line-endings
```

## 2. Required checks

Run these before every commit — CI and reviewers expect a clean pass. There are no pre-commit hooks (`husky`/`lint-staged` are not installed; `docs/architecture.md` §3.2 notes this), so it is on you.

```bash
yarn type-check     # tsc --noEmit
yarn lint           # eslint src/
yarn format:check   # prettier --check .   (use `yarn format` to auto-fix)
yarn build          # next build
```

### Lint, Prettier, and the boundaries rule

ESLint is configured in `eslint.config.mjs` (flat config) and composes `eslint-config-next`, `eslint-plugin-prettier`, and `eslint-plugin-boundaries`. Two things worth knowing:

- **Prettier is enforced as a lint error.** `'prettier/prettier': 'error'` means a formatting deviation fails `yarn lint`, not just `yarn format:check`. Run `yarn format` to fix.
- **The layering rule runs at `warn`, not `error`.** `boundaries/element-types` encodes `core → shared → modules → app` but is set to `warn` on purpose, so `yarn lint` still reports **0 errors** while surfacing the known cross-layer couplings (see `eslint.config.mjs:36-40` and `docs/architecture.md` §1.1). Do not add new boundary warnings; the goal is to remove the remaining ones and promote the rule to `error`.

Prettier options (`.prettierrc`) your code must match — most are auto-applied by `yarn format`:

| Option         | Value  | Option           | Value     |
| -------------- | ------ | ---------------- | --------- |
| `semi`         | `true` | `printWidth`     | `140`     |
| `singleQuote`  | `true` | `tabWidth`       | `2`       |
| `jsxSingleQuote`| `true`| `trailingComma`  | `es5`     |
| `arrowParens`  | `avoid`| `endOfLine`      | `auto`    |

`.editorconfig` reinforces the same basics editor-wide: UTF-8, LF, 2-space indent, final newline, trim trailing whitespace (except in `*.md`).

Note the scopes differ: `yarn lint` checks `src/` only; `yarn format:check` (`prettier --check .`) checks the whole repo.

## 3. Layered architecture: where new code goes

The import direction `core → shared → modules → app` is enforced by `eslint-plugin-boundaries`. Put new code in the lowest layer that fits, and only import from allowed layers:

| Layer               | Path              | May import                              | Put here                                                     |
| ------------------- | ----------------- | --------------------------------------- | ------------------------------------------------------------ |
| `core`              | `src/core/**`     | `core` only                             | Framework-agnostic infra: env, logger, `db.ts`, `i18n.ts`, `ai.ts`, `http.ts`, auth |
| `shared`            | `src/shared/**`   | `core`, `shared`                        | Reusable non-domain UI/utils (Button, Header, `utils/`, `data/`) |
| `modules/<feature>` | `src/modules/**`  | `core`, `shared`, **own module only**   | Business capabilities: `blog`, `estimator`, `admin`, `contact` |
| `app`               | `src/app/**`      | anything                                | Next.js routes/pages, kept logic-thin                        |

The rule set (`eslint.config.mjs:67-85`):

```js
rules: [
  { from: ['core'],   allow: ['core'] },
  { from: ['shared'], allow: ['core', 'shared'] },
  { from: ['module'], allow: ['core', 'shared', ['module', { moduleName: '${from.moduleName}' }]] },
  { from: ['app'],    allow: ['core', 'shared', 'module', 'app'] },
]
```

Practical consequences:

- One module **must not** import another module directly (e.g. `estimator` cannot import from `blog`). Route through `shared`/`core`, or compose them in the `app` layer.
- `core` must stay dependency-free of upper layers. `src/proxy.ts`, `src/messages/**`, `**/global.d.ts`, and `scripts/**` are excluded from the rule (`boundaries/ignore`).
- Add a DB query? It goes in a module's repository (`src/modules/<feature>/model/*.repository.ts`), and callers in `app` import that — never Drizzle.

Full rationale and the tracked known violations are in `docs/architecture.md`.

## 4. Adding a translation key

Locales are `uz` (default), `ru`, `en`, served by `next-intl`. Messages live in `src/messages/{uz,ru,en}.json` as three JSON files with an **identical nested key tree**.

1. Add the key at the same path in **all three** files. A key present in one bundle but missing in another throws at runtime for the locale that lacks it (keys are not type-checked).
2. Read it through its top-level namespace:

```tsx
// Server component / page:
const t = await getTranslations('blog');
t('relatedArticles');

// Client component ('use client'):
const t = useTranslations('header');
t('services');
```

3. For ICU placeholders, pass values as the second argument: `t('stepProgress', { current, total })`.

Adding a whole new *locale* touches several files (routing, middleware, static params, validators) — see the locale-list table in `docs/i18n.md`.

## 5. Adding or generating a blog post

Posts are rows in the `blog_posts` table, written through `src/modules/blog/model/posts.repository.ts`. Three ways to create them:

- **CLI (local):**

  ```bash
  npx tsx scripts/generate-post.ts --category mobile-app-development --locales en,ru,uz
  ```

  Flags (from `scripts/generate-post.ts`): `--category <id>` (a service pillar, or `random`), `--customTopic <str>` (overrides category), `--sourceUrl <url>`, `--sourceText <str>` (max 5000 chars), `--locales <list>` (default `en,ru,uz`), `--force` (ignore the per-slot idempotency check; bare `--force` works), `--publish true` (a **value** flag, not bare — local/manual runs stay drafts unless you pass `--publish true`; scheduled runs publish unless you pass `--publish false`).

- **GitHub Actions:** the `Generate Blog Post` workflow (`.github/workflows/generate-post.yml`) runs on a schedule (twice daily, `17 6` / `17 18` UTC) and via `workflow_dispatch` with inputs `category`, `customTopic`, `sourceUrl`, `sourceText`, `force`, `publish`. Scheduled runs publish automatically; dispatch with `publish=false` for drafts.

- **API:** `POST /api/blog/generate` (`src/app/api/blog/generate/route.ts`) for programmatic generation.

The three language variants of one article are separate rows sharing a `generation_group_id` (see `docs/i18n.md`). Generation requires `DATABASE_URL` and an AI key; see `docs/scripts.md` for the CLI details and `docs/ci-workflows.md` for the workflow.

## 6. Branch, commit, and PR flow

### Branches

`main` is the default (and deploys to production on push); `dev` is the shared integration branch (`git branch -a`). Don't commit directly to `main` — branch off it for your work. Feature-branch naming in history follows `type/short-description` (e.g. `feature/...`); keep it short and descriptive.

### Commit messages: Conventional Commits

`git log` shows a consistent `type(scope): subject` convention. Match it:

```
feat(blog): DeepSeek V4 Pro as the default DeepSeek model everywhere
fix(admin): robust logout — hard reload + clearer button styling
perf(home): SSR the LCP headline, cut DOM 72%, inline CSS, trim fonts/countries
docs(testing): AI-executable Playwright suite — 92 grounded E2E cases
```

Types seen in history: `feat`, `fix`, `chore`, `style`, `perf`, `docs`. Common scopes: `blog`, `admin`, `home`, `portfolio`, `estimator`, `contact`, `testing`. Guidelines:

- `type` lowercase; `scope` optional but preferred and lowercase.
- Subject in the imperative/present, no trailing period, concise. A ` — ` dash for a short clarifier is common.
- Scope the change so the type is honest (`fix` for bug fixes, `feat` for new behavior, `docs`/`chore`/`style` for non-runtime changes).

### Pull requests

1. Branch off `main` (or `dev`), commit your work with the checks in §2 passing.
2. Push and open a PR. Use the `gh` CLI for GitHub operations if you have it.
3. In the description, state what changed and why, and confirm `type-check`, `lint`, `format:check`, and `build` all pass. Note any new boundary warnings (there should be none).
4. Keep PRs focused; update the relevant `docs/*.md` when you change behavior it documents.

## Related docs

- [README.md](README.md) — project overview, scripts, structure, and API routes.
- [docs/architecture.md](docs/architecture.md) — the layered structure and boundary rules in depth.
- [docs/i18n.md](docs/i18n.md) — locales, message bundles, and adding translations.
- [docs/scripts.md](docs/scripts.md) — the `generate-post` / `regenerate-post` CLIs and their flags.

_Last verified against code: 2026-07-03._
