# MCP Servers & Local AI Tooling

Model Context Protocol (MCP) servers give Claude Code and Cursor live access to Vercel, Neon,
GitHub, browser automation, library docs, and this site's Google Search Console / Yandex Webmaster
data. This doc explains every configured server, the two custom local wrappers, and how to bring
MCP up on a fresh machine.

## At a glance

| Server | Transport (Claude Code) | Launched by | Needs |
|--------|-------------------------|-------------|-------|
| `vercel` | HTTP (`https://mcp.vercel.com`) | remote, hosted | OAuth in-client |
| `neon` | HTTP (`https://mcp.neon.tech/mcp`) | remote, hosted | OAuth in-client |
| `context7` | stdio | `npx -y @upstash/context7-mcp@latest` | nothing |
| `playwright` | stdio | `npx -y @playwright/mcp@latest` | nothing |
| `github` | stdio (Docker) | `docker run … ghcr.io/github/github-mcp-server` | Docker + `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `searchconsole-mcp` | stdio (local wrapper) | `node scripts/searchconsole-mcp.js` | `GSC_SERVICE_ACCOUNT_JSON_BASE64` |
| `yandex-webmaster` | stdio (local wrapper) | `node scripts/yandex-webmaster-mcp.js` | `YANDEX_WEBMASTER_TOKEN` (+ `YANDEX_WEBMASTER_HOST_URL`) |

Two config files declare these servers, one per client:

- `.mcp.json` — Claude Code.
- `.cursor/mcp.json` — Cursor.

They list the same seven servers but differ in a couple of important ways (see
[Client config differences](#client-config-differences)).

## Client config differences

The two files are close but not identical. Do not assume one mirrors the other.

| Server | `.mcp.json` (Claude Code) | `.cursor/mcp.json` (Cursor) |
|--------|---------------------------|------------------------------|
| `vercel` | `"type": "http"` + `url` | `url` only (type inferred) |
| `neon` | `"type": "http"` + `url` | `url` only (type inferred) |
| `context7` | `"type": "stdio"` + `command`/`args` | `command`/`args` (type inferred) |
| `playwright` | `"type": "stdio"` + `command`/`args` | `command`/`args` (type inferred) |
| **`github`** | **local Docker stdio** `ghcr.io/github/github-mcp-server` | **remote HTTP** `https://api.githubcopilot.com/mcp/` |
| `searchconsole-mcp` | `node scripts/searchconsole-mcp.js` | `node scripts/searchconsole-mcp.js` |
| `yandex-webmaster` | `node scripts/yandex-webmaster-mcp.js` | `node scripts/yandex-webmaster-mcp.js` |

The one that bites: **`github` is a different server in each client.** Claude Code runs GitHub's
official server locally in Docker and needs a `GITHUB_PERSONAL_ACCESS_TOKEN` in the shell
environment; Cursor points at GitHub's hosted Copilot MCP endpoint and authenticates in-client with
no local token or Docker. Cursor infers transport from shape (`url` ⇒ http, `command` ⇒ stdio), so
its file omits most `type` fields — but it still sets `"type": "stdio"` explicitly on the two
custom `yarn` wrappers.

## Server catalog

### Remote HTTP servers (no local setup)

`vercel` and `neon` are hosted endpoints declared purely by URL. The client handles auth (OAuth)
interactively; nothing is stored in the repo.

```jsonc
// .mcp.json
"vercel": { "type": "http", "url": "https://mcp.vercel.com" },
"neon":   { "type": "http", "url": "https://mcp.neon.tech/mcp" }
```

- **`vercel`** — deployments, projects, logs/runtime errors, docs search, domain checks.
- **`neon`** — the Postgres database behind the blog: run SQL, inspect schema, manage branches,
  Neon Auth config. See [database.md](./database.md).

### stdio servers via `npx` (zero-config)

```jsonc
"context7":   { "type": "stdio", "command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"], "env": {} },
"playwright": { "type": "stdio", "command": "npx", "args": ["-y", "@playwright/mcp@latest"],       "env": {} }
```

- **`context7`** (`@upstash/context7-mcp`) — up-to-date library/framework documentation lookup.
- **`playwright`** (`@playwright/mcp`) — drives a real browser (navigate, click, snapshot,
  screenshot). Pairs with the E2E suite in [testing/ai-playwright-suite.md](./testing/ai-playwright-suite.md).

Both are pinned to `@latest` and downloaded on demand by `npx -y`; no env, no secrets.

### `github` — local Docker (Claude Code)

```jsonc
"github": {
  "type": "stdio",
  "command": "docker",
  "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
  "env": {}
}
```

`docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN …` forwards the **host** environment's
`GITHUB_PERSONAL_ACCESS_TOKEN` into the container (the config's own `env` block is empty, so the
value is not supplied by the config — it must already exist in the shell that launched Claude
Code). Requirements: Docker running, and `GITHUB_PERSONAL_ACCESS_TOKEN` exported (or in the MCP
client's environment). Cursor sidesteps all of this by using the hosted endpoint instead.

### Custom local wrappers

`searchconsole-mcp` and `yandex-webmaster` are the only servers written for this repo. Both are
launched directly with `node` running a wrapper in `scripts/`. Launching via `node` (not `yarn`)
avoids a Windows failure: `spawn()` cannot execute the `yarn`/`npx` `.cmd` shims without a shell, so
a `yarn` launcher works on Ubuntu/macOS but fails on Windows with `ENOENT` (server → `Connection
closed`).

```jsonc
"searchconsole-mcp": { "type": "stdio", "command": "node", "args": ["scripts/searchconsole-mcp.js"], "env": {} },
"yandex-webmaster":  {
  "type": "stdio", "command": "node", "args": ["scripts/yandex-webmaster-mcp.js"],
  "env": { "YANDEX_WEBMASTER_HOST_URL": "https://softwhere.uz" }
}
```

They exist because the upstream MCP packages want credentials in specific shapes
(`GOOGLE_APPLICATION_CREDENTIALS` file path for Google; token + host env for Yandex) that don't
map cleanly to how this repo stores secrets. The wrappers bridge that gap. Details below.

## Deep dive: `scripts/searchconsole-mcp.js`

This wrapper runs the upstream `@vmandic/searchconsole-mcp` server but feeds it a Google service
account via a **temp credentials file** decoded at launch from a base64 env var.

What it does, in order (`scripts/searchconsole-mcp.js`):

1. **Load env.** `dotenv.config({ path: <root>/.env.local, override: false, quiet: true })` — so
   whatever is already in the process env wins over `.env.local`.
2. **Require the secret.** Reads `GSC_SERVICE_ACCOUNT_JSON_BASE64`; if absent it prints
   `Run: yarn mcp` (and the `npx vercel login` / `npx vercel link` hint for new machines) and exits
   `1`.
3. **Decode + validate.** Base64-decodes to UTF-8 and `JSON.parse`s it; on failure it errors with
   "not valid base64-encoded JSON" and exits `1`.
4. **Write a locked-down temp file.** Creates a temp dir with
   `fs.mkdtempSync(path.join(os.tmpdir(), 'softwhere-gsc-'))` and writes `service-account.json` with
   mode `0o600` (owner read/write only):

   ```js
   const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'softwhere-gsc-'));
   const credentialsPath = path.join(tempDir, 'service-account.json');
   fs.writeFileSync(credentialsPath, credentialsJson, { mode: 0o600 });
   ```

5. **Spawn the real server** with `GOOGLE_APPLICATION_CREDENTIALS` pointing at that file, inheriting
   stdio so it speaks MCP over the parent's stdin/stdout:

   ```js
   const child = spawn('npx', ['-y', '@vmandic/searchconsole-mcp'], {
     cwd: projectRoot,
     env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: credentialsPath },
     stdio: 'inherit',
     shell: process.platform === 'win32', // npx is a .cmd shim; Windows needs a shell to launch it
   });
   ```

6. **Always clean up.** A `cleanup()` (`fs.rmSync(tempDir, { recursive: true, force: true })`) runs
   on child exit and on `SIGINT`/`SIGTERM`/`SIGHUP`; after cleaning up on a signal it re-raises the
   same signal on itself so the exit status is honest. The decoded key never lingers on disk after
   the server stops.

The upstream server exposes Search Console tools (e.g. list sites/sitemaps, URL inspection, search
analytics) under the `searchconsole-mcp` namespace once running.

## Deep dive: `scripts/yandex-webmaster-mcp.js`

Thinner than the GSC wrapper — no file to write, just env plumbing (`scripts/yandex-webmaster-mcp.js`):

1. **Load env** the same way (`.env.local`, `override: false`, `quiet: true`).
2. **Default the host.** Builds the child env spreading `process.env` and defaulting
   `YANDEX_WEBMASTER_HOST_URL` to `https://softwhere.uz` if unset:

   ```js
   const env = {
     ...process.env,
     YANDEX_WEBMASTER_HOST_URL: process.env.YANDEX_WEBMASTER_HOST_URL || 'https://softwhere.uz',
   };
   ```

   `.mcp.json`/`.cursor/mcp.json` also set `YANDEX_WEBMASTER_HOST_URL` in the server's `env` block,
   so the host is supplied even without the default.
3. **Require the token.** If `YANDEX_WEBMASTER_TOKEN` is missing it prints `Run: yarn mcp` (plus the
   `vercel login`/`link` hint) and exits `1`.
4. **Spawn** `npx -y yandex-webmaster-mcp` with that env and `stdio: 'inherit'`; on exit it forwards
   the child's signal (re-raising it) or exit code.

The upstream server exposes Yandex Webmaster tools (diagnostics, indexing, queries, sitemaps,
recrawl, etc.) under the `yandex-webmaster` namespace.

## Deep dive: `scripts/verify-mcp-env.js`

Run automatically by `yarn mcp` after the env pull. It checks the two secrets the local wrappers
need and validates the GSC one is actually decodable (`scripts/verify-mcp-env.js`):

- Loads `.env.local` (`override: false`, `quiet: true`).
- `required = ['YANDEX_WEBMASTER_TOKEN', 'GSC_SERVICE_ACCOUNT_JSON_BASE64']` — note
  `YANDEX_WEBMASTER_HOST_URL` is **not** required here (it's config-supplied / defaulted).
- If either is missing, it prints the **Sensitive-var gotcha** and exits `1` (see below).
- Otherwise it base64-decodes `GSC_SERVICE_ACCOUNT_JSON_BASE64`, `JSON.parse`s it, and asserts both
  `client_email` and `private_key` are present; any failure ⇒ "must be a valid base64-encoded Google
  service account JSON", exit `1`.
- On success: `console.log('MCP env is ready.')`.

## Env sync flow

Secrets live in Vercel (production environment) and are pulled into a local, git-ignored
`.env.local`. The wrapper scripts read that file at launch.

```
yarn mcp
  ├─ yarn env:pull:local:production      # npx vercel env pull .env.local --environment production --yes
  └─ node scripts/verify-mcp-env.js      # assert YANDEX_WEBMASTER_TOKEN + GSC_...BASE64 present & valid
```

Relevant `package.json` scripts:

```jsonc
"env:pull:production":       "npx vercel env pull .env --environment production --yes",
"env:pull:development":      "npx vercel env pull .env --environment development --yes",
"env:pull:local:production": "npx vercel env pull .env.local --environment production --yes",
"mcp":                       "yarn env:pull:local:production && node scripts/verify-mcp-env.js",
"mcp:searchconsole":         "node scripts/searchconsole-mcp.js",
"mcp:yandex-webmaster":      "node scripts/yandex-webmaster-mcp.js"
```

- `yarn mcp` is the **one command you run manually** to (re)hydrate MCP secrets. It writes
  `.env.local` from Vercel's production env, then verifies.
- The wrappers `node scripts/searchconsole-mcp.js` / `node scripts/yandex-webmaster-mcp.js` are
  **invoked by the MCP client**, not by you — they are the `command`/`args` in the config files.
  (The `yarn mcp:searchconsole` / `yarn mcp:yandex-webmaster` package scripts still run the same
  wrappers, handy for manual testing.) Each wrapper re-reads `.env.local` on startup, so as long as
  `yarn mcp` has populated it, the servers pick the secrets up.
- `.env.local` is git-ignored (`.gitignore` covers `.env*.local` and `.env*`); never commit it.
- `dotenv` (dev dependency) is what the wrappers use to read `.env.local`.

## Required secrets

| Variable | Used by | Source / format |
|----------|---------|-----------------|
| `GSC_SERVICE_ACCOUNT_JSON_BASE64` | `searchconsole-mcp`, `verify-mcp-env.js` | Base64 of a Google service-account JSON key; must decode to JSON with `client_email` + `private_key` |
| `YANDEX_WEBMASTER_TOKEN` | `yandex-webmaster`, `verify-mcp-env.js` | Yandex Webmaster OAuth token |
| `YANDEX_WEBMASTER_HOST_URL` | `yandex-webmaster` | Set to `https://softwhere.uz` in both config files; wrapper also defaults to it. Not required by `verify-mcp-env.js` |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | `github` (Claude Code Docker only) | Read from host env by `docker run -e …`; Cursor doesn't need it |

To encode the GSC key locally:

```bash
base64 -w0 service-account.json   # Linux; macOS: base64 -i service-account.json
```

Store the output in Vercel (production) as `GSC_SERVICE_ACCOUNT_JSON_BASE64` so `yarn mcp` can pull
it. At runtime the wrapper decodes it back to a temp `service-account.json` and points
`GOOGLE_APPLICATION_CREDENTIALS` at it (see the GSC deep dive above).

## Gotcha: Vercel "Sensitive" env vars are write-only

`verify-mcp-env.js` calls this out explicitly, because it's the most common reason `yarn mcp`
"succeeds" but hands you empty secrets. If a Vercel env var is marked **Sensitive**, Vercel will
**not** return its value on `vercel env pull` — the pulled `.env.local` gets an empty/blank value,
and the local wrappers then fail with "missing" errors. The verifier's message:

```
Missing MCP env value(s): …
If Vercel pulled empty values, those variables are probably marked Sensitive.
Vercel Sensitive env vars are write-only and cannot be used as a local sync source.
Use non-sensitive Vercel env vars for MCP sync, or store these secrets locally/with a password manager.
```

**Fix:** either store `GSC_SERVICE_ACCOUNT_JSON_BASE64` / `YANDEX_WEBMASTER_TOKEN` as
**non-sensitive** Vercel env vars (so `env pull` can read them for MCP sync), or put them directly
in `.env.local` from a password manager and skip the pull.

## New machine: MCP from scratch

1. **Install deps.** `yarn install` (provides `dotenv`; `npx`, `docker`, and network access are
   assumed).
2. **Link to Vercel.** `npx vercel login` then `npx vercel link` (the wrappers' error messages
   point here). This is what lets `env pull` find the project.
3. **Pull + verify secrets.** `yarn mcp` — writes `.env.local` from Vercel production and runs
   `verify-mcp-env.js`. If it reports missing values, re-read the
   [Sensitive-vars gotcha](#gotcha-vercel-sensitive-env-vars-are-write-only).
4. **GitHub (Claude Code only).** Ensure Docker is running and export a
   `GITHUB_PERSONAL_ACCESS_TOKEN` in the environment that launches Claude Code. Cursor users skip
   this (hosted endpoint).
5. **Start your client.** Claude Code reads `.mcp.json`; Cursor reads `.cursor/mcp.json`. The
   remote (`vercel`, `neon`) and `npx` (`context7`, `playwright`) servers need no local secrets; the
   two custom wrappers now find their secrets in `.env.local`.
6. **Auth the remote servers** in-client (OAuth) the first time you use `vercel`/`neon`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `… is missing. Run: yarn mcp` from a wrapper | `.env.local` not populated | Run `yarn mcp`; if new machine, `npx vercel login` + `npx vercel link` first |
| `Missing MCP env value(s)` from `verify-mcp-env.js` | Vercel var marked **Sensitive** ⇒ pulled empty | Make it non-sensitive, or set it locally in `.env.local` |
| `GSC_SERVICE_ACCOUNT_JSON_BASE64 must be a valid base64…` | Not base64, not JSON, or missing `client_email`/`private_key` | Re-encode a real service-account key with `base64 -w0` |
| `github` tools missing in Claude Code | Docker not running or `GITHUB_PERSONAL_ACCESS_TOKEN` unset | Start Docker; export the token in the launching shell |
| GSC/Yandex tools missing | Wrapper exited (bad/empty secret) | Run the wrapper directly (`yarn mcp:searchconsole`) to see the error |
| GSC/Yandex server `Connection closed` on **Windows** | A `yarn`/`npx` `.cmd` shim was spawned without a shell → `ENOENT` (works on Ubuntu/macOS, not Windows) | Fixed in-repo: configs launch via `node scripts/…` and wrappers spawn `npx` with `shell` on Windows. Pull latest, then restart the client |

## Related docs

- [environment.md](./environment.md) — full env-var reference and `.env.local` handling
- [seo.md](./seo.md) — Search Console / Yandex Webmaster usage and sitemaps
- [deployment.md](./deployment.md) — Vercel project, environments, and env storage
- [database.md](./database.md) — the Neon Postgres backend the `neon` server talks to
- [testing/ai-playwright-suite.md](./testing/ai-playwright-suite.md) — E2E suite paired with the `playwright` server
- [../README.md](../README.md) — project overview and scripts

_Last verified against code: 2026-07-04._
