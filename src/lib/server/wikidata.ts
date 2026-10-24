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

const SPARQL = 'https://query.wikidata.org/sparql';
// follows, followed by, based on, derivative work, has spin-off: either way round. Pornographic
// parodies (Big Bang's) and fan films (Harry Potter's) are left out, besides TMDB's adult flag.
const LINKS = 'wdt:P155|wdt:P156|wdt:P144|wdt:P4969|wdt:P2512';

/**
 * Sequels, prequels, spin-offs, the rest of its series and franchise (#31): what TMDB has no
 * relation for (Young Sheldon for The Big Bang Theory). Empty when Wikidata is slow or down.
 */
export async function wikidataRelated(
	media: Media,
	tmdbId: number
): Promise<{ media: Media; tmdbId: number }[]> {
	const prop = media === 'movie' ? 'P4947' : 'P4983';
	const query = `SELECT DISTINCT ?m ?t WHERE {
  ?s wdt:${prop} "${tmdbId}" .
  { ?s ${LINKS} ?o } UNION { ?o ${LINKS} ?s }
  UNION { ?s wdt:P179 ?x . ?o wdt:P179 ?x }
  UNION { ?s wdt:P8345 ?f . ?o wdt:P8345 ?f }
  OPTIONAL { ?o wdt:P4947 ?m } OPTIONAL { ?o wdt:P4983 ?t }
  FILTER(?o != ?s && (BOUND(?m) || BOUND(?t)))
  FILTER NOT EXISTS { ?o wdt:P136/wdt:P279* wd:Q185529 }
  FILTER NOT EXISTS { ?o wdt:P31 wd:Q2301591 }
} LIMIT 80`;
	try {
		const url = new URL(SPARQL);
		url.searchParams.set('query', query);
		url.searchParams.set('format', 'json');
		const res = await fetch(url, {
			headers: { 'user-agent': UA, accept: 'application/sparql-results+json' },
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return [];
		const body = (await res.json()) as {
			results?: { bindings?: Record<string, { value: string } | undefined>[] };
		};
		const out = new Map<string, { media: Media; tmdbId: number }>();
		for (const b of body.results?.bindings ?? [])
			for (const [key, kind] of [
				['m', 'movie'],
				['t', 'tv']
			] as const) {
				const id = Number(b[key]?.value);
				if (Number.isSafeInteger(id) && id > 0)
					out.set(`${kind}:${id}`, { media: kind, tmdbId: id });
			}
		return [...out.values()];
	} catch {
		return [];
	}
}
