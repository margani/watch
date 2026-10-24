import { json } from '@sveltejs/kit';
import { exportData } from '#lib/server/account.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const day = new Date().toISOString().slice(0, 10);
	return json(await exportData(locals.db, locals.user!.id), {
		headers: { 'content-disposition': `attachment; filename="watch-${day}.json"` }
	});
};
