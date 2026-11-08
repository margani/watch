// The matrix of IMDb ratings on a series page (#52): seasons across, episodes down.

export interface EpisodeRating {
	season: number;
	episode: number;
	imdbId: string;
	rating: number;
	votes: number;
}

export const RATING_BANDS = [
	{ band: 'awesome', label: 'Awesome', from: 9 },
	{ band: 'great', label: 'Great', from: 8 },
	{ band: 'good', label: 'Good', from: 7 },
	{ band: 'average', label: 'Average', from: 6 },
	{ band: 'bad', label: 'Bad', from: 5 },
	{ band: 'garbage', label: 'Garbage', from: 0 }
] as const;

export type RatingBand = (typeof RATING_BANDS)[number]['band'];

export const ratingBand = (rating: number): RatingBand =>
	RATING_BANDS.find((b) => rating >= b.from)?.band ?? 'garbage';

export interface RatingsMatrix {
	seasons: number[];
	rows: { episode: number; cells: (EpisodeRating | null)[] }[];
	/** Each season's mean over its rated episodes, to one decimal, in `seasons` order. */
	averages: number[];
}

const ascending = (a: number, b: number) => a - b;

/** Only numbers that have a rating get a column or a row: some series number seasons by year. */
export function ratingsMatrix(ratings: EpisodeRating[]): RatingsMatrix | null {
	if (!ratings.length) return null;
	const byPlace = new Map<string, EpisodeRating>();
	for (const r of ratings) {
		const key = `${r.season}:${r.episode}`;
		const other = byPlace.get(key);
		// IMDb sometimes numbers two ids the same; the one people rated is the real episode.
		if (!other || r.votes > other.votes) byPlace.set(key, r);
	}
	const kept = [...byPlace.values()];
	const seasons = [...new Set(kept.map((r) => r.season))].sort(ascending);
	const episodes = [...new Set(kept.map((r) => r.episode))].sort(ascending);
	return {
		seasons,
		rows: episodes.map((episode) => ({
			episode,
			cells: seasons.map((season) => byPlace.get(`${season}:${episode}`) ?? null)
		})),
		averages: seasons.map((season) => {
			const own = kept.filter((r) => r.season === season);
			return Math.round((own.reduce((sum, r) => sum + r.rating, 0) / own.length) * 10) / 10;
		})
	};
}
