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

describe('email sign-up on an invite-only instance (#35)', () => {
	// Made-up addresses; an in-memory database, so nothing leaves the test.
	async function instance(emailFrom: string | undefined) {
		const { betterAuth } = await import('better-auth');
		const { memoryAdapter } = await import('better-auth/adapters/memory');
		const sent: { to: string; text: string }[] = [];
		const env = {
			ORIGIN: 'http://localhost:5173',
			BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-0123',
			ALLOWED_SIGNUP_EMAILS: 'invitee@example.test',
			EMAIL: { send: async (m: { to: string; text: string }) => void sent.push(m) },
			EMAIL_FROM: emailFrom
		};
		const db = { user: [], session: [], account: [], verification: [] } as Record<
			string,
			unknown[]
		>;
		const auth = betterAuth({
			...authOptions(env),
			database: memoryAdapter(db),
			logger: { disabled: true }
		});
		return { auth, db, sent };
	}
	const body = { name: 'Someone', email: 'invitee@example.test', password: 'some-pass-123' };

	it('gives no session for an invited address until its owner confirms it', async () => {
		const { auth, db, sent } = await instance('noreply@mail.example.test');
		const signedUp = await auth.api.signUpEmail({ body });
		expect(signedUp.token).toBeNull();
		await expect(
			auth.api.signInEmail({ body: { email: body.email, password: body.password } })
		).rejects.toThrow(/not verified/i);
		expect(db.session).toHaveLength(0);
		expect(sent.length).toBeGreaterThan(0);
		expect(sent.every((m) => m.to === 'invitee@example.test')).toBe(true);
		expect(sent[0].text).toMatch(/verify-email\?token=/);
	});

	it('still signs up straight away where the site cannot send email', async () => {
		const { auth } = await instance(undefined);
		const signedUp = await auth.api.signUpEmail({ body });
		expect(signedUp.token).toBeTruthy();
	});
});
