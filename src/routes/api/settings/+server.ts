import { error } from '@sveltejs/kit';
import { setEmailsNews } from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

// PUT { emailNews: boolean }: whether news on the watchlist also comes by email.
export const PUT: RequestHandler = async ({ locals, request }) => {
	const body = (await request.json().catch(() => null)) as { emailNews?: unknown } | null;
	if (typeof body?.emailNews !== 'boolean') error(400, 'emailNews must be true or false');
	await setEmailsNews(locals.db, locals.user!.id, body.emailNews);
	return new Response(null, { status: 204 });
};
