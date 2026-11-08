import { describe, expect, it } from 'vitest';
import { ratingBand, ratingsMatrix, type EpisodeRating } from './episode-ratings.ts';

const ep = (season: number, episode: number, rating: number, votes = 500): EpisodeRating => ({
	season,
	episode,
	imdbId: `tt${1000000 + season * 1000 + episode}`,
	rating,
	votes
});

describe('ratingBand', () => {
	it.each([
		[10, 'awesome'],
		[9, 'awesome'],
		[8.9, 'great'],
		[8, 'great'],
		[7.9, 'good'],
		[7, 'good'],
		[6.9, 'average'],
		[6, 'average'],
		[5.9, 'bad'],
		[5, 'bad'],
		[4.9, 'garbage'],
		[1, 'garbage']
	])('%f is %s', (rating, band) => {
		expect(ratingBand(rating)).toBe(band);
	});
});

describe('ratingsMatrix', () => {
	it('has nothing to show without rated episodes', () => {
		expect(ratingsMatrix([])).toBeNull();
	});

	it('puts seasons across and episodes down, in number order', () => {
		const m = ratingsMatrix([ep(2, 1, 7), ep(1, 2, 9), ep(1, 1, 8)])!;
		expect(m.seasons).toEqual([1, 2]);
		expect(m.rows.map((r) => r.episode)).toEqual([1, 2]);
		expect(m.rows[0].cells.map((c) => c?.rating)).toEqual([8, 7]);
		expect(m.rows[1].cells.map((c) => c?.rating)).toEqual([9, undefined]);
	});

	it('sorts numerically and leaves out seasons nobody rated', () => {
		const m = ratingsMatrix([ep(10, 10, 7), ep(2, 2, 7), ep(2, 1, 7)])!;
		expect(m.seasons).toEqual([2, 10]);
		expect(m.rows.map((r) => r.episode)).toEqual([1, 2, 10]);
	});

	it('averages each season over its rated episodes only', () => {
		const m = ratingsMatrix([ep(1, 1, 8), ep(1, 2, 9), ep(1, 3, 8.2), ep(2, 3, 6)])!;
		expect(m.averages).toEqual([8.4, 6]);
	});

	it('keeps the episode with more votes when IMDb numbers two the same', () => {
		const m = ratingsMatrix([ep(1, 1, 5, 150), ep(1, 1, 9, 4000), ep(1, 1, 6, 900)])!;
		expect(m.rows[0].cells[0]?.rating).toBe(9);
		expect(m.averages).toEqual([9]);
	});
});
