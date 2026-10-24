// Answers from TMDB and OMDb kept in the Workers cache.

/**
 * Answers kept in the Workers cache for a while, keyed by what was asked, so a page does
 * not ask on every visit. Without a cache (vite dev) it simply asks.
 */
export async function cached<T>(key: string, seconds: number, load: () => Promise<T>): Promise<T> {
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const req = new Request(`https://cache.watch.internal/${encodeURIComponent(key)}`);
	const hit = cache ? await cache.match(req).catch(() => undefined) : undefined;
	if (hit) return (await hit.json()) as T;
	const value = await load();
	await cache
		?.put(
			req,
			new Response(JSON.stringify(value), {
				headers: { 'content-type': 'application/json', 'cache-control': `max-age=${seconds}` }
			})
		)
		.catch(() => {});
	return value;
}
