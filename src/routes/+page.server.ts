import { isWatchStatus, whereToWatch, type WatchStatus } from '#lib/watch.ts';
import { tmdbDemo } from '#lib/server/tmdb.ts';
import {
	emailsNews,
	imdbRatingsFor,
	listWatch,
	myServices,
	unseenNews,
	watchCountry,
	watchCounts
} from '#lib/server/watchlist.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('app:watch-news');
	const raw = url.searchParams.get('tab');
	const userId = locals.user!.id;
	const counts = await watchCounts(locals.db, userId);
	// Without a tab, open on what the viewer is watching, if anything.
	const tab: WatchStatus = isWatchStatus(raw) ? raw : counts.watching ? 'watching' : 'want';
	const services = await myServices(locals.db, userId);
	const country = await watchCountry(locals.db, userId);
	const mine = new Set(services.map((p) => p.id));
	const rows = await listWatch(locals.db, userId, tab);
	const ratings = await imdbRatingsFor(
		locals.db,
		rows.map((r) => r.imdbId)
	);
	const titles = rows.map(({ providers, imdbId, ...t }) => ({
		...t,
		imdb: (imdbId && ratings.get(imdbId)) || null,
		// Which of the viewer's own services has it; the full list is on the title page.
		onMine: country ? (whereToWatch(providers, country, mine)?.mine ?? []) : []
	}));
	return {
		tab,
		counts,
		titles,
		services,
		news: await unseenNews(locals.db, userId),
		emailNews: await emailsNews(locals.db, userId),
		demo: tmdbDemo()
	};
};
