import { execSync } from 'node:child_process';
import { expect, signUp, test } from './helpers';

// Chrome offers installing through `beforeinstallprompt`; the app keeps it for the account menu
// (#4). Watch had a manifest but no menu item, so nothing in the app offered to install it.
test('the account menu offers Install app while the browser does', async ({ page }) => {
	await signUp(page);
	const menu = page.getByLabel('Account');
	await menu.click();
	await expect(page.getByRole('menuitem', { name: 'Account' })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: 'Install app' })).toHaveCount(0);
	await menu.click();

	await page.evaluate(() => {
		const e = new Event('beforeinstallprompt', { cancelable: true });
		const w = window as unknown as { prompted: number };
		w.prompted = 0;
		Object.assign(e, {
			prompt: async () => void w.prompted++,
			userChoice: Promise.resolve({ outcome: 'accepted' })
		});
		dispatchEvent(e);
	});
	await menu.click();
	await page.getByRole('menuitem', { name: 'Install app' }).click();
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { prompted: number }).prompted))
		.toBe(1);
	// The prompt can be used once: the item goes until the browser offers again.
	await expect(page.getByRole('menuitem', { name: 'Install app' })).toHaveCount(0);
});

// The service worker exists only in production builds: this part runs against the built Worker
// under `wrangler dev` (E2E_BASE_URL), and rebuilds in the middle.
test('the built app is installable, and a new version waits for Update', async ({ page }) => {
	test.skip(!process.env.E2E_BASE_URL, 'needs the built Worker (E2E_BASE_URL)');
	test.setTimeout(240_000);
	await signUp(page);
	await expect
		.poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller).catch(() => false))
		.toBe(true);
	const cdp = await page.context().newCDPSession(page);
	const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
	// Playwright's contexts count as incognito, where Chrome never installs; nothing else may fail.
	expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual(
		[]
	);

	const version = () => page.evaluate(() => fetch('/_app/version.json').then((r) => r.text()));
	const before = await version();
	execSync('npm run build', { stdio: 'ignore' });
	await expect.poll(version, { timeout: 60_000 }).not.toBe(before);
	// The new version.json can be served before the rebuilt worker script is (Shelf CI on #182).
	await expect
		.poll(() => page.evaluate(() => fetch('/service-worker.js').then((r) => r.status)), {
			timeout: 60_000
		})
		.toBe(200);
	await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
	const update = page.getByRole('button', { name: 'Update' });
	await expect(update).toBeVisible({ timeout: 30_000 });
	const tapped = Date.now();
	await update.click();
	await expect(update).toBeHidden({ timeout: 10_000 });
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	expect(Date.now() - tapped).toBeLessThan(10_000);
	expect(await version()).not.toBe(before);
});
