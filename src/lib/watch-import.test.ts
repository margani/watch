import { describe, expect, it } from 'vitest';
import {
	episodeNumber,
	groupViewings,
	netflixViewings,
	parseCsv,
	readDates
} from './watch-import.ts';

describe('parseCsv', () => {
	it('reads quoted fields, doubled quotes, CRLF and a BOM', () => {
		expect(parseCsv('﻿"Title","Date"\r\n"Say ""hi"", Bob","1/2/26"\r\n\r\nplain,x')).toEqual([
			['Title', 'Date'],
			['Say "hi", Bob', '1/2/26'],
			['plain', 'x']
		]);
	});
});

describe('readDates', () => {
	it('reads UK and US dates, and ISO ones', () => {
		expect(readDates(['22/10/2026', '01/02/2025'])).toEqual(['2026-10-22', '2025-02-01']);
		expect(readDates(['10/22/26', '1/2/25'])).toEqual(['2026-10-22', '2025-01-02']);
		expect(readDates(['2026-10-22'])).toEqual(['2026-10-22']);
		expect(readDates(['yesterday', ''])).toEqual([null, null]);
	});
});

describe('netflixViewings and groupViewings', () => {
	// Shaped like Netflix's "Download all" (Title, Date), newest first.
	const csv = [
		'Title,Date',
		'"Stranger Things: Stranger Things 4: Chapter One: The Hellfire Club","5/28/22"',
		'"Stranger Things: Season 4: Chapter Two: Vecna\'s Curse","5/29/22"',
		'"The Queen\'s Gambit: Limited Series: Openings","10/24/20"',
		'"Mission: Impossible - Fallout","12/25/21"',
		'"Glass Onion: A Knives Out Mystery","12/23/22"',
		'"Arcane: Welcome to the Playground","11/7/21"',
		'"Arcane: Some Mysteries Are Better Left Unsolved","11/7/21"',
		'"The Irishman","11/30/19"',
		'"The Irishman","12/01/19"'
	].join('\n');

	it('sorts episodes into series and seasons, the rest into films', () => {
		const views = netflixViewings(csv);
		expect(views).toHaveLength(9);
		expect(views[0]).toEqual({
			title: 'Stranger Things: Stranger Things 4: Chapter One: The Hellfire Club',
			date: '2022-05-28'
		});
		const { series, films } = groupViewings(views);
		expect(series.map((s) => [s.name, Object.keys(s.seasons)])).toEqual([
			['Stranger Things', ['4']],
			["The Queen's Gambit", ['1']],
			['Arcane', ['1']]
		]);
		// "Stranger Things 4" names season 4 after the show.
		expect(series[0].seasons[4]).toEqual([
			{ name: 'Chapter One: The Hellfire Club', date: '2022-05-28' },
			{ name: "Chapter Two: Vecna's Curse", date: '2022-05-29' }
		]);
		expect(series[2].seasons[1].map((e) => e.name)).toEqual([
			'Welcome to the Playground',
			'Some Mysteries Are Better Left Unsolved'
		]);
		expect(films).toEqual([
			{ title: 'Mission: Impossible - Fallout', date: '2021-12-25' },
			{ title: 'Glass Onion: A Knives Out Mystery', date: '2022-12-23' },
			{ title: 'The Irishman', date: '2019-12-01' }
		]);
	});
});

describe('episodeNumber', () => {
	const season = [
		{ number: 1, name: 'Chapter One: The Hellfire Club' },
		{ number: 2, name: 'Chapter Two: Vecna’s Curse' },
		{ number: 3, name: 'Episode 3' }
	];
	it('matches by name, ignoring case, accents and punctuation, else by number', () => {
		expect(episodeNumber("Chapter Two: Vecna's Curse", season)).toBe(2);
		expect(episodeNumber('chapter one: the hellfire club', season)).toBe(1);
		expect(episodeNumber('Episode 3', season)).toBe(3);
		expect(episodeNumber('Episode 9', season)).toBeNull();
		expect(episodeNumber('Something else', season)).toBeNull();
	});
});
