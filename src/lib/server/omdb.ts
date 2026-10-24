// Other ratings for a title page: Rotten Tomatoes and Metacritic from OMDb, by IMDb id.
// Free key, 1,000 requests a day, so answers are kept a week. IMDb's own rating comes from its
// dataset (imdb_ratings), not from here. Without OMDB_API_KEY nothing is shown.
import { env } from 'cloudflare:workers';
import { cached } from './cache.ts';

export interface OtherRating {
	source: string;
	value: string;
}

/** OMDb's Ratings without IMDb's: [{ Source, Value }] → [{ source, value }]. */
export function otherRatings(body: unknown): OtherRating[] {
	const ratings = (body as { Ratings?: unknown } | null)?.Ratings;
	if (!Array.isArray(ratings)) return [];
	return ratings
		.map((r) => ({ source: String(r?.Source ?? ''), value: String(r?.Value ?? '') }))
		.filter(
			(r) => r.source && r.value && r.value !== 'N/A' && r.source !== 'Internet Movie Database'
		);
}

export async function ratingsFromOmdb(imdbId: string | null): Promise<OtherRating[]> {
	const key = (env as { OMDB_API_KEY?: string }).OMDB_API_KEY;
	if (!key || !imdbId || !/^tt\d+$/.test(imdbId)) return [];
	return cached(`omdb/${imdbId}`, 7 * 24 * 3600, async () => {
		const res = await fetch(
			`https://www.omdbapi.com/?apikey=${encodeURIComponent(key)}&i=${imdbId}`,
			{
				signal: AbortSignal.timeout(6000)
			}
		);
		if (!res.ok) throw new Error(`OMDb answered ${res.status}`);
		return otherRatings(await res.json());
	}).catch(() => []);
}
