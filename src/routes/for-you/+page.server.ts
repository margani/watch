import { forYou } from '#lib/server/for-you.ts';
import { tmdbDemo } from '#lib/server/tmdb.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	...(await forYou(locals.db, locals.user!.id)),
	demo: tmdbDemo()
});
