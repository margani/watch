import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TitleHit } from '#lib/watch.ts';

const pending: Promise<unknown>[] = [];
vi.mock('cloudflare:workers', () => ({
	env: {},
	waitUntil: (p: Promise<unknown>) => pending.push(p)
}));
const tmdb = vi.hoisted(() => ({ calls: [] as string[], open: 0, most: 0 }));
vi.mock('./tmdb.ts', () => ({
	tmdbDemo: () => false,
	tmdbLive: () => true,
	TmdbError: class extends Error {},
	fetchSeason: vi.fn(),
	fetchDetails: async (media: string, id: number) => {
		tmdb.calls.push(`${media}:${id}`);
		tmdb.most = Math.max(tmdb.most, ++tmdb.open);
		await new Promise((r) => setTimeout(r, 5));
		tmdb.open--;
		return { media, tmdbId: id };
	}
}));
// No Workers cache in tests: every warmed title asks TMDB.
vi.mock('./cache.ts', () => ({ cached: (_k: string, _s: number, load: () => unknown) => load() }));

const { warmTitles } = await import('./watchlist.ts');

const hit = (media: 'movie' | 'tv', tmdbId: number) =>
	({
		media,
		tmdbId,
		title: `${media} ${tmdbId}`,
		year: null,
		posterPath: null,
		overview: ''
	}) as TitleHit;
/** A db whose watch_titles holds these titles. */
const dbWith = (stored: { media: string; tmdbId: number }[]) =>
	({ select: () => ({ from: () => ({ where: async () => stored }) }) }) as never;

describe('warmTitles (#13)', () => {
	beforeEach(() => {
		tmdb.calls = [];
		tmdb.most = 0;
	});

	it('asks TMDB for shown titles not stored, each once, a few at a time', async () => {
		const hits = [hit('movie', 1), hit('tv', 1), hit('movie', 2), hit('movie', 1), hit('tv', 3)];
		hits.push(...Array.from({ length: 6 }, (_, i) => hit('movie', 100 + i)));
		await warmTitles(dbWith([{ media: 'movie', tmdbId: 2 }]), hits);
		expect(tmdb.calls.length).toBeGreaterThan(0);
		// movie:2 is stored; movie:1 shown twice is asked once; tv:1 is not movie:1.
		expect(tmdb.calls.sort()).toEqual(
			['movie:1', 'tv:1', 'tv:3', ...Array.from({ length: 6 }, (_, i) => `movie:${100 + i}`)].sort()
		);
		expect(tmdb.most).toBeLessThanOrEqual(4);
	});

	it('asks for at most 60 titles', async () => {
		await warmTitles(
			dbWith([]),
			Array.from({ length: 80 }, (_, i) => hit('tv', i + 1))
		);
		expect(tmdb.calls).toHaveLength(60);
	});

	it('does nothing without titles', async () => {
		await warmTitles(dbWith([]), []);
		expect(tmdb.calls).toHaveLength(0);
	});
});
