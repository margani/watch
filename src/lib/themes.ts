// Colour themes. The choice is kept per browser ('theme' in localStorage) and applied by the
// script in app.html before the first paint; 'system' follows the device's light or dark setting.

export const THEME_CHOICES = ['system', 'paper', 'ink', 'sage', 'plum'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type Theme = Exclude<ThemeChoice, 'system'>;

export const THEME_LABEL: Record<ThemeChoice, string> = {
	system: 'System',
	paper: 'Paper',
	ink: 'Ink',
	sage: 'Sage',
	plum: 'Plum'
};

/** Each theme's page background (theme-color) and accent, for the picker's swatches. */
export const THEME_COLOURS: Record<Theme, { bg: string; accent: string }> = {
	paper: { bg: '#f5f1e8', accent: '#a63d16' },
	ink: { bg: '#16130f', accent: '#f08a5d' },
	sage: { bg: '#eef2ea', accent: '#3a6340' },
	plum: { bg: '#f4eff6', accent: '#74348a' }
};

export const DARK_THEMES: ReadonlySet<Theme> = new Set(['ink']);

/** A stored value, including the light/dark of the first version, as a choice. */
export function readChoice(stored: string | null): ThemeChoice {
	if (stored === 'light') return 'paper';
	if (stored === 'dark') return 'ink';
	return (THEME_CHOICES as readonly string[]).includes(stored ?? '')
		? (stored as ThemeChoice)
		: 'system';
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
	return choice === 'system' ? (prefersDark ? 'ink' : 'paper') : choice;
}

/** Puts a theme on the page: data-theme for the colours, .dark for dark-only styles. */
export function applyTheme(root: HTMLElement, theme: Theme) {
	root.dataset.theme = theme;
	root.classList.toggle('dark', DARK_THEMES.has(theme));
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute('content', THEME_COLOURS[theme].bg);
}
