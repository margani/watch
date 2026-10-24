import { error } from '@sveltejs/kit';
import { isMedia } from '#lib/watch.ts';
import { moveEntry } from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

// POST { to }: the title's new place in its tab, 0 at the top (#21).
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const id = Number(params.id);
	if (!isMedia(params.media) || !Number.isSafeInteger(id) || id < 1) error(404, 'No such title');
	const body = (await request.json().catch(() => null)) as { to?: unknown } | null;
	const to = body?.to;
	if (!Number.isInteger(to) || (to as number) < 0) error(400, 'to is a place from 0');
	if (!(await moveEntry(locals.db, locals.user!.id, params.media, id, to as number)))
		error(404, 'Not on your list');
	return new Response(null, { status: 204 });
};
