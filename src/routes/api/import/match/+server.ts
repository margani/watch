import { error, json } from '@sveltejs/kit';
import { searchTitles, TmdbError } from '#lib/server/tmdb.ts';
import { normTitle } from '#lib/title-key.ts';
import type { Media, TitleHit } from '#lib/watch.ts';
import type { RequestHandler } from './$types';

// POST { items: [{ media, name }] }, at most 20: the TMDB title each name from an imported
// history most likely is, or null. The same name and kind first, then the first of the kind.
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
	const items = body?.items;
	if (
		!Array.isArray(items) ||
		items.length > 20 ||
		!items.every(
			(i) =>
				i &&
				(i.media === 'movie' || i.media === 'tv') &&
				typeof i.name === 'string' &&
				i.name.trim() &&
				i.name.length <= 300
		)
	)
		error(400, 'items: up to 20 of { media: "movie" | "tv", name }');
	try {
		const out: (TitleHit | null)[] = [];
		for (const { media, name } of items as { media: Media; name: string }[]) {
			const hits = (await searchTitles(name)).filter((h) => h.media === media);
			const same = hits.find((h) => normTitle(h.title) === normTitle(name));
			out.push(same ?? hits[0] ?? null);
		}
		return json({ matches: out });
	} catch (e) {
		if (e instanceof TmdbError) error(e.code === 'not-configured' ? 503 : 502, e.message);
		throw e;
	}
};
