// The For you page: what is new for titles on the viewer's list, and what is popular or
// well rated on the services they chose that they have not listed yet.
import { newerParts, type CollectionPart, type Media, type TitleHit } from '#lib/watch.ts';
import { cached } from './cache.ts';
import type { Db } from './db';
import { collectionParts, discoverTitles, imdbIdOf, TmdbError } from './tmdb.ts';
import {
	allEntries,
	imdbRatingsFor,
	myServices,
	unseenNews,
	watchCountry,
	type ImdbRating
} from './watchlist.ts';

const HOUR = 3600;

// A long list must not turn one page view into dozens of TMDB requests.
const MAX_COLLECTIONS = 15;
const PER_ROW = 12;

export async function forYou(db: Db, userId: string) {
	const [country, services, entries, news] = await Promise.all([
		watchCountry(db, userId),
		myServices(db, userId),
		allEntries(db, userId),
		unseenNews(db, userId)
	]);
	const listed = new Set(entries.map((e) => `${e.details.media}:${e.details.tmdbId}`));
	const onListFilms = new Set(
		entries.filter((e) => e.details.media === 'movie').map((e) => e.details.tmdbId)
	);
	const notListed = (h: TitleHit) => !listed.has(`${h.media}:${h.tmdbId}`);
	let failed = false;

	// Newer films in the collections of films the viewer has seen or is watching.
	const seen = entries.filter(
		(e) => e.details.media === 'movie' && e.status !== 'want' && e.details.collection
	);
	const newer = new Map<number, CollectionPart & { after: string }>();
	for (const e of seen.slice(0, MAX_COLLECTIONS)) {
		const c = e.details.collection!;
		try {
			const parts = await cached(`collection/${c.id}`, 24 * HOUR, () => collectionParts(c.id));
			for (const p of newerParts(e.details, parts, onListFilms))
				if (!newer.has(p.tmdbId)) newer.set(p.tmdbId, { ...p, after: e.details.title });
		} catch (err) {
			if (!(err instanceof TmdbError)) throw err;
			failed = true;
		}
	}

	const providers = services.map((s) => s.id).sort((a, b) => a - b);
	const row = async (media: Media, order: 'popular' | 'rated') => {
		if (!country || !providers.length) return [];
		try {
			const hits = await cached(
				`discover/${media}/${order}/${country}/${providers.join(',')}`,
				6 * HOUR,
				() => discoverTitles(media, { country, providers, order })
			);
			return hits.filter(notListed).slice(0, PER_ROW);
		} catch (err) {
			if (!(err instanceof TmdbError)) throw err;
			failed = true;
			return [];
		}
	};
	const [popularTv, popularFilms, ratedTv, ratedFilms] = await Promise.all([
		row('tv', 'popular'),
		row('movie', 'popular'),
		row('tv', 'rated'),
		row('movie', 'rated')
	]);
	// IMDb's rating on every suggestion: the id comes from TMDB (kept a month), the rating
	// from the nightly copy of IMDb's dataset.
	const shown = [...newer.values(), ...popularTv, ...popularFilms, ...ratedTv, ...ratedFilms];
	const ids = new Map<string, string | null>();
	await Promise.all(
		[...new Map(shown.map((h) => [`${h.media}:${h.tmdbId}`, h])).values()].map(async (h) => {
			const id = await cached(`imdb/${h.media}/${h.tmdbId}`, 30 * 24 * HOUR, () =>
				imdbIdOf(h.media, h.tmdbId)
			).catch(() => null);
			ids.set(`${h.media}:${h.tmdbId}`, id);
		})
	);
	const ratings = await imdbRatingsFor(db, [...ids.values()]);
	const rate = <T extends TitleHit>(list: T[]): (T & { imdb: ImdbRating | null })[] =>
		list.map((h) => {
			const id = ids.get(`${h.media}:${h.tmdbId}`);
			return { ...h, imdb: (id && ratings.get(id)) || null };
		});
	return {
		country,
		services,
		news,
		newer: rate([...newer.values()]),
		popularTv: rate(popularTv),
		popularFilms: rate(popularFilms),
		ratedTv: rate(ratedTv),
		ratedFilms: rate(ratedFilms),
		failed
	};
}
