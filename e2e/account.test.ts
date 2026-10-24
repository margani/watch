import { readFileSync } from 'node:fs';
import { expect, hydrated, password, signUp, test } from './helpers';

test('download my data, then delete the account and everything on it', async ({ page }) => {
	const email = await signUp(page);
	await page.goto('/movie/900001');
	const add = page.waitForResponse(
		(r) => r.url().endsWith('/api/movie/900001') && r.request().method() === 'PUT'
	);
	await page.getByRole('button', { name: 'Want to watch', exact: true }).click();
	expect((await add).status()).toBe(200);

	await page.goto('/account');
	const download = page.waitForEvent('download');
	await page.getByRole('link', { name: 'Download my data' }).click();
	const file = await (await download).path();
	const data = JSON.parse(readFileSync(file, 'utf8'));
	expect(data.account.email).toBe(email);
	expect(data.list).toEqual([
		expect.objectContaining({ media: 'movie', tmdbId: 900001, status: 'want' })
	]);

	const confirm = page.getByLabel('Your email address');
	await confirm.fill('someone-else@example.com');
	await page.getByRole('button', { name: 'Delete my account' }).click();
	await expect(page.getByRole('alert')).toContainText('Type your email address exactly');
	await hydrated(page);
	await page.getByLabel('Your email address').fill(email);
	await page.getByRole('button', { name: 'Delete my account' }).click();
	await expect(page).toHaveURL(/\/signin\?deleted=1$/);
	await expect(page.getByRole('status')).toContainText('were deleted');

	// The account is gone: its password no longer signs in.
	await hydrated(page);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('do not match');
});

test('the privacy page is open to everyone', async ({ page }) => {
	await page.goto('/privacy');
	await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
	await page.goto('/signin');
	await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
});
