import { afterEach, describe, expect, it, vi } from 'vitest';
import { wikidataRelated } from './wikidata.ts';

afterEach(() => vi.unstubAllGlobals());

const answer = (bindings: Record<string, { value: string }>[]) =>
	new Response(JSON.stringify({ results: { bindings } }), {
		headers: { 'content-type': 'application/sparql-results+json' }
	});

describe('wikidataRelated', () => {
	it('asks for the title by its TMDB id and reads films and series, each once', async () => {
		const fetch = vi.fn<(url: URL) => Promise<Response>>(async () =>
			answer([
				{ t: { value: '71728' } },
				{ t: { value: '243875' } },
				{ t: { value: '71728' } },
				{ m: { value: '559969' } },
				{ m: { value: 'not a number' } }
			])
		);
		vi.stubGlobal('fetch', fetch);
		expect(await wikidataRelated('tv', 1418)).toEqual([
			{ media: 'tv', tmdbId: 71728 },
			{ media: 'tv', tmdbId: 243875 },
			{ media: 'movie', tmdbId: 559969 }
		]);
		const url = new URL(fetch.mock.calls[0][0]);
		const query = url.searchParams.get('query')!;
		expect(query).toContain('wdt:P4983 "1418"');
		// Spin-offs, and no pornographic parodies or fan films.
		expect(query).toContain('wdt:P2512');
		expect(query).toContain('wd:Q185529');
		expect(query).toContain('wd:Q2301591');
	});

	it('gives nothing when Wikidata fails, so the page just has no Related row', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('busy', { status: 429 }))
		);
		expect(await wikidataRelated('movie', 120)).toEqual([]);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('timed out');
			})
		);
		expect(await wikidataRelated('movie', 120)).toEqual([]);
	});
});
