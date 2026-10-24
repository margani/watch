export interface Mailer {
	send(message: { to: string; from: string; subject: string; text: string }): Promise<unknown>;
}

export class EmailSetupError extends Error {}

export function resetEmail(name: string, url: string) {
	return {
		subject: 'Reset your Watch password',
		text: [
			`Hi ${name || 'there'},`,
			'',
			'Someone asked to reset the password for your Watch account. To choose a new one, open:',
			'',
			url,
			'',
			'The link works for one hour. If you did not ask for this, ignore this email; your password stays the same.'
		].join('\n')
	};
}

/**
 * Sends through Cloudflare Email Sending. Failures that mean "not set up" become an
 * EmailSetupError naming what is missing, so whoever runs the site sees the fix instead of a 500.
 */
export async function sendMail(
	mailer: Mailer | undefined,
	from: string | undefined,
	message: { to: string; subject: string; text: string }
) {
	if (!mailer) {
		throw new EmailSetupError(
			'Email is not set up on this deployment: add the `send_email` binding `EMAIL` in wrangler.jsonc.'
		);
	}
	if (!from) throw new EmailSetupError('Email is not set up: set EMAIL_FROM in wrangler.jsonc.');
	try {
		await mailer.send({ ...message, from });
	} catch (failure) {
		const code = (failure as { code?: string }).code;
		const said = failure instanceof Error ? failure.message : String(failure);
		// Cloudflare reports an un-onboarded sender either way.
		if (code === 'E_SENDER_NOT_VERIFIED' || /domain config of sending domain/i.test(said)) {
			throw new EmailSetupError(
				`Cloudflare will not send from ${from}: ${from.split('@')[1]} is not onboarded for Email Sending ` +
					'on this account. Onboard it under Compute > Email Service > Email Sending, or change EMAIL_FROM.'
			);
		}
		throw failure;
	}
}
