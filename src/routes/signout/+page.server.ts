import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Sign-out is a POST: the old GET /logout could be triggered by any page linking to it.
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await locals.auth.api.signOut({ headers: request.headers });
		redirect(303, '/signin');
	}
};
