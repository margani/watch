// Films and series from TMDB. Free for non-commercial use with attribution; no fixed
// rate limit since 2019, only an anti-scraping ceiling around 40 requests a second, so a 429 is
// passed on rather than retried (checked 2026-10-20, developer.themoviedb.org/docs/rate-limiting).
// Without TMDB_TOKEN, deployments with TMDB_DEMO=1 (local, sandbox, tests) get the fictional titles in
// watch-demo.ts; anywhere else the pages say TMDB is not set up, so production never shows made-up titles.
import { env } from 'cloudflare:workers';
import {
	detailsFromTmdb,
	hitFromTmdb,
	partsFromTmdb,
	providerList,
	seasonFromTmdb,
	type CollectionPart,
	type Provider,
	type SeasonEpisode,
	type Media,
	type TitleDetails,
	type TitleHit
} from '#lib/watch.ts';
import {
	demoCollection,
	demoDetails,
	demoDiscover,
	demoImdbId,
	DEMO_PROVIDERS,
	DEMO_REGIONS,
	demoSearch,
	demoSeason
} from './watch-demo.ts';

const BASE = 'https://api.themoviedb.org/3';

export class TmdbError extends Error {
	constructor(
		readonly code: 'unavailable' | 'not-found' | 'not-configured',
		message: string
	) {
		super(message);
	}
}

/** True when TMDB itself answers. */
export const tmdbLive = () => !!env.TMDB_TOKEN;
/** True when the titles come from the demo catalogue rather than TMDB. */
export const tmdbDemo = () => !env.TMDB_TOKEN && env.TMDB_DEMO === '1';

function notConfigured() {
	return new TmdbError(
		'not-configured',
		'Films and series are not set up here: the TMDB_TOKEN secret is missing.'
	);
}

async function get(path: string, params: Record<string, string> = {}) {
	const url = new URL(BASE + path);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	let res: Response;
	try {
		res = await fetch(url, {
			headers: { authorization: `Bearer ${env.TMDB_TOKEN}`, accept: 'application/json' },
			signal: AbortSignal.timeout(8000)
		});
	} catch {
		throw new TmdbError('unavailable', 'TMDB did not answer in time.');
	}
	if (res.status === 404) throw new TmdbError('not-found', 'TMDB has no such title.');
	if (!res.ok) throw new TmdbError('unavailable', `TMDB answered ${res.status}.`);
	return (await res.json()) as Record<string, unknown>;
}

export async function searchTitles(query: string): Promise<TitleHit[]> {
	if (tmdbDemo()) return demoSearch(query);
	if (!tmdbLive()) throw notConfigured();
	const r = await get('/search/multi', { query, include_adult: 'false', page: '1' });
	const rows = Array.isArray(r.results) ? (r.results as Record<string, unknown>[]) : [];
	return rows.map((row) => hitFromTmdb(row)).filter((h): h is TitleHit => !!h);
}

export async function fetchDetails(media: Media, tmdbId: number): Promise<TitleDetails> {
	if (tmdbDemo()) {
		const d = demoDetails(media, tmdbId);
		if (!d) throw new TmdbError('not-found', 'No such demo title.');
		return d;
	}
	if (!tmdbLive()) throw notConfigured();
	const r = await get(`/${media}/${tmdbId}`, {
		// watch/providers: where it streams, by country, from JustWatch through TMDB.
		append_to_response:
			media === 'movie'
				? 'credits,watch/providers'
				: 'aggregate_credits,external_ids,watch/providers'
	});
	const d = detailsFromTmdb(media, r);
	if (!d) throw new TmdbError('not-found', 'TMDB has no such title.');
	return d;
}

/**
 * The streaming services in a country, films' and series' together, in TMDB's order: what
 * a viewer picks their own from.
 */
export async function servicesIn(country: string): Promise<Provider[]> {
	if (tmdbDemo()) return DEMO_PROVIDERS;
	if (!tmdbLive()) throw notConfigured();
	const [movie, tv] = await Promise.all(
		(['movie', 'tv'] as const).map((m) => get(`/watch/providers/${m}`, { watch_region: country }))
	);
	return providerList([
		...(Array.isArray(movie.results) ? movie.results : []),
		...(Array.isArray(tv.results) ? tv.results : [])
	]);
}

/** Countries TMDB has streaming data for, by English name. */
export async function watchRegions(): Promise<{ code: string; name: string }[]> {
	if (tmdbDemo()) return DEMO_REGIONS;
	if (!tmdbLive()) throw notConfigured();
	const r = await get('/watch/providers/regions');
	return (Array.isArray(r.results) ? (r.results as Record<string, unknown>[]) : [])
		.map((x) => ({ code: String(x.iso_3166_1 ?? ''), name: String(x.english_name ?? '') }))
		.filter((x) => /^[A-Z]{2}$/.test(x.code) && x.name)
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** One season's episodes of a series. */
export async function fetchSeason(tmdbId: number, season: number): Promise<SeasonEpisode[]> {
	if (tmdbDemo()) {
		const eps = demoSeason(tmdbId, season);
		if (!eps) throw new TmdbError('not-found', 'No such demo season.');
		return eps;
	}
	if (!tmdbLive()) throw notConfigured();
	return seasonFromTmdb(await get(`/tv/${tmdbId}/season/${season}`));
}

/**
 * Titles streaming on any of the given services in a country: TMDB's discover, with "|"
 * between providers meaning any of them. `popular` sorts by popularity; `rated` by rating, with a
 * higher vote floor so a few fans do not put a title on top.
 */
export async function discoverTitles(
	media: Media,
	q: { country: string; providers: number[]; order: 'popular' | 'rated' }
): Promise<TitleHit[]> {
	if (tmdbDemo()) return demoDiscover(media, q.country, q.providers, q.order);
	if (!tmdbLive()) throw notConfigured();
	if (!q.providers.length) return [];
	const r = await get(`/discover/${media}`, {
		watch_region: q.country,
		with_watch_providers: q.providers.join('|'),
		with_watch_monetization_types: 'flatrate|free|ads',
		sort_by: q.order === 'popular' ? 'popularity.desc' : 'vote_average.desc',
		'vote_count.gte': q.order === 'popular' ? '100' : '1000',
		include_adult: 'false',
		page: '1'
	});
	const rows = Array.isArray(r.results) ? (r.results as Record<string, unknown>[]) : [];
	return rows.map((row) => hitFromTmdb(row, media)).filter((h): h is TitleHit => !!h);
}

/** The films of a collection, oldest first. */
export async function collectionParts(id: number): Promise<CollectionPart[]> {
	if (tmdbDemo()) return demoCollection(id);
	if (!tmdbLive()) throw notConfigured();
	return partsFromTmdb(await get(`/collection/${id}`));
}

/** A title's IMDb id, for search and discover results, which do not carry it. */
export async function imdbIdOf(media: Media, tmdbId: number): Promise<string | null> {
	if (tmdbDemo()) return demoImdbId(media, tmdbId);
	if (!tmdbLive()) throw notConfigured();
	const r = await get(`/${media}/${tmdbId}/external_ids`);
	return typeof r.imdb_id === 'string' && /^tt\d+$/.test(r.imdb_id) ? r.imdb_id : null;
}
