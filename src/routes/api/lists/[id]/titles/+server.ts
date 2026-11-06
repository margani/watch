import { error } from '@sveltejs/kit';
import { addToList, removeFromList } from '#lib/server/lists.ts';
import { bodyOf, listIdOf, titleOf } from '#lib/server/list-api.ts';
import { keepTitle } from '#lib/server/watchlist.ts';
import { TmdbError } from '#lib/server/tmdb.ts';
import type { RequestHandler } from './$types';

// PUT { media, tmdbId }: the title goes last on the list (#46). DELETE: off the list.
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const listId = listIdOf(params.id);
	const t = titleOf(await bodyOf(request));
	let titleId: number;
	try {
		titleId = await keepTitle(locals.db, t.media, t.tmdbId);
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
		throw e;
	}
	if (!(await addToList(locals.db, locals.user!.id, listId, titleId))) error(404, 'No such list');
	return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const listId = listIdOf(params.id);
	const t = titleOf(await bodyOf(request));
	if (!(await removeFromList(locals.db, locals.user!.id, listId, t.media, t.tmdbId)))
		error(404, 'No such list');
	return new Response(null, { status: 204 });
};
