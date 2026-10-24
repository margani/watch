# Watch

Keep track of the films and series you want to watch, are watching and have seen.

- **Your list** in three tabs (want to watch, watching, watched) with your own 1–10 ratings.
- **Episodes**: tick off what you have seen, season by season; the series moves to _Watching_
  and _Watched_ by itself.
- **News**: new episodes of series you are watching and releases of films you want to see show
  up on your list, and by email if you like.
- **Where to watch**: pick your streaming services and country, and every title shows whether
  one of them has it.
- **For you**: newer films in collections you have started, and popular titles on your services.
- **Netflix import**: your viewing history file is read in the browser and matched to titles.
- **Your own links** on every title page, such as a search on a site you use.
- Ratings from IMDb, Rotten Tomatoes and Metacritic when configured.
- Download all your data, or delete the account, at any time.

Built with SvelteKit (Svelte 5), Tailwind CSS 4 and Drizzle on Cloudflare Workers + D1, with
sign-in by better-auth. Film and series data comes from [TMDB](https://www.themoviedb.org/);
where-to-watch data comes from [JustWatch](https://www.justwatch.com/) through TMDB.

_This product uses the TMDB API but is not endorsed or certified by TMDB._

A hosted copy runs at [watch.whosane.dev](https://watch.whosane.dev) (invite-only for now).

## Develop

```bash
npm ci
cp .dev.vars.example .dev.vars   # local settings for wrangler and vite
npm run db:migrate:local         # create the local D1 tables
npm run dev                      # http://localhost:5173
```

Create an account at `/signup`. Without a `TMDB_TOKEN`, `TMDB_DEMO=1` shows made-up titles
(search for "lighthouse"), which is also what the tests use.

| Command               | What it does                                                 |
| --------------------- | ------------------------------------------------------------ |
| `npm run lint`        | Prettier and ESLint                                          |
| `npm run check`       | Types (svelte-check)                                         |
| `npm test`            | Unit tests (Vitest)                                          |
| `npm run test:e2e`    | End-to-end tests (Playwright, starts the dev server)         |
| `npm run ci:local`    | All of the above, the way CI runs them                       |
| `npm run db:generate` | A new migration after changing `src/lib/server/db/schema.ts` |

## Run your own

You need a Cloudflare account (the free plan is enough to start) and a free
[TMDB API Read Access Token](https://www.themoviedb.org/settings/api).

```bash
npm ci
npx wrangler login
npx wrangler d1 create watch     # prints the new database's id
```

Put that id into `wrangler.jsonc` as `database_id` under `d1_databases`, and set `vars.ORIGIN` to
the address the site will have (for a start, `https://watch.<your-subdomain>.workers.dev`). Then:

```bash
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put BETTER_AUTH_SECRET     # any long random string: openssl rand -base64 32
npx wrangler secret put TMDB_TOKEN
npx wrangler secret put ALLOWED_SIGNUP_EMAILS  # comma-separated emails, or * for anyone
npm run build && npx wrangler deploy
```

Everything else is optional and off until you set it:

| Setting                                    | Adds                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Sign in with Google (redirect URI `{ORIGIN}/api/auth/callback/google`)                                                                                                                     |
| `OMDB_API_KEY`                             | Rotten Tomatoes and Metacritic scores ([omdbapi.com](https://www.omdbapi.com/); the free key allows 1,000 lookups a day)                                                                   |
| `SOURCE_URL`                               | The source repository the About page links, with its commit; set it when you run a fork (default: the upstream repository)                                                                 |
| `EMAIL_FROM` (a var)                       | Password-reset and news emails through [Cloudflare Email Sending](https://developers.cloudflare.com/email-service/); the address must be on a domain onboarded for sending on your account |
| `tools/imdb/`                              | IMDb ratings, loaded nightly from IMDb's non-commercial dataset by a small Python job                                                                                                      |

To keep your own ids and address out of `wrangler.jsonc`, deploy with `scripts/deploy.sh`
instead, which takes them from environment variables (see the top of that file). It suits
Cloudflare Workers Builds: build command `npm run build`, deploy command
`bash scripts/deploy.sh`, and the variables in the build settings.

TMDB's API is free for non-commercial use with the credit the pages already show; a commercial
site needs TMDB's commercial terms.

## Contribute

Issues and pull requests are welcome. Run `npm run ci:local` before opening a pull request; CI
runs the same steps. Keep changes small and say in the description what you checked.

## Licence

[MIT](LICENSE).
