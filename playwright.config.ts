import { defineConfig } from '@playwright/test';

// Runs against `npm run dev` with made-up titles (TMDB_DEMO), never a deployed site.
// E2E_BASE_URL points it at an already running local server instead, e.g. the built Worker
// under `wrangler dev`.
const external = process.env.E2E_BASE_URL;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: external ?? 'http://localhost:5173',
		channel: process.env.CI ? undefined : 'chrome'
	},
	webServer: external
		? undefined
		: {
				command: 'npm run dev -- --port 5173 --strictPort',
				url: 'http://localhost:5173/version',
				reuseExistingServer: true,
				timeout: 120_000
			}
});
