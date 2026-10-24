import { d1, expect, hydrated, signUp, test } from './helpers';

// Films and series, against the demo catalogue: there is no TMDB_TOKEN in tests.
test('watchlist: search, add, change status and rating, remove; private to the account', async ({
	page,
	browser
}) => {
	await signUp(page);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Films and series' })).toBeVisible();
	await expect(page.getByText('Demo titles: TMDB is not set up here')).toBeVisible();
	await expect(page.getByText('This product uses the TMDB API')).toBeVisible();

	await page.getByLabel('Search films and series').fill('lighthouse');
	await page.getByLabel('Search films and series').press('Enter');
	await expect(page).toHaveURL(/\/search\?q=lighthouse$/);
	const results = page.getByRole('list', { name: 'Results' }).getByRole('listitem');
	await expect(results).toHaveCount(2);

	await results.filter({ hasText: 'The Lighthouse Keeper’s Clock' }).getByRole('link').click();
	await expect(page).toHaveURL(/\/movie\/900001$/);
	await expect(
		page.getByRole('heading', { level: 1, name: 'The Lighthouse Keeper’s Clock' })
	).toBeVisible();
	await expect(page.getByText('Directed by Ada Penrose')).toBeVisible();

	const put = () =>
		page.waitForResponse(
			(r) => r.url().endsWith('/api/movie/900001') && r.request().method() === 'PUT'
		);
	let saved = put();
	await page.getByRole('button', { name: 'Want to watch' }).click();
	expect((await saved).status()).toBe(200);
	await expect(page.getByRole('button', { name: 'Want to watch' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	saved = put();
	await page.getByRole('button', { name: 'Watched' }).click();
	expect(await (await saved).json()).toMatchObject({ status: 'watched', rating: null });
	saved = put();
	await page.getByLabel('My rating').selectOption('8');
	expect(await (await saved).json()).toMatchObject({ status: 'watched', rating: 8 });

	// It is under Watched, with the rating, and nowhere else.
	await page.goto('/?tab=watched');
	const card = page.getByRole('link', { name: /The Lighthouse Keeper’s Clock/ });
	await expect(card).toBeVisible();
	await expect(card).toContainText('yours 8/10');
	await page.goto('/?tab=want');
	await expect(page.getByRole('link', { name: /The Lighthouse Keeper’s Clock/ })).toHaveCount(0);

	// A series being watched shows its next episode on the list.
	await page.goto('/tv/900101');
	const tvPut = page.waitForResponse(
		(r) => r.url().endsWith('/api/tv/900101') && r.request().method() === 'PUT'
	);
	await page.getByRole('button', { name: 'Watching' }).click();
	expect((await tvPut).status()).toBe(200);
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Watching 1' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByText('Next: S3 E7 · Spring Tide, 26 Oct 2026')).toBeVisible();

	// Someone else sees none of it.
	const other = await browser.newContext({ baseURL: new URL(page.url()).origin });
	const stranger = await other.newPage();
	await signUp(stranger);
	await stranger.goto('/?tab=watched');
	await expect(stranger.getByText('Nothing here yet')).toBeVisible();
	await stranger.goto('/movie/900001');
	await expect(stranger.getByRole('button', { name: 'Watched' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await other.close();

	// Removing it takes it off the list.
	await page.goto('/movie/900001');
	const removed = page.waitForResponse(
		(r) => r.url().endsWith('/api/movie/900001') && r.request().method() === 'DELETE'
	);
	await page.getByRole('button', { name: 'Remove from my list' }).click();
	expect((await removed).status()).toBe(204);
	await page.goto('/?tab=watched');
	await expect(page.getByText('Nothing here yet')).toBeVisible();
});

test('a new episode of a series being watched shows as news until it is seen', async ({
	page,
	browser
}) => {
	await signUp(page);
	await page.goto('/tv/900101');
	const put = page.waitForResponse(
		(r) => r.url().endsWith('/api/tv/900101') && r.request().method() === 'PUT'
	);
	await page.getByRole('button', { name: 'Watching' }).click();
	expect((await put).status()).toBe(200);

	// Someone who only wants to watch it gets no news of episodes.
	const other = await browser.newContext({ baseURL: new URL(page.url()).origin });
	const stranger = await other.newPage();
	await signUp(stranger);
	await stranger.goto('/tv/900101');
	// Not the fixture's page, so its goto doesn't wait for hydration; a click before it does nothing.
	await hydrated(stranger);
	const strangerPut = stranger.waitForResponse((r) => r.url().endsWith('/api/tv/900101'));
	await stranger.getByRole('button', { name: 'Want to watch' }).click();
	expect((await strangerPut).status()).toBe(200);

	// As if the details were kept a day ago, one episode before the one that has aired since.
	d1(
		"update watch_titles set details = json_set(details, '$.lastEpisode.number', 5), fetched_at = 0 where media = 'tv' and tmdb_id = 900101"
	);
	// The next view refreshes them and records what came out in between.
	await page.goto('/tv/900101');
	await page.goto('/');
	const news = page.getByRole('region', { name: 'New' });
	await expect(news).toContainText('Harbour Lights');
	await expect(news).toContainText('New episode: S3 E6 · Low Water, 12 Oct 2026');
	await expect(page.getByRole('link', { name: /^My list, 1 new$/ })).toBeVisible();

	await stranger.goto('/');
	await expect(stranger.getByRole('region', { name: 'New' })).toHaveCount(0);
	await other.close();

	const seen = page.waitForResponse((r) => r.url().endsWith('/api/news/seen'));
	await page.getByRole('button', { name: 'Mark all as seen' }).click();
	expect((await seen).status()).toBe(204);
	await expect(news).toHaveCount(0);
	await expect(page.getByRole('link', { name: /^My list, 1 new$/ })).toHaveCount(0);

	// The email switch is remembered.
	const setting = page.waitForResponse((r) => r.url().endsWith('/api/settings'));
	await page.getByLabel(/Email me when a series I am watching/).uncheck();
	expect((await setting).status()).toBe(204);
	await page.reload();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(page.getByLabel(/Email me when a series I am watching/)).not.toBeChecked();
});

test('the list tabs do not scroll up and down', async ({ page }) => {
	await signUp(page);
	await page.goto('/');
	// The tabs hang 1px below the row so their line covers its border; with overflow-x auto the row
	// then scrolled vertically and showed a scrollbar beside the tabs.
	const tabs = page.getByRole('navigation', { name: 'Watch lists' });
	await expect(tabs).toBeVisible();
	// The viewer can scroll it up and down only if overflow-y lets them and its content is taller.
	const scrollsUpAndDown = await tabs.evaluate(
		(n) =>
			['auto', 'scroll'].includes(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight
	);
	expect(scrollsUpAndDown).toBe(false);
});

test('streaming services: choose them, then see where a title streams', async ({ page }) => {
	await signUp(page);
	await page.goto('/');
	await page.getByRole('link', { name: 'Choose your streaming services' }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'Your streaming services' })
	).toBeVisible();
	await hydrated(page);

	// Another country shows its own services before anything is saved.
	await page.getByLabel('Country').selectOption('GB');
	await expect(page).toHaveURL(/country=GB/);
	const services = page.getByRole('list', { name: 'Services' });
	await services.getByRole('checkbox', { name: 'Netflix' }).check();
	await services.getByRole('checkbox', { name: 'Max' }).check();
	await page.getByLabel('Find a service').fill('max');
	await expect(services.getByRole('checkbox', { name: 'Netflix' })).toBeHidden();
	await page.getByRole('button', { name: 'Save', exact: true }).click();

	await expect(page).toHaveURL(/\/\?services=saved$/);
	await expect(page.getByText('Your services:')).toBeVisible();
	await expect(page.getByRole('img', { name: 'Netflix' })).toBeVisible();
	await expect(page.getByText('data by JustWatch')).toBeVisible();

	await page.goto('/movie/900001');
	const where = page.getByRole('region', { name: 'Where to watch' });
	await expect(where.getByText('On your services')).toBeVisible();
	await expect(where.getByText('Netflix')).toBeVisible();
	// Each service links to the title there: a search where the service's works.
	await expect(where.getByRole('link', { name: 'Netflix' })).toHaveAttribute(
		'href',
		'https://www.netflix.com/search?q=The%20Lighthouse%20Keeper%E2%80%99s%20Clock'
	);
	await expect(
		where.getByRole('link', { name: 'Amazon Prime Video: The Lighthouse Keeper’s Clock' })
	).toHaveAttribute('href', /^https:\/\/www\.primevideo\.com\/search\/\?phrase=/);
	await expect(
		where.getByRole('link', { name: 'Google Play Movies: The Lighthouse Keeper’s Clock' })
	).toBeVisible();

	// Disney Plus has the series in the UK; Max only in the US.
	await page.goto('/tv/900101');
	await expect(
		page.getByRole('region', { name: 'Where to watch' }).getByText('Not on any of your services.')
	).toBeVisible();

	// The list shows a title's logos from the viewer's services.
	await page.goto('/movie/900001');
	await hydrated(page);
	const saved = page.waitForResponse(
		(r) => r.url().endsWith('/api/movie/900001') && r.request().method() === 'PUT'
	);
	await page.getByRole('button', { name: 'Want to watch' }).click();
	expect((await saved).status()).toBe(200);
	await page.goto('/?tab=want');
	await expect(
		page.getByRole('group', { name: 'On your services' }).getByRole('img', { name: 'Netflix' })
	).toBeVisible();
});

test('episodes: tick them, the series moves to watching, then watched when all are seen', async ({
	page
}) => {
	await signUp(page);
	await page.goto('/tv/900102');
	await hydrated(page);
	const episodes = page.getByRole('region', { name: 'Episodes' });
	await expect(episodes.getByText('None watched yet')).toBeVisible();

	const put = () =>
		page.waitForResponse(
			(r) => r.url().endsWith('/api/tv/900102/episodes') && r.request().method() === 'PUT'
		);
	await episodes.getByText('Season 1', { exact: true }).click();
	const s1 = episodes.getByRole('list', { name: 'Season 1 episodes' });
	let saved = put();
	await s1.getByRole('checkbox', { name: /^1\. Episode 1/ }).check();
	expect((await saved).status()).toBe(200);
	await expect(episodes.getByText('1 of 40 episodes watched')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Watching', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	for (const n of [1, 2, 3, 4]) {
		if (n > 1) await episodes.getByText(`Season ${n}`, { exact: true }).click();
		saved = put();
		await episodes
			.locator('details', { hasText: `Season ${n}` })
			.getByRole('button', { name: 'Mark season as watched' })
			.click();
		expect((await saved).status()).toBe(200);
	}
	await expect(episodes.getByText('40 of 40 episodes watched')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Watched', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.goto('/?tab=watched');
	await expect(page.getByText('40 of 40 episodes watched')).toBeVisible();

	// An episode not out yet cannot be ticked (Harbour Lights S3E7).
	await page.goto('/tv/900101');
	await hydrated(page);
	await page
		.getByRole('region', { name: 'Episodes' })
		.getByText('Season 3', { exact: true })
		.click();
	await expect(
		page
			.getByRole('list', { name: 'Season 3 episodes' })
			.getByRole('checkbox', { name: /^7\. Spring Tide/ })
	).toBeDisabled();
});

test('import a Netflix viewing history: match, review, add', async ({ page }) => {
	await signUp(page);
	await page.goto('/');
	await page.getByRole('link', { name: 'Import from Netflix' }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'Import viewing history' })
	).toBeVisible();
	await hydrated(page);

	// Shaped like Netflix's "Download all" (UK dates).
	const csv = [
		'Title,Date',
		'"Harbour Lights: Season 3: Low Water","12/10/2026"',
		'"Harbour Lights: Season 1: Episode 2","13/01/2021"',
		'"Harbour Lights: Season 1: Episode 1","06/01/2021"',
		'"Paper Comets","22/10/2026"',
		'"Not A Real Film At All","21/10/2026"'
	].join('\n');
	await page.getByLabel('Netflix viewing activity (CSV)').setInputFiles({
		name: 'NetflixViewingHistory.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(csv)
	});

	const found = page.getByRole('list', { name: 'Titles found' });
	await expect(found.getByRole('listitem')).toHaveCount(3);
	await expect(
		found.getByRole('listitem').filter({ hasText: 'Not A Real Film At All' })
	).toContainText('not found');
	await expect(page.getByRole('checkbox', { name: 'Add Not A Real Film At All' })).toBeDisabled();
	await page.getByRole('button', { name: 'Add 2 to my list' }).click();
	await expect(page.getByText('Done.')).toBeVisible();
	await expect(found.getByRole('listitem').filter({ hasText: 'Harbour Lights' })).toContainText(
		'3 episodes ticked'
	);

	await page.goto('/?tab=watching');
	await expect(page.getByText('3 of 26 episodes watched')).toBeVisible();
	await page.goto('/?tab=watched');
	await expect(page.getByRole('heading', { name: 'Paper Comets' })).toBeVisible();
});

test('For you: newer films after seen ones, and popular titles on my services', async ({
	page
}) => {
	// IMDb's ratings come from its dataset, loaded nightly in production.
	d1(
		"INSERT INTO imdb_ratings (imdb_id, rating, votes) VALUES ('tt9000001', 7.8, 12345) ON CONFLICT(imdb_id) DO UPDATE SET rating = 7.8, votes = 12345"
	);
	await signUp(page);
	await page.goto('/for-you');
	await expect(page.getByRole('heading', { level: 1, name: 'For you' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Choose your streaming services' })).toBeVisible();

	await page.goto('/services?country=GB');
	await hydrated(page);
	await page.getByRole('checkbox', { name: 'Netflix' }).check();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/services=saved/);

	await page.goto('/movie/900002');
	await hydrated(page);
	const saved = page.waitForResponse(
		(r) => r.url().endsWith('/api/movie/900002') && r.request().method() === 'PUT'
	);
	await page.getByRole('button', { name: 'Watched', exact: true }).click();
	expect((await saved).status()).toBe(200);

	await page.goto('/');
	await page.getByRole('link', { name: 'For you' }).click();
	await hydrated(page);
	const newer = page.getByRole('region', { name: 'Newer films after ones you have seen' });
	await expect(newer.getByRole('heading', { name: 'Paper Comets 2' })).toBeVisible();
	await expect(newer.getByText('After Paper Comets')).toBeVisible();

	const popular = page.getByRole('region', { name: 'Popular films on your services' });
	await expect(
		popular.getByRole('heading', { name: 'The Lighthouse Keeper’s Clock' })
	).toBeVisible();
	await expect(
		popular.getByRole('listitem').filter({ hasText: 'The Lighthouse Keeper’s Clock' })
	).toContainText('IMDb 7.8');
	// What is on the list already is not suggested.
	await expect(popular.getByRole('heading', { name: 'Paper Comets', exact: true })).toHaveCount(0);
	const add = page.waitForResponse(
		(r) => r.url().endsWith('/api/movie/900001') && r.request().method() === 'PUT'
	);
	await popular
		.getByRole('button', { name: 'Want to watch The Lighthouse Keeper’s Clock' })
		.click();
	expect((await add).status()).toBe(200);
	await expect(popular.getByText('On my list')).toBeVisible();
	await expect(page.getByText('data by JustWatch')).toBeVisible();

	await page.goto('/?tab=want');
	await expect(page.getByRole('heading', { name: 'The Lighthouse Keeper’s Clock' })).toBeVisible();
	await expect(page.getByText('IMDb 7.8')).toBeVisible();
	await page.goto('/movie/900001');
	await expect(page.getByText('/10 on IMDb, 12,345 votes')).toBeVisible();
});

test('your own links show on title pages, only for you', async ({ page, browser }) => {
	await signUp(page);
	await page.goto('/services?country=GB');
	const box = page.getByRole('textbox', { name: 'Your own links' });
	await box.fill('No name https://example.com/{imdb}');
	await page.getByRole('button', { name: 'Save links' }).click();
	await expect(page.getByRole('alert')).toContainText('Give');
	// The answer is a new page: typing before it hydrates would be reset to the sent text.
	await hydrated(page);
	await box.fill(
		'My search | https://example.com/?s={imdb}\nBy title | https://example.org/find?q={title}'
	);
	await page.getByRole('button', { name: 'Save links' }).click();
	await expect(page.getByRole('status')).toHaveText('Links saved.');

	await page.goto('/movie/900001');
	const links = page.getByRole('list', { name: 'Your links' });
	await expect(links.getByRole('link', { name: 'My search' })).toHaveAttribute(
		'href',
		'https://example.com/?s=tt9000001'
	);
	await expect(links.getByRole('link', { name: 'By title' })).toHaveAttribute(
		'href',
		/^https:\/\/example\.org\/find\?q=The%20Lighthouse/
	);

	const other = await browser.newPage();
	await signUp(other);
	await other.goto('/movie/900001');
	await expect(other.getByRole('list', { name: 'Your links' })).toHaveCount(0);
	await other.close();
});
