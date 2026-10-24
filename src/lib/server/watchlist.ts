// The viewer's own films and series. Every query on `watchlist` is scoped to the signed-in
// viewer, like tags: nobody sees, counts or filters anyone else's list.
import { and, asc, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import {
	newsBetween,
	newsFor,
	newsLabel,
	type Media,
	type NewsKind,
	type OwnLink,
	statusAfterEpisodes,
	type Provider,
	type SeasonEpisode,
	type TitleDetails,
	type WatchStatus
} from '#lib/watch.ts';
import type { Db } from './db';
import {
	imdbRatings,
	user,
	watchEpisodes,
	watchlist,
	watchNews,
	watchSeasons,
	watchServices,
	watchSettings,
	watchTitles
} from './db/schema';
import { fetchDetails, fetchSeason, tmdbDemo, tmdbLive, TmdbError } from './tmdb.ts';

// Stored details are used as they are for a day; after that a page view refreshes them.
const FRESH_MS = 24 * 60 * 60 * 1000;

export interface StoredTitle {
	id: number;
	details: TitleDetails;
	fetchedAt: Date;
}

export async function storedTitle(
	db: Db,
	media: Media,
	tmdbId: number
): Promise<StoredTitle | null> {
	const [row] = await db
		.select({ id: watchTitles.id, details: watchTitles.details, fetchedAt: watchTitles.fetchedAt })
		.from(watchTitles)
		.where(and(eq(watchTitles.media, media), eq(watchTitles.tmdbId, tmdbId)));
	return row ? { id: row.id, details: JSON.parse(row.details), fetchedAt: row.fetchedAt } : null;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Stores a title's details. When they replace older ones, what came out in between becomes news
 * for every viewer with the title on the list it matters to (a series being watched, a film
 * wanted): page views and the cron run refresh the same way, so neither swallows the other's news.
 */
async function saveTitle(db: Db, d: TitleDetails, previous?: StoredTitle | null): Promise<number> {
	const old = previous === undefined ? await storedTitle(db, d.media, d.tmdbId) : previous;
	const values = {
		media: d.media,
		tmdbId: d.tmdbId,
		title: d.title,
		year: d.year,
		posterPath: d.posterPath,
		details: JSON.stringify(d),
		fetchedAt: new Date()
	};
	const [row] = await db
		.insert(watchTitles)
		.values(values)
		.onConflictDoUpdate({ target: [watchTitles.media, watchTitles.tmdbId], set: values })
		.returning({ id: watchTitles.id });
	const news = newsBetween(old?.details ?? null, d, today());
	if (news.length) {
		const viewers = await db
			.select({ userId: watchlist.userId })
			.from(watchlist)
			.where(and(eq(watchlist.titleId, row.id), eq(watchlist.status, newsFor(d.media))));
		const rows = viewers.flatMap(({ userId }) =>
			news.map((n) => ({ userId, titleId: row.id, ...n }))
		);
		// D1 binds at most 100 values a query: 7 a row (2026-10-20, 31 viewers of one series failed).
		for (let i = 0; i < rows.length; i += 12)
			await db
				.insert(watchNews)
				.values(rows.slice(i, i + 12))
				.onConflictDoNothing();
	}
	return row.id;
}

/**
 * A title's details: stored ones while fresh, else TMDB's (and stored again when the title is
 * already kept). If TMDB fails, stale stored details are better than none. `stale` says so.
 */
export async function titleDetails(db: Db, media: Media, tmdbId: number) {
	const stored = await storedTitle(db, media, tmdbId);
	// Details stored before providers were kept have no providers: fetch them again rather than wait a day.
	// Demo titles always come from the demo catalogue: a stored copy hid a demo change from the tests.
	if (
		stored &&
		!tmdbDemo() &&
		stored.details.providers &&
		// Films stored before collections were kept have no collection field yet: fetch those once more too.
		(media !== 'movie' || 'collection' in stored.details) &&
		Date.now() - stored.fetchedAt.getTime() < FRESH_MS
	)
		return { details: stored.details, stale: false };
	try {
		const details = await fetchDetails(media, tmdbId);
		if (stored) await saveTitle(db, details, stored);
		return { details, stale: false };
	} catch (e) {
		if (stored && e instanceof TmdbError && e.code === 'unavailable')
			return { details: stored.details, stale: true };
		throw e;
	}
}

export async function entryFor(db: Db, userId: string, media: Media, tmdbId: number) {
	const [row] = await db
		.select({ status: watchlist.status, rating: watchlist.rating, watchedAt: watchlist.watchedAt })
		.from(watchlist)
		.innerJoin(watchTitles, eq(watchTitles.id, watchlist.titleId))
		.where(
			and(
				eq(watchlist.userId, userId),
				eq(watchTitles.media, media),
				eq(watchTitles.tmdbId, tmdbId)
			)
		);
	return row ? { ...row, status: row.status as WatchStatus } : null;
}

/** Puts the title on the viewer's list with this status, or changes it. */
export async function setEntry(
	db: Db,
	userId: string,
	details: TitleDetails,
	change: { status?: WatchStatus; rating?: number | null; watchedAt?: Date }
) {
	const titleId = await saveTitle(db, details);
	const now = new Date();
	const had = await entryFor(db, userId, details.media, details.tmdbId);
	const status = change.status ?? had?.status ?? 'want';
	const rating = change.rating === undefined ? (had?.rating ?? null) : change.rating;
	// The first time it becomes watched; going back to "watching" keeps the date of the last time.
	const watchedAt =
		status === 'watched' && had?.status !== 'watched'
			? (change.watchedAt ?? now)
			: (had?.watchedAt ?? null);
	await db
		.insert(watchlist)
		.values({ userId, titleId, status, rating, watchedAt, addedAt: now, updatedAt: now })
		.onConflictDoUpdate({
			target: [watchlist.userId, watchlist.titleId],
			set: { status, rating, watchedAt, updatedAt: now }
		});
	return { status, rating, watchedAt };
}

export async function removeEntry(db: Db, userId: string, media: Media, tmdbId: number) {
	const stored = await storedTitle(db, media, tmdbId);
	if (!stored) return;
	await db
		.delete(watchlist)
		.where(and(eq(watchlist.userId, userId), eq(watchlist.titleId, stored.id)));
	// Taking a series off the list forgets which episodes were seen.
	await db
		.delete(watchEpisodes)
		.where(and(eq(watchEpisodes.userId, userId), eq(watchEpisodes.titleId, stored.id)));
}

export async function listWatch(db: Db, userId: string, status: WatchStatus) {
	const rows = await db
		.select({
			media: watchTitles.media,
			tmdbId: watchTitles.tmdbId,
			title: watchTitles.title,
			year: watchTitles.year,
			posterPath: watchTitles.posterPath,
			details: watchTitles.details,
			rating: watchlist.rating,
			updatedAt: watchlist.updatedAt,
			seenEpisodes: sql<number>`(select count(*) from ${watchEpisodes} e where e.user_id = ${watchlist.userId} and e.title_id = ${watchlist.titleId})`
		})
		.from(watchlist)
		.innerJoin(watchTitles, eq(watchTitles.id, watchlist.titleId))
		.where(and(eq(watchlist.userId, userId), eq(watchlist.status, status)))
		.orderBy(desc(watchlist.updatedAt), desc(watchTitles.id));
	return rows.map(({ details, ...r }) => {
		const d = JSON.parse(details) as TitleDetails;
		return {
			...r,
			media: r.media as Media,
			nextEpisode: d.nextEpisode,
			seasons: d.seasons,
			episodes: d.episodes,
			imdbId: d.imdbId,
			providers: d.providers
		};
	});
}

export async function watchCounts(db: Db, userId: string) {
	const rows = await db
		.select({ status: watchlist.status, n: sql<number>`count(*)` })
		.from(watchlist)
		.where(eq(watchlist.userId, userId))
		.groupBy(watchlist.status);
	const counts: Record<WatchStatus, number> = { want: 0, watching: 0, watched: 0 };
	for (const r of rows) if (r.status in counts) counts[r.status as WatchStatus] = r.n;
	return counts;
}

export async function unseenNews(db: Db, userId: string) {
	const rows = await db
		.select({
			id: watchNews.id,
			kind: watchNews.kind,
			season: watchNews.season,
			number: watchNews.number,
			name: watchNews.name,
			airDate: watchNews.airDate,
			media: watchTitles.media,
			tmdbId: watchTitles.tmdbId,
			title: watchTitles.title,
			posterPath: watchTitles.posterPath
		})
		.from(watchNews)
		.innerJoin(watchTitles, eq(watchTitles.id, watchNews.titleId))
		.where(and(eq(watchNews.userId, userId), isNull(watchNews.seenAt)))
		.orderBy(desc(watchNews.createdAt), desc(watchNews.id))
		.limit(50);
	return rows.map((r) => ({ ...r, kind: r.kind as NewsKind, media: r.media as Media }));
}

export async function unseenNewsCount(db: Db, userId: string) {
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(watchNews)
		.where(and(eq(watchNews.userId, userId), isNull(watchNews.seenAt)));
	return row?.n ?? 0;
}

export async function markNewsSeen(db: Db, userId: string) {
	await db
		.update(watchNews)
		.set({ seenAt: new Date() })
		.where(and(eq(watchNews.userId, userId), isNull(watchNews.seenAt)));
}

export async function emailsNews(db: Db, userId: string) {
	const [row] = await db
		.select({ on: watchSettings.emailNews })
		.from(watchSettings)
		.where(eq(watchSettings.userId, userId));
	return row?.on ?? true;
}

export async function setEmailsNews(db: Db, userId: string, on: boolean) {
	await db
		.insert(watchSettings)
		.values({ userId, emailNews: on })
		.onConflictDoUpdate({ target: watchSettings.userId, set: { emailNews: on } });
}

/** The viewer's own links on title pages, in their order. */
export async function ownLinks(db: Db, userId: string): Promise<OwnLink[]> {
	const [row] = await db
		.select({ links: watchSettings.links })
		.from(watchSettings)
		.where(eq(watchSettings.userId, userId));
	return row?.links ?? [];
}

export async function setOwnLinks(db: Db, userId: string, links: OwnLink[]) {
	await db
		.insert(watchSettings)
		.values({ userId, links })
		.onConflictDoUpdate({ target: watchSettings.userId, set: { links } });
}

// Each title on someone's list is looked up about once a day: 40 titles a run, 96 runs a day.
const REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;

/**
 * The cron run's part: refreshes the titles on anyone's list that were looked up
 * longest ago, which records their news. Stops at the first TMDB failure (a 429 or an outage
 * is not worth hammering); nothing to do without a TMDB token.
 */
export async function refreshWatchTitles(db: Db, limit = 40) {
	if (!tmdbLive() && !tmdbDemo()) return { checked: 0, skipped: 'no TMDB token' };
	const due = await db
		.selectDistinct({ id: watchTitles.id, media: watchTitles.media, tmdbId: watchTitles.tmdbId })
		.from(watchTitles)
		.innerJoin(watchlist, eq(watchlist.titleId, watchTitles.id))
		.where(lt(watchTitles.fetchedAt, new Date(Date.now() - REFRESH_AFTER_MS)))
		.orderBy(asc(watchTitles.fetchedAt))
		.limit(limit);
	let checked = 0;
	for (const t of due) {
		const media = t.media as Media;
		const stored = await storedTitle(db, media, t.tmdbId);
		try {
			await saveTitle(db, await fetchDetails(media, t.tmdbId), stored);
			checked++;
		} catch (e) {
			if (!(e instanceof TmdbError)) throw e;
			// A title TMDB removed stays as it was stored; mark it looked at so it waits a day.
			if (e.code === 'not-found') {
				await db.update(watchTitles).set({ fetchedAt: new Date() }).where(eq(watchTitles.id, t.id));
				continue;
			}
			return { checked, due: due.length, stopped: e.message };
		}
	}
	return { checked, due: due.length };
}

export interface NewsMail {
	userId: string;
	to: string;
	subject: string;
	text: string;
	ids: number[];
}

/** One email per viewer with news not yet emailed, unless they switched email off. */
export async function pendingNewsMails(db: Db, origin: string): Promise<NewsMail[]> {
	const rows = await db
		.select({
			id: watchNews.id,
			userId: watchNews.userId,
			email: user.email,
			on: watchSettings.emailNews,
			kind: watchNews.kind,
			season: watchNews.season,
			number: watchNews.number,
			name: watchNews.name,
			airDate: watchNews.airDate,
			media: watchTitles.media,
			tmdbId: watchTitles.tmdbId,
			title: watchTitles.title
		})
		.from(watchNews)
		.innerJoin(user, eq(user.id, watchNews.userId))
		.innerJoin(watchTitles, eq(watchTitles.id, watchNews.titleId))
		.leftJoin(watchSettings, eq(watchSettings.userId, watchNews.userId))
		.where(and(isNull(watchNews.emailedAt), isNull(watchNews.seenAt)))
		.orderBy(asc(watchNews.userId), asc(watchNews.id));
	const byUser = new Map<string, typeof rows>();
	for (const r of rows)
		if (r.on !== false) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
	return [...byUser.values()].map((items) => {
		const lines = items.map(
			(n) =>
				`- ${n.title}: ${newsLabel({ ...n, kind: n.kind as NewsKind })}${n.airDate ? ` (${n.airDate})` : ''}\n  ${origin}/${n.media}/${n.tmdbId}`
		);
		return {
			userId: items[0].userId,
			to: items[0].email,
			subject:
				items.length === 1
					? `New on your list: ${items[0].title}`
					: `${items.length} new things on your list`,
			text: `New for films and series on your Watch list:\n\n${lines.join('\n')}\n\nYour list: ${origin}\nStop these emails on that page.\n`,
			ids: items.map((n) => n.id)
		};
	});
}

export async function markNewsEmailed(db: Db, ids: number[]) {
	for (let i = 0; i < ids.length; i += 50) {
		const part = ids.slice(i, i + 50);
		await db
			.update(watchNews)
			.set({ emailedAt: new Date() })
			.where(
				sql`${watchNews.id} in (${sql.join(
					part.map((id) => sql`${id}`),
					sql`, `
				)})`
			);
	}
}

/** The viewer's country, or null until they choose one. */
export async function watchCountry(db: Db, userId: string) {
	const [row] = await db
		.select({ country: watchSettings.country })
		.from(watchSettings)
		.where(eq(watchSettings.userId, userId));
	return row?.country ?? null;
}

/** The streaming services the viewer has, by name. */
export async function myServices(db: Db, userId: string): Promise<Provider[]> {
	const rows = await db
		.select({
			id: watchServices.providerId,
			name: watchServices.name,
			logoPath: watchServices.logoPath
		})
		.from(watchServices)
		.where(eq(watchServices.userId, userId))
		.orderBy(asc(watchServices.name));
	return rows;
}

/** Replaces the viewer's country and services. */
export async function setServices(db: Db, userId: string, country: string, services: Provider[]) {
	await db
		.insert(watchSettings)
		.values({ userId, country })
		.onConflictDoUpdate({ target: watchSettings.userId, set: { country } });
	await db.delete(watchServices).where(eq(watchServices.userId, userId));
	// D1 binds at most 100 values a query: 4 a row.
	const rows = services.map((p) => ({
		userId,
		providerId: p.id,
		name: p.name,
		logoPath: p.logoPath
	}));
	for (let i = 0; i < rows.length; i += 20)
		await db.insert(watchServices).values(rows.slice(i, i + 20));
}

/**
 * A season's episodes: kept for a day once the series is stored, like its details; a
 * series nobody has on their list is asked for each time.
 */
export async function seasonEpisodes(
	db: Db,
	tmdbId: number,
	season: number
): Promise<SeasonEpisode[]> {
	// The demo catalogue is fixed, so its seasons are not kept (a stale copy outlived a demo change).
	const title = tmdbDemo() ? null : await storedTitle(db, 'tv', tmdbId);
	if (title) {
		const [row] = await db
			.select({ episodes: watchSeasons.episodes, fetchedAt: watchSeasons.fetchedAt })
			.from(watchSeasons)
			.where(and(eq(watchSeasons.titleId, title.id), eq(watchSeasons.season, season)));
		if (row && Date.now() - row.fetchedAt.getTime() < FRESH_MS) return JSON.parse(row.episodes);
		try {
			const episodes = await fetchSeason(tmdbId, season);
			const values = {
				titleId: title.id,
				season,
				episodes: JSON.stringify(episodes),
				fetchedAt: new Date()
			};
			await db
				.insert(watchSeasons)
				.values(values)
				.onConflictDoUpdate({ target: [watchSeasons.titleId, watchSeasons.season], set: values });
			return episodes;
		} catch (e) {
			if (row && e instanceof TmdbError && e.code === 'unavailable')
				return JSON.parse(row.episodes);
			throw e;
		}
	}
	return fetchSeason(tmdbId, season);
}

/** The episodes of a series the viewer has seen, as "season:episode" keys. */
export async function watchedEpisodes(db: Db, userId: string, tmdbId: number) {
	const rows = await db
		.select({ season: watchEpisodes.season, episode: watchEpisodes.episode })
		.from(watchEpisodes)
		.innerJoin(watchTitles, eq(watchTitles.id, watchEpisodes.titleId))
		.where(
			and(
				eq(watchEpisodes.userId, userId),
				eq(watchTitles.media, 'tv'),
				eq(watchTitles.tmdbId, tmdbId)
			)
		);
	return rows.map((r) => `${r.season}:${r.episode}`);
}

/**
 * Marks episodes of one season as seen or not, then moves the series to "watching", or to
 * "watched" once every episode of an ended series is seen. Returns the keys seen and the status.
 */
export async function setEpisodes(
	db: Db,
	userId: string,
	details: TitleDetails,
	season: number,
	episodes: number[],
	seen: boolean
) {
	const titleId = await saveTitle(db, details);
	if (seen) {
		const rows = episodes.map((episode) => ({ userId, titleId, season, episode }));
		// D1 binds at most 100 values a query: 4 a row (5 with the default).
		for (let i = 0; i < rows.length; i += 20)
			await db
				.insert(watchEpisodes)
				.values(rows.slice(i, i + 20))
				.onConflictDoNothing();
	} else if (episodes.length)
		await db
			.delete(watchEpisodes)
			.where(
				and(
					eq(watchEpisodes.userId, userId),
					eq(watchEpisodes.titleId, titleId),
					eq(watchEpisodes.season, season),
					inArray(watchEpisodes.episode, episodes)
				)
			);
	const keys = await watchedEpisodes(db, userId, details.tmdbId);
	const had = await entryFor(db, userId, 'tv', details.tmdbId);
	const status = statusAfterEpisodes(had?.status ?? null, keys.length, details);
	if (status && status !== had?.status) await setEntry(db, userId, details, { status });
	return { watched: keys, status };
}

/** Every title on the viewer's list with its stored details. */
export async function allEntries(db: Db, userId: string) {
	const rows = await db
		.select({ status: watchlist.status, details: watchTitles.details })
		.from(watchlist)
		.innerJoin(watchTitles, eq(watchTitles.id, watchlist.titleId))
		.where(eq(watchlist.userId, userId));
	return rows.map((r) => ({
		status: r.status as WatchStatus,
		details: JSON.parse(r.details) as TitleDetails
	}));
}

export interface ImdbRating {
	rating: number;
	votes: number;
}

/** IMDb's ratings for these ids, from the nightly copy of its dataset. */
export async function imdbRatingsFor(db: Db, ids: (string | null | undefined)[]) {
	const wanted = [...new Set(ids.filter((i): i is string => !!i && /^tt\d+$/.test(i)))];
	const out = new Map<string, ImdbRating>();
	// D1 binds at most 100 values a query.
	for (let i = 0; i < wanted.length; i += 90) {
		const rows = await db
			.select()
			.from(imdbRatings)
			.where(inArray(imdbRatings.imdbId, wanted.slice(i, i + 90)));
		for (const r of rows) out.set(r.imdbId, { rating: r.rating, votes: r.votes });
	}
	return out;
}
