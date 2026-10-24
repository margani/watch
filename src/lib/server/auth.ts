import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import type { Db } from './db';
import { authOptions, type AuthEnv } from './auth-options';

export function createAuth(db: Db, env: AuthEnv) {
	const options = authOptions(env);
	return betterAuth({
		...options,
		database: drizzleAdapter(db, { provider: 'sqlite' }),
		// Lets form actions that call auth.api.* set the session cookie; must stay last.
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

export type Auth = ReturnType<typeof createAuth>;
