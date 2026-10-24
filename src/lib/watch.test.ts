import { describe, expect, it } from 'vitest';
import {
	rankHits,
	detailsFromTmdb,
	formatAirDate,
	formatRuntime,
	hitFromTmdb,
	newerParts,
	newsBetween,
	partsFromTmdb,
	personFromTmdb,
	posterUrl,
	profileUrl,
	trailerOf,
	progressLabel,
	providersFromTmdb,
	seasonFromTmdb,
	serviceLink,
	formatOwnLinks,
	ownLinkHref,
	parseOwnLinks,
	statusAfterEpisodes,
	hasAired,
	whereToWatch
} from './watch.ts';

// Shapes from TMDB's API reference (search/multi, movie details, tv series details).
const series = {
	id: 1399,
	name: 'Game of Thrones',
	original_name: 'Game of Thrones',
	first_air_date: '2011-04-17',
	poster_path: '/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
	overview: 'Seven noble families fight for control of the mythical land of Westeros.',
	created_by: [{ name: 'David Benioff' }, { name: 'D.B. Weiss' }],
	episode_run_time: [],
	genres: [{ id: 18, name: 'Drama' }],
	last_episode_to_air: {
		name: 'The Iron Throne',
		air_date: '2019-05-19',
		episode_number: 6,
		season_number: 8,
		runtime: 80
	},
	next_episode_to_air: null,
	number_of_episodes: 73,
	number_of_seasons: 8,
	status: 'Ended',
	tagline: 'Winter Is Coming',
	vote_average: 8.438,
	vote_count: 21390,
	external_ids: { imdb_id: 'tt0944947' },
	aggregate_credits: {
		cast: [
			{
				name: 'Emilia Clarke',
				profile_path: '/86jeYFV40KctQMDQIWhJ5oviNGj.jpg',
				roles: [{ character: 'Daenerys Targaryen' }]
			}
		]
	}
};

const film = {
	id: 11,
	title: 'Star Wars',
	original_title: 'Star Wars',
	release_date: '1977-05-25',
	poster_path: '/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg',
	overview: 'Princess Leia is captured.',
	runtime: 121,
	imdb_id: 'tt0076759',
	status: 'Released',
	genres: [{ name: 'Adventure' }, { name: 'Science Fiction' }],
	vote_average: 8.2,
	vote_count: 20000,
	credits: {
		cast: [
			{ name: 'Mark Hamill', character: 'Luke Skywalker', profile_path: null },
			{ name: 'Carrie Fisher', character: 'Leia', profile_path: '//evil.example/x.jpg' }
		],
		crew: [
			{ id: 1, name: 'George Lucas', job: 'Director' },
			{ id: 1, name: 'George Lucas', job: 'Writer' },
			{ id: 491, name: 'John Williams', job: 'Original Music Composer' }
		]
	},
	videos: {
		results: [
			{ site: 'YouTube', key: 'teaser00001', type: 'Teaser', official: true, iso_639_1: 'en' },
			{ site: 'Vimeo', key: 'vimeo000001', type: 'Trailer', official: true, iso_639_1: 'en' },
			{
				site: 'YouTube',
				key: 'trailer0001',
				type: 'Trailer',
				official: true,
				iso_639_1: 'en',
				name: 'Official Trailer'
			}
		]
	}
};

describe('hitFromTmdb', () => {
	it('reads films and series from a multi search and leaves out people', () => {
		expect(hitFromTmdb({ ...film, media_type: 'movie' })).toMatchObject({
			media: 'movie',
			tmdbId: 11,
			title: 'Star Wars',
			year: 1977
		});
		expect(hitFromTmdb({ ...series, media_type: 'tv' })).toMatchObject({
			media: 'tv',
			title: 'Game of Thrones',
			year: 2011
		});
		expect(hitFromTmdb({ id: 5, name: 'Someone', media_type: 'person' })).toBeNull();
		expect(hitFromTmdb({ id: 6, media_type: 'movie' })).toBeNull();
	});
});

describe('rankHits', () => {
	const hit = (tmdbId: number, title: string, votes: number, media: 'movie' | 'tv' = 'movie') => ({
		media,
		tmdbId,
		title,
		year: null,
		posterPath: null,
		overview: '',
		votes
	});
	const ids = (list: { tmdbId: number }[]) => list.map((h) => h.tmdbId);

	it('puts the well-known title Wikidata found by another name above TMDB’s own matches', () => {
		// "Seven": TMDB lists Macross 7 first and has no Se7en at all (#28).
		const tmdb = [hit(1, 'Macross 7', 40, 'tv'), hit(2, 'Furious 7', 10_000), hit(3, 'Seven', 3)];
		const se7en = hit(807, 'Se7en', 21_000);
		expect(ids(rankHits('Seven', tmdb, [se7en]))).toEqual([807, 2, 3, 1]);
		expect(ids(rankHits('seven 1995', tmdb, [se7en]))[0]).toBe(807);
	});

	it('keeps a much-rated exact title above an obscure one Wikidata matched', () => {
		const series = hit(95396, 'Severance', 3_000, 'tv');
		const film = hit(1117953, 'Severance', 4);
		expect(ids(rankHits('severance', [series, film], [film]))).toEqual([95396, 1117953]);
	});

	it('lists each title once and keeps TMDB’s order between equals', () => {
		const a = hit(1, 'Alpha', 0);
		const b = hit(2, 'Beta', 0);
		expect(ids(rankHits('x', [a, b, a], [b]))).toEqual([2, 1]);
		expect(ids(rankHits('x', [a, b], []))).toEqual([1, 2]);
	});
});

describe('detailsFromTmdb', () => {
	it('keeps what the title page shows for a series', () => {
		const d = detailsFromTmdb('tv', series)!;
		expect(d).toMatchObject({
			makers: ['David Benioff', 'D.B. Weiss'],
			seasons: 8,
			episodes: 73,
			status: 'Ended',
			imdbId: 'tt0944947',
			// No usual episode length in episode_run_time, so the last episode's.
			runtime: 80,
			lastEpisode: { season: 8, number: 6, name: 'The Iron Throne', airDate: '2019-05-19' },
			nextEpisode: null,
			cast: [
				{
					name: 'Emilia Clarke',
					role: 'Daenerys Targaryen',
					// The photo beside the name (#16).
					profilePath: '/86jeYFV40KctQMDQIWhJ5oviNGj.jpg'
				}
			]
		});
	});

	it('keeps what the title page shows for a film, directors once', () => {
		expect(detailsFromTmdb('movie', film)).toMatchObject({
			makers: ['George Lucas'],
			runtime: 121,
			imdbId: 'tt0076759',
			genres: ['Adventure', 'Science Fiction'],
			seasons: null,
			cast: [
				{ name: 'Mark Hamill', role: 'Luke Skywalker', profilePath: null },
				{ name: 'Carrie Fisher', role: 'Leia', profilePath: '//evil.example/x.jpg' }
			]
		});
	});

	it('keeps the people behind a film with their ids, and its trailer (#18-#20)', () => {
		expect(detailsFromTmdb('movie', film)).toMatchObject({
			makerCredits: [{ id: 1, name: 'George Lucas' }],
			music: [{ id: 491, name: 'John Williams' }],
			trailer: { key: 'trailer0001', name: 'Official Trailer' }
		});
	});

	it("finds a series composer among each person's jobs", () => {
		const d = detailsFromTmdb('tv', {
			...series,
			created_by: [{ id: 9813, name: 'David Benioff' }],
			aggregate_credits: {
				cast: [],
				crew: [
					{ id: 10851, name: 'Ramin Djawadi', jobs: [{ job: 'Original Music Composer' }] },
					{ id: 7, name: 'Someone', jobs: [{ job: 'Editor' }] }
				]
			}
		})!;
		expect(d.makerCredits).toEqual([{ id: 9813, name: 'David Benioff' }]);
		expect(d.music).toEqual([{ id: 10851, name: 'Ramin Djawadi' }]);
		expect(d.trailer).toBeNull();
	});

	it('has no rating without votes', () => {
		expect(
			detailsFromTmdb('movie', { ...film, vote_count: 0, vote_average: 0 })!.rating
		).toBeNull();
	});
});

describe('trailerOf', () => {
	it('takes a YouTube trailer over a teaser, and nothing that is not a plain key', () => {
		expect(
			trailerOf({
				results: [
					{ site: 'YouTube', key: 'teaser00001', type: 'Teaser' },
					{ site: 'YouTube', key: 'clip0000001', type: 'Clip' }
				]
			})
		).toEqual({ key: 'teaser00001', name: 'Trailer' });
		expect(
			trailerOf({ results: [{ site: 'YouTube', key: 'x"><script>', type: 'Trailer' }] })
		).toBeNull();
		expect(trailerOf(undefined)).toBeNull();
	});
});

describe('personFromTmdb', () => {
	it('lists each title once per kind of work, characters and jobs together', () => {
		const p = personFromTmdb({
			id: 491,
			name: 'John Williams',
			profile_path: '/w.jpg',
			biography: 'Composer.',
			known_for_department: 'Sound',
			combined_credits: {
				cast: [
					{
						id: 11,
						media_type: 'movie',
						title: 'Star Wars',
						release_date: '1977-05-25',
						character: 'Himself',
						vote_count: 5
					}
				],
				crew: [
					{
						id: 11,
						media_type: 'movie',
						title: 'Star Wars',
						release_date: '1977-05-25',
						job: 'Original Music Composer',
						vote_count: 20000
					},
					{
						id: 11,
						media_type: 'movie',
						title: 'Star Wars',
						release_date: '1977-05-25',
						job: 'Music',
						vote_count: 20000
					},
					{
						id: 1399,
						media_type: 'tv',
						name: 'A Series',
						first_air_date: '2011-04-17',
						job: 'Theme Song Performance',
						vote_count: 3
					},
					{ id: 12, media_type: 'movie', title: 'Other', job: 'Producer' },
					{ id: 13, media_type: 'person', name: 'Not a title', job: 'Director' }
				]
			}
		})!;
		expect(p).toMatchObject({
			id: 491,
			name: 'John Williams',
			knownFor: 'music',
			profilePath: '/w.jpg'
		});
		expect(p.credits).toEqual([
			expect.objectContaining({ kind: 'acting', tmdbId: 11, role: 'Himself', votes: 5 }),
			expect.objectContaining({
				kind: 'music',
				media: 'movie',
				tmdbId: 11,
				role: null,
				votes: 20000
			}),
			expect.objectContaining({
				kind: 'music',
				media: 'tv',
				tmdbId: 1399,
				role: 'Theme Song Performance'
			})
		]);
	});

	it('needs an id and a name', () => {
		expect(personFromTmdb({ id: 5 })).toBeNull();
	});
});

describe('helpers', () => {
	it('builds poster URLs on TMDB only from a plain path', () => {
		expect(posterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
		expect(posterUrl('//evil.example/x.jpg')).toBeNull();
		expect(posterUrl(null)).toBeNull();
		expect(profileUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w185/abc.jpg');
		expect(profileUrl('//evil.example/x.jpg')).toBeNull();
		expect(profileUrl(undefined)).toBeNull();
	});

	it('formats air dates the same in every timezone', () => {
		expect(formatAirDate('2026-10-26')).toBe('26 Oct 2026');
		expect(formatAirDate('soon')).toBe('soon');
	});

	it('formats runtimes', () => {
		expect(formatRuntime(121)).toBe('2 h 1 min');
		expect(formatRuntime(45)).toBe('45 min');
		expect(formatRuntime(120)).toBe('2 h');
		expect(formatRuntime(null)).toBeNull();
	});
});

describe('newsBetween', () => {
	const show = detailsFromTmdb('tv', series)!;
	const at = (season: number, number: number, airDate: string | null = '2026-10-12') => ({
		...show,
		lastEpisode: { season, number, name: `Ep ${number}`, airDate }
	});

	it('is nothing on a first save, or when nothing changed', () => {
		expect(newsBetween(null, at(3, 6), '2026-10-20')).toEqual([]);
		expect(newsBetween(at(3, 6), at(3, 6), '2026-10-20')).toEqual([]);
	});

	it('reports a newer aired episode, and episode 1 as a new season', () => {
		expect(newsBetween(at(3, 5), at(3, 6), '2026-10-20')).toEqual([
			{ kind: 'episode', season: 3, number: 6, name: 'Ep 6', airDate: '2026-10-12' }
		]);
		expect(newsBetween(at(3, 10), at(4, 1), '2026-10-20')[0]).toMatchObject({
			kind: 'season',
			season: 4,
			number: 1
		});
	});

	it('waits for an episode listed before its air date, and ignores going backwards', () => {
		expect(newsBetween(at(3, 5), at(3, 6, '2026-10-26'), '2026-10-20')).toEqual([]);
		expect(newsBetween(at(3, 6), at(3, 5), '2026-10-20')).toEqual([]);
	});

	it('reports a film once it is released', () => {
		const f = detailsFromTmdb('movie', film)!;
		expect(newsBetween({ ...f, status: 'Post Production' }, f, '2026-10-20')).toEqual([
			{ kind: 'release', season: 0, number: 0, name: 'Star Wars', airDate: null }
		]);
		expect(newsBetween(f, f, '2026-10-20')).toEqual([]);
	});
});

describe('where to watch', () => {
	// Shaped like TMDB's watch/providers for one title (JustWatch's data).
	const raw = {
		results: {
			GB: {
				link: 'https://www.themoviedb.org/tv/1/watch?locale=GB',
				flatrate: [
					{
						provider_id: 337,
						provider_name: 'Disney Plus',
						logo_path: '/d.jpg',
						display_priority: 3
					},
					{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 1 }
				],
				ads: [
					{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 1 }
				],
				free: [
					{ provider_id: 103, provider_name: 'Channel 4', logo_path: null, display_priority: 9 }
				],
				buy: [
					{ provider_id: 2, provider_name: 'Apple TV', logo_path: '/a.jpg', display_priority: 4 }
				]
			},
			US: { flatrate: [{ provider_id: 1899, provider_name: 'Max', logo_path: '/m.jpg' }] },
			bad: { flatrate: [] }
		}
	};

	it('reads offers by country, in TMDB order, without repeats', () => {
		const p = providersFromTmdb(raw);
		expect(Object.keys(p)).toEqual(['GB', 'US']);
		expect(p.GB.stream.map((x) => x.name)).toEqual(['Netflix', 'Disney Plus']);
		expect(p.GB.free.map((x) => x.name)).toEqual(['Netflix', 'Channel 4']);
		expect(p.GB.rent).toEqual([]);
		expect(p.GB.buy).toEqual([{ id: 2, name: 'Apple TV', logoPath: '/a.jpg' }]);
		expect(p.US.link).toBeNull();
		expect(providersFromTmdb(undefined)).toEqual({});
	});

	it('puts the viewer’s own services first, and says nothing for another country', () => {
		const p = providersFromTmdb(raw);
		const w = whereToWatch(p, 'GB', new Set([337]))!;
		expect(w.mine.map((x) => x.name)).toEqual(['Disney Plus']);
		// Netflix is both in the subscription and with ads: listed once.
		expect(w.others.map((x) => x.name)).toEqual(['Netflix', 'Channel 4']);
		expect(whereToWatch(p, 'GB', new Set([8]))!.mine.map((x) => x.name)).toEqual(['Netflix']);
		expect(w.buy.map((x) => x.name)).toEqual(['Apple TV']);
		expect(whereToWatch(p, 'FR', new Set([8]))).toBeNull();
		expect(whereToWatch(undefined, 'GB', new Set())).toBeNull();
	});

	it('keeps the providers in the stored details', () => {
		const d = detailsFromTmdb('tv', { id: 1, name: 'X', 'watch/providers': raw })!;
		expect(d.providers?.GB.stream).toHaveLength(2);
	});
});

describe('episode progress', () => {
	it('reads a season from TMDB, in episode order', () => {
		expect(
			seasonFromTmdb({
				episodes: [
					{ episode_number: 2, name: 'Two', air_date: '2026-01-08', runtime: 50 },
					{ episode_number: 1, name: 'One', air_date: '2026-01-01', runtime: 0 },
					{ name: 'No number' }
				]
			})
		).toEqual([
			{ number: 1, name: 'One', airDate: '2026-01-01', runtime: null },
			{ number: 2, name: 'Two', airDate: '2026-01-08', runtime: 50 }
		]);
		expect(seasonFromTmdb({})).toEqual([]);
	});

	it('knows what has aired', () => {
		expect(hasAired({ airDate: '2026-10-23' }, '2026-10-23')).toBe(true);
		expect(hasAired({ airDate: '2026-10-24' }, '2026-10-23')).toBe(false);
		expect(hasAired({ airDate: null }, '2026-10-23')).toBe(false);
	});

	it('moves the series to watching, and to watched once every episode of an ended one is seen', () => {
		const running = { episodes: 26, status: 'Returning Series' };
		const ended = { episodes: 40, status: 'Ended' };
		expect(statusAfterEpisodes(null, 1, running)).toBe('watching');
		expect(statusAfterEpisodes('want', 3, running)).toBe('watching');
		expect(statusAfterEpisodes('watching', 26, running)).toBe('watching');
		expect(statusAfterEpisodes('watching', 40, ended)).toBe('watched');
		expect(statusAfterEpisodes('watched', 5, ended)).toBe('watched');
		expect(statusAfterEpisodes('want', 0, running)).toBe('want');
	});

	it('labels progress', () => {
		expect(progressLabel(13, 26)).toBe('13 of 26 episodes');
		expect(progressLabel(30, 26)).toBe('26 of 26 episodes');
		expect(progressLabel(4, null)).toBe('4 episodes');
		expect(progressLabel(0, 26)).toBeNull();
	});
});

describe('newer films in a collection', () => {
	const parts = partsFromTmdb({
		parts: [
			{ id: 3, title: 'Part Three', release_date: '2024-05-01' },
			{ id: 1, title: 'Part One', release_date: '2016-05-01' },
			{ id: 2, title: 'Part Two', release_date: '2019-05-01' },
			{ id: 4, title: 'Part Four', release_date: '' }
		]
	});

	it('reads the parts oldest first', () => {
		expect(parts.map((p) => p.title)).toEqual(['Part One', 'Part Two', 'Part Three', 'Part Four']);
		expect(
			detailsFromTmdb('movie', {
				id: 9,
				title: 'X',
				belongs_to_collection: { id: 7, name: 'X Collection' }
			})?.collection
		).toEqual({ id: 7, name: 'X Collection' });
	});

	it('suggests the later ones not on the list, dated', () => {
		expect(newerParts({ tmdbId: 1, year: 2016 }, parts, new Set([1])).map((p) => p.tmdbId)).toEqual(
			[2, 3]
		);
		expect(
			newerParts({ tmdbId: 1, year: 2016 }, parts, new Set([1, 3])).map((p) => p.tmdbId)
		).toEqual([2]);
		expect(newerParts({ tmdbId: 3, year: 2024 }, parts, new Set())).toEqual([]);
	});
});

describe('own links', () => {
	const t = { imdbId: 'tt5687612', tmdbId: 42, media: 'movie' as const, title: 'Rock & Roll' };

	it('reads one link a line and fills in the title', () => {
		const r = parseOwnLinks(
			'My site | https://example.com/?s={imdb}\n\n Wiki | https://en.wikipedia.org/w/index.php?search={title} '
		);
		expect(r).toEqual({
			links: [
				{ name: 'My site', url: 'https://example.com/?s={imdb}' },
				{ name: 'Wiki', url: 'https://en.wikipedia.org/w/index.php?search={title}' }
			]
		});
		if (!('links' in r)) throw new Error('no links');
		expect(ownLinkHref(r.links[0], t)).toBe('https://example.com/?s=tt5687612');
		expect(ownLinkHref(r.links[1], t)).toBe(
			'https://en.wikipedia.org/w/index.php?search=Rock%20%26%20Roll'
		);
		expect(formatOwnLinks(r.links)).toBe(
			'My site | https://example.com/?s={imdb}\nWiki | https://en.wikipedia.org/w/index.php?search={title}'
		);
	});

	it('leaves the link out when the title has no IMDb id', () => {
		const link = { name: 'X', url: 'https://example.com/{media}/{imdb}' };
		expect(ownLinkHref(link, { ...t, imdbId: null })).toBeNull();
		expect(ownLinkHref(link, { ...t, imdbId: 'tt1&x=1' })).toBeNull();
		expect(ownLinkHref(link, t)).toBe('https://example.com/movie/tt5687612');
	});

	it('refuses links without a name, a placeholder or https', () => {
		expect(parseOwnLinks('https://example.com/?s={imdb}')).toHaveProperty('error');
		expect(parseOwnLinks('X | https://example.com/')).toHaveProperty('error');
		expect(parseOwnLinks('X | javascript:alert({imdb})')).toHaveProperty('error');
		expect(parseOwnLinks('X | http://example.com/{imdb}')).toHaveProperty('error');
		expect(parseOwnLinks(Array(11).fill('X | https://e.com/{tmdb}').join('\n'))).toEqual({
			error: 'Up to 10 links.'
		});
	});
});

describe('serviceLink', () => {
	const p = (name: string) => ({ id: 1, name, logoPath: null });
	it('searches the service for the title where its search works, else TMDB’s watch page', () => {
		expect(serviceLink(p('Netflix'), 'Gilmore Girls', 'https://tmdb/x')).toBe(
			'https://www.netflix.com/search?q=Gilmore%20Girls'
		);
		expect(serviceLink(p('Netflix Standard with Ads'), 'A&B', null)).toBe(
			'https://www.netflix.com/search?q=A%26B'
		);
		expect(serviceLink(p('Amazon Prime Video'), 'X', null)).toBe(
			'https://www.primevideo.com/search/?phrase=X'
		);
		expect(serviceLink(p('Apple TV'), 'X', null)).toBe('https://tv.apple.com/search?term=X');
		expect(serviceLink(p('Disney Plus'), 'X', 'https://tmdb/x')).toBe('https://tmdb/x');
		expect(serviceLink(p('Sky Go'), 'X', null)).toBeNull();
	});
});
