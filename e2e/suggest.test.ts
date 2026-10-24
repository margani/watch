import { d1, expect, signUp, test } from './helpers';

// Suggestions under the search box while typing (#28): asked once typing pauses, not per key, and
// as rich as the results page.
test('suggestions come after a pause in typing, with poster, rating and status', async ({
	page
}) => {
	d1(
		"INSERT INTO imdb_ratings (imdb_id, rating, votes) VALUES ('tt9000001', 7.8, 12345) ON CONFLICT(imdb_id) DO UPDATE SET rating = 7.8, votes = 12345"
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await signUp(page);
	await page.goto('/movie/900001');
	const saved = page.waitForResponse(
		(r) => r.url().endsWith('/api/movie/900001') && r.request().method() === 'PUT'
	);
	await page.getByRole('button', { name: 'Want to watch' }).click();
	expect((await saved).status()).toBe(200);

	await page.goto('/');
	const asked: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes('/api/search')) asked.push(new URL(r.url()).searchParams.get('q')!);
	});
	const box = page.getByRole('combobox', { name: 'Search films and series' });
	const answer = page.waitForResponse((r) => r.url().includes('/api/search'));
	// Keys 60 ms apart, quicker than the pause: one request, for the whole word.
	await box.pressSequentially('light', { delay: 60 });
	expect((await answer).status()).toBe(200);
	expect(asked).toEqual(['light']);

	const list = page.getByRole('listbox', { name: 'Suggestions' });
	await expect(box).toHaveAttribute('aria-expanded', 'true');
	const clock = list.getByRole('option', { name: /The Lighthouse Keeper’s Clock/ });
	await expect(clock).toContainText('Film · 2019');
	await expect(clock).toContainText('IMDb 7.8');
	await expect(clock).toContainText('Want to watch');
	// Demo titles have no poster image, so the stand-in poster shows.
	await expect(clock.locator('.aspect-\\[2\\/3\\]')).toHaveCount(1);
	await expect(list.getByRole('option', { name: /Harbour Lights/ })).toContainText('Series');
	await expect(list.getByRole('option', { name: 'All results for “light”' })).toBeVisible();

	// A query answered before shows at once, without asking again.
	await box.press('Backspace');
	await box.press('t');
	await expect(clock).toBeVisible();
	expect(asked).toEqual(['light']);

	// Escape closes; arrows reopen and choose; Enter opens the chosen title.
	await box.press('Escape');
	await expect(list).toBeHidden();
	await box.press('ArrowDown');
	await expect(list).toBeVisible();
	await expect(list.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
	const first = (await list.getByRole('option').first().getAttribute('href'))!;
	await box.press('Enter');
	await expect(page).toHaveURL(new RegExp(`${first}$`));
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	// A tap on a suggestion opens it; the last row opens all the results.
	await page.goto('/search');
	await page.getByRole('combobox', { name: 'Search films and series' }).fill('harbour');
	await page.getByRole('option', { name: /Harbour Lights/ }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Harbour Lights' })).toBeVisible();
	await page.goto('/');
	await page.getByRole('combobox', { name: 'Search films and series' }).fill('paper');
	await page.getByRole('option', { name: 'All results for “paper”' }).click();
	await expect(page).toHaveURL(/\/search\?q=paper$/);
	await expect(page.getByRole('list', { name: 'Results' }).getByRole('link')).toHaveCount(2);

	// Nothing found says so; one letter asks nothing.
	await page.goto('/');
	const none = page.waitForResponse((r) => r.url().includes('/api/search'));
	await page.getByRole('combobox', { name: 'Search films and series' }).fill('zzzz');
	await none;
	await expect(page.getByText('Nothing found for “zzzz”.')).toBeVisible();
	asked.length = 0;
	await page.getByRole('combobox', { name: 'Search films and series' }).fill('z');
	await page.waitForTimeout(600);
	expect(asked).toEqual([]);
});
