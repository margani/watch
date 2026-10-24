# Watch — notes for coding agents

Open-source app for keeping track of films and series (see README.md). Anyone may run their own
copy, so nothing about one particular instance (domains, ids, keys, people) belongs in this repo:
instance settings come from Worker vars and secrets, or from `scripts/deploy.sh`'s environment.

## Commands

- Install: `npm ci`, then `cp .dev.vars.example .dev.vars`.
- Dev: `npm run dev` (http://localhost:5173), local D1 in `.wrangler/` after `npm run db:migrate:local`.
- All checks: `npm run ci:local` (lint, types, unit, IMDb loader, build, e2e). CI runs the same.
- Schema change: edit `src/lib/server/db/schema.ts`, then `npm run db:generate`.

## Rules

- Every feature that needs a key or service is optional and off without it; the page says what
  is missing instead of failing. Only `TMDB_TOKEN` (or `TMDB_DEMO=1`) is needed to run.
- Lists are private: every query is scoped to the signed-in user, and e2e tests check a second
  account sees nothing.
- Tests use made-up titles (`src/lib/server/watch-demo.ts`, `TMDB_DEMO=1`), never TMDB.
- E2E tests wait for `html[data-hydrated]` before interacting, and after a form posts a full page
  (`hydrated(page)`): typing before hydration is reset.
- Credit TMDB and JustWatch wherever their data shows.
- Kit 3: no `svelte.config.js` (options in `vite.config.ts`), `#lib/...` imports with the file
  extension, bindings from `cloudflare:workers`, param matchers in `src/params/index.ts`
  (`defineParams`).
- The adapter builds from `wrangler.kit.jsonc`; `wrangler.jsonc`'s `main` is `src/worker.ts`,
  which adds the cron.
