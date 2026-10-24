import { error, fail, redirect } from '@sveltejs/kit';
import { servicesIn, tmdbDemo, TmdbError, watchRegions } from '#lib/server/tmdb.ts';
import { formatOwnLinks, parseOwnLinks } from '#lib/watch.ts';
import {
	myServices,
	ownLinks,
	setOwnLinks,
	setServices,
	watchCountry
} from '#lib/server/watchlist.ts';
import type { Actions, PageServerLoad } from './$types';

// Before the viewer chooses, their country is where Cloudflare sees them, else the UK.
function guessCountry(request: Request) {
	const c = (request as Request & { cf?: { country?: unknown } }).cf?.country;
	return typeof c === 'string' && /^[A-Z]{2}$/.test(c) ? c : 'GB';
}

export const load: PageServerLoad = async ({ locals, url, request }) => {
	const userId = locals.user!.id;
	const saved = await watchCountry(locals.db, userId);
	// ?country= previews another country's services before saving.
	const asked = url.searchParams.get('country');
	try {
		const regions = await watchRegions();
		const pick = [asked, saved, guessCountry(request)].find(
			(c) => c && regions.some((r) => r.code === c)
		);
		const country = pick ?? regions[0]?.code ?? 'GB';
		return {
			country,
			saved: saved !== null,
			regions,
			services: await servicesIn(country),
			mine: (await myServices(locals.db, userId)).map((p) => p.id),
			links: formatOwnLinks(await ownLinks(locals.db, userId)),
			demo: tmdbDemo()
		};
	} catch (e) {
		if (e instanceof TmdbError) error(503, e.message);
		throw e;
	}
};

export const actions: Actions = {
	services: async ({ locals, request }) => {
		const form = await request.formData();
		const country = String(form.get('country') ?? '');
		const regions = await watchRegions();
		if (!regions.some((r) => r.code === country)) return fail(400, { error: 'Choose a country.' });
		// Only services TMDB lists for that country, with the name and logo it gives them.
		const ids = new Set(form.getAll('service').map(Number));
		const chosen = (await servicesIn(country)).filter((p) => ids.has(p.id));
		await setServices(locals.db, locals.user!.id, country, chosen);
		redirect(303, '/?services=saved');
	},
	links: async ({ locals, request }) => {
		const text = String((await request.formData()).get('links') ?? '');
		const r = parseOwnLinks(text);
		if ('error' in r) return fail(400, { linksError: r.error, links: text });
		await setOwnLinks(locals.db, locals.user!.id, r.links);
		return { linksSaved: true };
	}
};
