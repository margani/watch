// Makes Watch installable and lets the viewer choose when a new version takes over (#4).
// The app's own build files and icons are cached. Pages come from the network, and a failed
// navigation gets a short offline notice instead of the browser's error page.
// A page's data (__data.json) is kept on this device too, so Back and a title seen before show at
// once while the network answers (#7). That copy is the viewer's own list: any change they make
// (every request that is not a GET, sign-out included) clears it, and so does a new version.
import { version } from '$app/env';
import { immutable } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `watch-${version}`;
const DATA_CACHE = 'watch-data';
const SHELL = new Set([
	...immutable.map((f) => '/' + f.path.replace(/^\//, '')),
	'/favicon.svg',
	'/manifest.webmanifest',
	'/icons/icon-192.png',
	'/icons/icon-512.png'
]);

self.addEventListener('install', (event) => {
	// No skipWaiting here: a new version waits until Update is tapped.
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...SHELL])));
});

self.addEventListener('activate', (event) => {
	// Nothing slow here: the page reloads on claim and its navigation waits for activation, so
	// work in here keeps the old page on screen after Update (Shelf #174).
	event.waitUntil(
		(async () => {
			// The data cache goes too: the new version's pages may want other data.
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const OFFLINE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Watch</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f5f1e8;color:#1f1a14;font:17px/1.5 system-ui,sans-serif;text-align:center;padding:1rem}@media (prefers-color-scheme:dark){body{background:#16130f;color:#f1ebe0}}</style><main><h1 style="font-weight:600">You are offline</h1><p>Watch needs a connection. It opens again once you are back online.</p></main></html>`;

const isData = (path: string) => path.endsWith('/__data.json');
/** Counts changes, so a refresh that began before one doesn't keep its now outdated answer. */
let changes = 0;

/**
 * Answers with the kept copy when there is one and fetches the page's data anyway; if it changed,
 * the page is told (`DATA_UPDATED`) and loads it again.
 */
async function staleWhileRevalidate(event: FetchEvent): Promise<Response> {
	const { request } = event;
	const path = new URL(request.url).pathname;
	const cache = await caches.open(DATA_CACHE);
	const hit = await cache.match(request);
	// Read before the copy goes to the page: a body used there can no longer be cloned, and the
	// comparison then threw, so a change made elsewhere never showed.
	const kept = hit?.clone().text();
	const before = changes;
	const fresh = fetch(request).then(async (res) => {
		// Only a plain answer is kept: a redirect (to sign-in) or an error is passed on as it is.
		if (!res.ok || res.redirected || changes !== before) return res;
		const body = await res.clone().text();
		if (kept && (await kept) !== body) {
			// Copies of the same page asked with other invalidation flags are as old as this one: the
			// page's reload must not be answered by one of them.
			for (const key of await cache.keys())
				if (new URL(key.url).pathname === path) await cache.delete(key);
			await cache.put(request, res.clone());
			const client = await self.clients.get(event.clientId);
			client?.postMessage({ type: 'DATA_UPDATED', path });
		} else await cache.put(request, res.clone());
		return res;
	});
	if (!hit) return fresh;
	event.waitUntil(fresh.catch(() => {}));
	return hit;
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (request.method !== 'GET') {
		// A change of any kind: the kept data may no longer be true. Cleared before the request goes
		// out, so the reload that follows it can't be answered from the old copy.
		changes++;
		event.respondWith(
			caches
				.delete(DATA_CACHE)
				.catch(() => false)
				.then(() => fetch(request))
		);
		return;
	}
	if (SHELL.has(url.pathname)) {
		event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
		return;
	}
	if (isData(url.pathname)) {
		event.respondWith(staleWhileRevalidate(event));
		return;
	}
	if (request.mode === 'navigate')
		event.respondWith(
			fetch(request).catch(
				() => new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
			)
		);
});
