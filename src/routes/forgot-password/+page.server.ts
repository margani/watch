import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { EmailSetupError } from '#lib/server/email.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const email = String((await request.formData()).get('email') ?? '').trim();
		if (!email) return fail(400, { email, message: 'Enter your email.' });
		try {
			await locals.auth.api.requestPasswordReset({
				body: { email, redirectTo: '/reset-password' }
			});
		} catch (e) {
			// Only a deployment without working email gets here; say what to fix.
			if (e instanceof EmailSetupError) return fail(503, { email, message: e.message });
			if (e instanceof APIError) return fail(400, { email, message: e.message });
			throw e;
		}
		// Same answer whether or not the account exists.
		return { sent: true, email };
	}
};
