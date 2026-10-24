import { fail, redirect } from '@sveltejs/kit';
import { deleteAccount } from '#lib/server/account.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	email: locals.user!.email
});

export const actions: Actions = {
	delete: async ({ locals, request, cookies }) => {
		const typed = String((await request.formData()).get('confirm') ?? '').trim();
		// Typing the address makes a slip of the finger unable to delete a whole list.
		if (typed.toLowerCase() !== locals.user!.email.toLowerCase())
			return fail(400, { error: 'Type your email address exactly to delete the account.' });
		await deleteAccount(locals.db, locals.user!.id);
		for (const c of cookies.getAll())
			if (c.name.includes('better-auth')) cookies.delete(c.name, { path: '/' });
		redirect(303, '/signin?deleted=1');
	}
};
