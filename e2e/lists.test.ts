import { expect, hydrated, signUp, test } from './helpers';

// The viewer's own lists, each in the order to watch it (#46).
test.use({ hasTouch: true });
test('lists of my own, in my own order, private to me', async ({ page, browser }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await signUp(page);
	// By id: 900001, 900002, 900003.
	const names = ['The Lighthouse Keeper’s Clock', 'Paper Comets', 'Lighthouse Road'];

	// Two titles on the main list, to pick from later.
	for (const id of ['900002', '900003']) {
		await page.goto(`/movie/${id}`);
		const put = page.waitForResponse(
			(r) => r.url().endsWith(`/api/movie/${id}`) && r.request().method() === 'PUT'
		);
		await page.getByRole('button', { name: 'Want to watch', exact: true }).click();
		expect((await put).status()).toBe(200);
	}

	// A new list made from a title page has that title on it; the title needn't be on the main list.
	await page.goto('/movie/900001');
	await page.getByRole('button', { name: 'New list' }).click();
	await expect(page.getByLabel('Name of the new list')).toBeFocused();
	await page.getByLabel('Name of the new list').fill('  Coast   marathon ');
	const made = page.waitForResponse(
		(r) => r.url().endsWith('/api/lists') && r.request().method() === 'POST'
	);
	await page.getByRole('button', { name: 'Make it' }).click();
	expect((await made).status()).toBe(201);
	await expect(page.getByRole('button', { name: 'Coast marathon' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// The Lists tab sits beside the status tabs.
	await page.goto('/');
	await page.getByRole('link', { name: /My lists/ }).click();
	await expect(page).toHaveURL(/\/lists$/);
	await hydrated(page);
	await page.getByRole('link', { name: /Coast marathon/ }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coast marathon');
	await hydrated(page);
	const listUrl = page.url();
	const rows = page.locator('main ol').getByRole('heading', { level: 2 });
	await expect(rows).toHaveText([names[0]]);

	// Add from the main list, with the filter: each goes to the end.
	const added = () =>
		page.waitForResponse((r) => r.url().endsWith('/titles') && r.request().method() === 'PUT');
	await page.getByLabel('Find a title on my list').fill('paper');
	await expect(page.getByRole('button', { name: /^Add / })).toHaveCount(1);
	let done = added();
	await page.getByRole('button', { name: `Add ${names[1]} to this list` }).click();
	expect((await done).status()).toBe(204);
	await page.getByLabel('Find a title on my list').fill('');
	done = added();
	await page.getByRole('button', { name: `Add ${names[2]} to this list` }).click();
	expect((await done).status()).toBe(204);
	await expect(rows).toHaveText(names);
	await expect(page.getByText('Everything on your main list is on this one.')).toBeVisible();

	// Hold the last and drag it to the top: it becomes number 1.
	const moved = () =>
		page.waitForResponse((r) => r.url().endsWith('/move') && r.request().method() === 'POST');
	const row = (title: string) =>
		page.locator('ol > li', { has: page.getByRole('heading', { name: title }) });
	const centre = async (title: string) => {
		const b = (await row(title).boundingBox())!;
		return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
	};
	done = moved();
	const from = await centre(names[2]);
	const to = await centre(names[0]);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.waitForTimeout(500);
	await page.mouse.move(to.x, to.y - 10, { steps: 8 });
	await page.mouse.up();
	expect(JSON.parse((await done).request().postData()!)).toEqual({
		media: 'movie',
		tmdbId: 900003,
		to: 0
	});
	expect((await done).status()).toBe(204);
	await expect(rows).toHaveText([names[2], names[0], names[1]]);
	await expect(row(names[2]).getByLabel('Number 1')).toBeVisible();
	await expect(page).toHaveURL(listUrl);

	// Keyboard: Alt and the arrow keys.
	done = moved();
	await row(names[1]).getByRole('link').focus();
	await page.keyboard.press('Alt+ArrowUp');
	expect((await done).status()).toBe(204);
	await expect(rows).toHaveText([names[2], names[1], names[0]]);
	await expect(row(names[1]).getByRole('link')).toBeFocused();

	// Kept after a reload, and the title page shows the list ticked.
	await page.reload();
	await expect(rows).toHaveText([names[2], names[1], names[0]]);
	await page.goto('/movie/900002');
	await expect(page.getByRole('button', { name: 'Coast marathon' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	// Taking it off from the title page.
	const off = page.waitForResponse(
		(r) => r.url().endsWith('/titles') && r.request().method() === 'DELETE'
	);
	await page.getByRole('button', { name: 'Coast marathon' }).click();
	expect((await off).status()).toBe(204);
	await page.goto(listUrl);
	await expect(rows).toHaveText([names[2], names[0]]);

	// Removing from the list page leaves the title on the main list.
	const removed = page.waitForResponse(
		(r) => r.url().endsWith('/titles') && r.request().method() === 'DELETE'
	);
	await page.getByRole('button', { name: `Remove ${names[2]} from this list` }).click();
	expect((await removed).status()).toBe(204);
	await expect(rows).toHaveText([names[0]]);
	await page.goto('/?tab=want');
	await expect(page.getByRole('heading', { name: names[2] })).toBeVisible();

	// The account export carries the list in its order.
	const exported = await page.request.get('/account/export');
	expect((await exported.json()).lists).toEqual([
		{
			name: 'Coast marathon',
			createdAt: expect.any(String),
			titles: [{ media: 'movie', tmdbId: 900001, title: names[0] }]
		}
	]);

	// Another account sees nothing of it and can change nothing.
	const listId = listUrl.split('/').pop();
	const other = await browser.newContext();
	const them = await other.newPage();
	await them.goto('/signup');
	await them.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await them.getByLabel('Name').fill('Other Viewer');
	await them.getByLabel('Email').fill(`other-${Date.now()}@example.com`);
	await them.getByLabel('Password').fill('correct horse battery');
	await them.getByRole('button', { name: 'Create account' }).click();
	await expect(them.getByRole('heading', { level: 1, name: 'Films and series' })).toBeAttached();
	expect((await them.goto(listUrl))!.status()).toBe(404);
	await them.goto('/lists');
	await expect(them.getByText('No lists yet')).toBeVisible();
	await them.goto('/movie/900001');
	await expect(them.getByRole('button', { name: 'Coast marathon' })).toHaveCount(0);
	const json = { 'content-type': 'application/json' };
	const title = JSON.stringify({ media: 'movie', tmdbId: 900002 });
	for (const [method, path, data] of [
		['PUT', 'titles', title],
		['DELETE', 'titles', JSON.stringify({ media: 'movie', tmdbId: 900001 })],
		['POST', 'move', JSON.stringify({ media: 'movie', tmdbId: 900001, to: 0 })]
	] as const)
		expect(
			(
				await them.request.fetch(`/api/lists/${listId}/${path}`, { method, headers: json, data })
			).status()
		).toBe(404);
	await other.close();
	await page.goto(listUrl);
	await expect(rows).toHaveText([names[0]]);

	// Rename, then delete.
	await page.getByText('Rename', { exact: true }).click();
	await page.getByLabel('New name').fill('Harbour nights');
	await page.getByRole('button', { name: 'Save' }).click();
	await hydrated(page);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Harbour nights');
	await page.getByText('Delete', { exact: true }).click();
	await page.getByRole('button', { name: 'Delete the list' }).click();
	await expect(page).toHaveURL(/\/lists$/);
	await expect(page.getByText('No lists yet')).toBeVisible();
});
