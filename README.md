# Memoria

A private photo library for a small household. Phones upload photos to a cloud inbox that is always online, and a sync agent on a home PC pulls the originals onto a local drive whenever the PC is on. Nobody needs to know whether the PC is awake.

> **Status:** Phase 0 (foundations). Sign-in, uploads and the sync agent arrive in Phase 1.

## How it works

```
iPhone (installable web app)
   │ 1. ask the API for an upload link
   ▼
API on Cloudflare Workers ─── D1 database (users, albums, photo status)
   │ 2. upload the photo straight to storage
   ▼
R2 bucket (inbox for originals + permanent thumbnails)
   ▲
   │ 3. sync agent on the home PC, when it is on:
   │    download → save to disk → verify SHA-256 → mark archived
Home PC library drive (permanent originals) → weekly encrypted backup
```

- Originals leave the cloud only once they are on the library drive **and** in a backup.
- Thumbnails stay in R2, so the gallery works while the PC is off.
- The home PC only makes outgoing requests; nothing on it is exposed to the internet.

## Repository layout

| Path              | What it is                                                        |
| ----------------- | ----------------------------------------------------------------- |
| `apps/web`        | Astro site + API, deployed to Cloudflare Workers                  |
| `apps/agent`      | Node.js sync agent for the home Windows PC                        |
| `packages/shared` | Types and Zod schemas shared by the web app, API and agent        |
| `apps/web/migrations` | D1 database migrations (SQL), applied on every deploy         |

## Tech stack

Astro 7 · React 19 · Tailwind CSS 4 · TypeScript · Cloudflare Workers, D1 and R2 · Zod · Vitest · GitHub Actions · pnpm workspaces

## Development

Requires Node 26 (`nvm use`) and pnpm 12.

```bash
pnpm install
cd apps/web
pnpm exec wrangler d1 migrations apply memoria --local   # first time only
pnpm dev                                                 # http://localhost:4321
```

Local development runs in Cloudflare's own runtime (workerd), with local copies of D1 and R2 stored in `apps/web/.wrangler/`. `GET /api/health` confirms that both are reachable.

| Command        | What it does                                          |
| -------------- | ----------------------------------------------------- |
| `pnpm dev`     | Run the web app locally                               |
| `pnpm verify`  | Type check, lint, format check, tests, build. Run before every commit. |
| `pnpm test`    | Unit tests (Vitest)                                   |
| `pnpm format`  | Apply Prettier                                        |

## Deployment

Every push to `main` runs CI, applies new D1 migrations, and deploys to Cloudflare Workers through GitHub Actions (`.github/workflows/deploy.yml`). Pull requests run CI only.

### One-time Cloudflare setup

```bash
cd apps/web
pnpm exec wrangler login
pnpm exec wrangler r2 bucket create memoria
pnpm exec wrangler d1 create memoria       # copy the printed database_id into wrangler.jsonc
pnpm exec wrangler d1 migrations apply memoria --remote
pnpm run deploy                            # first deploy also attaches the custom domain
```

Then, in the GitHub repo settings, create an environment named `production` with two secrets:

- `CLOUDFLARE_ACCOUNT_ID`: shown on the Workers & Pages overview page.
- `CLOUDFLARE_API_TOKEN`: a custom API token limited to this account, with **Workers Scripts: Edit**, **Workers R2 Storage: Edit**, **D1: Edit**, and **Zone → Workers Routes: Edit** for the domain's zone.

## Security

- No secrets live in this repository. Production secrets are Workers secrets (`wrangler secret put`); local ones go in `apps/web/.dev.vars` (git-ignored; see `.dev.vars.example`).
- Deploy credentials exist only in the `production` GitHub environment, used only by pushes to `main`.
- Third-party GitHub Actions are pinned to commit SHAs, and Dependabot proposes updates after a 7-day cooldown.
- Resource IDs in `wrangler.jsonc` are not secrets; using them requires an API token.

## License

[MIT](LICENSE)
