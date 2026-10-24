import { eq } from 'drizzle-orm';
import type { Db } from './db';
import {
	user,
	watchEpisodes,
	watchlist,
	watchServices,
	watchSettings,
	watchTitles
} from './db/schema';

/** Everything the app keeps about one person, as they would want it back. */
export async function exportData(db: Db, userId: string) {
	const [me] = await db
		.select({ name: user.name, email: user.email, createdAt: user.createdAt })
		.from(user)
		.where(eq(user.id, userId));
	const list = await db
		.select({
			media: watchTitles.media,
			tmdbId: watchTitles.tmdbId,
			title: watchTitles.title,
			status: watchlist.status,
			rating: watchlist.rating,
			watchedAt: watchlist.watchedAt,
			addedAt: watchlist.addedAt
		})
		.from(watchlist)
		.innerJoin(watchTitles, eq(watchTitles.id, watchlist.titleId))
		.where(eq(watchlist.userId, userId));
	const episodes = await db
		.select({
			tmdbId: watchTitles.tmdbId,
			title: watchTitles.title,
			season: watchEpisodes.season,
			episode: watchEpisodes.episode,
			watchedAt: watchEpisodes.watchedAt
		})
		.from(watchEpisodes)
		.innerJoin(watchTitles, eq(watchTitles.id, watchEpisodes.titleId))
		.where(eq(watchEpisodes.userId, userId));
	const services = await db
		.select({ id: watchServices.providerId, name: watchServices.name })
		.from(watchServices)
		.where(eq(watchServices.userId, userId));
	const [settings] = await db
		.select({
			country: watchSettings.country,
			emailNews: watchSettings.emailNews,
			links: watchSettings.links
		})
		.from(watchSettings)
		.where(eq(watchSettings.userId, userId));
	return {
		exportedAt: new Date().toISOString(),
		account: me ?? null,
		list,
		episodes,
		services,
		settings: settings ?? null
	};
}

/** Removes the account; its sessions, list, episodes, services, settings and news go with it. */
export async function deleteAccount(db: Db, userId: string) {
	await db.delete(user).where(eq(user.id, userId));
}
