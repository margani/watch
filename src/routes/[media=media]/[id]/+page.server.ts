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
		const { details, stale } = await titleDetails(locals.db, params.media, id);
		const userId = locals.user!.id;
		const country = await watchCountry(locals.db, userId);
		const mine = new Set((await myServices(locals.db, userId)).map((p) => p.id));
		return {
			details,
			country,
			where: country ? whereToWatch(details.providers, country, mine) : null,
			hasServices: mine.size > 0,
			otherRatings: await ratingsFromOmdb(details.imdbId),
			imdb: details.imdbId
				? ((await imdbRatingsFor(locals.db, [details.imdbId])).get(details.imdbId) ?? null)
				: null,
			watchedEpisodes: params.media === 'tv' ? await watchedEpisodes(locals.db, userId, id) : [],
			stale,
			entry: await entryFor(locals.db, userId, params.media, id),
			links: await ownLinks(locals.db, userId),
			demo: tmdbDemo()
		};
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
		throw e;
	}
};
