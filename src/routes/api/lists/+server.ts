import { error, json } from '@sveltejs/kit';
import { addToList, createList, listName } from '#lib/server/lists.ts';
import { bodyOf, titleOf } from '#lib/server/list-api.ts';
import { keepTitle } from '#lib/server/watchlist.ts';
import { TmdbError } from '#lib/server/tmdb.ts';
import type { Media } from '#lib/watch.ts';
import type { RequestHandler } from './$types';

// POST { name, add? }: a new list of the viewer's own (#46), with this title on it already when
// made from a title page.
export const POST: RequestHandler = async ({ locals, request }) => {
	const kept = (media: Media, tmdbId: number) =>
		keepTitle(locals.db, media, tmdbId).catch((e) => {
			if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
			throw e;
		});
	const body = await bodyOf(request);
	const name = listName(body.name);
	if (!name) error(400, 'A list needs a name of up to 80 characters');
	const add = body.add === undefined ? null : titleOf(body.add);
	const userId = locals.user!.id;
	// The title first: if TMDB can't give it, no half-made list is left behind.
	const titleId = add ? await kept(add.media, add.tmdbId) : null;
	const id = await createList(locals.db, userId, name);
	if (titleId) await addToList(locals.db, userId, id, titleId);
	return json({ id, name }, { status: 201 });
};
