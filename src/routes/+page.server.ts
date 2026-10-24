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
	// One query after another kept the list waiting 300-530 ms (#7); only the rows need the tab, and
	// the tab needs the counts only when the address names none.
	const asked = isWatchStatus(raw) ? raw : null;
	const [counts, services, country, news, emailNews, askedRows] = await Promise.all([
		watchCounts(locals.db, userId),
		myServices(locals.db, userId),
		watchCountry(locals.db, userId),
		unseenNews(locals.db, userId),
		emailsNews(locals.db, userId),
		asked ? listWatch(locals.db, userId, asked) : null
	]);
	// Without a tab, open on what the viewer is watching, if anything.
	const tab: WatchStatus = asked ?? (counts.watching ? 'watching' : 'want');
	const mine = new Set(services.map((p) => p.id));
	const rows = askedRows ?? (await listWatch(locals.db, userId, tab));
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
		news,
		emailNews,
		demo: tmdbDemo()
	};
};
