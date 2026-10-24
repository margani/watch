/** Title for matching an imported name to TMDB's: ASCII, lower case, no subtitle, no leading article, words only. */
export function normTitle(t: string | null): string {
	let s = (t ?? '')
		.normalize('NFKD')
		.replace(/[\u0080-￿]/g, '')
		.toLowerCase();
	s = s
		.split(/[:([]/)[0]
		.trim()
		.replace(/^(the|a|an) /, '');
	return s.replace(/[^a-z0-9]+/g, ' ').trim();
}
