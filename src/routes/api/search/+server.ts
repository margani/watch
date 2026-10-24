import { json } from '@sveltejs/kit';
import { imdbRater } from '#lib/server/for-you.ts';
import { searchTitles, TmdbError } from '#lib/server/tmdb.ts';
import { statusesOnList, warmTitles } from '#lib/server/watchlist.ts';
import type { Suggestion } from '#lib/watch.ts';
import type { RequestHandler } from './$types';

const SHOWN = 6;
/** The likeliest picks are fetched ahead, so opening one doesn't wait for TMDB. */
const WARMED = 3;

// GET ?q=: suggestions under the search box while the viewer types (#28).
export const GET: RequestHandler = async ({ locals, url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	if (q.length < 2) return json({ q, hits: [] });
	let found;
	try {
		found = (await searchTitles(q)).slice(0, SHOWN);
	} catch (e) {
		if (!(e instanceof TmdbError)) throw e;
		return json({ q, hits: [], failed: e.message }, { status: 502 });
	}
	const [rate, statuses] = await Promise.all([
		imdbRater(locals.db, found),
		statusesOnList(locals.db, locals.user!.id)
	]);
	warmTitles(locals.db, found.slice(0, WARMED));
	const hits: Suggestion[] = rate(found).map((h) => ({
		...h,
		imdb: h.imdb && { rating: h.imdb.rating, votes: h.imdb.votes },
		status: statuses.get(`${h.media}:${h.tmdbId}`) ?? null
	}));
	// Not kept by the browser: the statuses would be out of date once the viewer changes their list.
	return json({ q, hits }, { headers: { 'cache-control': 'private, no-store' } });
};
