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

	await expect(page.getByText('Where to watch: data by')).toBeVisible();

	// Elsewhere JustWatch is credited once, beside a title's where-to-watch links, not on every page
	// (#27).
	await page.goto('/services');
	await page.getByLabel('Country').selectOption('GB');
	await expect(page).toHaveURL(/country=GB/);
	await page.getByRole('checkbox', { name: 'Netflix' }).check();
	await expect(page.getByRole('link', { name: 'JustWatch' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/\/\?services=saved$/);
	await expect(page.getByText('Your services:')).toBeVisible();
	await expect(page.getByRole('link', { name: 'JustWatch' })).toHaveCount(0);
	await page.goto('/for-you');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: 'JustWatch' })).toHaveCount(0);
	await page.goto('/movie/900001');
	const where = page.getByRole('region', { name: 'Where to watch' });
	await expect(where.getByText('via JustWatch')).toBeVisible();
	await expect(where.getByRole('link', { name: 'JustWatch' })).toHaveAttribute(
		'href',
		'https://www.justwatch.com/'
	);
});
