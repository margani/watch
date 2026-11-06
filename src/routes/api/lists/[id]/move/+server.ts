import { error } from '@sveltejs/kit';
import { moveInList } from '#lib/server/lists.ts';
import { bodyOf, listIdOf, titleOf } from '#lib/server/list-api.ts';
import type { RequestHandler } from './$types';

// POST { media, tmdbId, to }: the title's new place on the list, 0 being the first to watch (#46).
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const listId = listIdOf(params.id);
	const body = await bodyOf(request);
	const t = titleOf(body);
	if (!Number.isInteger(body.to) || (body.to as number) < 0) error(400, 'to is a place from 0');
	if (!(await moveInList(locals.db, locals.user!.id, listId, t.media, t.tmdbId, body.to as number)))
		error(404, 'Not on this list');
	return new Response(null, { status: 204 });
};
