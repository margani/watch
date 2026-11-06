import { error, fail, redirect } from '@sveltejs/kit';
import {
	deleteList,
	listCount,
	listName,
	listWithTitles,
	pickableTitles,
	renameList
} from '#lib/server/lists.ts';
import { listIdOf } from '#lib/server/list-api.ts';
import { watchCounts } from '#lib/server/watchlist.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const id = listIdOf(params.id);
	const userId = locals.user!.id;
	const [list, counts, lists, pickable] = await Promise.all([
		listWithTitles(locals.db, userId, id),
		watchCounts(locals.db, userId),
		listCount(locals.db, userId),
		pickableTitles(locals.db, userId)
	]);
	// Someone else's list answers like one that doesn't exist.
	if (!list) error(404, 'No such list');
	return { list, counts, lists, pickable };
};

export const actions: Actions = {
	rename: async ({ locals, params, request }) => {
		const raw = (await request.formData()).get('name');
		const name = listName(raw);
		if (!name) return fail(400, { renameError: 'Give the list a name, up to 80 characters.' });
		if (!(await renameList(locals.db, locals.user!.id, listIdOf(params.id), name)))
			error(404, 'No such list');
		return { renamed: true };
	},
	delete: async ({ locals, params }) => {
		if (!(await deleteList(locals.db, locals.user!.id, listIdOf(params.id))))
			error(404, 'No such list');
		redirect(303, '/lists');
	}
};
