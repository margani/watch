import type { BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { resetEmail, sendMail, type Mailer } from './email';

export interface AuthEnv {
	ORIGIN: string;
	BETTER_AUTH_SECRET: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	/**
	 * Who may create an account: a comma-separated list of emails, `*` for anyone,
	 * or empty for nobody. Closed unless set, so a new instance is not open to the world by
	 * accident.
	 */
	ALLOWED_SIGNUP_EMAILS?: string;
	EMAIL?: Mailer;
	EMAIL_FROM?: string;
}

export function isSignupAllowed(email: string, allowed: string | undefined): boolean {
	const list = (allowed ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	if (list.includes('*')) return true;
	return list.includes(email.trim().toLowerCase());
}

export function hasGoogle(env: Partial<AuthEnv>): boolean {
	return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export interface AuthHooks {
	/** Emails invited outside ALLOWED_SIGNUP_EMAILS, such as v1 users. */
	isInvited?: (email: string) => Promise<boolean>;
	onUserCreated?: (user: { id: string; email: string }) => Promise<void>;
}

/** Options shared by the runtime and the schema-generation CLI; nothing here may import $app. */
export function authOptions(env: AuthEnv, hooks: AuthHooks = {}) {
	return {
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			resetPasswordTokenExpiresIn: 60 * 60,
			revokeSessionsOnPasswordReset: true,
			sendResetPassword: async ({ user, url }) => {
				await sendMail(env.EMAIL, env.EMAIL_FROM, {
					to: user.email,
					...resetEmail(user.name, url)
				});
			}
		},
		socialProviders: hasGoogle(env)
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID!,
						clientSecret: env.GOOGLE_CLIENT_SECRET!
					}
				}
			: undefined,
		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
			// The session rides in a signed cookie for five minutes, so a page doesn't first wait for
			// D1 to look it up (#7). Signing out elsewhere takes effect here within those minutes.
			cookieCache: { enabled: true, maxAge: 5 * 60 }
		},
		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						// Covers both email sign-up and a first Google sign-in.
						const allowed =
							isSignupAllowed(user.email, env.ALLOWED_SIGNUP_EMAILS) ||
							((await hooks.isInvited?.(user.email)) ?? false);
						if (!allowed) {
							throw new APIError('FORBIDDEN', {
								message: 'Sign-up is invite-only. Ask whoever runs this site to add your email.'
							});
						}
					},
					after: async (user) => {
						await hooks.onUserCreated?.(user);
					}
				}
			}
		}
	} satisfies Omit<BetterAuthOptions, 'database'>;
}
