import { searchTitles, tmdbDemo, TmdbError } from '#lib/server/tmdb.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	if (!q) return { q, hits: [], failed: null, demo: tmdbDemo() };
	try {
		return { q, hits: await searchTitles(q), failed: null, demo: tmdbDemo() };
	} catch (e) {
		if (!(e instanceof TmdbError)) throw e;
		return { q, hits: [], failed: e.message, demo: tmdbDemo() };
	}
};
