import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import type { OwnLink } from '../../watch.ts';
import { user } from './auth.schema';

export * from './auth.schema';

/**
 * Films and series from TMDB, with the details the title page shows as JSON
 * (`TitleDetails` in #lib/watch.ts). Kept once a title is on someone's list, so the list still
 * works when TMDB is down; `fetched_at` says how fresh the details are.
 */
export const watchTitles = sqliteTable(
	'watch_titles',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** 'movie' or 'tv', TMDB's own words. */
		media: text('media').notNull(),
		tmdbId: integer('tmdb_id').notNull(),
		title: text('title').notNull(),
		year: integer('year'),
		posterPath: text('poster_path'),
		details: text('details').notNull(),
		fetchedAt: integer('fetched_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [uniqueIndex('watch_titles_tmdb_idx').on(t.media, t.tmdbId)]
);

/** A viewer's own list of films and series: private like favourites and tags. */
export const watchlist = sqliteTable(
	'watchlist',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		titleId: integer('title_id')
			.notNull()
			.references(() => watchTitles.id, { onDelete: 'cascade' }),
		/** 'want', 'watching' or 'watched' (WATCH_STATUSES). */
		status: text('status').notNull(),
		/** The viewer's own rating, 1–10, or null. */
		rating: integer('rating'),
		watchedAt: integer('watched_at', { mode: 'timestamp' }),
		addedAt: integer('added_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		/**
		 * The viewer's own order within the tab, smallest first (#21). A title put on the list or moved
		 * to another tab goes above the rest there.
		 */
		position: real('position').notNull().default(0)
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.titleId] }),
		index('watchlist_status_idx').on(t.userId, t.status, t.updatedAt),
		index('watchlist_position_idx').on(t.userId, t.status, t.position)
	]
);

/**
 * What came out for a title on a viewer's list: a new episode or season of a
 * series being watched, or the release of a film they want to watch. One row per viewer and
 * item; `seen_at` when they cleared it on the list, `emailed_at` once it went out in an email.
 */
export const watchNews = sqliteTable(
	'watch_news',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		titleId: integer('title_id')
			.notNull()
			.references(() => watchTitles.id, { onDelete: 'cascade' }),
		/** 'episode', 'season' or 'release' (NEWS_KINDS). */
		kind: text('kind').notNull(),
		season: integer('season').notNull(),
		number: integer('number').notNull(),
		name: text('name').notNull(),
		airDate: text('air_date'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		seenAt: integer('seen_at', { mode: 'timestamp' }),
		emailedAt: integer('emailed_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('watch_news_item_idx').on(t.userId, t.titleId, t.kind, t.season, t.number),
		index('watch_news_unseen_idx').on(t.userId, t.seenAt)
	]
);

/** A viewer's choices for films and series: whether news also comes by email. */
export const watchSettings = sqliteTable('watch_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	emailNews: integer('email_news', { mode: 'boolean' }).notNull().default(true),
	/** Where the viewer watches: an ISO 3166-1 code; null until chosen. */
	country: text('country'),
	/** The viewer's own links on every title page (OwnLink[] in #lib/watch.ts). */
	links: text('links', { mode: 'json' }).$type<OwnLink[]>()
});

/**
 * The streaming services a viewer subscribes to, as TMDB's provider ids; name and logo
 * are kept so the list shows without asking TMDB. Private like the rest of the watch list.
 */
export const watchServices = sqliteTable(
	'watch_services',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		providerId: integer('provider_id').notNull(),
		name: text('name').notNull(),
		logoPath: text('logo_path')
	},
	(t) => [primaryKey({ columns: [t.userId, t.providerId] })]
);

/** The episodes of a series a viewer has watched, private like the rest of the list. */
export const watchEpisodes = sqliteTable(
	'watch_episodes',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		titleId: integer('title_id')
			.notNull()
			.references(() => watchTitles.id, { onDelete: 'cascade' }),
		season: integer('season').notNull(),
		episode: integer('episode').notNull(),
		watchedAt: integer('watched_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [primaryKey({ columns: [t.userId, t.titleId, t.season, t.episode] })]
);

/** A season's episodes from TMDB, kept like title details and refreshed after a day. */
export const watchSeasons = sqliteTable(
	'watch_seasons',
	{
		titleId: integer('title_id')
			.notNull()
			.references(() => watchTitles.id, { onDelete: 'cascade' }),
		season: integer('season').notNull(),
		/** JSON: SeasonEpisode[] (#lib/watch.ts). */
		episodes: text('episodes').notNull(),
		fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull()
	},
	(t) => [primaryKey({ columns: [t.titleId, t.season] })]
);

/**
 * IMDb's ratings, from its daily non-commercial dataset, loaded by the optional
 * tools/imdb/imdb_ratings.py for titles with at least 100 votes. Empty without it.
 */
export const imdbRatings = sqliteTable('imdb_ratings', {
	imdbId: text('imdb_id').primaryKey(),
	rating: real('rating').notNull(),
	votes: integer('votes').notNull()
});
