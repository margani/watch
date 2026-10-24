#!/usr/bin/env bash
# The whole test job, on this machine: `npm run ci:local`. GitHub Actions runs the same steps
# (.github/workflows/ci.yml).
set -euo pipefail
cd "$(dirname "$0")/.."
# Playwright reuses whatever answers on 5173, so a stale dev server would be tested instead of this tree.
if ss -ltn "sport = :5173" | grep -q LISTEN; then echo "port 5173 is in use; stop that server first" >&2; exit 1; fi
# The tests use made-up titles, so a .dev.vars with real keys is set aside and put back after.
saved=
if [ -f .dev.vars ]; then saved=$(mktemp); cp .dev.vars "$saved"; fi
cleanup() { if [ -n "$saved" ]; then mv "$saved" .dev.vars; else rm -f .dev.vars; fi; }
trap cleanup EXIT
cp .dev.vars.example .dev.vars
step() { printf '\n=== %s\n' "$1"; }
step Lint; npm run lint
step 'Type check'; npm run check
step 'Unit tests'; npm test
step 'IMDb loader tests'; python3 -m unittest discover -s tools/imdb
step Build; npm run build
step 'Local database'; npm run db:migrate:local
step 'End-to-end tests'; npm run test:e2e
# The service worker exists only in production builds, so installing, the update flow (#4, which
# rebuilds mid-test) and the device copy of page data (#7) run against the built Worker under `wrangler dev`.
step 'Install and update against the built Worker'
if ss -ltn "sport = :4173" | grep -q LISTEN; then echo "port 4173 is in use; stop that server first" >&2; exit 1; fi
WRANGLER_SEND_METRICS=false setsid npx wrangler dev --port 4173 > .wrangler/ci-local-wrangler.log 2>&1 &
wrangler_pid=$!
trap 'kill -- -$wrangler_pid; cleanup' EXIT
for _ in $(seq 1 90); do curl -sf -o /dev/null http://localhost:4173/version && break; sleep 1; done
E2E_BASE_URL=http://localhost:4173 npx playwright test e2e/install.test.ts e2e/speed.test.ts
step "All checks passed on $(git rev-parse --short HEAD 2>/dev/null || echo 'no commit')$(git diff --quiet HEAD 2>/dev/null || echo ' (with uncommitted changes)')"
