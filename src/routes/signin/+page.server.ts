import { fail, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { APIError } from 'better-auth/api';
import { hasGoogle } from '#lib/server/auth-options.ts';
import { safeNext } from '#lib/safe-next.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (locals.user) redirect(303, next);
	return {
		next,
		google: hasGoogle(env),
		error: url.searchParams.get('error'),
		reset: url.searchParams.get('reset') === '1',
		deleted: url.searchParams.get('deleted') === '1'
	};
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!email || !password) return fail(400, { email, message: 'Enter your email and password.' });

		try {
			await locals.auth.api.signInEmail({ body: { email, password } });
		} catch (e) {
			if (e instanceof APIError) {
				return fail(400, { email, message: 'That email and password do not match.' });
			}
			throw e;
		}
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
