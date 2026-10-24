import { error, json } from '@sveltejs/kit';
import { TmdbError } from '#lib/server/tmdb.ts';
import { seasonEpisodes } from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

// GET: one season's episodes of a series, opened on its page.
export const GET: RequestHandler = async ({ locals, params }) => {
	const id = Number(params.id);
	const n = Number(params.n);
	if (!Number.isSafeInteger(id) || id < 1 || !Number.isInteger(n) || n < 0 || n > 500)
		error(404, 'No such season');
	try {
		return json({ episodes: await seasonEpisodes(locals.db, id, n) });
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
		throw e;
	}
};
