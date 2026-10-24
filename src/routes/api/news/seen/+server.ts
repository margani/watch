import { markNewsSeen } from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

// Clears the viewer's news on the list.
export const POST: RequestHandler = async ({ locals }) => {
	await markNewsSeen(locals.db, locals.user!.id);
	return new Response(null, { status: 204 });
};
