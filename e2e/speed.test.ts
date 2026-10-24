import { d1, expect, signUp, test } from './helpers';

// Lets context.route see the service worker's own requests (Chromium).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

// The service worker exists only in production builds: run against `wrangler dev` (E2E_BASE_URL).
test.skip(!process.env.E2E_BASE_URL, 'needs the built Worker (E2E_BASE_URL)');

const TITLE = /The Lighthouse Keeper’s Clock/;

// Opening a title and going Back each waited about a second for the network (#7). The device now
// keeps each page's data and shows it at once while the network answers; a change the viewer makes
// clears that copy, and one made elsewhere shows as soon as the network has answered.
test('Back shows the list at once, and changes still show on it', async ({ page, context }) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 390, height: 844 });
	const email = await signUp(page);
	await expect
		.poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller).catch(() => false))
		.toBe(true);
	const list = page
		.getByRole('navigation', { name: 'Main' })
		.getByRole('link', { name: 'My list' });
	const put = () =>
		page.waitForResponse(
			(r) => r.url().endsWith('/api/movie/900001') && r.request().method() === 'PUT'
		);

	await page.goto('/movie/900001');
	let saved = put();
	await page.getByRole('button', { name: 'Want to watch' }).click();
	expect((await saved).status()).toBe(200);
	await list.click();
	await page.getByRole('link', { name: TITLE }).click();
	await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();

	// From now on the network takes 4 s to answer for a page's data.
	await context.route('**/__data.json*', async (route) => {
		await new Promise((r) => setTimeout(r, 4000));
		await route.continue().catch(() => {});
	});
	let started = Date.now();
	await page.goBack();
	await expect(page.getByRole('link', { name: TITLE })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Want to watch 1' })).toBeVisible();
	expect(Date.now() - started).toBeLessThan(2000);
	// So is a title opened before.
	started = Date.now();
	await page.getByRole('link', { name: TITLE }).click();
	await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
	expect(Date.now() - started).toBeLessThan(2000);

	// A change here clears the copy: Back waits for the network and shows it.
	saved = put();
	await page.getByRole('button', { name: 'Watched' }).click();
	expect((await saved).status()).toBe(200);
	await page.goBack();
	await expect(page.getByRole('link', { name: 'Watched 1' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByRole('link', { name: 'Want to watch 0' })).toBeVisible();

	// A change made elsewhere (another device): the copy shows first, then the new data.
	await page.getByRole('link', { name: 'Watched 1' }).click();
	await expect(page.getByRole('link', { name: TITLE })).toBeVisible({ timeout: 15_000 });
	d1(
		`UPDATE watchlist SET status = 'watching' WHERE user_id = (SELECT id FROM user WHERE email = '${email}')`
	);
	await page.getByRole('link', { name: TITLE }).click();
	await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
	await page.goBack();
	await expect(page.getByRole('link', { name: 'Watched 1' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Watching 1' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByRole('link', { name: 'Watched 0' })).toBeVisible();
});
