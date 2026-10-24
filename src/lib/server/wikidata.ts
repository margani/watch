// Titles TMDB's search can't find by the name people use (#28): "Seven" never finds Se7en there,
// not even with its year, because TMDB matches its own title only. Wikidata knows the other names
// and records each film's and series' TMDB id, so its best few matches are looked up on TMDB.
// Free and open (CC0); Wikimedia asks for a User-Agent naming the app and a contact.
import type { Media } from '#lib/watch.ts';

const API = 'https://www.wikidata.org/w/api.php';
const UA = 'Watch (https://github.com/margani/watch)';
const PROPS: [string, Media][] = [
	['P4947', 'movie'],
	['P4983', 'tv']
];

async function call(params: Record<string, string>, signal: AbortSignal) {
	const url = new URL(API);
	for (const [k, v] of Object.entries({ ...params, format: 'json' })) url.searchParams.set(k, v);
	const res = await fetch(url, { headers: { 'user-agent': UA }, signal });
	if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
	return (await res.json()) as Record<string, unknown>;
}

/** The TMDB ids of Wikidata's best matches, best first; none when Wikidata is slow or down. */
export async function wikidataMatches(
	query: string,
	limit = 3
): Promise<{ media: Media; tmdbId: number }[]> {
	// Search waits on this, so it gets little time.
	const signal = AbortSignal.timeout(2500);
	try {
		const found = await call(
			{
				action: 'query',
				list: 'search',
				srsearch: `${query} haswbstatement:P4947|P4983`,
				srlimit: String(limit),
				srprop: ''
			},
			signal
		);
		const items = (((found.query as Record<string, unknown>)?.search as { title: string }[]) ?? [])
			.map((r) => r.title)
			.filter((t) => /^Q\d+$/.test(t));
		const ids = await Promise.all(
			items.map(async (item) => {
				for (const [prop, media] of PROPS) {
					const r = await call({ action: 'wbgetclaims', entity: item, property: prop }, signal);
					const claims = (
						r.claims as Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>
					)?.[prop];
					const tmdbId = Number(claims?.[0]?.mainsnak?.datavalue?.value);
					if (Number.isSafeInteger(tmdbId) && tmdbId > 0) return { media, tmdbId };
				}
				return null;
			})
		);
		return ids.filter((x) => !!x);
	} catch {
		return [];
	}
}
