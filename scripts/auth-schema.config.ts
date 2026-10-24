// Only for `npm run auth:schema`: the better-auth CLI loads this to know which tables to write.
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { authOptions } from '../src/lib/server/auth-options';

export const auth = betterAuth({
	...authOptions({ ORIGIN: 'http://localhost', BETTER_AUTH_SECRET: 'schema-only' }),
	database: drizzleAdapter({} as never, { provider: 'sqlite' })
});
