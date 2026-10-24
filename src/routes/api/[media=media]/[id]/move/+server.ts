import { error } from '@sveltejs/kit';
import { isMedia } from '#lib/watch.ts';
import { moveEntry, type Move } from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

const MOVES: readonly Move[] = ['top', 'up', 'down'];

// POST { move: 'top' | 'up' | 'down' }: the viewer's own order within a tab of their list (#21).
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const id = Number(params.id);
	if (!isMedia(params.media) || !Number.isSafeInteger(id) || id < 1) error(404, 'No such title');
	const body = (await request.json().catch(() => null)) as { move?: unknown } | null;
	const move = body?.move as Move;
	if (!MOVES.includes(move)) error(400, 'move is top, up or down');
	if (!(await moveEntry(locals.db, locals.user!.id, params.media, id, move)))
		error(404, 'Not on your list');
	return new Response(null, { status: 204 });
};
