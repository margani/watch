// Makes Watch installable and lets the viewer choose when a new version takes over (#4).
// Only the app's own build files and icons are cached. Pages and their data are personal (a
// viewer's list), so they always come from the network, and a failed navigation gets a short
// offline notice instead of the browser's error page.
import { version } from '$app/env';
import { immutable } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `watch-${version}`;
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
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const OFFLINE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Watch</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f5f1e8;color:#1f1a14;font:17px/1.5 system-ui,sans-serif;text-align:center;padding:1rem}@media (prefers-color-scheme:dark){body{background:#16130f;color:#f1ebe0}}</style><main><h1 style="font-weight:600">You are offline</h1><p>Watch needs a connection. It opens again once you are back online.</p></main></html>`;

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;
	if (SHELL.has(url.pathname)) {
		event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
		return;
	}
	if (request.mode === 'navigate')
		event.respondWith(
			fetch(request).catch(
				() => new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
			)
		);
});
