import { error, json } from '@sveltejs/kit';
import { TmdbError } from '#lib/server/tmdb.ts';
import { setEpisodes, titleDetails } from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

// PUT { season, episodes: number[], seen }: marks episodes of one season as seen or not.
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const id = Number(params.id);
	if (!Number.isSafeInteger(id) || id < 1) error(404, 'No such series');
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const season = body?.season;
	const episodes = body?.episodes;
	if (!Number.isInteger(season) || (season as number) < 0 || (season as number) > 500)
		error(400, 'season must be a number');
	if (
		!Array.isArray(episodes) ||
		episodes.length > 500 ||
		!episodes.every((e) => Number.isInteger(e) && e >= 0 && e <= 5000)
	)
		error(400, 'episodes must be a list of episode numbers');
	if (typeof body?.seen !== 'boolean') error(400, 'seen must be true or false');
	let details;
	try {
		({ details } = await titleDetails(locals.db, 'tv', id));
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
		throw e;
	}
	return json(
		await setEpisodes(locals.db, locals.user!.id, details, season as number, episodes, body.seen)
	);
};
