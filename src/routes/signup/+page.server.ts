import { fail, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { APIError } from 'better-auth/api';
import { hasGoogle } from '#lib/server/auth-options.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return { google: hasGoogle(env) };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!name || !email || password.length < 8) {
			return fail(400, {
				name,
				email,
				message: 'Enter your name, email and a password of at least 8 characters.'
			});
		}

		try {
			await locals.auth.api.signUpEmail({ body: { name, email, password } });
		} catch (e) {
			if (e instanceof APIError) {
				return fail(e.statusCode === 403 ? 403 : 400, {
					name,
					email,
					message: e.message || 'Could not create the account.'
				});
			}
			throw e;
		}
		redirect(303, '/');
	}
};
