import { error, json } from '@sveltejs/kit';
import { isMedia, isWatchStatus, RATING_MAX } from '#lib/watch.ts';
import { TmdbError } from '#lib/server/tmdb.ts';
import { removeEntry, setEntry, titleDetails } from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

// The viewer's own list: PUT { status?, rating? } adds the title or changes it, DELETE
// takes it off the list.
function target(params: { media: string; id: string }) {
	const id = Number(params.id);
	if (!isMedia(params.media) || !Number.isSafeInteger(id) || id < 1) error(404, 'No such title');
	return { media: params.media, id };
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const { media, id } = target(params);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const status = body?.status;
	const rating = body?.rating;
	if (status !== undefined && !isWatchStatus(status)) error(400, 'Unknown status');
	if (
		rating !== undefined &&
		rating !== null &&
		!(Number.isInteger(rating) && (rating as number) >= 1 && (rating as number) <= RATING_MAX)
	)
		error(400, `A rating is a whole number from 1 to ${RATING_MAX}`);
	let details;
	try {
		({ details } = await titleDetails(locals.db, media, id));
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
		throw e;
	}
	const entry = await setEntry(locals.db, locals.user!.id, details, {
		status,
		rating: rating as number | null | undefined
	});
	return json(entry);
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const { media, id } = target(params);
	await removeEntry(locals.db, locals.user!.id, media, id);
	return new Response(null, { status: 204 });
};
