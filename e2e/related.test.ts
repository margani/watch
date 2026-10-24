import { expect, signUp, test } from './helpers';

// A title's Related row (sequels, film series, spin-offs) and More like this (#31).
test('a title shows its related and similar titles, with my status', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await signUp(page);
	// The spin-off on my list first, so its row shows the status.
	await page.goto('/tv/900102');
	const saved = page.waitForResponse(
		(r) => r.url().endsWith('/api/tv/900102') && r.request().method() === 'PUT'
	);
	await page.getByRole('button', { name: 'Watching' }).click();
	expect((await saved).status()).toBe(200);

	await page.goto('/tv/900101');
	await expect(page.getByRole('heading', { level: 1, name: 'Harbour Lights' })).toBeVisible();
	const related = page.getByRole('list', { name: 'Related' });
	const orchard = related.getByRole('link', { name: /The Quiet Orchard/ });
	await expect(orchard).toContainText('Series · ');
	await expect(orchard).toContainText('Watching');
	const similar = page.getByRole('list', { name: 'More like this' });
	await expect(similar.getByRole('link', { name: /The Lighthouse Keeper’s Clock/ })).toBeVisible();
	// A title is in one row only, and never in its own.
	await expect(similar.getByRole('link', { name: /The Quiet Orchard/ })).toHaveCount(0);
	await expect(
		page
			.getByRole('list', { name: /Related|More like this/ })
			.getByRole('link', { name: /Harbour Lights/ })
	).toHaveCount(0);

	// A film's series; a tap opens it, and its own rows follow.
	await page.goto('/movie/900002');
	await page
		.getByRole('list', { name: 'Related' })
		.getByRole('link', { name: /Paper Comets 2/ })
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Paper Comets 2' })).toBeVisible();
	await expect(
		page.getByRole('list', { name: 'Related' }).getByRole('link', { name: /^Paper Comets Film/ })
	).toBeVisible();

	// No rows at all for a title with nothing related or similar.
	await page.goto('/movie/900003');
	const done = page.waitForResponse((r) => r.url().endsWith('/api/movie/900003/more'));
	await page.reload();
	expect((await done).status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'Related' })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'More like this' })).toHaveCount(0);
});
