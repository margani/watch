import { describe, expect, it, vi } from 'vitest';
import { EmailSetupError, resetEmail, sendMail } from './email';

const msg = { to: 'a@example.com', subject: 's', text: 't' };

describe('sendMail', () => {
	it('names the missing binding', async () => {
		await expect(sendMail(undefined, 'x@mail.example.com', msg)).rejects.toThrow(/send_email/);
	});

	it('turns an un-onboarded domain into a setup message naming the domain', async () => {
		const mailer = {
			send: vi.fn().mockRejectedValue(new Error('could not find domain config of sending domain'))
		};
		const err = await sendMail(mailer, 'noreply@mail.example.com', msg).catch((e) => e);
		expect(err).toBeInstanceOf(EmailSetupError);
		expect(err.message).toMatch(/mail\.example\.com is not onboarded/);
	});

	it('passes other failures through', async () => {
		const mailer = { send: vi.fn().mockRejectedValue(new Error('rate limited')) };
		await expect(sendMail(mailer, 'noreply@mail.example.com', msg)).rejects.toThrow('rate limited');
	});

	it('sends from the configured address', async () => {
		const mailer = { send: vi.fn().mockResolvedValue(undefined) };
		await sendMail(mailer, 'noreply@mail.example.com', msg);
		expect(mailer.send).toHaveBeenCalledWith({ ...msg, from: 'noreply@mail.example.com' });
	});
});

describe('resetEmail', () => {
	it('includes the link', () => {
		expect(resetEmail('Ada', 'https://x/reset?token=1').text).toContain('https://x/reset?token=1');
	});

	it('uses the app name', () => {
		expect(resetEmail('Ada', 'https://x').subject).toBe('Reset your Watch password');
	});
});
