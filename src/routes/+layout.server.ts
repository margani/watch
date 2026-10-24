import { unseenNewsCount } from '#lib/server/watchlist.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	// Cleared on the list, which invalidates this so the menu's dot goes too.
	depends('app:watch-news');
	const u = locals.user;
	return {
		user: u ? { name: u.name, email: u.email, image: u.image ?? null } : null,
		news: u ? await unseenNewsCount(locals.db, u.id) : 0
	};
};
