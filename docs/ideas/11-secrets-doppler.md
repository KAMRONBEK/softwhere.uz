# Idea: Environment variables in Doppler instead of Vercel

> **Status:** idea, not built. Researched 2026-10-01. The founders decided to keep every environment variable in Doppler before the move to the own server ([07](./07-own-server.md)). The list of variables itself stays in `docs/environment.md`, which is authoritative.

## Is it free for us? Yes

Doppler's **Developer plan is free for up to 3 users** (extra users $8 a month each; the Team plan is $21 per user a month). The limits that matter here:

| Limit | Free plan |
| --- | --- |
| Projects | 10 |
| Environments per project | 4 |
| Config syncs (integrations such as GitHub or Vercel) | 5 |
| Service tokens | 50 |
| Activity log | 3 days |
| Roles, SSO | Not included |

Give the founders the 3 seats. Engineers who only need to run the site locally get a **read-only service token for `dev`**, not a seat.

## Layout

One Doppler project, `softwhere-web`:

| Config | Used by | Database |
| --- | --- | --- |
| `dev` | Local development, Claude Code sessions | A Neon dev branch, never production |
| `stg` | The hidden staging host on the server | A Neon staging branch |
| `prd` | Production on the server, and the GitHub Actions blog jobs | Production |

## Moving the variables out of Vercel

Do this on your own computer, not in a cloud session, and never commit the files.

1. Pull each Vercel environment to a file. The repo's `yarn env:pull:*` scripts already wrap this:
   ```bash
   npx vercel env pull .env.prd --environment production --yes
   npx vercel env pull .env.dev --environment development --yes
   ```
2. Upload each file to its config:
   ```bash
   doppler secrets upload .env.prd --project softwhere-web --config prd
   doppler secrets upload .env.dev --project softwhere-web --config dev
   ```
3. Clean up against `docs/environment.md`:
   - Drop Vercel's own variables (`VERCEL_*`); the code reads none of them.
   - Drop dead ones such as `WEBSITE_URL`.
   - Make sure the Telegram values are the server-only `TG_BOT_TOKEN` and `TG_CHAT_ID`, never `NEXT_PUBLIC_TG_*`.
4. Delete the local files (`rm .env.prd .env.dev`).
5. Point `dev` and `stg` at Neon branches, not at production.
6. While Vercel stays up as the rollback (2–4 weeks), use Doppler's Vercel integration (one sync) so Vercel gets the same values from Doppler. Remove that sync when Vercel is switched off.
7. After the cutover, rotate everything that lived in Vercel:
   - the AI keys
   - `API_SECRET` and `TG_BOT_TOKEN`
   - `NEON_AUTH_COOKIE_SECRET`
   - the database password (Neon's "reset password")

## How each place reads the variables

| Where | How |
| --- | --- |
| **Local development** | `doppler setup` once in the repo (project `softwhere-web`, config `dev`), then `doppler run -- yarn dev`. Replace the `env:pull:*` scripts in `package.json` with Doppler equivalents |
| **Server, running** | Coolify (or Docker Compose) holds one secret only: `DOPPLER_TOKEN`, a read-only service token for `prd`. The container starts with `doppler run -- node server.js`. The CLI keeps an encrypted fallback copy, so a restart still works if Doppler is unreachable |
| **Server, building** | `next build` needs the two `NEXT_PUBLIC_*` values (inlined into the browser bundle), and `DATABASE_URL`, because blog posts are prerendered from Neon at build time. Build with `doppler run -- yarn build`. If the build runs inside Docker, pass the values as a build secret (`RUN --mount=type=secret`) so the database URL never ends up in an image layer |
| **GitHub Actions** (blog jobs, audits) | Doppler's GitHub integration (one sync) copies `prd` into the repo's Actions secrets, so the workflows don't change. Alternative: `dopplerhq/secrets-fetch-action` with a service token |
| **Claude cloud sessions** | Doppler is blocked by the cloud environment's network rules today. Either allow `api.doppler.com` and add a read-only `dev` token as an API credential in the environment settings, or copy the few dev values into the environment variables. Never production; never paste a token into the chat |

## Rules

- **One service token per place** (server, staging, CI, each engineer), read-only and scoped to one config, so one can be revoked without breaking the others.
- **Nothing from Doppler is committed.** `.env*` files are already git-ignored.
- **When the move is done,** rewrite the Vercel sections of `docs/environment.md` and the "Environment & `vercel env pull`" section of `docs/deployment.md` for Doppler.

## Sources

- Doppler pricing: <https://www.doppler.com/pricing>
- Doppler free plan limits: <https://costbench.com/software/secrets-management/doppler/free-plan/>, <https://freetier.co/directory/products/doppler>
- Doppler and Vercel: <https://www.doppler.com/integrations/vercel>
- Next.js `NEXT_PUBLIC_*` values are inlined at build time: `docs/environment.md`
