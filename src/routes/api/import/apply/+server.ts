import { error, json } from '@sveltejs/kit';
import { episodeNumber } from '#lib/watch-import.ts';
import { TmdbError } from '#lib/server/tmdb.ts';
import {
	entryFor,
	seasonEpisodes,
	setEntry,
	setEpisodes,
	titleDetails
} from '#lib/server/watchlist.ts';
import type { RequestHandler } from './$types';

// POST one matched title from an imported history: a film becomes Watched (on the date it
// was seen); a series gets the episodes whose names match TMDB's, season by season.
//   { media: 'movie', tmdbId, date? }  or  { media: 'tv', tmdbId, seasons: [{ season, names }] }
export const POST: RequestHandler = async ({ locals, request }) => {
	const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const id = b?.tmdbId;
	if (
		!b ||
		(b.media !== 'movie' && b.media !== 'tv') ||
		!Number.isSafeInteger(id) ||
		(id as number) < 1
	)
		error(400, 'media and tmdbId are needed');
	const userId = locals.user!.id;
	try {
		const { details } = await titleDetails(locals.db, b.media, id as number);
		if (b.media === 'movie') {
			const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
			await setEntry(locals.db, userId, details, {
				status: 'watched',
				watchedAt: date ? new Date(`${date}T12:00:00Z`) : undefined
			});
			return json({ films: 1 });
		}
		const seasons = b.seasons;
		if (
			!Array.isArray(seasons) ||
			seasons.length > 100 ||
			!seasons.every(
				(s) =>
					Number.isInteger(s?.season) &&
					Array.isArray(s.names) &&
					s.names.length <= 500 &&
					s.names.every((n: unknown) => typeof n === 'string' && n.length <= 300)
			)
		)
			error(400, 'seasons: [{ season, names }]');
		let matched = 0;
		let unmatched = 0;
		for (const { season, names } of seasons as { season: number; names: string[] }[]) {
			const list = await seasonEpisodes(locals.db, id as number, season).catch((e) => {
				if (e instanceof TmdbError && e.code === 'not-found') return [];
				throw e;
			});
			const numbers = [
				...new Set(names.map((n) => episodeNumber(n, list)).filter((n) => n != null))
			];
			unmatched += names.length - names.filter((n) => episodeNumber(n, list) != null).length;
			matched += numbers.length;
			if (numbers.length) await setEpisodes(locals.db, userId, details, season, numbers, true);
		}
		// A series with no episode matched still goes on the list, as being watched, unless it is on it.
		if (!matched && !(await entryFor(locals.db, userId, 'tv', id as number)))
			await setEntry(locals.db, userId, details, { status: 'watching' });
		return json({ episodes: matched, unmatched });
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-found' ? 404 : 503, e.message);
		throw e;
	}
};
