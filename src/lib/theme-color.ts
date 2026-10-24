/**
 * Puts the page's own background into `<meta name="theme-color">`. The installed desktop app
 * paints the strip behind its window buttons with it, and the system's light/dark
 * setting chose it before, so a light page on a dark system had a dark strip. Call it
 * after anything that changes the page's colours: the theme button.
 */
export function syncThemeColor() {
	const meta = document.querySelector('meta[name="theme-color"]');
	meta?.setAttribute('content', getComputedStyle(document.documentElement).backgroundColor);
}
