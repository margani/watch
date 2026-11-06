import { fail, redirect } from '@sveltejs/kit';
import { createList, listName, myLists } from '#lib/server/lists.ts';
import { watchCounts } from '#lib/server/watchlist.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const [counts, lists] = await Promise.all([
		watchCounts(locals.db, userId),
		myLists(locals.db, userId)
	]);
	return { counts, lists };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const raw = (await request.formData()).get('name');
		const name = listName(raw);
		if (!name)
			return fail(400, {
				name: String(raw ?? ''),
				error: 'Give the list a name, up to 80 characters.'
			});
		redirect(303, `/lists/${await createList(locals.db, locals.user!.id, name)}`);
	}
};
