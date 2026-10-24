// The Worker's entry: SvelteKit's built handler for requests, plus the cron run that looks for new
// episodes and releases on everyone's lists and emails them. The adapter's own entry only has
// `fetch`, so it is wrapped here. The adapter writes its Worker to the `main` of the config it
// reads, so it gets its own (wrangler.kit.jsonc); with this file as its `main` a build
// overwrote it.
// The adapter writes this file during `npm run build`, and `npm run check` runs both before a
// build (CI) and after one, so neither an error nor @ts-expect-error fits every time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import kit from '../.svelte-kit/cloudflare/_worker.js';
import { getDb } from './lib/server/db/index.ts';
import { sendMail } from './lib/server/email.ts';
import { markNewsEmailed, pendingNewsMails, refreshWatchTitles } from './lib/server/watchlist.ts';

async function watchNews(db: ReturnType<typeof getDb>, env: Env) {
	const refreshed = await refreshWatchTitles(db);
	let sent = 0;
	for (const mail of await pendingNewsMails(db, env.ORIGIN)) {
		try {
			await sendMail(env.EMAIL, env.EMAIL_FROM, mail);
			await markNewsEmailed(db, mail.ids);
			sent++;
		} catch (e) {
			// Left unmarked, so the next run tries again; the news is on the list either way.
			console.log('news email failed', mail.userId, e instanceof Error ? e.message : e);
		}
	}
	return { ...refreshed, sent };
}

export default {
	fetch: (kit as ExportedHandler<Env>).fetch,
	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(
			watchNews(getDb(env.DB), env).then((r) => console.log('news', JSON.stringify(r)))
		);
	}
} satisfies ExportedHandler<Env>;
