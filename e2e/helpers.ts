// Shared by the e2e tests: a page fixture that waits for hydration, sign-up and local D1 access.
import { execFileSync } from 'node:child_process';
import { expect, test as base, type Page } from '@playwright/test';

export { expect };

// Every navigation waits for hydration, so clicks and selects are handled by the app.
export const test = base.extend({
	page: async ({ page }, use) => {
		const goto = page.goto.bind(page);
		page.goto = async (url, options) => {
			const res = await goto(url, options);
			await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
			return res;
		};
		await use(page);
	}
});

export const password = 'correct horse battery';
let n = 0;

export async function signUp(page: Page) {
	const email = `viewer-${Date.now()}-${n++}@example.com`;
	await page.goto('/signup');
	await page.getByLabel('Name').fill('Demo Viewer');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Films and series' })).toBeAttached();
	return email;
}

/** After a full page load (form POST, redirect), wait until the app handles input. */
export async function hydrated(page: Page) {
	await page.waitForLoadState();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

/**
 * Runs SQL against the local D1 the dev server uses. A separate wrangler process can find the
 * database locked while the dev server writes (SQLITE_BUSY failed a release run), so retry briefly.
 */
export function d1(sql: string): Record<string, number | string>[] {
	for (let attempt = 1; ; attempt++) {
		try {
			const out = execFileSync(
				'npx',
				['wrangler', 'd1', 'execute', 'DB', '--local', '--json', '--command', sql],
				{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
			);
			return JSON.parse(out)[0].results;
		} catch (e) {
			const err = e as { message?: string; stderr?: string; stdout?: string };
			const text = `${err.message} ${err.stderr} ${err.stdout}`;
			if (attempt >= 5 || !/SQLITE_BUSY|database is locked/.test(text)) throw e;
			execFileSync('sleep', ['0.5']);
		}
	}
}

/**
 * Rated episodes of the demo series, one of each band and enough seasons to be wider than a phone
 * (#52). The same rows every time: tests run in parallel on one local database.
 */
export function seedEpisodeRatings() {
	const rows: [string, number, number, number][] = [
		['tt9100101', 1, 1, 9.3],
		['tt9100102', 1, 2, 8.1],
		['tt9100103', 1, 3, 7.4],
		['tt9100201', 2, 1, 6.2],
		['tt9100202', 2, 2, 5.1],
		['tt9100203', 2, 3, 3.9]
	];
	for (let season = 3; season <= 12; season++) rows.push([`tt91${season + 10}001`, season, 1, 7.5]);
	d1(
		`INSERT OR REPLACE INTO imdb_ratings (imdb_id, rating, votes) VALUES ${rows
			.map(([id, , , rating]) => `('${id}', ${rating}, 1234)`)
			.join(',')}`
	);
	d1(
		`INSERT OR REPLACE INTO imdb_episodes (imdb_id, series_id, season, episode) VALUES ${rows
			.map(([id, season, episode]) => `('${id}', 'tt9000101', ${season}, ${episode})`)
			.join(',')}`
	);
}
