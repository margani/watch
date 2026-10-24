import { error, json } from '@sveltejs/kit';
import { isMedia, type Suggestion, type TitleHit } from '#lib/watch.ts';
import { imdbRater } from '#lib/server/for-you.ts';
import { moreTitles } from '#lib/server/related.ts';
import { TmdbError } from '#lib/server/tmdb.ts';
import { statusesOnList, titleDetails } from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

// GET: the title page's Related and More like this rows (#31). Asked after the page shows, so
// Wikidata and the lookups it needs never hold the page up.
export const GET: RequestHandler = async ({ locals, params }) => {
	const id = Number(params.id);
	if (!isMedia(params.media) || !Number.isSafeInteger(id) || id < 1) error(404, 'No such title');
	let more;
	try {
		const { details } = await titleDetails(locals.db, params.media, id);
		more = await moreTitles(params.media, id, details.collection?.id ?? null);
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
		throw e;
	}
	const [rate, statuses] = await Promise.all([
		imdbRater(locals.db, [...more.related, ...more.similar]),
		statusesOnList(locals.db, locals.user!.id)
	]);
	const rich = (list: TitleHit[]): Suggestion[] =>
		rate(list).map((h) => ({
			...h,
			imdb: h.imdb && { rating: h.imdb.rating, votes: h.imdb.votes },
			status: statuses.get(`${h.media}:${h.tmdbId}`) ?? null
		}));
	// Not kept by the browser: the statuses change with the viewer's list.
	return json(
		{ related: rich(more.related), similar: rich(more.similar) },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
