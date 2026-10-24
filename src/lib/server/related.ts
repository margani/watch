// A title's related titles (sequels, its film series, spin-offs) and similar ones (#31).
import type { Media, TitleHit } from '#lib/watch.ts';
import { cached } from './cache.ts';
import { collectionParts, similarTitles, titleHit, tmdbDemo } from './tmdb.ts';
import { demoMore } from './watch-demo.ts';
import { wikidataRelated } from './wikidata.ts';

const RELATED_MAX = 40;
const SIMILAR_MAX = 20;
/** TMDB lookups at a time for Wikidata's titles: a franchise can name forty. */
const AT_ONCE = 8;

const key = (h: { media: Media; tmdbId: number }) => `${h.media}:${h.tmdbId}`;

export async function moreTitles(
	media: Media,
	tmdbId: number,
	collectionId: number | null
): Promise<{ related: TitleHit[]; similar: TitleHit[] }> {
	if (tmdbDemo()) return demoMore(media, tmdbId);
	return cached(`more/${media}/${tmdbId}`, 24 * 3600, async () => {
		const [parts, linked, similar] = await Promise.all([
			collectionId ? collectionParts(collectionId).catch(() => []) : [],
			wikidataRelated(media, tmdbId),
			similarTitles(media, tmdbId).catch(() => [])
		]);
		const self = `${media}:${tmdbId}`;
		const seen = new Set([self, ...parts.map(key)]);
		const todo = linked.filter((l) => !seen.has(key(l))).slice(0, RELATED_MAX);
		const fetched: TitleHit[] = [];
		for (let i = 0; i < todo.length; i += AT_ONCE)
			for (const h of await Promise.all(
				todo.slice(i, i + AT_ONCE).map((l) => titleHit(l.media, l.tmdbId).catch(() => null))
			))
				if (h) fetched.push(h);
		const related = [...parts.filter((p) => key(p) !== self), ...fetched]
			.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))
			.slice(0, RELATED_MAX);
		const shown = new Set([self, ...related.map(key)]);
		return {
			related,
			similar: similar.filter((h) => !shown.has(key(h))).slice(0, SIMILAR_MAX)
		};
	});
}
