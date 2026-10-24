#!/usr/bin/env bash
# Deploys to Cloudflare with this instance's own settings taken from the environment, so none of
# them live in the repo. Used as the deploy command of Cloudflare Workers Builds:
#
#   WATCH_WORKER=watch WATCH_D1_NAME=watch WATCH_D1_ID=… WATCH_ORIGIN=https://watch.example.com \
#   [WATCH_DOMAIN=watch.example.com] [WATCH_EMAIL_FROM=noreply@mail.example.com] \
#   [WATCH_BRANCH=main] [WATCH_NO_CRON=1] [WATCH_DEMO=1] bash scripts/deploy.sh
#
# WATCH_BRANCH refuses a build of any other branch (a sandbox build must never deploy over
# production). WATCH_DEMO=1 shows made-up titles, for a sandbox without a TMDB token.
set -euo pipefail
: "${WATCH_WORKER:?}" "${WATCH_D1_NAME:?}" "${WATCH_D1_ID:?}" "${WATCH_ORIGIN:?}"
if [ -n "${WATCH_BRANCH:-}" ] && [ "${WORKERS_CI:-}" = 1 ] && [ "${WORKERS_CI_BRANCH:-}" != "$WATCH_BRANCH" ]; then
  echo "refusing: this Worker deploys only from '$WATCH_BRANCH', this build is '${WORKERS_CI_BRANCH:-?}'" >&2
  exit 1
fi
config=wrangler.deploy.jsonc
node - "$config" <<'JS'
const fs = require('node:fs');
const strip = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1');
const c = JSON.parse(strip(fs.readFileSync('wrangler.jsonc', 'utf8')));
const e = process.env;
c.name = e.WATCH_WORKER;
c.d1_databases[0].database_name = e.WATCH_D1_NAME;
c.d1_databases[0].database_id = e.WATCH_D1_ID;
c.vars = { ...c.vars, ORIGIN: e.WATCH_ORIGIN };
if (e.WATCH_EMAIL_FROM) c.vars.EMAIL_FROM = e.WATCH_EMAIL_FROM;
if (e.WATCH_DEMO === '1') c.vars.TMDB_DEMO = '1';
if (e.WATCH_NO_CRON === '1') c.triggers = { crons: [] };
if (e.WATCH_DOMAIN) {
	c.routes = [{ pattern: e.WATCH_DOMAIN, custom_domain: true }];
	c.workers_dev = false;
}
c.preview_urls = false;
fs.writeFileSync(process.argv[2], JSON.stringify(c, null, '\t'));
JS
# Migrations first: a column nothing reads yet is harmless, a query against a missing column is not.
npx wrangler d1 migrations apply DB --remote --config "$config"
log=$(mktemp)
npx wrangler deploy --config "$config" 2>&1 | tee "$log"
grep -q "Uploaded $WATCH_WORKER " "$log" || { echo "expected to deploy $WATCH_WORKER" >&2; exit 1; }
want=${WORKERS_CI_COMMIT_SHA:-$(git rev-parse HEAD)}
# A custom domain's first deploy creates its DNS record, which took over a minute to resolve on
# the first production deploy, so the check waits up to three minutes.
for _ in $(seq 1 36); do
  got=$(curl -fsS "$WATCH_ORIGIN/version" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).commit))' || true)
  [ "$got" = "$want" ] && { echo "Live: $got"; exit 0; }
  sleep 5
done
echo "$WATCH_ORIGIN/version reports '$got', expected $want" >&2; exit 1
