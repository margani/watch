import { error } from '@sveltejs/kit';
import { markNewsSeen } from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

// Clears the viewer's news on the list: { ids: number[] } clears those items, no body all of it.
export const POST: RequestHandler = async ({ locals, request }) => {
	const text = await request.text();
	let ids: number[] | undefined;
	if (text) {
		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			error(400, 'Not JSON');
		}
		const raw = (body as { ids?: unknown } | null)?.ids;
		if (
			!Array.isArray(raw) ||
			raw.length > 100 ||
			!raw.every((n) => Number.isInteger(n) && (n as number) > 0)
		)
			error(400, 'ids must be a list of item numbers');
		ids = raw as number[];
	}
	await markNewsSeen(locals.db, locals.user!.id, ids);
	return new Response(null, { status: 204 });
};
