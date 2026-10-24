import { expect, signUp, test } from './helpers';

const SECTIONS = ['My list', 'For you', 'Search', 'Services'];

// On a phone the menu is a tab bar at the bottom, within thumb reach, and the top row names the
// section.
for (const width of [390, 360])
	test(`the phone menu is a tab bar at the bottom, big enough to tap at ${width} px`, async ({
		page
	}) => {
		const height = 800;
		await page.setViewportSize({ width, height });
		await signUp(page);
		const nav = page.getByRole('navigation', { name: 'Main' });
		const links = nav.getByRole('link');
		await expect(links).toHaveText(SECTIONS);
		const bar = (await nav.boundingBox())!;
		expect(bar.y + bar.height).toBeCloseTo(height, 0);
		for (const t of await links.all()) {
			const box = (await t.boundingBox())!;
			expect(box.width).toBeGreaterThanOrEqual(48);
			expect(box.height).toBeGreaterThanOrEqual(56);
			expect(box.x + box.width).toBeLessThanOrEqual(width);
		}
		for (const t of [page.getByLabel('Account'), page.getByLabel(/^Theme:/)]) {
			const box = (await t.boundingBox())!;
			expect(box.width).toBeGreaterThanOrEqual(40);
			expect(box.height).toBeGreaterThanOrEqual(40);
		}

		const banner = page.getByRole('banner');
		await expect(banner).toContainText('My list');
		await links.filter({ hasText: 'For you' }).click();
		await expect(page).toHaveURL(/\/for-you$/);
		await expect(banner).toContainText('For you');
		await expect(links.filter({ hasText: 'For you' })).toHaveAttribute('aria-current', 'page');

		// The end of the page scrolls clear of the bar.
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		const end = await page
			.locator('main')
			.evaluate((m) => m.lastElementChild!.getBoundingClientRect().bottom);
		expect(end).toBeLessThanOrEqual(bar.y);
	});

test('on a desktop the menu stays in the top row', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await signUp(page);
	const nav = page.getByRole('navigation', { name: 'Main' });
	await expect(nav.getByRole('link')).toHaveText(SECTIONS);
	expect((await nav.boundingBox())!.y).toBeLessThan(64);
	expect((await page.getByRole('heading', { level: 1 }).boundingBox())!.width).toBeGreaterThan(1);
});

// The list's own heading would repeat the top bar's name: two titles on a phone.
test('the list is named once on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 800 });
	await signUp(page);
	await expect(page.getByRole('banner')).toContainText('My list');
	const h1 = page.getByRole('heading', { level: 1, name: 'Films and series' });
	await expect(h1).toBeAttached();
	expect((await h1.boundingBox())!.width).toBeLessThanOrEqual(1);
});
