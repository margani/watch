# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner and a few invited people (friends and family) keeping track of the films and series
they want to watch, are watching and have seen, mostly on the phone, also on desktop. A secondary
audience is anyone who runs their own copy of the open-source app for themselves.

## Product Purpose

One private list of films and series in three tabs (want to watch, watching, watched), with
episodes ticked off season by season, news when a followed series gets a new episode or a wanted
film is released, and where each title can be watched on the services the user has. Success is
that the user opens the app, sees what to watch next and where, and keeps the list up to date
without effort.

## Positioning

Private and self-hostable: lists belong to their owner only, there is no social feed, followers
or public profile. The code is open source, anyone can run their own copy, and users can download
all their data or delete their account at any time. Neighbouring products (Letterboxd, TV Time)
are social and hosted; watch is neither.

## Operating Context

- Quick checks on the phone (installable PWA): add a title from search, tick an episode, see
  what is new.
- Longer sessions on desktop: ordering a tab, importing a Netflix viewing-history file (read in
  the browser), choosing streaming services and country.
- News arrives on the list and, if the user wants, by email.
- Invite-only sign-up on hosted instances; email + password, Google when the instance has it.

## Capabilities and Constraints

- Film and series data from TMDB; where-to-watch from JustWatch through TMDB. Both must be
  credited wherever their data shows. IMDb, Rotten Tomatoes and Metacritic ratings when the
  instance configures them.
- "For you": newer films in collections the user has started, popular titles on their services.
- The user's own links on every title page; own order within each tab; 1–10 ratings.
- Every feature that needs a key or service is optional; without it the page says what is
  missing instead of failing. Only a TMDB token (or demo titles) is needed to run.
- Nothing about one particular instance (domains, ids, people) belongs in the product itself.
- Stack: SvelteKit (Svelte 5), Tailwind CSS 4, Cloudflare Workers + D1.

## Brand Commitments

- Name: Watch.
- Voice: plain, short English sentences that say what happens and what is missing.
- The required "This product uses the TMDB API but is not endorsed or certified by TMDB" notice
  and the TMDB logo (`static/credits/tmdb.svg`).

## Evidence on Hand

- Made-up demo titles for tests and screenshots (`src/lib/server/watch-demo.ts`, `TMDB_DEMO=1`).
  Never use real users' lists.
- No testimonials, user counts or press exist; do not invent any.

## Product Principles

1. Private by default: nothing a user keeps is visible to anyone else.
2. The list is the product: getting to "what next, and where" beats browsing.
3. Optional, never broken: a missing key or service is explained, not an error.
4. The user owns their data: export and delete are always one step away.
5. Credit the sources the data comes from.
