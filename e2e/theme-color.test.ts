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

const PAPER = 'rgb(245, 241, 232)';
const INK = 'rgb(22, 19, 15)';
const SAGE = 'rgb(238, 242, 234)';

async function pick(page: Page, name: string) {
	await page.getByLabel(/^Theme:/).click();
	await page.getByRole('menuitemradio', { name }).click();
}

// The installed desktop app paints the strip behind its window buttons with theme-color, so it
// follows the chosen theme; System follows the device.
test('themes: System follows the device, a chosen theme stays across pages', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await signUp(page);
	expect(await colours(page)).toEqual({ meta: INK, bg: INK });
	await expect(page.getByLabel(/^Theme:/)).toHaveAccessibleName('Theme: System');

	await pick(page, 'Sage');
	expect(await colours(page)).toEqual({ meta: SAGE, bg: SAGE });
	await expect(page.locator('html')).not.toHaveClass(/dark/);
	await page.goto('/for-you');
	expect(await colours(page)).toEqual({ meta: SAGE, bg: SAGE });

	await pick(page, 'Paper');
	expect(await colours(page)).toEqual({ meta: PAPER, bg: PAPER });
	await pick(page, 'System');
	expect(await colours(page)).toEqual({ meta: INK, bg: INK });
	await expect(page.locator('html')).toHaveClass(/dark/);
});

test('the first version’s dark setting becomes Ink', async ({ page }) => {
	await signUp(page);
	await page.evaluate(() => localStorage.setItem('theme', 'dark'));
	await page.goto('/');
	expect(await colours(page)).toEqual({ meta: INK, bg: INK });
});
