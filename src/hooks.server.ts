import { env } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/env';
import { getDb } from '#lib/server/db/index.ts';
import { createAuth } from '#lib/server/auth.ts';

/** Everything else needs a session: lists are private. */
const PUBLIC_PATHS = [
	'/signin',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/version',
	'/privacy',
	'/api/auth'
];

function isPublic(pathname: string) {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const db = getDb(env.DB);
	const auth = createAuth(db, env);
	event.locals.db = db;
	event.locals.auth = auth;

	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.user = session.user;
		event.locals.session = session.session;
	}

	const { pathname, search } = event.url;
	if (!session && !isPublic(pathname)) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ message: 'Sign in first' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		const next =
			pathname === '/' && !search ? '' : `?next=${encodeURIComponent(pathname + search)}`;
		redirect(303, `/signin${next}`);
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	if (event.url.hostname.endsWith('.workers.dev')) {
		response.headers.set('x-robots-tag', 'noindex');
	}
	return response;
};
