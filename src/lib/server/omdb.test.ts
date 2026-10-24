import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {} }));
const { otherRatings } = await import('./omdb.ts');

describe('otherRatings', () => {
	it('keeps Rotten Tomatoes and Metacritic, not IMDb or N/A', () => {
		// OMDb's answer for The Shawshank Redemption, 2026-10-23.
		expect(
			otherRatings({
				Ratings: [
					{ Source: 'Internet Movie Database', Value: '9.3/10' },
					{ Source: 'Rotten Tomatoes', Value: '89%' },
					{ Source: 'Metacritic', Value: 'N/A' }
				]
			})
		).toEqual([{ source: 'Rotten Tomatoes', value: '89%' }]);
		expect(otherRatings({ Response: 'False', Error: 'Incorrect IMDb ID.' })).toEqual([]);
	});
});
