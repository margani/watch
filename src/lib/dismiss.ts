// Popovers close on a click or tap outside them and on Escape. Clicks inside the EPUB
// viewer land in epub.js's iframe and never reach this window, so the viewer announces them
// with `dismissPopovers()`.

const EVENT = 'watch:dismiss';

export function dismissPopovers() {
	window.dispatchEvent(new Event(EVENT));
}

/**
 * Calls `close` on a pointer press outside `node`, on Escape, and when the viewer's book is
 * touched. Returns the cleanup.
 */
export function onDismiss(node: HTMLElement, close: () => void) {
	const pointer = (e: PointerEvent) => {
		if (!node.contains(e.target as Node)) close();
	};
	const key = (e: KeyboardEvent) => {
		if (e.key === 'Escape') close();
	};
	window.addEventListener('pointerdown', pointer);
	window.addEventListener('keydown', key);
	window.addEventListener(EVENT, close);
	return () => {
		window.removeEventListener('pointerdown', pointer);
		window.removeEventListener('keydown', key);
		window.removeEventListener(EVENT, close);
	};
}
