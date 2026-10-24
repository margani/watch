// Importing viewing history from a streaming service's own download. Netflix: Account →
// Profiles → a profile → Viewing activity → Download all gives a CSV of "Title","Date", where a
// series' episode is "Show: Season 2: Episode name". Read in the browser; only the titles to
// match go to the server, and nothing else from the file is kept.

/** Rows of a CSV file: quoted fields with "" for a quote, CRLF or LF, a BOM at the start. */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	const s = text.replace(/^\uFEFF/, '');
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (quoted) {
			if (c === '"' && s[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && s[i + 1] === '\n') i++;
			row.push(field);
			if (row.some((f) => f.trim())) rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	row.push(field);
	if (row.some((f) => f.trim())) rows.push(row);
	return rows;
}

export interface Viewing {
	title: string;
	/** YYYY-MM-DD, or null when the date could not be read. */
	date: string | null;
}

/**
 * Netflix writes dates in the account's locale: 10/22/26 in the US, 22/10/2026 in the UK. Day
 * first unless no first number is over 12 while a second one is.
 */
export function readDates(raw: string[]): (string | null)[] {
	const parts = raw.map((d) => d.trim().match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/));
	const iso = parts.some((p) => p && p[1].length === 4);
	const monthFirst =
		!iso &&
		parts.every((p) => !p || Number(p[1]) <= 12) &&
		parts.some((p) => p && Number(p[2]) > 12);
	return parts.map((p) => {
		if (!p) return null;
		const [yy, m, d] = iso
			? [p[1], p[2], p[3]]
			: monthFirst
				? [p[3], p[1], p[2]]
				: [p[3], p[2], p[1]];
		const y = yy.length === 2 ? `20${yy}` : yy;
		const date = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
		return Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31 ? date : null;
	});
}

/** The viewings in a Netflix CSV (header "Title","Date"; extra columns are ignored). */
export function netflixViewings(text: string): Viewing[] {
	const rows = parseCsv(text);
	if (!rows.length) return [];
	const head = rows[0].map((h) => h.trim().toLowerCase());
	const ti = head.indexOf('title');
	const di = head.indexOf('date');
	if (ti < 0) return [];
	const body = rows.slice(1).filter((r) => r[ti]?.trim());
	const dates = readDates(body.map((r) => (di >= 0 ? (r[di] ?? '') : '')));
	return body.map((r, i) => ({ title: r[ti].trim(), date: dates[i] }));
}

// What Netflix puts between a show's name and the episode's: "Season 2", "Limited Series",
// "Part 1", "Volume 3", "Chapter 4", "Book One", "Collection".
const SEASON =
	/^(?:season|series|part|volume|vol\.|chapter|book|collection)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b|^(limited series|miniseries|mini-series)$/i;
const WORDS: Record<string, number> = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface SeriesSeen {
	name: string;
	/** Episodes by season number (a limited series is season 1); names as Netflix gives them. */
	seasons: Record<number, { name: string; date: string | null }[]>;
	last: string | null;
}

export interface FilmSeen {
	title: string;
	date: string | null;
}

/**
 * Sorts viewings into series (with their episodes) and films. "Show: Season 2: Name" is an
 * episode; "Show: Name" counts as an episode only when the same show has other rows, since films
 * have colons too ("Mission: Impossible").
 */
export function groupViewings(views: Viewing[]): { series: SeriesSeen[]; films: FilmSeen[] } {
	const series = new Map<string, SeriesSeen>();
	const add = (name: string, season: number, episode: string, date: string | null) => {
		const s = series.get(name) ?? { name, seasons: {}, last: null };
		(s.seasons[season] ??= []).push({ name: episode, date });
		if (date && (!s.last || date > s.last)) s.last = date;
		series.set(name, s);
	};
	const loose: Viewing[] = [];
	for (const v of views) {
		const parts = v.title.split(': ');
		const show = parts[0].trim();
		const m = parts.length >= 3 ? SEASON.exec(parts[1].trim()) : null;
		// Netflix also names a season after the show: "Stranger Things: Stranger Things 4: …".
		const named =
			parts.length >= 3
				? new RegExp(`^${escape(show)}\\s+(\\d+)$`, 'i').exec(parts[1].trim())
				: null;
		if (m) {
			const n = m[2] ? 1 : /^\d+$/.test(m[1]) ? Number(m[1]) : WORDS[m[1].toLowerCase()];
			add(show, n, parts.slice(2).join(': ').trim(), v.date);
		} else if (named) add(show, Number(named[1]), parts.slice(2).join(': ').trim(), v.date);
		else loose.push(v);
	}
	const byShow = new Map<string, Viewing[]>();
	for (const v of loose) {
		const parts = v.title.split(': ');
		if (parts.length < 2) continue;
		const key = parts[0].trim();
		byShow.set(key, [...(byShow.get(key) ?? []), v]);
	}
	const films: FilmSeen[] = [];
	for (const v of loose) {
		const parts = v.title.split(': ');
		const key = parts[0].trim();
		if (parts.length >= 2 && (series.has(key) || (byShow.get(key)?.length ?? 0) > 1))
			add(key, 1, parts.slice(1).join(': ').trim(), v.date);
		else if (!films.some((f) => f.title === v.title)) films.push({ title: v.title, date: v.date });
		else {
			const f = films.find((x) => x.title === v.title)!;
			if (v.date && (!f.date || v.date > f.date)) f.date = v.date;
		}
	}
	return { series: [...series.values()], films };
}

const norm = (s: string) =>
	s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/^(episode|chapter|part)\s+\d+\s*[:.-]?\s*/, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

/**
 * Which episode of a season a name from the history is: the same name, else "Episode 4",
 * "Chapter 4" or "Part 4" by number. Null when nothing matches.
 */
export function episodeNumber(
	name: string,
	episodes: { number: number; name: string }[]
): number | null {
	const n = norm(name);
	const byName = n ? episodes.find((e) => norm(e.name) === n) : undefined;
	if (byName) return byName.number;
	const num = /^(?:episode|chapter|part|ep\.?)\s*(\d+)$/i.exec(name.trim());
	if (num && episodes.some((e) => e.number === Number(num[1]))) return Number(num[1]);
	return null;
}
