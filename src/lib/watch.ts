// Films and series: the viewer's own watchlist of titles from TMDB. No video files; the
// details are kept in D1 when a title is added, so the list still works when TMDB is down.

export const MEDIA = ['movie', 'tv'] as const;
export type Media = (typeof MEDIA)[number];

export const WATCH_STATUSES = ['want', 'watching', 'watched'] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];

export const STATUS_LABEL: Record<WatchStatus, string> = {
	want: 'Want to watch',
	watching: 'Watching',
	watched: 'Watched'
};

export const isMedia = (s: string): s is Media => (MEDIA as readonly string[]).includes(s);
export const isWatchStatus = (s: unknown): s is WatchStatus =>
	typeof s === 'string' && (WATCH_STATUSES as readonly string[]).includes(s);

/** One search result. */
export interface TitleHit {
	media: Media;
	tmdbId: number;
	title: string;
	year: number | null;
	posterPath: string | null;
	overview: string;
}

export interface Person {
	name: string;
	role: string | null;
}

/** Everything the title page shows, as stored in `watch_titles.details`. */
export interface TitleDetails extends TitleHit {
	originalTitle: string | null;
	tagline: string | null;
	genres: string[];
	/** Minutes: a film's length, or a series' usual episode length. */
	runtime: number | null;
	rating: number | null;
	ratingCount: number | null;
	imdbId: string | null;
	/** Film: Released, …; series: Returning Series, Ended, Canceled, … */
	status: string | null;
	/** Directors of a film, creators of a series. */
	makers: string[];
	cast: Person[];
	seasons: number | null;
	episodes: number | null;
	lastEpisode: Episode | null;
	nextEpisode: Episode | null;
	homepage: string | null;
	/**
	 * Where it can be watched, by country code, from TMDB's watch/providers (JustWatch's
	 * data). Missing in details stored before providers were kept until they are refreshed.
	 */
	providers?: Record<string, Availability>;
	/** The series of films it belongs to, for "a newer one is out"; films only. */
	collection?: { id: number; name: string } | null;
}

/** A streaming service, shop or rental as TMDB names it. */
export interface Provider {
	id: number;
	name: string;
	logoPath: string | null;
}

/** One country's offers: in a subscription, free (with or without ads), to rent, to buy. */
export interface Availability {
	/** TMDB's page listing these offers, with JustWatch's links to each service. */
	link: string | null;
	stream: Provider[];
	free: Provider[];
	rent: Provider[];
	buy: Provider[];
}

export interface Episode {
	season: number;
	number: number;
	name: string;
	airDate: string | null;
}

export const RATING_MAX = 10;

/** A service's logo, small, from TMDB's image server. */
export function logoUrl(path: string | null) {
	return path && /^\/[\w.-]+$/.test(path) ? `https://image.tmdb.org/t/p/w92${path}` : null;
}

/** TMDB's image server; sizes from its configuration (w92…w780, original). */
export function posterUrl(path: string | null, size: 'w185' | 'w342' | 'w500' = 'w342') {
	return path && /^\/[\w.-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function titleHref(t: { media: Media; tmdbId: number }) {
	return `/${t.media}/${t.tmdbId}`;
}

const yearOf = (date: unknown) => {
	const y = typeof date === 'string' ? Number(date.slice(0, 4)) : NaN;
	return Number.isInteger(y) && y > 1800 ? y : null;
};
const text = (s: unknown) => (typeof s === 'string' && s.trim() ? s.trim() : null);
const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : null);
const list = (a: unknown): Record<string, unknown>[] =>
	Array.isArray(a) ? a.filter((x) => x && typeof x === 'object') : [];

/** A row of TMDB's /search/multi as a hit; people and anything else are left out. */
export function hitFromTmdb(r: Record<string, unknown>, media?: Media): TitleHit | null {
	const m = media ?? r.media_type;
	if (m !== 'movie' && m !== 'tv') return null;
	const id = num(r.id);
	const title = text(m === 'movie' ? r.title : r.name);
	if (!id || !title) return null;
	return {
		media: m,
		tmdbId: id,
		title,
		year: yearOf(m === 'movie' ? r.release_date : r.first_air_date),
		posterPath: text(r.poster_path),
		overview: text(r.overview) ?? ''
	};
}

function episode(e: unknown): Episode | null {
	if (!e || typeof e !== 'object') return null;
	const r = e as Record<string, unknown>;
	const season = num(r.season_number);
	const number = num(r.episode_number);
	if (season == null || number == null) return null;
	return { season, number, name: text(r.name) ?? '', airDate: text(r.air_date) };
}

/**
 * A film's /movie/{id}?append_to_response=credits or a series' /tv/{id}?append_to_response=
 * aggregate_credits,external_ids, as the title page needs it.
 */
export function detailsFromTmdb(media: Media, r: Record<string, unknown>): TitleDetails | null {
	const hit = hitFromTmdb(r, media);
	if (!hit) return null;
	const credits = (media === 'movie' ? r.credits : r.aggregate_credits) as
		Record<string, unknown> | undefined;
	const cast = list(credits?.cast)
		.slice(0, 12)
		.map((c) => ({
			name: text(c.name) ?? '',
			// Series list a person's characters under roles, films under character.
			role:
				media === 'movie'
					? text(c.character)
					: list(c.roles)
							.map((x) => text(x.character))
							.filter(Boolean)
							.join(' / ') || null
		}))
		.filter((c) => c.name);
	const makers =
		media === 'movie'
			? list(credits?.crew)
					.filter((c) => c.job === 'Director')
					.map((c) => text(c.name))
			: list(r.created_by).map((c) => text(c.name));
	const externalIds = (r.external_ids ?? {}) as Record<string, unknown>;
	const runtimes = Array.isArray(r.episode_run_time) ? r.episode_run_time : [];
	return {
		...hit,
		originalTitle: text(media === 'movie' ? r.original_title : r.original_name),
		tagline: text(r.tagline),
		genres: list(r.genres)
			.map((g) => text(g.name))
			.filter((g): g is string => !!g),
		runtime:
			media === 'movie'
				? num(r.runtime) || null
				: // episode_run_time is often empty for newer series; the last episode's length isn't.
					num(runtimes[0]) ||
					num((r.last_episode_to_air as Record<string, unknown> | null)?.runtime) ||
					null,
		rating: num(r.vote_count) ? num(r.vote_average) : null,
		ratingCount: num(r.vote_count) || null,
		imdbId: text(media === 'movie' ? r.imdb_id : externalIds.imdb_id),
		status: text(r.status),
		makers: [...new Set(makers.filter((m): m is string => !!m))],
		cast,
		seasons: media === 'tv' ? num(r.number_of_seasons) : null,
		episodes: media === 'tv' ? num(r.number_of_episodes) : null,
		lastEpisode: media === 'tv' ? episode(r.last_episode_to_air) : null,
		nextEpisode: media === 'tv' ? episode(r.next_episode_to_air) : null,
		homepage: text(r.homepage),
		providers: providersFromTmdb(r['watch/providers']),
		collection: collectionOf(r.belongs_to_collection)
	};
}

function collectionOf(c: unknown): { id: number; name: string } | null {
	const r = (c ?? {}) as Record<string, unknown>;
	const id = num(r.id);
	const name = text(r.name);
	return id && name ? { id, name } : null;
}

/** A film of a collection, with its release date. */
export interface CollectionPart extends TitleHit {
	releaseDate: string | null;
}

/** TMDB's /collection/{id} as its films, oldest first. */
export function partsFromTmdb(r: Record<string, unknown>): CollectionPart[] {
	return list(r.parts)
		.map((p) => {
			const hit = hitFromTmdb(p, 'movie');
			return hit ? { ...hit, releaseDate: text(p.release_date) } : null;
		})
		.filter((p): p is CollectionPart => !!p)
		.sort((a, b) => (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999'));
}

/**
 * Films that came after one the viewer has seen or is watching, in the same collection:
 * released later, not on their list. Upcoming ones count too; the page says when.
 */
export function newerParts(
	seen: { tmdbId: number; year: number | null },
	parts: CollectionPart[],
	onList: Set<number>
): CollectionPart[] {
	const me = parts.find((p) => p.tmdbId === seen.tmdbId);
	const after = me?.releaseDate ?? (seen.year ? `${seen.year}-12-31` : null);
	if (!after) return [];
	return parts.filter(
		(p) =>
			p.tmdbId !== seen.tmdbId && !onList.has(p.tmdbId) && !!p.releaseDate && p.releaseDate > after
	);
}

/** A list of TMDB providers, in TMDB's display order, without repeats. */
export function providerList(a: unknown): Provider[] {
	const seen = new Set<number>();
	return list(a)
		.map((p) => ({
			id: num(p.provider_id),
			name: text(p.provider_name),
			logoPath: text(p.logo_path),
			order: num(p.display_priority) ?? 999
		}))
		.filter((p): p is typeof p & { id: number; name: string } => !!p.id && !!p.name)
		.sort((a, b) => a.order - b.order)
		.filter((p) => !seen.has(p.id) && !!seen.add(p.id))
		.map(({ id, name, logoPath }) => ({ id, name, logoPath }));
}

/** TMDB's `watch/providers` (appended to the details) as availability by country. */
export function providersFromTmdb(raw: unknown): Record<string, Availability> {
	const results = ((raw ?? {}) as Record<string, unknown>).results;
	const out: Record<string, Availability> = {};
	if (!results || typeof results !== 'object') return out;
	for (const [country, v] of Object.entries(results as Record<string, Record<string, unknown>>)) {
		if (!/^[A-Z]{2}$/.test(country) || !v || typeof v !== 'object') continue;
		out[country] = {
			link: text(v.link),
			stream: providerList(v.flatrate),
			free: providerList([...list(v.free), ...list(v.ads)]),
			rent: providerList(v.rent),
			buy: providerList(v.buy)
		};
	}
	return out;
}

/**
 * Where a viewer can watch a title in their country: first what is in the services they
 * have, then the other subscriptions and free services, then rent and buy.
 */
export function whereToWatch(
	providers: Record<string, Availability> | undefined,
	country: string,
	mine: Set<number>
) {
	const here = providers?.[country];
	if (!here) return null;
	// A service can list a title twice (in the subscription and free with ads): once is enough,
	// and the page's keyed lists broke on the repeat.
	const seen = new Set<number>();
	const watchable = [...here.stream, ...here.free].filter(
		(p) => !seen.has(p.id) && !!seen.add(p.id)
	);
	return {
		link: here.link,
		mine: watchable.filter((p) => mine.has(p.id)),
		others: watchable.filter((p) => !mine.has(p.id)),
		rent: here.rent,
		buy: here.buy
	};
}

export function formatRuntime(minutes: number | null) {
	if (!minutes) return null;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** "26 Oct 2026" from TMDB's "2026-10-26"; the date as given when it isn't one. */
export function formatAirDate(date: string) {
	const d = new Date(`${date}T00:00:00Z`);
	return Number.isNaN(d.getTime())
		? date
		: d.toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				timeZone: 'UTC'
			});
}

export function episodeLabel(e: Episode) {
	return `S${e.season} E${e.number}${e.name ? ` · ${e.name}` : ''}`;
}

export const NEWS_KINDS = ['episode', 'season', 'release'] as const;
export type NewsKind = (typeof NEWS_KINDS)[number];

/** Something that came out for a title on the viewer's list. */
export interface WatchNews {
	kind: NewsKind;
	/** Episodes and seasons; 0 for a film's release. */
	season: number;
	number: number;
	name: string;
	airDate: string | null;
}

const after = (a: Episode, b: Episode) =>
	a.season > b.season || (a.season === b.season && a.number > b.number);

/**
 * What came out between two versions of a title's details. Nothing on a first save: adding a
 * title is not news. A series' newest aired episode is news once it is past the stored one
 * (episode 1 of a season is a new season); a film is news when it becomes Released. Only aired
 * ones count, by the date TMDB gives, so an episode TMDB lists early waits for its day.
 */
export function newsBetween(
	old: TitleDetails | null,
	next: TitleDetails,
	today: string
): WatchNews[] {
	if (!old) return [];
	if (next.media === 'movie') {
		return old.status !== 'Released' && next.status === 'Released'
			? [{ kind: 'release', season: 0, number: 0, name: next.title, airDate: null }]
			: [];
	}
	const last = next.lastEpisode;
	if (!last || (last.airDate && last.airDate > today)) return [];
	if (old.lastEpisode && !after(last, old.lastEpisode)) return [];
	return [
		{
			kind: last.number === 1 ? 'season' : 'episode',
			season: last.season,
			number: last.number,
			name: last.name,
			airDate: last.airDate
		}
	];
}

/** Which list a title must be on for its news to reach the viewer. */
export function newsFor(media: Media): WatchStatus {
	return media === 'tv' ? 'watching' : 'want';
}

export function newsLabel(n: WatchNews) {
	if (n.kind === 'release') return 'Released';
	const ep = episodeLabel({ season: n.season, number: n.number, name: n.name, airDate: n.airDate });
	return n.kind === 'season' ? `New season: ${ep}` : `New episode: ${ep}`;
}

/** One episode in a season's list. */
export interface SeasonEpisode {
	number: number;
	name: string;
	airDate: string | null;
	/** Minutes, when TMDB knows. */
	runtime: number | null;
}

/** TMDB's tv/{id}/season/{n} as its episodes, in order. */
export function seasonFromTmdb(r: Record<string, unknown>): SeasonEpisode[] {
	return list(r.episodes)
		.map((e) => ({
			number: num(e.episode_number),
			name: text(e.name) ?? '',
			airDate: text(e.air_date),
			runtime: num(e.runtime) || null
		}))
		.filter((e): e is SeasonEpisode => e.number != null)
		.sort((a, b) => a.number - b.number);
}

/** Whether an episode has come out by `today` (YYYY-MM-DD); undated ones have not. */
export const hasAired = (e: { airDate: string | null }, today: string) =>
	!!e.airDate && e.airDate <= today;

/**
 * What ticking episodes does to the series' status: watching anything puts it on
 * "watching"; having seen every episode of a series that has ended makes it "watched".
 */
export function statusAfterEpisodes(
	current: WatchStatus | null,
	watchedCount: number,
	details: Pick<TitleDetails, 'episodes' | 'status'>
): WatchStatus | null {
	if (watchedCount === 0) return current;
	const ended = details.status === 'Ended' || details.status === 'Canceled';
	if (ended && details.episodes && watchedCount >= details.episodes) return 'watched';
	return current === 'watched' ? 'watched' : 'watching';
}

/** "13 of 26 episodes" for a series in progress, or null before any. */
export function progressLabel(watchedCount: number, episodes: number | null) {
	if (!watchedCount) return null;
	return episodes
		? `${Math.min(watchedCount, episodes)} of ${episodes} episodes`
		: `${watchedCount} episodes`;
}

// Services whose search page takes the title in its address (each checked with the title in it,
// 2026-10-23). TMDB gives no deep links, and Disney+, Channel 4, ITV and Max had no
// working one, so those fall back to TMDB's watch page, whose links come from JustWatch.
const SEARCH: [RegExp, (q: string) => string][] = [
	[/^netflix/i, (q) => `https://www.netflix.com/search?q=${q}`],
	[/amazon|prime video/i, (q) => `https://www.primevideo.com/search/?phrase=${q}`],
	[/^apple tv/i, (q) => `https://tv.apple.com/search?term=${q}`],
	[/bbc iplayer/i, (q) => `https://www.bbc.co.uk/iplayer/search?q=${q}`],
	[/google play/i, (q) => `https://play.google.com/store/search?q=${q}&c=movies`],
	[/^(channel 5|my5)\b/i, (q) => `https://www.channel5.com/search?q=${q}`]
];

/** Where a service's logo takes the viewer for this title. */
export function serviceLink(provider: Provider, title: string, fallback: string | null) {
	const hit = SEARCH.find(([re]) => re.test(provider.name));
	return hit ? hit[1](encodeURIComponent(title)) : fallback;
}

/**
 * A link of the viewer's own on every title page, such as a search on a site they use. Its
 * address names the title with {imdb}, {tmdb}, {media} or {title}. Nothing is fetched there.
 */
export interface OwnLink {
	name: string;
	url: string;
}

export const MAX_OWN_LINKS = 10;
const PLACEHOLDER = /\{(imdb|tmdb|media|title)\}/g;

/** Reads one link a line, "Name | https://example.com/search?q={imdb}"; blank lines are skipped. */
export function parseOwnLinks(text: string): { links: OwnLink[] } | { error: string } {
	const links: OwnLink[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		const bar = line.lastIndexOf('|');
		const name = bar === -1 ? '' : line.slice(0, bar).trim();
		const url = (bar === -1 ? line : line.slice(bar + 1)).trim();
		if (!name || name.length > 40)
			return { error: `Give “${line}” a name of up to 40 characters, then |.` };
		if (!url.match(PLACEHOLDER))
			return { error: `${name}: the address needs {imdb}, {tmdb}, {media} or {title}.` };
		let parsed: URL;
		try {
			parsed = new URL(url.replace(PLACEHOLDER, 'x'));
		} catch {
			return { error: `${name}: that is not a web address.` };
		}
		if (parsed.protocol !== 'https:')
			return { error: `${name}: the address must start with https://.` };
		links.push({ name, url });
	}
	if (links.length > MAX_OWN_LINKS) return { error: `Up to ${MAX_OWN_LINKS} links.` };
	return { links };
}

export function formatOwnLinks(links: OwnLink[]) {
	return links.map((l) => `${l.name} | ${l.url}`).join('\n');
}

/** The link for one title, or null when it needs an id the title lacks (many have no IMDb id). */
export function ownLinkHref(
	link: OwnLink,
	t: { imdbId: string | null; tmdbId: number; media: Media; title: string }
) {
	const values: Record<string, string | null> = {
		imdb: t.imdbId && /^tt\d+$/.test(t.imdbId) ? t.imdbId : null,
		tmdb: String(t.tmdbId),
		media: t.media,
		title: t.title
	};
	let missing = false;
	const href = link.url.replace(PLACEHOLDER, (_, k: string) => {
		const v = values[k];
		if (v === null) missing = true;
		return encodeURIComponent(v ?? '');
	});
	return missing ? null : href;
}
