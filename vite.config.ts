import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
// Workers Builds sets WORKERS_CI_COMMIT_SHA; locally fall back to git so /version always
// names a real commit.
function commit() {
	if (process.env.WORKERS_CI_COMMIT_SHA) return process.env.WORKERS_CI_COMMIT_SHA;
	try {
		return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
}

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		__APP_COMMIT__: JSON.stringify(commit())
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// The adapter builds from wrangler.kit.jsonc (it overwrites that file's `main`); dev
			// bindings and deploys use wrangler.jsonc, whose entry adds the cron.
			adapter: adapter({
				config: 'wrangler.kit.jsonc',
				platformProxy: { configPath: 'wrangler.jsonc' }
			}),
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': [
						'self',
						'data:',
						'https://*.googleusercontent.com',
						// Posters, stills and streaming-service logos.
						'https://image.tmdb.org'
					],
					'font-src': ['self', 'data:'],
					'connect-src': ['self'],
					'form-action': ['self', 'https://accounts.google.com'],
					'frame-ancestors': ['none'],
					'base-uri': ['self'],
					'object-src': ['none']
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts']
	}
});
