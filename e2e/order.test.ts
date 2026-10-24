import { expect, signUp, test } from './helpers';

// The viewer's own order in each tab (#21).
test('titles can be put in my own order, and keep it', async ({ page }) => {
	await signUp(page);
	const add = async (path: string, status: 'Want to watch' | 'Watching') => {
		await page.goto(path);
		const put = page.waitForResponse(
			(r) => r.url().endsWith(`/api${path}`) && r.request().method() === 'PUT'
		);
		await page.getByRole('button', { name: status, exact: true }).click();
		expect((await put).status()).toBe(200);
	};
	await add('/movie/900001', 'Want to watch');
	await add('/movie/900002', 'Want to watch');
	await add('/movie/900003', 'Want to watch');

	await page.goto('/?tab=want');
	const rows = page.getByRole('list').last().getByRole('heading', { level: 2 });
	const names = ['Lighthouse Road', 'Paper Comets', 'The Lighthouse Keeper’s Clock'];
	// The newest on top to begin with.
	await expect(rows).toHaveText(names);
	await expect(page.getByRole('button', { name: 'Move up' })).toHaveCount(0);

	const moved = () =>
		page.waitForResponse((r) => r.url().endsWith('/move') && r.request().method() === 'POST');
	await page.getByRole('button', { name: 'Reorder' }).click();
	const controls = (title: string) => page.getByRole('group', { name: `Move ${title}` });
	let done = moved();
	await controls('The Lighthouse Keeper’s Clock')
		.getByRole('button', { name: 'To the top' })
		.click();
	expect((await done).status()).toBe(204);
	await expect(rows).toHaveText([names[2], names[0], names[1]]);
	done = moved();
	await controls('Paper Comets').getByRole('button', { name: 'Move up' }).click();
	expect((await done).status()).toBe(204);
	await expect(rows).toHaveText([names[2], names[1], names[0]]);
	await expect(controls(names[2]).getByRole('button', { name: 'Move up' })).toBeDisabled();
	await expect(controls(names[0]).getByRole('button', { name: 'Move down' })).toBeDisabled();

	// Kept after a reload.
	await page.reload();
	await expect(rows).toHaveText([names[2], names[1], names[0]]);

	// A rating leaves it in its place; moving to another tab puts it on top there.
	await page.goto('/movie/900003');
	const put = page.waitForResponse(
		(r) => r.url().endsWith('/api/movie/900003') && r.request().method() === 'PUT'
	);
	await page.getByLabel('My rating').selectOption('7');
	expect((await put).status()).toBe(200);
	await page.goto('/?tab=want');
	await expect(rows).toHaveText([names[2], names[1], names[0]]);

	await add('/tv/900101', 'Watching');
	await add('/movie/900002', 'Watching');
	await page.goto('/?tab=watching');
	await expect(rows).toHaveText(['Paper Comets', 'Harbour Lights']);
	await page.goto('/?tab=want');
	await expect(rows).toHaveText([names[2], names[0]]);
});
