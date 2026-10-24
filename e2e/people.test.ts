import { expect, signUp, test } from './helpers';

// Cast with photos and links (#16), people's pages (#18, #20), trailers (#19), the lighter box (#17).
test('a title links its cast, director and composer to their pages, on the list or not', async ({
	page
}) => {
	await signUp(page);
	await page.goto('/tv/900101');
	// Harbour Lights is on the list; The Lighthouse Keeper's Clock is not.
	const put = page.waitForResponse(
		(r) => r.url().endsWith('/api/tv/900101') && r.request().method() === 'PUT'
	);
	await page.getByRole('button', { name: 'Watching', exact: true }).click();
	expect((await put).status()).toBe(200);

	// The status box: one line of three choices, then rating and remove on one row.
	const choices = page.getByRole('group', { name: 'Status' }).getByRole('button');
	await expect(choices).toHaveCount(3);
	const tops = await choices.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
	expect(new Set(tops).size).toBe(1);
	const rating = (await page.getByLabel('My rating').boundingBox())!;
	const remove = (await page.getByRole('button', { name: 'Remove from my list' }).boundingBox())!;
	expect(Math.abs(rating.y + rating.height / 2 - (remove.y + remove.height / 2))).toBeLessThan(4);

	await page.goto('/movie/900001');
	const cast = page.getByRole('link', { name: /^Milo Hart\s*Ewan$/ });
	await expect(cast).toHaveAttribute('href', '/person/910001');
	await cast.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Milo Hart' })).toBeVisible();
	await expect(page.getByText('a made-up actor')).toBeVisible();
	const films = page.getByRole('list', { name: 'Acting' }).getByRole('listitem');
	await expect(films).toHaveCount(2);
	// Every title they are in, the ones on the list marked.
	await expect(films.filter({ hasText: 'Harbour Lights' })).toContainText('Watching');
	await expect(films.filter({ hasText: 'Harbour Lights' })).toContainText('Finn');
	await expect(films.filter({ hasText: 'The Lighthouse Keeper’s Clock' })).toContainText('Ewan');
	await expect(films.filter({ hasText: 'The Lighthouse Keeper’s Clock' })).not.toContainText(
		'Watching'
	);
	await page.getByLabel('Order').selectOption('newest');
	await expect(films.first()).toContainText('Harbour Lights');

	await page.goto('/movie/900001');
	await page.getByRole('link', { name: 'Ada Penrose' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Ada Penrose' })).toBeVisible();
	await expect(page.getByRole('list', { name: 'Directing' }).getByRole('listitem')).toHaveCount(2);

	await page.goto('/movie/900001');
	await page.getByRole('link', { name: 'Noor Calder' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Noor Calder' })).toBeVisible();
	await expect(page.getByRole('list', { name: 'Music' }).getByRole('listitem')).toHaveText([
		/The Lighthouse Keeper’s Clock/
	]);
});

test('the trailer loads from YouTube only once play is tapped', async ({ page, context }) => {
	const youtube: string[] = [];
	await context.route(/youtube/, (route) => {
		youtube.push(route.request().url());
		return route.abort();
	});
	await signUp(page);
	await page.goto('/movie/900001');
	await expect(page.getByRole('button', { name: 'Play trailer' })).toBeVisible();
	expect(youtube).toEqual([]);
	await page.getByRole('button', { name: 'Play trailer' }).click();
	await expect(page.locator('iframe')).toHaveAttribute(
		'src',
		'https://www.youtube-nocookie.com/embed/demoTrailer01?autoplay=1&rel=0'
	);
	await page.getByRole('button', { name: 'Close trailer' }).click();
	await expect(page.locator('iframe')).toHaveCount(0);
	// A title without one has no button.
	await page.goto('/movie/900002');
	await expect(page.getByRole('heading', { level: 1, name: 'Paper Comets' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Play trailer' })).toHaveCount(0);
});
