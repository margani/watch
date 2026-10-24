import { describe, expect, it } from 'vitest';
import { readChoice, resolveTheme } from './themes.ts';

describe('themes', () => {
	it('reads stored choices, the old light/dark too', () => {
		expect(readChoice(null)).toBe('system');
		expect(readChoice('light')).toBe('paper');
		expect(readChoice('dark')).toBe('ink');
		expect(readChoice('sage')).toBe('sage');
		expect(readChoice('neon')).toBe('system');
	});

	it('follows the device only for system', () => {
		expect(resolveTheme('system', true)).toBe('ink');
		expect(resolveTheme('system', false)).toBe('paper');
		expect(resolveTheme('plum', true)).toBe('plum');
	});
});

describe('the early theme script in app.html', () => {
	it('knows the same themes and colours', async () => {
		const { readFileSync } = await import('node:fs');
		const html = readFileSync('src/app.html', 'utf8');
		const { THEME_COLOURS } = await import('./themes.ts');
		expect(html).toContain(`['${Object.keys(THEME_COLOURS).join("', '")}']`);
		for (const [t, c] of Object.entries(THEME_COLOURS)) expect(html).toContain(`${t}: '${c.bg}'`);
	});
});
