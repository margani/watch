import type { Page } from '@playwright/test';
import { expect, signUp, test } from './helpers';

/** The theme-color that applies now (its media matches), and the page's background. */
const colours = (page: Page) =>
	page.evaluate(() => {
		const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
		const applies = metas.filter((m) => !m.media || matchMedia(m.media).matches);
		const probe = document.createElement('i');
		probe.style.color = applies[0]?.content ?? '';
		document.body.append(probe);
		const meta = getComputedStyle(probe).color;
		probe.remove();
		return { meta, bg: getComputedStyle(document.documentElement).backgroundColor };
	});

const LIGHT = 'rgb(247, 245, 241)';
const DARK = 'rgb(19, 18, 16)';

// The installed desktop app paints the strip behind its window buttons with theme-color; it
// stayed dark on a dark system while the app was light.
test("theme-color follows the app's theme, not the system's", async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await signUp(page);
	await page.evaluate(() => localStorage.setItem('theme', 'light'));
	await page.goto('/');
	expect(await colours(page)).toEqual({ meta: LIGHT, bg: LIGHT });

	await page.getByRole('button', { name: 'Switch to dark theme' }).click();
	expect(await colours(page)).toEqual({ meta: DARK, bg: DARK });

	await page.goto('/for-you');
	expect(await colours(page)).toEqual({ meta: DARK, bg: DARK });
});
