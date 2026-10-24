import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return {
		token: url.searchParams.get('token') ?? '',
		invalid: url.searchParams.get('error') === 'INVALID_TOKEN' || !url.searchParams.get('token')
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const form = await request.formData();
		const token = String(form.get('token') ?? '');
		const newPassword = String(form.get('password') ?? '');
		if (newPassword.length < 8) return fail(400, { message: 'Use at least 8 characters.' });
		try {
			await locals.auth.api.resetPassword({ body: { token, newPassword } });
		} catch (e) {
			if (e instanceof APIError) {
				return fail(400, {
					message: 'This link has expired or was already used. Ask for a new one.'
				});
			}
			throw e;
		}
		redirect(303, '/signin?reset=1');
	}
};
