// Fictional films and series for local, sandbox and the e2e tests: with no TMDB_TOKEN the
// watchlist searches these instead of TMDB, like the demo books and courses.
import type {
	Availability,
	CollectionPart,
	Media,
	Provider,
	SeasonEpisode,
	TitleDetails
} from '#lib/watch.ts';

// Real service names, no logos: the demo never loads TMDB's images.
export const DEMO_PROVIDERS: Provider[] = [
	{ id: 8, name: 'Netflix', logoPath: null },
	{ id: 337, name: 'Disney Plus', logoPath: null },
	{ id: 9, name: 'Amazon Prime Video', logoPath: null },
	{ id: 1899, name: 'Max', logoPath: null },
	{ id: 3, name: 'Google Play Movies', logoPath: null }
];
const [netflix, disney, prime, max, google] = DEMO_PROVIDERS;
export const DEMO_REGIONS = [
	{ code: 'GB', name: 'United Kingdom' },
	{ code: 'US', name: 'United States of America' }
];
const offer = (a: Partial<Availability>): Availability => ({
	link: null,
	stream: [],
	free: [],
	rent: [],
	buy: [],
	...a
});

const base = {
	posterPath: null,
	originalTitle: null,
	tagline: null,
	rating: null,
	ratingCount: null,
	imdbId: null,
	homepage: null,
	seasons: null,
	episodes: null,
	lastEpisode: null,
	nextEpisode: null
};

export const DEMO_TITLES: TitleDetails[] = [
	{
		...base,
		media: 'movie',
		tmdbId: 900001,
		imdbId: 'tt9000001',
		title: 'The Lighthouse Keeper’s Clock',
		year: 2019,
		overview: 'A clockmaker on a remote island races the tide to mend the lamp before the storm.',
		genres: ['Drama', 'Mystery'],
		runtime: 112,
		rating: 7.4,
		ratingCount: 1200,
		status: 'Released',
		makers: ['Ada Penrose'],
		providers: {
			// Netflix both in the subscription and with ads, as TMDB lists some titles.
			GB: offer({ stream: [netflix, prime], free: [netflix], rent: [google] }),
			US: offer({ stream: [max] })
		},
		cast: [
			{ name: 'Milo Hart', role: 'Ewan' },
			{ name: 'Rosa Lind', role: 'Maren' }
		]
	},
	{
		...base,
		media: 'movie',
		tmdbId: 900002,
		imdbId: 'tt9000002',
		title: 'Paper Comets',
		year: 2023,
		overview:
			'Two rival kite makers enter the same festival and lose their kites to the same wind.',
		genres: ['Comedy'],
		runtime: 94,
		status: 'Released',
		makers: ['Jonah Weir'],
		cast: [{ name: 'Ivy Brand', role: 'Tess' }],
		collection: { id: 990001, name: 'Paper Comets Collection' },
		providers: { GB: offer({ stream: [netflix] }) }
	},
	{
		...base,
		media: 'movie',
		tmdbId: 900004,
		imdbId: 'tt9000004',
		title: 'Paper Comets 2',
		year: 2026,
		overview: 'The rivals are back, and this year the festival is on a windy cliff.',
		genres: ['Comedy'],
		runtime: 99,
		status: 'Released',
		makers: ['Jonah Weir'],
		cast: [{ name: 'Ivy Brand', role: 'Tess' }],
		collection: { id: 990001, name: 'Paper Comets Collection' },
		providers: { GB: offer({ stream: [netflix] }) }
	},
	{
		...base,
		media: 'movie',
		tmdbId: 900003,
		title: 'Lighthouse Road',
		year: 2008,
		overview: 'A road trip along the coast, one lighthouse at a time.',
		genres: ['Adventure'],
		runtime: 101,
		status: 'Released',
		makers: ['Ada Penrose'],
		cast: []
	},
	{
		...base,
		media: 'tv',
		tmdbId: 900101,
		imdbId: 'tt9000101',
		title: 'Harbour Lights',
		year: 2021,
		overview: 'The harbour master’s family keeps a small fishing town afloat, season by season.',
		genres: ['Drama'],
		runtime: 48,
		rating: 8.1,
		ratingCount: 640,
		status: 'Returning Series',
		makers: ['Nell Arden'],
		providers: { GB: offer({ stream: [disney] }), US: offer({ stream: [disney, prime] }) },
		cast: [{ name: 'Tom Fairley', role: 'Harbour master' }],
		seasons: 3,
		episodes: 26,
		lastEpisode: { season: 3, number: 6, name: 'Low Water', airDate: '2026-10-12' },
		nextEpisode: { season: 3, number: 7, name: 'Spring Tide', airDate: '2026-10-26' }
	},
	{
		...base,
		media: 'tv',
		tmdbId: 900102,
		title: 'The Quiet Orchard',
		year: 2015,
		overview: 'An orchard, three sisters and one very old pear tree.',
		genres: ['Drama', 'Family'],
		runtime: 42,
		status: 'Ended',
		makers: ['Ruth Mallory'],
		cast: [],
		seasons: 4,
		episodes: 40,
		lastEpisode: { season: 4, number: 10, name: 'Harvest', airDate: '2019-11-02' }
	}
];

export function demoSearch(query: string) {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	return DEMO_TITLES.filter((t) =>
		words.every((w) => `${t.title} ${t.overview}`.toLowerCase().includes(w))
	);
}

export function demoDetails(media: Media, tmdbId: number) {
	return DEMO_TITLES.find((t) => t.media === media && t.tmdbId === tmdbId) ?? null;
}

/**
 * A demo series' season: ten episodes a week apart, except the last season, which ends
 * with the series' latest episode and then its next one (not out yet). Harbour Lights: 10 + 10 +
 * 6 aired, so its 26 episodes, and S3E7 to come; The Quiet Orchard: 4 seasons of 10.
 */
export function demoSeason(tmdbId: number, season: number): SeasonEpisode[] | null {
	const t = DEMO_TITLES.find((x) => x.media === 'tv' && x.tmdbId === tmdbId);
	if (!t?.seasons || season < 1 || season > t.seasons) return null;
	const start = Date.UTC((t.year ?? 2020) + season - 1, 0, 6);
	const weekly = (i: number) => new Date(start + i * 7 * 86_400_000).toISOString().slice(0, 10);
	const last = season === t.seasons && t.lastEpisode?.season === season;
	const aired = last ? t.lastEpisode!.number : 10;
	const eps: SeasonEpisode[] = Array.from({ length: aired }, (_, i) => ({
		number: i + 1,
		name: last && i === aired - 1 ? t.lastEpisode!.name : `Episode ${i + 1}`,
		airDate: last && i === aired - 1 ? t.lastEpisode!.airDate : weekly(i),
		runtime: t.runtime
	}));
	const next = t.nextEpisode;
	if (last && next?.season === season)
		eps.push({ number: next.number, name: next.name, airDate: next.airDate, runtime: t.runtime });
	return eps;
}

const dates: Record<number, string> = { 900002: '2023-06-02', 900004: '2026-09-18' };

/** The demo collection: Paper Comets and its sequel. */
export function demoCollection(id: number): CollectionPart[] {
	return DEMO_TITLES.filter((t) => t.collection?.id === id).map((t) => ({
		media: t.media,
		tmdbId: t.tmdbId,
		title: t.title,
		year: t.year,
		posterPath: t.posterPath,
		overview: t.overview,
		releaseDate: dates[t.tmdbId] ?? null
	}));
}

/** Demo titles streaming on any of these services in the country, best rated or most popular. */
export function demoDiscover(
	media: Media,
	country: string,
	providers: number[],
	order: 'popular' | 'rated'
) {
	const on = new Set(providers);
	return DEMO_TITLES.filter(
		(t) =>
			t.media === media &&
			[...(t.providers?.[country]?.stream ?? []), ...(t.providers?.[country]?.free ?? [])].some(
				(p) => on.has(p.id)
			)
	).sort((a, b) =>
		order === 'rated'
			? (b.rating ?? 0) - (a.rating ?? 0)
			: (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
	);
}

export function demoImdbId(media: Media, tmdbId: number) {
	return DEMO_TITLES.find((t) => t.media === media && t.tmdbId === tmdbId)?.imdbId ?? null;
}
