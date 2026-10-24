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

for (const scheme of ['light', 'dark'] as const) {
	test(`pages have no serious accessibility problems (${scheme})`, async ({ page }) => {
		// Every page analysed by axe takes longer than the default 30 s.
		test.setTimeout(180_000);
		await page.emulateMedia({ colorScheme: scheme });
		const problems: string[] = [];
		await page.goto('/signin');
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
			['series', '/tv/900101'],
			['account', '/account'],
			['privacy', '/privacy']
		];
		for (const [label, url, ready] of pages) {
			await page.goto(url);
			if (ready) await page.locator(ready).first().waitFor();
			problems.push(...(await audit(page, label)));
		}
		expect(problems).toEqual([]);
	});
}
