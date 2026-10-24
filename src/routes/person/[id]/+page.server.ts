import { error } from '@sveltejs/kit';
import { PERSON_KINDS, type PersonKind } from '#lib/watch.ts';
import { cached } from '#lib/server/cache.ts';
import { imdbRater } from '#lib/server/for-you.ts';
import { fetchPerson, tmdbDemo, TmdbError } from '#lib/server/tmdb.ts';
import { statusesOnList, warmTitles } from '#lib/server/watchlist.ts';
import type { PageServerLoad } from './$types';

/** IMDb ratings for the best-known credits only: each new one costs TMDB a lookup. */
const RATED = 40;

// A person's page (#18, #20): everything they acted in, directed or composed, on the list or not.
export const load: PageServerLoad = async ({ locals, params }) => {
	const id = Number(params.id);
	if (!Number.isSafeInteger(id) || id < 1) error(404, 'No such person');
	try {
		const [person, onList] = await Promise.all([
			tmdbDemo() ? fetchPerson(id) : cached(`tmdb/person/${id}`, 24 * 3600, () => fetchPerson(id)),
			statusesOnList(locals.db, locals.user!.id)
		]);
		const best = [...person.credits].sort((a, b) => b.votes - a.votes);
		const rate = await imdbRater(locals.db, best.slice(0, RATED));
		warmTitles(locals.db, best);
		const kinds = PERSON_KINDS.filter((k) => person.credits.some((c) => c.kind === k));
		const open: PersonKind | undefined =
			person.knownFor && kinds.includes(person.knownFor) ? person.knownFor : kinds[0];
		return {
			person: {
				...person,
				credits: rate(person.credits).map((c) => ({
					...c,
					status: onList.get(`${c.media}:${c.tmdbId}`) ?? null
				}))
			},
			kinds,
			open: open ?? null,
			demo: tmdbDemo()
		};
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
		throw e;
	}
};
