import type { Page } from '@playwright/test';
import { d1, expect, hydrated, signUp, test } from './helpers';

// #49: "Mark all as seen" was the only way to clear news, so seeing one item meant losing the rest.
// Each item has its own Seen, and news clears itself when the episode is ticked or the title is
// marked watched.

async function setStatus(page: Page, media: string, id: number, status: string) {
	await page.goto(`/${media}/${id}`);
	const put = page.waitForResponse(
		(r) => r.url().endsWith(`/api/${media}/${id}`) && r.request().method() === 'PUT'
	);
	await page.getByRole('button', { name: status, exact: true }).click();
	expect((await put).status()).toBe(200);
}

function addNews(
	email: string,
	media: string,
	tmdbId: number,
	kind: string,
	season: number,
	number: number,
	name: string
) {
	d1(
		`insert into watch_news (user_id, title_id, kind, season, number, name, air_date)
		 select u.id, t.id, '${kind}', ${season}, ${number}, '${name}', '2026-10-01'
		 from user u, watch_titles t where u.email = '${email}' and t.media = '${media}' and t.tmdb_id = ${tmdbId}`
	);
}

test('news: each item is seen on its own, and clears when the episode or title is watched', async ({
	page,
	browser
}) => {
	const email = await signUp(page);
	await setStatus(page, 'tv', 900101, 'Watching');
	await setStatus(page, 'movie', 900001, 'Want to watch');
	await setStatus(page, 'movie', 900002, 'Want to watch');
	addNews(email, 'tv', 900101, 'episode', 3, 6, 'Low Water');
	addNews(email, 'tv', 900101, 'episode', 3, 5, 'Fog Bank');
	addNews(email, 'movie', 900001, 'release', 0, 0, 'Out now');
	addNews(email, 'movie', 900002, 'release', 0, 0, 'Out now');

	await page.goto('/');
	const news = page.getByRole('region', { name: 'New' });
	const items = news.getByRole('listitem');
	await expect(items).toHaveCount(4);
	await expect(news.getByRole('button', { name: 'Mark all as seen' })).toBeVisible();

	// Seen on one item clears that one only, and it stays cleared.
	const seen = page.waitForResponse((r) => r.url().endsWith('/api/news/seen'));
	await items
		.filter({ hasText: 'Paper Comets' })
		.getByRole('button', { name: /^Seen: Paper Comets/ })
		.click();
	expect((await seen).status()).toBe(204);
	await expect(items).toHaveCount(3);
	await page.reload();
	await hydrated(page);
	await expect(items).toHaveCount(3);
	await expect(items.filter({ hasText: 'Paper Comets' })).toHaveCount(0);

	// Ticking an episode clears that episode's news, not the other one's.
	await page.goto('/tv/900101');
	const episodes = page.getByRole('region', { name: 'Episodes' });
	await episodes.getByText('Season 3', { exact: true }).click();
	const tick = page.waitForResponse(
		(r) => r.url().endsWith('/api/tv/900101/episodes') && r.request().method() === 'PUT'
	);
	await episodes
		.getByRole('list', { name: 'Season 3 episodes' })
		.getByRole('checkbox', { name: /Low Water/ })
		.check();
	expect((await tick).status()).toBe(200);
	await page.goto('/');
	await expect(items).toHaveCount(2);
	await expect(news).not.toContainText('Low Water');
	await expect(news).toContainText('Fog Bank');

	// Marking a title watched clears its news.
	await setStatus(page, 'movie', 900001, 'Watched');
	await page.goto('/');
	await expect(items).toHaveCount(1);
	await expect(news).not.toContainText('The Lighthouse Keeper’s Clock');
	// With one item left, its own Seen is enough.
	await expect(news.getByRole('button', { name: 'Mark all as seen' })).toHaveCount(0);

	// Someone else can't clear it by its id.
	const [{ id }] = d1(
		`select n.id from watch_news n join user u on u.id = n.user_id where u.email = '${email}' and n.seen_at is null`
	);
	const other = await browser.newContext({ baseURL: new URL(page.url()).origin });
	const stranger = await other.newPage();
	await signUp(stranger);
	const res = await stranger.request.post('/api/news/seen', { data: { ids: [id] } });
	expect(res.status()).toBe(204);
	await other.close();
	await page.reload();
	await hydrated(page);
	await expect(items).toHaveCount(1);

	// Bad ids are refused.
	expect((await page.request.post('/api/news/seen', { data: { ids: ['x'] } })).status()).toBe(400);

	await page.getByRole('button', { name: /^Seen: Harbour Lights/ }).click();
	await expect(news).toHaveCount(0);
	await expect(page.getByRole('link', { name: /new$/ })).toHaveCount(0);
});
