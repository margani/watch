import { imdbRater } from '#lib/server/for-you.ts';
import { searchTitles, tmdbDemo, TmdbError } from '#lib/server/tmdb.ts';
import { warmTitles, type ImdbRating } from '#lib/server/watchlist.ts';
import type { TitleHit } from '#lib/watch.ts';
import type { PageServerLoad } from './$types';

type Rated = TitleHit & { imdb: ImdbRating | null };

export const load: PageServerLoad = async ({ locals, url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	if (!q) return { q, hits: [] as Rated[], failed: null, demo: tmdbDemo() };
	try {
		const hits = await searchTitles(q);
		// Choosing between results shouldn't mean opening each one (#10).
		const rate = await imdbRater(locals.db, hits);
		warmTitles(locals.db, hits);
		return { q, hits: rate(hits), failed: null, demo: tmdbDemo() };
	} catch (e) {
		if (!(e instanceof TmdbError)) throw e;
		return { q, hits: [] as Rated[], failed: e.message, demo: tmdbDemo() };
	}
};
