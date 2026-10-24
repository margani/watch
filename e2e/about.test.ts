import { expect, signUp, test } from './helpers';

// The account menu's About: version, the deployed commit, build time, source and credits (#22).
test('About shows the running version and commit, and the credits', async ({ page }) => {
	await signUp(page);
	const v = (await (await page.request.get('/version')).json()) as {
		version: string;
		commit: string;
	};
	expect(v.commit).toMatch(/^[0-9a-f]{7,40}$/);
	await page.getByLabel('Account').click();
	await page.getByRole('menuitem', { name: 'About' }).click();
	await expect(page).toHaveURL(/\/about$/);
	await expect(page.getByRole('heading', { level: 1, name: 'About Watch' })).toBeVisible();
	const facts = page.getByRole('definition');
	await expect(facts.nth(0)).toHaveText(v.version);
	await expect(page.getByRole('link', { name: v.commit.slice(0, 7) })).toHaveAttribute(
		'href',
		`https://github.com/margani/watch/commit/${v.commit}`
	);
	await expect(facts.nth(2).locator('time')).toHaveAttribute('datetime', /^\d{4}-\d\d-\d\dT/);
	// The credits TMDB, JustWatch and IMDb ask for.
	await expect(page.getByRole('img', { name: 'TMDB' })).toBeVisible();
	await expect(
		page.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.')
	).toBeVisible();
	await expect(page.getByText('Information courtesy of')).toBeVisible();

	// Beside the where-to-watch data, JustWatch stays credited.
	await page.goto('/services?country=GB');
	await expect(page.getByText('Streaming data:')).toBeVisible();
});
