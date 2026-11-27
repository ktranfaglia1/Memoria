# Memoria

Private household photo library. Public repo: never commit secrets, real photos, personal emails, or family names.

## Layout

- `apps/web`: Astro 7 (`output: "server"`) on Cloudflare Workers via `@astrojs/cloudflare`. Bindings come from `import { env } from "cloudflare:workers"` (`env.DB` = D1, `env.BUCKET` = R2); `Astro.locals.runtime` no longer exists.
- `apps/agent`: Node 26 sync agent for the home Windows PC. Runs TypeScript directly (type stripping), so use only erasable syntax and `.ts` import extensions.
- `packages/shared`: Zod schemas and types used by both. Shared logic gets Vitest tests next to it (`*.test.ts`).

## Commands

- `pnpm verify`: check + lint + format check + tests + build. Run before every commit.
- `pnpm dev`: local dev in workerd with local D1/R2 in `apps/web/.wrangler/`. First run: `pnpm exec wrangler d1 migrations apply memoria --local` in `apps/web`.
- `pnpm run deploy`, never `pnpm deploy` (a built-in pnpm command). Production deploys normally go through GitHub Actions on push to `main`.
- After changing `wrangler.jsonc`, rerun `pnpm --filter @memoria/web cf-typegen` (`check` and `dev` do this too).

## Rules

- Schema changes go in a new numbered file in `apps/web/migrations/`; never edit an applied migration.
- Every API route checks the session (from Phase 1). `/api/health` is the only public endpoint, and it reports ok/error only.
- Secrets: `wrangler secret put` in production, `apps/web/.dev.vars` locally (git-ignored). Only `*.example` files are committed.
- Keep the Cloudflare Images binding and KV sessions off (`imageService: "passthrough"`, `session: false`); they add resources we don't use.
- New dependencies: prefer releases at least a few days old. Don't add `minimumReleaseAgeExclude` entries to bypass pnpm's release-age check.
- GitHub Actions: pin third-party actions to a commit SHA with the tag in a comment; deploy secrets only in the `production` environment.
- The implementation plan lives in a Claude doc, not in this repo.
