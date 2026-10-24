import { env } from 'cloudflare:workers';
import type { PageServerLoad } from './$types';

/** Where the code lives; a self-hosted fork sets SOURCE_URL to its own repository. */
const UPSTREAM = 'https://github.com/margani/watch';

// The facts /version reports, for people (#22).
export const load: PageServerLoad = () => {
	const configured = (env as { SOURCE_URL?: string }).SOURCE_URL?.trim().replace(/\/+$/, '');
	return {
		version: __APP_VERSION__,
		commit: __APP_COMMIT__,
		built: __APP_BUILT__,
		source: configured && /^https:\/\/[^\s"]+$/.test(configured) ? configured : UPSTREAM
	};
};
