import { describe, expect, it } from 'vitest';
import { authOptions, isSignupAllowed } from './auth-options';

describe('isSignupAllowed', () => {
	it('is closed when nothing is listed', () => {
		expect(isSignupAllowed('a@example.com', undefined)).toBe(false);
		expect(isSignupAllowed('a@example.com', '')).toBe(false);
	});

	it('allows listed emails, ignoring case and spaces', () => {
		const list = ' A@example.com , b@example.com';
		expect(isSignupAllowed('a@EXAMPLE.com', list)).toBe(true);
		expect(isSignupAllowed('c@example.com', list)).toBe(false);
	});

	it('allows anyone with *', () => {
		expect(isSignupAllowed('anyone@example.com', '*')).toBe(true);
	});
});

describe('sign-up hook', () => {
	const env = {
		ORIGIN: 'http://x',
		BETTER_AUTH_SECRET: 's',
		ALLOWED_SIGNUP_EMAILS: 'owner@example.com'
	};
	const before = (hooks: Parameters<typeof authOptions>[1]) => (email: string) =>
		authOptions(env, hooks).databaseHooks.user.create.before({ email } as never);

	it('lets invited v1 users sign up and still refuses strangers', async () => {
		const check = before({ isInvited: async (e) => e === 'v1user@example.com' });
		await expect(check('v1user@example.com')).resolves.toBeUndefined();
		await expect(check('owner@example.com')).resolves.toBeUndefined();
		await expect(check('stranger@example.com')).rejects.toThrow(/invite-only/);
	});
});
