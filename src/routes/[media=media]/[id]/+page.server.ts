import { error } from '@sveltejs/kit';
import { isMedia, whereToWatch } from '#lib/watch.ts';
import { ratingsFromOmdb } from '#lib/server/omdb.ts';
import { tmdbDemo, TmdbError } from '#lib/server/tmdb.ts';
import {
	entryFor,
	imdbRatingsFor,
	myServices,
	ownLinks,
	titleDetails,
	watchCountry,
	watchedEpisodes
} from '#lib/server/watchlist.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const id = Number(params.id);
	if (!isMedia(params.media) || !Number.isSafeInteger(id) || id < 1) error(404, 'No such title');
	try {
		const userId = locals.user!.id;
		// Each query waits about as long as D1 takes to answer, so they run at the same time: one
		// after another they kept a title waiting 300-440 ms (#7).
		const [{ details, stale }, country, services, entry, links, watchedEps] = await Promise.all([
			titleDetails(locals.db, params.media, id),
			watchCountry(locals.db, userId),
			myServices(locals.db, userId),
			entryFor(locals.db, userId, params.media, id),
			ownLinks(locals.db, userId),
			params.media === 'tv' ? watchedEpisodes(locals.db, userId, id) : Promise.resolve([])
		]);
		const [otherRatings, imdb] = await Promise.all([
			ratingsFromOmdb(details.imdbId),
			details.imdbId
				? imdbRatingsFor(locals.db, [details.imdbId]).then((r) => r.get(details.imdbId!) ?? null)
				: null
		]);
		const mine = new Set(services.map((p) => p.id));
		return {
			details,
			country,
			where: country ? whereToWatch(details.providers, country, mine) : null,
			hasServices: mine.size > 0,
			otherRatings,
			imdb,
			watchedEpisodes: watchedEps,
			stale,
			entry,
			links,
			demo: tmdbDemo()
		};
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
		throw e;
	}
};
