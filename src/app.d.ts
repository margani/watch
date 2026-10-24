import type { Session, User } from 'better-auth';
import type { Auth } from '#lib/server/auth.ts';
import type { Db } from '#lib/server/db/index.ts';

declare global {
	const __APP_VERSION__: string;
	const __APP_COMMIT__: string;

	namespace App {
		interface Locals {
			db: Db;
			auth: Auth;
			user?: User;
			session?: Session;
		}
	}
}

export {};
