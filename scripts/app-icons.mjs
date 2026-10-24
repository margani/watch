// Writes the PWA icons in static/icons from the logo. Run once and commit the output.
import { chromium } from '@playwright/test';

const play =
	'<path d="M12.5 10.2v11.6c0 .8.9 1.3 1.6.9l9.3-5.8c.6-.4.6-1.3 0-1.7l-9.3-5.8c-.7-.5-1.6 0-1.6.8z" fill="#fff"/>';
// "any": the rounded logo as is. "maskable": a full square with the play sign inside the 80% safe
// zone, since launchers cut it to a circle or squircle themselves.
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0d7a6f"/>${play}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#0d7a6f"/><g transform="translate(16 16) scale(0.72) translate(-16 -16)">${play}</g></svg>`;
const icons = [
	['icon-192.png', any, 192],
	['icon-512.png', any, 512],
	['maskable-512.png', maskable, 512],
	// iOS rounds the corners itself and shows transparency as black.
	['apple-touch-icon.png', maskable, 180]
];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const [name, svg, size] of icons) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(
		`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`
	);
	await page.screenshot({ path: `static/icons/${name}`, omitBackground: true });
}
await browser.close();
console.log('Wrote static/icons');
