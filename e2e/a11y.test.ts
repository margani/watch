import AxeBuilder from '@axe-core/playwright';
import { expect, signUp, test } from './helpers';

// Serious and critical WCAG 2.1 AA problems fail the run; minor ones are only listed.
async function audit(page: import('@playwright/test').Page, label: string) {
	// Legacy mode runs inside the page: the default opens a helper page, which fails here with
	// "Failed to find browser context".
	const { violations } = await new AxeBuilder({ page })
		.setLegacyMode(true)
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
	for (const v of violations)
		console.log(
			`${label}: ${v.impact} ${v.id} (${v.nodes.length}) ${v.nodes
				.slice(0, 2)
				.map((n) => n.target.join(' '))
				.join(' | ')}`
		);
	return blocking.map((v) => `${label}: ${v.id} ×${v.nodes.length}`);
}

// Every theme keeps its contrast (#1): each one is audited on every page.
for (const theme of ['paper', 'ink', 'sage', 'plum'] as const) {
	test(`pages have no serious accessibility problems (${theme})`, async ({ page }) => {
		// Every page analysed by axe takes longer than the default 30 s.
		test.setTimeout(180_000);
		const problems: string[] = [];
		await page.goto('/signin');
		await page.evaluate((t) => localStorage.setItem('theme', t), theme);
		await page.goto('/signin');
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
		problems.push(...(await audit(page, 'signin')));

		await signUp(page);
		const pages: [string, string, string?][] = [
			// Films and series, on the demo titles.
			['watchlist', '/'],
			['watch search', '/search?q=lighthouse'],
			['watch services', '/services?country=GB'],
			['watch import', '/import'],
			['watch for you', '/for-you'],
			['film', '/movie/900001'],
			['series', '/tv/900101', 'ul[aria-label="Related"]'],
			['actor', '/person/910001'],
			['composer', '/person/910020'],
			['account', '/account'],
			['privacy', '/privacy'],
			['about', '/about']
		];
		for (const [label, url, ready] of pages) {
			await page.goto(url);
			if (ready) await page.locator(ready).first().waitFor();
			problems.push(...(await audit(page, label)));
		}
		// The search box's suggestions, open (#28).
		await page.goto('/');
		await page.getByRole('combobox', { name: 'Search films and series' }).fill('light');
		await page.getByRole('option', { name: /Harbour Lights/ }).waitFor();
		await page.getByRole('combobox', { name: 'Search films and series' }).press('ArrowDown');
		problems.push(...(await audit(page, 'suggestions')));
		expect(problems).toEqual([]);
	});
}
