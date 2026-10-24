// Service worker registration, the "new version" signal and the install prompt (#4).
interface InstallPrompt extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const pwa = $state<{ waiting: ServiceWorker | null; install: InstallPrompt | null }>({
	waiting: null,
	install: null
});

const UPDATE_CHECK_MS = 30 * 60 * 1000;
const RECHECK_MS = 60 * 1000;
let registration: ServiceWorkerRegistration | null = null;
let lastCheck = 0;

/** Keeps Chrome's install prompt for the account menu's "Install app" item. */
export function watchInstallPrompt() {
	addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		pwa.install = e as InstallPrompt;
	});
	addEventListener('appinstalled', () => (pwa.install = null));
}

export async function startPwa() {
	if (!('serviceWorker' in navigator)) return;
	const reg = await navigator.serviceWorker.register('/service-worker.js');
	// A worker waiting while another controls the page is a new version, not the first install.
	const offer = (w: ServiceWorker | null) => {
		if (w && navigator.serviceWorker.controller) pwa.waiting = w;
	};
	offer(reg.waiting);
	reg.addEventListener('updatefound', () => {
		const w = reg.installing;
		w?.addEventListener('statechange', () => w.state === 'installed' && offer(w));
	});
	// Only a new version taking over needs the reload. The first worker claiming the page changes
	// nothing on it, and reloading then threw away a form being filled in (sign-up, #4).
	let controlled = !!navigator.serviceWorker.controller;
	let reloading = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (!controlled) {
			controlled = true;
			return;
		}
		if (reloading) return;
		reloading = true;
		location.reload();
	});
	// Look for a new deploy now and then, and whenever the app comes back to the foreground. An
	// installed window that is only switched to never becomes hidden, and the app navigates
	// without loading pages, so the browser's own check rarely runs (Shelf waited 30 minutes).
	setInterval(() => reg.update().catch(() => {}), UPDATE_CHECK_MS);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') checkForUpdate();
	});
	addEventListener('focus', checkForUpdate);
	addEventListener('online', checkForUpdate);
	registration = reg;
}

/** Asks the browser for a new worker, at most once a minute; the layout calls it on navigation. */
export function checkForUpdate() {
	if (!registration || Date.now() - lastCheck < RECHECK_MS) return;
	lastCheck = Date.now();
	registration.update().catch(() => {});
}

/** Update was tapped: the waiting worker takes over and the page reloads. */
export async function applyUpdate() {
	// The worker waiting now, not the one the banner was shown for: another deploy since then
	// replaces it, and a message to the replaced one goes nowhere.
	const reg = await navigator.serviceWorker.getRegistration();
	const waiting = reg?.waiting ?? pwa.waiting;
	if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
	// Already taken over elsewhere (another tab updated): this page only needs the new files.
	else location.reload();
}

export async function installApp() {
	const prompt = pwa.install;
	if (!prompt) return;
	await prompt.prompt();
	await prompt.userChoice;
	pwa.install = null;
}
